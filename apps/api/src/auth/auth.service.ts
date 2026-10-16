import { Injectable, UnauthorizedException, ConflictException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

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

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password');
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

  async googleAuth(idToken: string) {
    // In production, verify idToken with Google OAuth2Client
    // Decode and fetch or upsert user
    const mockEmail = `google_user_${Math.random().toString(36).substring(2, 7)}@gmail.com`;
    let user = await this.prisma.user.findUnique({ where: { email: mockEmail } });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: mockEmail,
          name: 'Google User',
          isEmailVerified: true,
          plan: 'FREE',
        },
      });
    }

    const tokens = await this.generateTokens(user.id, user.email, user.globalRole);
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return { user, tokens };
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

  private async generateTokens(userId: string, email: string, role: string) {
    const jwtSecret = this.configService.get<string>('JWT_SECRET', 'pdfforge-enterprise-jwt-super-secret-key-2026');
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
