import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { TOKEN_ISSUER, TOKEN_AUDIENCE } from '../../auth/token-policy';

describe('JWT access guard with real token signatures', () => {
  const secret = 'c'.repeat(64);
  const jwt = new JwtService();
  const prisma: any = { user: { findUnique: jest.fn() } };
  const guard = new JwtAuthGuard(jwt, { getOrThrow: () => secret } as unknown as ConfigService, prisma);
  beforeEach(() => {
    prisma.user.findUnique.mockReset().mockResolvedValue({ id: 'fixture-user', email: 'fixture@example.invalid', globalRole: 'USER', tokenVersion: 0 });
  });
  function context(token?: string) {
    const request = { headers: { authorization: token ? `Bearer ${token}` : undefined } };
    return { request, context: { switchToHttp: () => ({ getRequest: () => request }) } as any };
  }
  function sign(claims: any = {}, options: any = {}) {
    return jwt.sign({ sub: 'fixture-user', purpose: 'access', ...claims }, {
      secret, algorithm: 'HS256', issuer: TOKEN_ISSUER, audience: TOKEN_AUDIENCE, expiresIn: '5m', ...options,
    });
  }
  it('accepts only signed access credentials and exposes verified claims', async () => {
    const c = context(sign());
    await expect(guard.canActivate(c.context)).resolves.toBe(true);
    expect(c.request['user'].sub).toBe('fixture-user');
  });
  it.each([
    ['refresh purpose', { purpose: 'refresh' }, {}], ['OAuth purpose', { purpose: 'oauth_state' }, {}],
    ['missing purpose', { purpose: undefined }, {}], ['missing subject', { sub: undefined }, {}],
    ['wrong audience', {}, { audience: 'other-app' }], ['wrong issuer', {}, { issuer: 'other-api' }],
    ['wrong signature', {}, { secret: 'd'.repeat(64) }], ['wrong algorithm', {}, { algorithm: 'HS384' }],
    ['expired token', {}, { expiresIn: -1 }],
  ])('rejects %s', async (_label, claims, options) => {
    await expect(guard.canActivate(context(sign(claims, options)).context)).rejects.toThrow(UnauthorizedException);
  });
  it('rejects missing credentials', async () => {
    await expect(guard.canActivate(context().context)).rejects.toThrow(UnauthorizedException);
  });
  it.each([null, { isBanned: true }, { twoFactorEnabled: true }, { tokenVersion: 1 }])('rejects unavailable or revoked accounts', async changes => {
    prisma.user.findUnique.mockResolvedValue(changes === null ? null : { id: 'fixture-user', globalRole: 'USER', tokenVersion: 0, ...changes });
    await expect(guard.canActivate(context(sign()).context)).rejects.toThrow(UnauthorizedException);
  });
  it('uses the current database role instead of stale administrator claims', async () => {
    const c = context(sign({ role: 'SUPERADMIN' }));
    await guard.canActivate(c.context);
    expect(c.request['user'].role).toBe('USER');
  });
  it('rejects malformed revocation versions before database access', async () => {
    await expect(guard.canActivate(context(sign({ tokenVersion: -1 })).context)).rejects.toThrow(UnauthorizedException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});
