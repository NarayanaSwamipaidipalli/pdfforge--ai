import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import axios from 'axios';
import { OAuth2Client } from 'google-auth-library';
import { PrismaService } from '../prisma/prisma.service';
import { effectivePlan } from '../common/effective-plan';
import { TOKEN_ISSUER, TOKEN_AUDIENCE, tokenVerificationOptions, validTokenClaims } from './token-policy';
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
    // Administrator provisioning is an explicit operator action, never a server startup side effect.
    this.initGoogleClient();
  }

  private initGoogleClient() {
    const clientId = this.getGoogleClientId();
    if (clientId) this.googleClient = new OAuth2Client(clientId);
  }

  getGoogleClientId(): string | null {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID')?.trim();
    return clientId && !clientId.startsWith('pdfforge-google-client-id') ? clientId : null;
  }

  getFrontendUrl(): string {
    return this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000').replace(/\/$/, '');
  }

  private googleRedirectUri(requested?: string): string {
    const callback = this.configService.get<string>('GOOGLE_CALLBACK_URL');
    const allowed = [callback, this.getFrontendUrl() + '/auth/callback'].filter(Boolean);
    const selected = requested || callback;
    if (!selected || !allowed.includes(selected)) throw new BadRequestException('Unapproved OAuth redirect URI');
    return selected;
  }

  async beginGoogleOAuth(redirectUri?: string, userId?: string) {
    const clientId = this.getGoogleClientId();
    if (!clientId) throw new ServiceUnavailableException('Google authentication is not configured');
    if (userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user || user.isBanned) throw new UnauthorizedException('Account unavailable');
    }
    const target = this.googleRedirectUri(redirectUri);
    const state = crypto.randomBytes(32).toString('base64url');
    const nonce = crypto.randomBytes(32).toString('base64url');
    const cookie = await this.jwtService.signAsync(
      { purpose: 'oauth_state', state, nonce, redirectUri: target, userId: userId || null },
      { secret: this.configService.getOrThrow<string>('JWT_SECRET'), algorithm: 'HS256', issuer: TOKEN_ISSUER,
        audience: 'pdfforge-oauth', expiresIn: '10m' },
    );
    const params = new URLSearchParams({ client_id: clientId, redirect_uri: target, response_type: 'code',
      scope: 'openid email profile', prompt: 'select_account', state, nonce });
    return { url: 'https://accounts.google.com/o/oauth2/v2/auth?' + params, clientId, cookie };
  }

  async validateGoogleOAuthState(state?: string, cookie?: string, redirectUri?: string, userId?: string) {
    try {
      if (!state || !cookie) throw new Error();
      const payload = await this.jwtService.verifyAsync(cookie, tokenVerificationOptions(this.configService, 'oauth_state'));
      if (payload.purpose !== 'oauth_state' || typeof payload.state !== 'string' || !payload.nonce
        || payload.state.length !== state.length
        || !crypto.timingSafeEqual(Buffer.from(payload.state), Buffer.from(state))
        || payload.redirectUri !== this.googleRedirectUri(redirectUri)
        || (payload.userId || null) !== (userId || null)) throw new Error();
      return payload as { nonce: string; redirectUri: string; userId: string | null };
    } catch {
      throw new UnauthorizedException('Invalid or expired OAuth state');
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

    if (user.twoFactorEnabled) throw new UnauthorizedException('Two-factor authentication is currently unavailable; contact support');
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

  async verifyGoogleToken(idToken: string, expectedNonce?: string): Promise<GoogleVerifiedPayload> {
    if (!idToken || typeof idToken !== 'string' || !idToken.trim()) {
      throw new BadRequestException('Google ID token is required');
    }
    const token = idToken.trim();
    if (token.startsWith('ya29.') || /^bearer /i.test(token) || token.split('.').length !== 3) {
      throw new BadRequestException('A Google ID token (JWT) is required, not an OAuth access token');
    }
    const clientId = this.getGoogleClientId();
    if (!clientId) throw new ServiceUnavailableException('Google authentication is not configured');
    try {
      const header = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString('utf8'));
      if (header?.alg !== 'RS256') throw new Error();
      // Verify with Google's certificates; decoded claims and environment flags never authenticate users.
      const client = this.googleClient || new OAuth2Client(clientId);
      const ticket = await client.verifyIdToken({ idToken: token, audience: clientId });
      const payload = ticket.getPayload();
      if (!payload || !['accounts.google.com', 'https://accounts.google.com'].includes(payload.iss)
        || payload.aud !== clientId || (payload.azp && payload.azp !== clientId)
        || typeof payload.sub !== 'string' || !payload.sub || typeof payload.email !== 'string' || !payload.email
        || payload.email_verified !== true || !Number.isFinite(payload.exp) || payload.exp <= Date.now() / 1000
        || (expectedNonce && (payload as any).nonce !== expectedNonce)) throw new Error();
      return { googleId: payload.sub, email: payload.email.toLowerCase(), emailVerified: true,
        name: payload.name || payload.email.split('@')[0], picture: payload.picture };
    } catch {
      // External errors may contain credentials or exchange requests. Do not log them.
      throw new UnauthorizedException('Invalid, untrusted, or expired Google identity token');
    }
  }

  async exchangeGoogleCode(code: string, redirectUri?: string, expectedNonce?: string): Promise<GoogleVerifiedPayload> {
    if (!expectedNonce) throw new UnauthorizedException('A state-bound OAuth flow is required');
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      throw new BadRequestException('Google OAuth credentials (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET) are not configured');
    }

    const defaultCallback = this.configService.get<string>(
      'GOOGLE_CALLBACK_URL',
      'http://localhost:4000/api/v1/auth/google/callback',
    );
    const targetRedirectUri = this.googleRedirectUri(redirectUri || defaultCallback);

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

      if (!tokenRes.data?.id_token) throw new UnauthorizedException('Google identity token missing');
      return await this.verifyGoogleToken(tokenRes.data.id_token, expectedNonce);
    } catch {
      throw new UnauthorizedException('Failed to exchange Google authorization code');
    }

    throw new UnauthorizedException('Failed to retrieve Google user profile');
  }

  async googleAuth(
    credentialOrCode: { idToken?: string; code?: string; accessToken?: string; redirectUri?: string; nonce?: string },
    ipAddress = '127.0.0.1',
    userAgent = 'Web Browser',
  ) {
    if (credentialOrCode.accessToken) {
      this.logger.warn('Google authentication rejected: Provided credential is an OAuth access token, not an ID token.');
      throw new BadRequestException(
        'An OAuth access token was provided where a Google ID token (JWT) is required. Please provide a valid Google identity token (credential).',
      );
    }

    let googleUser: GoogleVerifiedPayload;

    if (credentialOrCode.code) {
      googleUser = await this.exchangeGoogleCode(credentialOrCode.code, credentialOrCode.redirectUri, credentialOrCode.nonce);
    } else if (credentialOrCode.idToken) {
      googleUser = await this.verifyGoogleToken(credentialOrCode.idToken);
    } else {
      this.logger.warn('Google authentication rejected: Neither idToken nor code was provided');
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
        // Link only from an authenticated account; matching email alone is insufficient proof of account ownership.
        throw new UnauthorizedException('Sign in to your existing account and connect Google from account settings');
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

    if (user.twoFactorEnabled) throw new UnauthorizedException('Two-factor authentication is currently unavailable; contact support');
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

  async githubAuth(_codeOrToken: string): Promise<never> {
    throw new ServiceUnavailableException('GitHub authentication is disabled until verified OAuth is configured');
  }

  async forgotPassword(_email: string): Promise<never> {
    // Fail closed: there is no verified email delivery, so a reset token could never
    // reach the account owner. Do not look up accounts or mint reset credentials.
    throw new ServiceUnavailableException('Password recovery is disabled until verified email delivery is configured');
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: crypto.createHash('sha256').update(token).digest('hex'),
        passwordResetExpiresAt: { gt: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException('Password reset token is invalid or has expired');
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    const changed = await this.prisma.user.updateMany({
      where: { id: user.id, passwordResetToken: crypto.createHash('sha256').update(token).digest('hex'),
        passwordResetExpiresAt: { gt: new Date() } },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpiresAt: null,
        refreshTokenHash: null,
      },
    });

    if (changed.count !== 1) throw new BadRequestException('Password reset token is invalid or has expired');

    return { success: true, message: 'Password has been successfully updated. You may now log in.' };
  }

  async verifyEmail(_token: string): Promise<never> {
    throw new ServiceUnavailableException('Email verification is disabled until verified email delivery is configured');
  }

  async generate2FaSecret(_userId: string): Promise<never> {
    throw new ServiceUnavailableException('Two-factor setup is disabled until TOTP verification is implemented');
  }

  async verify2Fa(_userId: string, _code: string): Promise<never> {
    throw new ServiceUnavailableException('Two-factor setup is disabled until TOTP verification is implemented');
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

  async refreshTokens(refreshToken: string) {
    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(refreshToken, tokenVerificationOptions(this.configService, 'refresh'));
      if (!validTokenClaims(payload, 'refresh')) throw new Error();
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.isBanned || user.twoFactorEnabled || !user.refreshTokenHash) {
      throw new UnauthorizedException('Access denied - session invalidated');
    }
    const preHashed = crypto.createHash('sha256').update(refreshToken).digest('hex');
    if (!(await bcrypt.compare(preHashed, user.refreshTokenHash))) {
      throw new UnauthorizedException('Refresh token has already been used or revoked');
    }
    const tokens = await this.generateTokens(user.id, user.email, user.globalRole);
    const nextHash = await this.hashRefreshToken(tokens.refreshToken);
    // Only one concurrent request can consume the stored refresh credential.
    const claimed = await this.prisma.user.updateMany({
      where: { id: user.id, refreshTokenHash: user.refreshTokenHash, isBanned: false, twoFactorEnabled: false },
      data: { refreshTokenHash: nextHash },
    });
    if (claimed.count !== 1) throw new UnauthorizedException('Refresh token has already been used or revoked');
    return tokens;
  }

  async logout(userId: string) {
    await this.prisma.user.updateMany({ where: { id: userId }, data: { refreshTokenHash: null } });
    return { success: true, message: 'Logged out successfully' };
  }

  async logoutByToken(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken, tokenVerificationOptions(this.configService, 'refresh'));
      if (!validTokenClaims(payload, 'refresh')) throw new Error();
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      const preHashed = crypto.createHash('sha256').update(refreshToken).digest('hex');
      if (user?.refreshTokenHash && await bcrypt.compare(preHashed, user.refreshTokenHash)) {
        await this.prisma.user.updateMany({ where: { id: user.id, refreshTokenHash: user.refreshTokenHash }, data: { refreshTokenHash: null } });
      }
    } catch { /* Logout is intentionally idempotent. */ }
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

    if (!user || user.isBanned) {
      throw new NotFoundException('User profile not found');
    }

    const { passwordHash, refreshTokenHash, twoFactorSecret, passwordResetToken, passwordResetExpiresAt,
      emailVerificationToken, emailVerificationExpiresAt, ...profile } = user;
    return { ...profile, plan: await effectivePlan(this.prisma, user) };
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
    const revoked = await this.prisma.userSession.updateMany({
      where: { id: sessionId, userId },
      data: { isRevoked: true },
    });
    // Refresh credentials are currently stored once per account. Revoking a device therefore invalidates account refresh.
    if (revoked.count > 0) await this.logout(userId);
    return { success: true, message: 'Session revoked successfully' };
  }

  async revokeAllOtherSessions(userId: string) {
    await this.prisma.userSession.updateMany({
      where: { userId },
      data: { isRevoked: true },
    });
    await this.logout(userId);
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
    if (!user || user.isBanned) {
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

    const { passwordHash, refreshTokenHash, twoFactorSecret, passwordResetToken, passwordResetExpiresAt, ...profile } = updated;
    return profile;
  }

  async connectGoogle(userId: string, dto: ConnectGoogleDto, expectedNonce?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.isBanned) {
      throw new NotFoundException('User profile not found');
    }

    let verifiedPayload: GoogleVerifiedPayload;

    if (dto.code) {
      verifiedPayload = await this.exchangeGoogleCode(dto.code, dto.redirectUri, expectedNonce);
    } else {
      const rawToken = dto.idToken || dto.credential;
      if (!rawToken) {
        throw new BadRequestException('Missing Google credential, id_token, or code');
      }
      verifiedPayload = await this.verifyGoogleToken(rawToken);
    }

    if (!verifiedPayload.emailVerified) throw new UnauthorizedException('Google email is not verified');
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

    const { passwordHash, refreshTokenHash, twoFactorSecret, passwordResetToken, passwordResetExpiresAt, ...profile } = updated;
    return { success: true, message: 'Google account linked successfully', user: profile };
  }

  async disconnectGoogle(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.isBanned) {
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

    const { passwordHash, refreshTokenHash, twoFactorSecret, passwordResetToken, passwordResetExpiresAt, ...profile } = updated;
    return { success: true, message: 'Google account disconnected successfully', user: profile };
  }

  async deleteAccount(userId: string, dto: DeleteAccountDto) {
    if (dto.confirmation !== 'DELETE') {
      throw new BadRequestException('Must provide exact confirmation string "DELETE"');
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.isBanned) {
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
    const claims = { sub: userId, email, role };
    const options = { algorithm: 'HS256' as const, issuer: TOKEN_ISSUER, audience: TOKEN_AUDIENCE };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync({ ...claims, purpose: 'access' }, {
        ...options, secret: this.configService.getOrThrow<string>('JWT_SECRET'), expiresIn: '15m' }),
      this.jwtService.signAsync({ ...claims, purpose: 'refresh', jti: crypto.randomUUID() }, {
        ...options, secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'), expiresIn: '7d' }),
    ]);
    return { accessToken, refreshToken, tokenType: 'Bearer', expiresInSeconds: 900 };
  }

  private async hashRefreshToken(refreshToken: string) {
    return bcrypt.hash(crypto.createHash('sha256').update(refreshToken).digest('hex'), 10);
  }

  private async updateRefreshToken(userId: string, refreshToken: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { refreshTokenHash: await this.hashRefreshToken(refreshToken) } });
  }
}
