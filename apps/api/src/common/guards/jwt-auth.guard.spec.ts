import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { TOKEN_ISSUER, TOKEN_AUDIENCE } from '../../auth/token-policy';

describe('JWT access guard with real token signatures', () => {
  const secret = 'c'.repeat(64);
  const jwt = new JwtService();
  const guard = new JwtAuthGuard(jwt, { getOrThrow: () => secret } as unknown as ConfigService);
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
});
