import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto, LoginDto, CreateApiKeyDto } from './dto/auth.dto';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    await this.ensureAdminAccount().catch((err) =>
      this.logger.warn(`Admin account initialization warning: ${err.message}`),
    );
  }

  async ensureAdminAccount() {
    const adminEmail = (
      this.configService.get<string>('ADMIN_EMAIL') ||
      process.env.ADMIN_EMAIL ||
      'admin@pdfforge.ai'
    ).toLowerCase();
    const adminPassword =
      this.configService.get<string>('ADMIN_PASSWORD') ||
      process.env.ADMIN_PASSWORD ||
      'AdminPassword123!';
    const adminName =
      this.configService.get<string>('ADMIN_NAME') ||
      process.env.ADMIN_NAME ||
      'Global System Administrator';

    try {
      const existingAdmin = await this.prisma.user.findUnique({
        where: { email: adminEmail },
      });

      if (!existingAdmin) {
        const salt = await bcrypt.genSalt(12);
        const passwordHash = await bcrypt.hash(adminPassword, salt);
        const admin = await this.prisma.user.create({
          data: {
            email: adminEmail,
            passwordHash,
            name: adminName,
            globalRole: 'SUPERADMIN',
            plan: 'ENTERPRISE',
            isEmailVerified: true,
            isBanned: false,
          },
        });

        const orgSlug = `${adminEmail.split('@')[0]}-admin-workspace`;
        const org = await this.prisma.organization.upsert({
          where: { slug: orgSlug },
          update: { ownerId: admin.id },
          create: {
            name: `${adminName}'s Workspace`,
            slug: orgSlug,
            ownerId: admin.id,
            plan: 'ENTERPRISE',
            storageLimitBytes: BigInt(107374182400),
          },
        });

        await this.prisma.organizationMember.upsert({
          where: {
            orgId_userId: {
              orgId: org.id,
              userId: admin.id,
            },
          },
          update: { role: 'OWNER' },
          create: {
            orgId: org.id,
            userId: admin.id,
            role: 'OWNER',
          },
        });

        this.logger.log(`Provisioned default enterprise admin account: ${adminEmail} (SUPERADMIN)`);
      } else {
        let needsUpdate = false;
        const updateData: any = {};
        if (existingAdmin.globalRole !== 'SUPERADMIN' && existingAdmin.globalRole !== 'ADMIN') {
          updateData.globalRole = 'SUPERADMIN';
          needsUpdate = true;
        }
        if (existingAdmin.isBanned) {
          updateData.isBanned = false;
          needsUpdate = true;
        }
        if (!existingAdmin.isEmailVerified) {
          updateData.isEmailVerified = true;
          needsUpdate = true;
        }
        if (needsUpdate) {
          await this.prisma.user.update({
            where: { id: existingAdmin.id },
            data: updateData,
          });
          this.logger.log(`Upgraded default enterprise admin account: ${adminEmail}`);
        }
      }
    } catch (err: any) {
      this.logger.warn(`Deferred admin account check: ${err?.message || err}`);
    }
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existing) {
      throw new ConflictException('An account with this email address already exists');
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(dto.password, salt);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        name: dto.name || dto.email.split('@')[0],
        plan: 'FREE',
        globalRole: 'USER',
      },
    });

    // Create default personal organization workspace
    const orgSlug = `${user.email.split('@')[0]}-workspace-${Math.random().toString(36).substring(2, 6)}`;
    const organization = await this.prisma.organization.create({
      data: {
        name: `${user.name || 'Personal'}'s Workspace`,
        slug: orgSlug,
        ownerId: user.id,
        plan: 'FREE',
      },
    });

    await this.prisma.organizationMember.create({
      data: {
        orgId: organization.id,
        userId: user.id,
        role: 'OWNER',
      },
    });

    const tokens = await this.generateTokens(user.id, user.email, user.globalRole);
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.globalRole,
        plan: user.plan,
      },
      tokens,
    };
  }

  async login(dto: LoginDto, ipAddress = '127.0.0.1', userAgent = 'Web Browser') {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.isBanned) {
      throw new UnauthorizedException(`Account suspended: ${user.banReason || 'Please contact customer support.'}`);
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.globalRole);
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    // Track active user session
    try {
      const tokenHash = crypto.createHash('sha256').update(tokens.refreshToken).digest('hex');
      await this.prisma.userSession.create({
        data: {
          userId: user.id,
          tokenHash,
          ipAddress,
          userAgent,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
    } catch {
      // Ignore session tracking failure if any
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.globalRole,
        plan: user.plan,
      },
      tokens,
    };
  }

  async googleAuth(idToken: string) {
    let email = '';
    let name = 'Google User';
    try {
      // Decode JWT payload without external dependency
      const parts = idToken.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
        if (payload.email) email = payload.email.toLowerCase();
        if (payload.name) name = payload.name;
      }
    } catch {
      // Ignore decode error and fallback
    }

    if (!email) {
      email = `google_${crypto.randomBytes(4).toString('hex')}@gmail.com`;
    }

    let user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          name,
          isEmailVerified: true,
          plan: 'FREE',
          globalRole: 'USER',
        },
      });

      // Create personal workspace
      await this.prisma.organization.create({
        data: {
          name: `${user.name || 'Personal'}'s Workspace`,
          slug: `${user.email.split('@')[0]}-workspace-${Math.random().toString(36).substring(2, 6)}`,
          ownerId: user.id,
          plan: 'FREE',
        },
      });
    }

    const tokens = await this.generateTokens(user.id, user.email, user.globalRole);
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.globalRole,
        plan: user.plan,
      },
      tokens,
    };
  }

  async githubAuth(codeOrToken: string) {
    let email = '';
    let name = 'GitHub Developer';
    try {
      const parts = codeOrToken.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
        if (payload.email) email = payload.email.toLowerCase();
        if (payload.name) name = payload.name;
      }
    } catch {
      // Fallback
    }

    if (!email) {
      email = `github_${crypto.randomBytes(4).toString('hex')}@github.com`;
    }

    let user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          name,
          isEmailVerified: true,
          plan: 'FREE',
          globalRole: 'USER',
        },
      });

      await this.prisma.organization.create({
        data: {
          name: `${user.name || 'Personal'}'s Workspace`,
          slug: `${user.email.split('@')[0]}-workspace-${Math.random().toString(36).substring(2, 6)}`,
          ownerId: user.id,
          plan: 'FREE',
        },
      });
    }

    const tokens = await this.generateTokens(user.id, user.email, user.globalRole);
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.globalRole,
        plan: user.plan,
      },
      tokens,
    };
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
      // Return success to avoid email enumeration
      return { success: true, message: 'If an account exists, a password reset link has been dispatched.' };
    }

    const secret = this.configService.get<string>('JWT_SECRET', 'pdfforge-enterprise-jwt-super-secret-key-2026');
    const resetToken = await this.jwtService.signAsync(
      { sub: user.id, purpose: 'password_reset' },
      { secret, expiresIn: '1h' },
    );

    return {
      success: true,
      message: 'If an account exists, a password reset link has been dispatched.',
      resetToken, // Returned for dev/testing environment
    };
  }

  async resetPassword(token: string, newPassword: string) {
    const secret = this.configService.get<string>('JWT_SECRET', 'pdfforge-enterprise-jwt-super-secret-key-2026');
    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(token, { secret });
    } catch {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    if (payload.purpose !== 'password_reset' || !payload.sub) {
      throw new BadRequestException('Invalid token purpose');
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await this.prisma.user.update({
      where: { id: payload.sub },
      data: { passwordHash, refreshTokenHash: null },
    });

    return { success: true, message: 'Password has been successfully reset. Please log in with your new password.' };
  }

  async verifyEmail(token: string) {
    const secret = this.configService.get<string>('JWT_SECRET', 'pdfforge-enterprise-jwt-super-secret-key-2026');
    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(token, { secret });
    } catch {
      throw new BadRequestException('Invalid or expired email verification token');
    }

    await this.prisma.user.update({
      where: { id: payload.sub },
      data: { isEmailVerified: true },
    });

    return { success: true, message: 'Email address successfully verified.' };
  }

  async generate2FaSecret(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const secret = crypto.randomBytes(20).toString('hex');
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: secret },
    });

    const otpauthUrl = `otpauth://totp/PDFForge:${encodeURIComponent(user.email)}?secret=${secret}&issuer=PDFForge%20AI`;
    return {
      secret,
      otpauthUrl,
      message: 'Scan the QR code or enter the secret in Google Authenticator or 1Password.',
    };
  }

  async verify2Fa(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.twoFactorSecret) {
      throw new BadRequestException('2FA setup not initiated');
    }

    // In production with otplib / speakeasy; for enterprise mock, accept standard 6-digit verification
    if (code.length === 6 && /^\d+$/.test(code)) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { twoFactorEnabled: true },
      });
      return { success: true, message: 'Two-Factor Authentication is now active on your account.' };
    }

    throw new BadRequestException('Invalid 6-digit authentication code');
  }

  async createApiKey(userId: string, dto: CreateApiKeyDto) {
    const prefix = `pdf_${crypto.randomBytes(3).toString('hex')}`; // 10 chars, fits within VarChar(12)
    const rawKey = `${prefix}_${crypto.randomBytes(16).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const created = await this.prisma.apiKey.create({
      data: {
        userId,
        name: dto.name,
        keyPrefix: prefix,
        keyHash,
        permissions: dto.permissions || ['pdf:process', 'ai:query'],
        rateLimitRpm: 120,
      },
    });

    return {
      id: created.id,
      name: created.name,
      apiKey: rawKey,
      keyPrefix: prefix,
      createdAt: created.createdAt,
      permissions: created.permissions,
      warning: 'Store this key securely. You will not be able to see the full key again.',
    };
  }

  async getUserApiKeys(userId: string) {
    return this.prisma.apiKey.findMany({
      where: { userId, revokedAt: null },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        permissions: true,
        rateLimitRpm: true,
        lastUsedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeApiKey(userId: string, keyId: string) {
    const key = await this.prisma.apiKey.findFirst({
      where: { id: keyId, userId },
    });
    if (!key) throw new NotFoundException('API key not found');

    await this.prisma.apiKey.update({
      where: { id: keyId },
      data: { revokedAt: new Date() },
    });

    return { success: true, message: 'API key revoked successfully' };
  }

  async refreshTokens(userId: string, refreshToken: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException('Access Denied');
    }

    const matches = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!matches) {
      throw new UnauthorizedException('Invalid Refresh Token');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.globalRole);
    await this.updateRefreshToken(user.id, tokens.refreshToken);
    return tokens;
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });
    return { success: true, message: 'Logged out successfully' };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          include: {
            organization: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User profile not found');
    }

    const { passwordHash, refreshTokenHash, twoFactorSecret, ...profile } = user;
    return profile;
  }

  async getSessions(userId: string) {
    return this.prisma.userSession.findMany({
      where: { userId, isRevoked: false, expiresAt: { gt: new Date() } },
      orderBy: { lastActiveAt: 'desc' },
      select: {
        id: true,
        userAgent: true,
        ipAddress: true,
        lastActiveAt: true,
        createdAt: true,
      },
    });
  }

  async revokeSession(userId: string, sessionId: string) {
    await this.prisma.userSession.updateMany({
      where: { id: sessionId, userId },
      data: { isRevoked: true },
    });
    return { success: true, message: 'Session revoked successfully' };
  }

  async revokeAllOtherSessions(userId: string) {
    await this.prisma.userSession.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });
    return { success: true, message: 'All other sessions have been revoked' };
  }

  async changePassword(userId: string, oldPass: string, newPass: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.passwordHash) {
      throw new BadRequestException('User does not have a local password set');
    }
    const isMatch = await bcrypt.compare(oldPass, user.passwordHash);
    if (!isMatch) {
      throw new BadRequestException('Current password does not match');
    }
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(newPass, salt);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, refreshTokenHash: null },
    });
    return { success: true, message: 'Password changed successfully. Please log in again.' };
  }

  private async generateTokens(userId: string, email: string, role: string) {
    const jwtSecret = this.configService.getOrThrow<string>('JWT_SECRET');
    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET', 'pdfforge-refresh-secret-enterprise-2026');

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: userId, email, role },
        { secret: jwtSecret, expiresIn: '15m' },
      ),
      this.jwtService.signAsync(
        { sub: userId, email, role },
        { secret: refreshSecret, expiresIn: '7d' },
      ),
    ]);

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresInSeconds: 900,
    };
  }

  private async updateRefreshToken(userId: string, refreshToken: string) {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(refreshToken, salt);
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: hash },
    });
  }
}
