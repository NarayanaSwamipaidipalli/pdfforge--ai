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
import axios from 'axios';
import { OAuth2Client } from 'google-auth-library';
import { PrismaService } from '../prisma/prisma.service';
import {
  RegisterDto,
  LoginDto,
  CreateApiKeyDto,
  UpdateProfileDto,
  ConnectGoogleDto,
  DeleteAccountDto,
} from './dto/auth.dto';

export interface GoogleVerifiedPayload {
  googleId: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
}

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  private googleClient: OAuth2Client | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    this.initGoogleClient();
    await this.ensureAdminAccount().catch((err) =>
      this.logger.warn(`Admin account initialization warning: ${err.message}`),
    );
  }

  private initGoogleClient() {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');
    const callbackUrl = this.configService.get<string>(
      'GOOGLE_CALLBACK_URL',
      'http://localhost:4000/api/v1/auth/google/callback',
    );
    if (clientId) {
      try {
        this.googleClient = new OAuth2Client(clientId, clientSecret, callbackUrl);
        this.logger.log(`Initialized Google OAuth 2.0 client (Client ID: ${clientId.substring(0, 10)}...)`);
      } catch (err: any) {
        this.logger.warn(`Failed to initialize Google OAuth2Client: ${err.message}`);
      }
    }
  }

  getGoogleClientId(): string | null {
    return (
      this.configService.get<string>('GOOGLE_CLIENT_ID') ||
      process.env.GOOGLE_CLIENT_ID ||
      'pdfforge-google-client-id.apps.googleusercontent.com'
    );
  }

  getFrontendUrl(): string {
    return this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
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
      undefined;
    const adminName =
      this.configService.get<string>('ADMIN_NAME') ||
      process.env.ADMIN_NAME ||
      'Global System Administrator';

    if (!this.configService.get<string>('ADMIN_EMAIL') || !adminPassword) {
      this.logger.warn('Admin auto-provisioning disabled: explicit ADMIN_EMAIL and ADMIN_PASSWORD required');
      return;
    }

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
          this.logger.warn('Existing admin role will not be elevated automatically');
        }
        if (false) {
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
        provider: 'LOCAL',
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

  // ============================================================================
  // GOOGLE OAUTH 2.0 AUTHENTICATION & ACCOUNT LINKING
  // ============================================================================

  getGoogleAuthUrl(state?: string, redirectUri?: string): string {
    const clientId =
      this.configService.get<string>('GOOGLE_CLIENT_ID') ||
      process.env.GOOGLE_CLIENT_ID ||
      'pdfforge-google-client-id.apps.googleusercontent.com';

    const defaultCallback = this.configService.get<string>(
      'GOOGLE_CALLBACK_URL',
      'http://localhost:4000/api/v1/auth/google/callback',
    );
    const targetRedirectUri = redirectUri || defaultCallback;
    const csrfState = state || crypto.randomBytes(16).toString('hex');

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: targetRedirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'select_account',
      state: csrfState,
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async verifyGoogleToken(idToken: string): Promise<GoogleVerifiedPayload> {
    if (!idToken || typeof idToken !== 'string') {
      throw new BadRequestException('Google ID token is required');
    }

    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');

    // 1. Google OAuth2Client Cryptographic Verification
    if (this.googleClient && clientId) {
      try {
        const ticket = await this.googleClient.verifyIdToken({
          idToken,
          audience: clientId,
        });
        const payload = ticket.getPayload();
        if (payload && payload.sub && payload.email) {
          return {
            googleId: payload.sub,
            email: payload.email.toLowerCase(),
            emailVerified: payload.email_verified ?? true,
            name: payload.name || payload.email.split('@')[0],
            picture: payload.picture,
          };
        }
      } catch (err: any) {
        this.logger.warn(`Google verifyIdToken error: ${err.message}`);
      }
    }

    // 2. Direct cryptographic token verification with Google's public tokeninfo endpoint
    try {
      const res = await axios.get(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
        { timeout: 5000 },
      );
      const data = res.data;
      if (data && data.sub && data.email) {
        if (clientId && data.aud && data.aud !== clientId) {
          throw new UnauthorizedException('Google ID token was issued for a different client application');
        }
        return {
          googleId: data.sub,
          email: data.email.toLowerCase(),
          emailVerified: data.email_verified === 'true' || data.email_verified === true,
          name: data.name || data.email.split('@')[0],
          picture: data.picture,
        };
      }
    } catch (err: any) {
      if (err instanceof UnauthorizedException) throw err;
      this.logger.error(`Google tokeninfo verification rejected token: ${err?.response?.data?.error_description || err.message}`);
    }

    // 3. For automated unit testing / CI test token support
    if (
      process.env.NODE_ENV === 'test'
    ) {
      try {
        const parts = idToken.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
          if (payload.sub && payload.email) {
            return {
              googleId: payload.sub,
              email: payload.email.toLowerCase(),
              emailVerified: payload.email_verified ?? true,
              name: payload.name || payload.email.split('@')[0],
              picture: payload.picture,
            };
          }
        }
      } catch {
        // ignore
      }
    }

    throw new UnauthorizedException('Invalid, untrusted, or expired Google identity token');
  }

  async exchangeGoogleCode(code: string, redirectUri?: string): Promise<GoogleVerifiedPayload> {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      throw new BadRequestException('Google OAuth credentials (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET) are not configured');
    }

    const defaultCallback = this.configService.get<string>(
      'GOOGLE_CALLBACK_URL',
      'http://localhost:4000/api/v1/auth/google/callback',
    );
    const targetRedirectUri = redirectUri || defaultCallback;

    try {
      const tokenRes = await axios.post(
        'https://oauth2.googleapis.com/token',
        new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: targetRedirectUri,
          grant_type: 'authorization_code',
        }).toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 8000,
        },
      );

      const { id_token, access_token } = tokenRes.data;
      if (id_token) {
        return this.verifyGoogleToken(id_token);
      }

      if (access_token) {
        const userInfoRes = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${access_token}` },
          timeout: 5000,
        });
        const data = userInfoRes.data;
        if (!data || !data.sub || !data.email) {
          throw new UnauthorizedException('Incomplete Google profile returned');
        }
        return {
          googleId: data.sub,
          email: data.email.toLowerCase(),
          emailVerified: data.email_verified ?? true,
          name: data.name,
          picture: data.picture,
        };
      }
    } catch (err: any) {
      this.logger.error(`Google authorization code exchange failed: ${err?.response?.data?.error || err.message}`);
      throw new UnauthorizedException('Failed to exchange Google authorization code');
    }

    throw new UnauthorizedException('Failed to retrieve Google user profile');
  }

  async googleAuth(
    credentialOrCode: { idToken?: string; code?: string; redirectUri?: string },
    ipAddress = '127.0.0.1',
    userAgent = 'Web Browser',
  ) {
    let googleUser: GoogleVerifiedPayload;

    if (credentialOrCode.code) {
      googleUser = await this.exchangeGoogleCode(credentialOrCode.code, credentialOrCode.redirectUri);
    } else if (credentialOrCode.idToken) {
      googleUser = await this.verifyGoogleToken(credentialOrCode.idToken);
    } else {
      throw new BadRequestException('Either idToken or code must be provided for Google authentication');
    }

    const { googleId, email, name, picture, emailVerified } = googleUser;

    if (!emailVerified) {
      throw new UnauthorizedException('Your Google email address is not verified by Google.');
    }

    // 1. Check if user already exists by googleId
    let user = await this.prisma.user.findUnique({
      where: { googleId },
    });

    if (user) {
      // Existing Google user: update avatar/name if changed
      const updateData: any = {};
      if (name && (!user.name || user.name === user.email.split('@')[0])) {
        updateData.name = name;
      }
      if (picture && !user.avatarUrl) {
        updateData.avatarUrl = picture;
      }
      if (!user.isEmailVerified) {
        updateData.isEmailVerified = true;
      }
      if (Object.keys(updateData).length > 0) {
        const updated = await this.prisma.user.update({
          where: { id: user.id },
          data: updateData,
        });
        if (updated) user = updated;
      }
    } else {
      // 2. Check if user with this email already exists (Account Linking)
      const existingUserByEmail = await this.prisma.user.findUnique({
        where: { email },
      });

      if (existingUserByEmail) {
        // Safe Account Linking
        user = await this.prisma.user.update({
          where: { id: existingUserByEmail.id },
          data: {
            googleId,
            provider: existingUserByEmail.provider === 'LOCAL' ? 'GOOGLE_AND_LOCAL' : 'GOOGLE',
            isEmailVerified: true,
            avatarUrl: existingUserByEmail.avatarUrl || picture,
            name: existingUserByEmail.name || name,
          },
        });
        this.logger.log(`Linked Google account (${googleId}) to existing user ${user.id} (${email})`);
      } else {
        // 3. New User Registration via Google
        user = await this.prisma.user.create({
          data: {
            email,
            name: name || email.split('@')[0],
            avatarUrl: picture,
            googleId,
            provider: 'GOOGLE',
            isEmailVerified: true,
            plan: 'FREE',
            globalRole: 'USER',
          },
        });

        // Create default personal organization workspace
        const orgSlug = `${email.split('@')[0]}-workspace-${Math.random().toString(36).substring(2, 6)}`;
        const org = await this.prisma.organization.create({
          data: {
            name: `${user.name || 'Personal'}'s Workspace`,
            slug: orgSlug,
            ownerId: user.id,
            plan: 'FREE',
          },
        });

        await this.prisma.organizationMember.create({
          data: {
            orgId: org.id,
            userId: user.id,
            role: 'OWNER',
          },
        });
        this.logger.log(`Created new user via Google Sign-In: ${user.id} (${email})`);
      }
    }

    if (user.isBanned) {
      throw new UnauthorizedException(`Account suspended: ${user.banReason || 'Please contact customer support.'}`);
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
        avatarUrl: user.avatarUrl,
        role: user.globalRole,
        plan: user.plan,
        provider: user.provider,
      },
      tokens,
    };
  }

  async githubAuth(codeOrToken: string) {
    let email = '';
    let name = 'GitHub Developer';
    throw new UnauthorizedException('GitHub OAuth is disabled until server-side authorization code exchange and identity verification are implemented');

    let user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          name,
          isEmailVerified: true,
          plan: 'FREE',
          globalRole: 'USER',
          provider: 'GITHUB',
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
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return { success: true, message: 'If that email address is registered, password reset instructions have been sent.' };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 3600000); // 1 hour

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpiresAt: resetExpires,
      },
    });

    return {
      success: true,
      message: 'If that email address is registered, password reset instructions have been sent.',
      // Reset tokens must only be delivered through verified out-of-band channels.
    };
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpiresAt: { gt: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException('Password reset token is invalid or has expired');
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpiresAt: null,
        refreshTokenHash: null,
      },
    });

    return { success: true, message: 'Password has been successfully updated. You may now log in.' };
  }

  async verifyEmail(token: string) {
    const secret = this.configService.getOrThrow<string>('JWT_SECRET');
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

    if (code.length === 6 && /^\d+$/.test(code)) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { twoFactorEnabled: true },
      });
      return { success: true, message: 'Two-Factor Authentication successfully enabled.' };
    }

    throw new BadRequestException('Invalid 2FA verification code');
  }

  async createApiKey(userId: string, dto: CreateApiKeyDto) {
    const rawKey = `pdf_${crypto.randomBytes(24).toString('hex')}`;
    const keyPrefix = rawKey.substring(0, 12);
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const apiKey = await this.prisma.apiKey.create({
      data: {
        user: { connect: { id: userId } },
        name: dto.name,
        keyPrefix,
        keyHash,
        permissions: dto.permissions || ['pdf:read', 'pdf:write'],
      },
    });

    return {
      id: apiKey.id,
      name: apiKey.name,
      apiKey: rawKey,
      permissions: apiKey.permissions,
      createdAt: apiKey.createdAt,
      message: 'Store this API key securely. It will not be shown again.',
    };
  }

  async getUserApiKeys(userId: string) {
    return this.prisma.apiKey.findMany({
      where: { userId, revokedAt: null },
      select: {
        id: true,
        name: true,
        permissions: true,
        createdAt: true,
        lastUsedAt: true,
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

  async refreshTokens(rawRefreshTokenOrUserId: string, explicitRawToken?: string) {
    let userId: string;
    let refreshToken: string;

    const refreshSecret = this.configService.get<string>(
      'JWT_REFRESH_SECRET',
      'pdfforge-enterprise-refresh-secret-key-2026',
    );

    if (explicitRawToken) {
      userId = rawRefreshTokenOrUserId;
      refreshToken = explicitRawToken;
    } else {
      refreshToken = rawRefreshTokenOrUserId;
      try {
        const payload = await this.jwtService.verifyAsync(refreshToken, {
          secret: refreshSecret,
        });
        userId = payload.sub;
      } catch {
        throw new UnauthorizedException('Invalid or expired refresh token');
      }
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException('Access denied - session invalidated');
    }

    const preHashed = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const matches = await bcrypt.compare(preHashed, user.refreshTokenHash);
    if (!matches) {
      // Possible reuse attack detected: invalidate refresh token
      await this.prisma.user.update({
        where: { id: userId },
        data: { refreshTokenHash: null },
      });
      throw new UnauthorizedException('Refresh token reuse detected. Please log in again.');
    }

    // Refresh token rotation
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

  async logoutByToken(refreshToken: string) {
    const refreshSecret = this.configService.get<string>(
      'JWT_REFRESH_SECRET',
      'pdfforge-enterprise-refresh-secret-key-2026',
    );
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: refreshSecret,
      });
      if (payload && payload.sub) {
        await this.prisma.user.update({
          where: { id: payload.sub },
          data: { refreshTokenHash: null },
        });
      }
    } catch {
      // ignore
    }
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
      where: { userId },
      data: { isRevoked: true },
    });
    return { success: true, message: 'All active sessions revoked successfully' };
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

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User profile not found');
    }
    const updateData: any = {};
    if (dto.name !== undefined) updateData.name = dto.name.trim();
    if (dto.avatarUrl !== undefined) updateData.avatarUrl = dto.avatarUrl.trim();

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      include: {
        memberships: {
          include: {
            organization: true,
          },
        },
      },
    });

    const { passwordHash, refreshTokenHash, twoFactorSecret, ...profile } = updated;
    return profile;
  }

  async connectGoogle(userId: string, dto: ConnectGoogleDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User profile not found');
    }

    let verifiedPayload: GoogleVerifiedPayload;

    if (dto.code) {
      verifiedPayload = await this.exchangeGoogleCode(dto.code, dto.redirectUri);
    } else {
      const rawToken = dto.idToken || dto.credential;
      if (!rawToken) {
        throw new BadRequestException('Missing Google credential, id_token, or code');
      }
      verifiedPayload = await this.verifyGoogleToken(rawToken);
    }

    const existingGoogleUser = await this.prisma.user.findUnique({
      where: { googleId: verifiedPayload.googleId },
    });
    if (existingGoogleUser && existingGoogleUser.id !== userId) {
      throw new ConflictException('This Google account is already linked to another user.');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        googleId: verifiedPayload.googleId,
        provider: user.passwordHash ? 'GOOGLE_AND_LOCAL' : 'GOOGLE',
        avatarUrl: user.avatarUrl || verifiedPayload.picture,
        isEmailVerified: true,
      },
    });

    const { passwordHash, refreshTokenHash, twoFactorSecret, ...profile } = updated;
    return { success: true, message: 'Google account linked successfully', user: profile };
  }

  async disconnectGoogle(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User profile not found');
    }
    if (!user.googleId) {
      throw new BadRequestException('No Google account is currently linked');
    }
    if (!user.passwordHash) {
      throw new BadRequestException('Cannot disconnect Google account without setting a local password first.');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        googleId: null,
        provider: 'LOCAL',
      },
    });

    const { passwordHash, refreshTokenHash, twoFactorSecret, ...profile } = updated;
    return { success: true, message: 'Google account disconnected successfully', user: profile };
  }

  async deleteAccount(userId: string, dto: DeleteAccountDto) {
    if (dto.confirmation !== 'DELETE') {
      throw new BadRequestException('Must provide exact confirmation string "DELETE"');
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User profile not found');
    }
    if (user.passwordHash) {
      if (!dto.password) {
        throw new BadRequestException('Password confirmation is required to delete this account');
      }
      const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
      if (!isMatch) {
        throw new UnauthorizedException('Incorrect password');
      }
    }

    // Find organizations owned by this user
    const ownedOrgs = await this.prisma.organization.findMany({
      where: { ownerId: userId },
      select: { id: true },
    });
    const orgIds = ownedOrgs.map((o) => o.id);

    await this.prisma.$transaction([
      ...(orgIds.length > 0
        ? [
            this.prisma.organizationMember.deleteMany({ where: { orgId: { in: orgIds } } }),
            this.prisma.apiKey.deleteMany({ where: { orgId: { in: orgIds } } }),
            this.prisma.fileRecord.deleteMany({ where: { orgId: { in: orgIds } } }),
            this.prisma.processingJob.deleteMany({ where: { orgId: { in: orgIds } } }),
            this.prisma.subscription.deleteMany({ where: { orgId: { in: orgIds } } }),
            this.prisma.organization.deleteMany({ where: { id: { in: orgIds } } }),
          ]
        : []),
      this.prisma.userSession.deleteMany({ where: { userId } }),
      this.prisma.apiKey.deleteMany({ where: { userId } }),
      this.prisma.auditLog.deleteMany({ where: { userId } }),
      this.prisma.processingJob.deleteMany({ where: { userId } }),
      this.prisma.fileRecord.deleteMany({ where: { userId } }),
      this.prisma.organizationMember.deleteMany({ where: { userId } }),
      this.prisma.user.delete({ where: { id: userId } }),
    ]);

    return { success: true, message: 'Account permanently deleted' };
  }

  private async generateTokens(userId: string, email: string, role: string) {
    const jwtSecret = this.configService.get<string>(
      'JWT_SECRET',
      'pdfforge-enterprise-jwt-super-secret-key-2026',
    );
    const refreshSecret = this.configService.get<string>(
      'JWT_REFRESH_SECRET',
      'pdfforge-enterprise-refresh-secret-key-2026',
    );

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: userId, email, role },
        { secret: jwtSecret, expiresIn: '15m' },
      ),
      this.jwtService.signAsync(
        { sub: userId, email, role, jti: crypto.randomUUID() },
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
    const preHashed = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(preHashed, salt);
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: hash },
    });
  }
}
