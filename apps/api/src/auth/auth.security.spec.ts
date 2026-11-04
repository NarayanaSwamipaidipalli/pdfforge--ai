import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { BadRequestException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { TOKEN_ISSUER, TOKEN_AUDIENCE } from './token-policy';

// No AppModule, PrismaClient instance, .env loading, network, or external service is used here.
describe('Authentication security boundaries', () => {
  const clientId = 'security-fixture.apps.googleusercontent.com';
  const signingKey = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const attackerKey = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwt = new JwtService();
  let config: ConfigService;
  let prisma: any;
  let service: AuthService;
  let certs: jest.SpyInstance;

  function fixtureConfig(values: Record<string, any>) {
    return { get: (key: string, fallback?: any) => values[key] ?? fallback,
      getOrThrow: (key: string) => { if (!values[key]) throw new Error('Missing fixture configuration'); return values[key]; },
    } as ConfigService;
  }

  function googleToken(changes: Record<string, any> = {}, tampered = false) {
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'fixture', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ iss: 'https://accounts.google.com', aud: clientId,
      sub: 'google-fixture', email: 'fixture@example.invalid', email_verified: true,
      iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 600, ...changes })).toString('base64url');
    const data = `${header}.${payload}`;
    return `${data}.${crypto.sign('RSA-SHA256', Buffer.from(data), tampered ? attackerKey.privateKey : signingKey.privateKey).toString('base64url')}`;
  }

  function refreshToken(changes: Record<string, any> = {}) {
    return jwt.sign({ sub: 'user-fixture', purpose: 'refresh', jti: crypto.randomUUID(), ...changes }, {
      secret: config.getOrThrow('JWT_REFRESH_SECRET'), algorithm: 'HS256', expiresIn: '5m',
      issuer: TOKEN_ISSUER, audience: TOKEN_AUDIENCE,
    });
  }

  beforeEach(() => {
    config = fixtureConfig({ GOOGLE_CLIENT_ID: clientId, GOOGLE_CLIENT_SECRET: 'fixture-only',
      GOOGLE_CALLBACK_URL: 'http://127.0.0.1:49871/api/v1/auth/google/callback',
      FRONTEND_URL: 'http://127.0.0.1:49872', JWT_SECRET: 'a'.repeat(64), JWT_REFRESH_SECRET: 'b'.repeat(64) });
    prisma = { user: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }) }, organization: { create: jest.fn() },
      subscription: { findMany: jest.fn().mockResolvedValue([]) },
      userSession: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      oAuthState: { create: jest.fn().mockResolvedValue({}), updateMany: jest.fn().mockResolvedValue({ count: 1 }) } };
    service = new AuthService(prisma, jwt, config);
    // Mock only the external certificate retrieval boundary. Google's real RSA verification executes.
    certs = jest.spyOn(OAuth2Client.prototype, 'getFederatedSignonCertsAsync').mockResolvedValue({
      certs: { fixture: signingKey.publicKey.export({ type: 'spki', format: 'pem' }).toString() },
    } as any);
  });

  afterEach(() => { certs.mockRestore(); });

  it('accepts a cryptographically valid Google ID token for the configured audience', async () => {
    await expect(service.verifyGoogleToken(googleToken())).resolves.toMatchObject({
      googleId: 'google-fixture', email: 'fixture@example.invalid', emailVerified: true,
    });
    expect(certs).toHaveBeenCalledTimes(1);
  });

  it.each(['test', 'development', 'production'])('rejects forged signatures even with legacy flags in %s', async (mode) => {
    const oldMode = process.env.NODE_ENV, oldFlag = process.env.ALLOW_TEST_TOKENS;
    process.env.NODE_ENV = mode; process.env.ALLOW_TEST_TOKENS = 'true';
    try { await expect(service.verifyGoogleToken(googleToken({}, true))).rejects.toThrow(UnauthorizedException); }
    finally {
      if (oldMode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = oldMode;
      if (oldFlag === undefined) delete process.env.ALLOW_TEST_TOKENS; else process.env.ALLOW_TEST_TOKENS = oldFlag;
    }
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it.each([
    ['wrong audience', { aud: 'another-client' }], ['wrong issuer', { iss: 'https://attacker.invalid' }],
    ['expired', { exp: Math.floor(Date.now() / 1000) - 60 }], ['missing expiry', { exp: undefined }],
    ['future issuance', { iat: Math.floor(Date.now() / 1000) + 1000 }],
    ['unverified email', { email_verified: false }], ['missing email verification', { email_verified: undefined }],
    ['string verification flag', { email_verified: 'true' }], ['missing subject', { sub: undefined }],
    ['wrong authorized party', { azp: 'another-client' }],
  ])('rejects Google claims: %s', async (_label, changes) => {
    await expect(service.verifyGoogleToken(googleToken(changes))).rejects.toThrow(UnauthorizedException);
  });

  it('requires the OAuth nonce when validating a code-exchange identity token', async () => {
    await expect(service.verifyGoogleToken(googleToken({ nonce: 'wrong' }), 'expected')).rejects.toThrow(UnauthorizedException);
    await expect(service.verifyGoogleToken(googleToken({ nonce: 'expected' }), 'expected')).resolves.toHaveProperty('googleId');
    await expect(service.exchangeGoogleCode('unused')).rejects.toThrow(UnauthorizedException);
  });

  it.each(['ya29.fixture', 'not-a-jwt', 'Bearer credential', ''])('rejects malformed credentials: %s', async (token) => {
    await expect(service.verifyGoogleToken(token)).rejects.toThrow(BadRequestException);
    expect(certs).not.toHaveBeenCalled();
  });

  it('fails closed without a configured Google audience', async () => {
    service = new AuthService(prisma, jwt, fixtureConfig({ GOOGLE_CLIENT_ID: '' }));
    await expect(service.verifyGoogleToken(googleToken())).rejects.toThrow(ServiceUnavailableException);
    expect(certs).not.toHaveBeenCalled();
  });

  it('startup never provisions or elevates administrator records', async () => {
    await service.onModuleInit();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('disables unsigned GitHub login, fake TOTP and token-purpose-confused email verification', async () => {
    await expect(service.githubAuth(googleToken())).rejects.toThrow(ServiceUnavailableException);
    await expect(service.generate2FaSecret('user-fixture')).rejects.toThrow(ServiceUnavailableException);
    await expect(service.verify2Fa('user-fixture', '123456')).rejects.toThrow(ServiceUnavailableException);
    await expect(service.verifyEmail(refreshToken())).rejects.toThrow(ServiceUnavailableException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('fails password-recovery requests closed without account lookup or credential generation', async () => {
    for (const email of ['fixture@example.invalid', 'unknown@example.invalid']) {
      await expect(service.forgotPassword(email)).rejects.toThrow(ServiceUnavailableException);
    }
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('consumes password reset credentials once under concurrent attempts', async () => {
    const raw = crypto.randomBytes(32).toString('hex');
    let stored: string | null = crypto.createHash('sha256').update(raw).digest('hex');
    prisma.user.findFirst.mockResolvedValue({ id: 'user-fixture' });
    prisma.user.updateMany.mockImplementation(async ({ where, data }) => {
      if (stored !== where.passwordResetToken) return { count: 0 };
      stored = data.passwordResetToken;
      return { count: 1 };
    });
    const attempts = await Promise.allSettled([service.resetPassword(raw, 'Fixture-password-1'), service.resetPassword(raw, 'Fixture-password-2')]);
    expect(attempts.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(attempts.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect(stored).toBeNull();
    expect(prisma.user.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ refreshTokenHash: null }),
    }));
  });

  it('does not return account credential material in profile responses', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-fixture', email: 'fixture@example.invalid', plan: 'FREE',
      passwordHash: 'fixture-hash', refreshTokenHash: 'fixture-hash', twoFactorSecret: 'fixture-secret',
      passwordResetToken: 'fixture-reset', passwordResetExpiresAt: new Date() });
    const profile = await service.getMe('user-fixture');
    expect(Object.keys(profile).sort()).toEqual(['email', 'id', 'plan']);
  });

  it('binds OAuth state to the initiating browser, exact redirect and authenticated linking account', async () => {
    const redirect = 'http://127.0.0.1:49872/auth/callback';
    const flow = await service.beginGoogleOAuth(redirect);
    const state = new URL(flow.url).searchParams.get('state');
    await expect(service.validateGoogleOAuthState(state, flow.cookie, redirect)).resolves.toHaveProperty('nonce');
    await expect(service.validateGoogleOAuthState(state, undefined, redirect)).rejects.toThrow(UnauthorizedException);
    await expect(service.validateGoogleOAuthState('different', flow.cookie, redirect)).rejects.toThrow(UnauthorizedException);
    await expect(service.validateGoogleOAuthState(state, flow.cookie, 'https://attacker.invalid/auth/callback')).rejects.toThrow(UnauthorizedException);
    await expect(service.beginGoogleOAuth('https://attacker.invalid/auth/callback')).rejects.toThrow(BadRequestException);
    prisma.user.findUnique.mockResolvedValue({ id: 'user-fixture' });
    const link = await service.beginGoogleOAuth(redirect, 'user-fixture');
    const linkState = new URL(link.url).searchParams.get('state');
    await expect(service.validateGoogleOAuthState(linkState, link.cookie, redirect, 'other-user')).rejects.toThrow(UnauthorizedException);
    await expect(service.validateGoogleOAuthState(linkState, link.cookie, redirect, 'user-fixture')).resolves.toHaveProperty('userId', 'user-fixture');
  });

  it('rejects an expired OAuth cookie', async () => {
    const cookie = jwt.sign({ purpose: 'oauth_state', state: 'fixture', nonce: 'fixture',
      redirectUri: config.get('GOOGLE_CALLBACK_URL'), userId: null }, {
      secret: config.get('JWT_SECRET'), algorithm: 'HS256', issuer: TOKEN_ISSUER,
      audience: 'pdfforge-oauth', expiresIn: -1 });
    await expect(service.validateGoogleOAuthState('fixture', cookie)).rejects.toThrow(UnauthorizedException);
  });

  it('allows only one concurrent consumption of a valid OAuth state', async () => {
    const redirect = 'http://127.0.0.1:49872/auth/callback';
    const flow = await service.beginGoogleOAuth(redirect);
    const state = new URL(flow.url).searchParams.get('state');
    let consumed = false;
    prisma.oAuthState.updateMany.mockImplementation(async () => {
      if (consumed) return { count: 0 };
      consumed = true; return { count: 1 };
    });
    const attempts = await Promise.allSettled([0, 1].map(() => service.validateGoogleOAuthState(state, flow.cookie, redirect)));
    expect(attempts.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(attempts.filter(result => result.status === 'rejected')).toHaveLength(1);
  });

  it.each([{ purpose: 'access' }, { sub: undefined }, { jti: undefined }])('rejects refresh-purpose confusion or malformed identity', async (changes) => {
    await expect(service.refreshTokens(refreshToken(changes))).rejects.toThrow(UnauthorizedException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('rejects banned users before rotating refresh credentials', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-fixture', isBanned: true, refreshTokenHash: 'unused' });
    await expect(service.refreshTokens(refreshToken())).rejects.toThrow(UnauthorizedException);
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it('allows exactly one refresh in a concurrent replay and rejects the old token afterward', async () => {
    const old = refreshToken();
    let hash = await bcrypt.hash(crypto.createHash('sha256').update(old).digest('hex'), 4);
    prisma.user.findUnique.mockImplementation(async () => ({ id: 'user-fixture', email: 'fixture@example.invalid',
      globalRole: 'USER', isBanned: false, twoFactorEnabled: false, refreshTokenHash: hash }));
    prisma.user.updateMany.mockImplementation(async ({ where, data }) => {
      if (where.refreshTokenHash !== hash) return { count: 0 };
      hash = data.refreshTokenHash; return { count: 1 };
    });
    const results = await Promise.allSettled([service.refreshTokens(old), service.refreshTokens(old)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    const successful = (results.find((r) => r.status === 'fulfilled') as PromiseFulfilledResult<any>).value;
    const claims = jwt.verify(successful.accessToken, { secret: config.get('JWT_SECRET'), issuer: TOKEN_ISSUER, audience: TOKEN_AUDIENCE });
    expect(claims.purpose).toBe('access');
    await expect(service.refreshTokens(old)).rejects.toThrow(UnauthorizedException);
    await expect(service.refreshTokens(successful.refreshToken)).resolves.toHaveProperty('accessToken');
  });

  it('prevents an old refresh token from logging out a newly rotated session', async () => {
    const stale = refreshToken(), current = refreshToken();
    prisma.user.findUnique.mockResolvedValue({ id: 'user-fixture',
      refreshTokenHash: await bcrypt.hash(crypto.createHash('sha256').update(current).digest('hex'), 4) });
    await service.logoutByToken(stale);
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
    await service.logoutByToken(current);
    expect(prisma.user.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { refreshTokenHash: null, tokenVersion: { increment: 1 } } }));
  });
});
