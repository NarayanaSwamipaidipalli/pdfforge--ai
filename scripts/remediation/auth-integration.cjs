const { createRequire } = require('node:module');
const appRequire = createRequire('/app/package.json');
appRequire('reflect-metadata');
// Match the production bootstrap's JSON support for storage quota fields.
BigInt.prototype.toJSON = function () { const value = Number(this); return value <= Number.MAX_SAFE_INTEGER ? value : this.toString(); };
const assert = require('node:assert/strict'), crypto = require('node:crypto'), fs = require('node:fs');
const { PrismaClient } = appRequire('@prisma/client');
const { JwtService } = appRequire('@nestjs/jwt');
const { ConfigService } = appRequire('@nestjs/config');
const { Module, ValidationPipe } = appRequire('@nestjs/common');
const { NestFactory } = appRequire('@nestjs/core');
const { AuthService } = require('/app/dist/auth/auth.service');
const { AuthController } = require('/app/dist/auth/auth.controller');
const { AdminService } = require('/app/dist/admin/admin.service');
const { AdminController } = require('/app/dist/admin/admin.controller');
const { PrismaService } = require('/app/dist/prisma/prisma.service');
const { TOKEN_ISSUER, TOKEN_AUDIENCE } = require('/app/dist/auth/token-policy');
const url = new URL(process.env.DATABASE_URL);
if (url.hostname !== process.env.EXPECTED_DB_HOST || !/^pdfforge-security-\d+-[a-f0-9]{8}-postgres$/.test(url.hostname) ||
    url.pathname.slice(1) !== process.env.EXPECTED_DB_NAME || !/^security_auth_[a-f0-9]{8}$/.test(url.pathname.slice(1))) throw new Error('Unsafe auth database target');
const prisma = new PrismaClient({ log: [] }), jwt = new JwtService();
const config = new ConfigService({ ...process.env, FRONTEND_URL: 'https://auth.example.invalid',
  GOOGLE_CLIENT_ID: 'fixture.apps.googleusercontent.com', GOOGLE_CALLBACK_URL: 'https://auth.example.invalid/api/v1/auth/google/callback' });
const delivered = new Map(); let deliveryFailure = false;
const mail = { assertConfigured() {}, async sendPasswordReset(email, token) {
  if (deliveryFailure) throw new Error('Synthetic private delivery failure'); delivered.set(email, token);
} };
const service = new AuthService(prisma, jwt, config, mail), admin = new AdminService(prisma);
let app, origin, phase = 'startup', passed = 0;
function pass(label) { phase = label; passed++; console.log(`PASS: ${label}`); }
async function call(path, { method = 'GET', token, body } = {}) {
  return fetch(origin + '/api/v1' + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000) });
}
async function json(response, status) { assert.equal(response.status, status); return response.json(); }
async function login(email, password) { return json(await call('/auth/login', { method: 'POST', body: { email, password } }), 200); }
function signed(user, role = user.globalRole) {
  return jwt.sign({ sub: user.id, purpose: 'access', role, tokenVersion: user.tokenVersion }, {
    secret: process.env.JWT_SECRET, algorithm: 'HS256', issuer: TOKEN_ISSUER, audience: TOKEN_AUDIENCE, expiresIn: 300,
  });
}
(async () => {
  await prisma.$connect();
  class FixtureModule {}
  Module({ controllers: [AuthController, AdminController], providers: [
    { provide: AuthService, useValue: service }, { provide: AdminService, useValue: admin },
    { provide: PrismaService, useValue: prisma }, { provide: JwtService, useValue: jwt }, { provide: ConfigService, useValue: config },
  ] })(FixtureModule);
  app = await NestFactory.create(FixtureModule, { logger: false });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.listen(0, '127.0.0.1'); origin = await app.getUrl();
  const email = `auth-${crypto.randomUUID()}@example.invalid`, password = crypto.randomBytes(24).toString('base64url');
  const registered = await json(await call('/auth/register', { method: 'POST', body: { email, password, name: 'Synthetic Doxera user' } }), 201);
  const stored = await prisma.user.findUnique({ where: { id: registered.user.id } });
  assert.equal(stored.globalRole, 'USER'); assert.equal(stored.tokenVersion, 0);
  await json(await call('/auth/register', { method: 'POST', body: { email: `invalid-${email}`, password, role: 'SUPERADMIN' } }), 400);
  await json(await call('/admin/users', { token: signed(stored, 'SUPERADMIN') }), 403);
  pass('real registration cannot assign privileges; database role overrides signed stale administrator claims');

  const loginResult = await login(email, password);
  const attempts = await Promise.all([0, 1].map(() => call('/auth/refresh', { method: 'POST', body: { refreshToken: loginResult.tokens.refreshToken } })));
  assert.deepEqual(attempts.map(r => r.status).sort(), [200, 401]);
  const current = await json(attempts.find(r => r.status === 200), 200);
  await attempts.find(r => r.status === 401).arrayBuffer();
  await json(await call('/auth/refresh', { method: 'POST', body: { refreshToken: loginResult.tokens.refreshToken } }), 401);
  pass('PostgreSQL compare-and-swap permits exactly one concurrent refresh and rejects replay');

  const known = await json(await call('/auth/forgot-password', { method: 'POST', body: { email } }), 200);
  const unknown = await json(await call('/auth/forgot-password', { method: 'POST', body: { email: `unknown-${email}` } }), 200);
  assert.deepEqual(known, unknown);
  const raw = delivered.get(email), resetState = await prisma.user.findUnique({ where: { id: stored.id } });
  assert.ok(raw); assert.notEqual(resetState.passwordResetToken, raw);
  assert.equal(resetState.passwordResetToken, crypto.createHash('sha256').update(raw).digest('hex'));
  const nextPassword = crypto.randomBytes(24).toString('base64url');
  const resets = await Promise.all([0, 1].map(() => call('/auth/reset-password', { method: 'POST', body: { token: raw, newPassword: nextPassword } })));
  assert.deepEqual(resets.map(r => r.status).sort(), [200, 400]);
  await Promise.all(resets.map(r => r.arrayBuffer()));
  assert.equal((await prisma.user.findUnique({ where: { id: stored.id } })).tokenVersion, 1);
  await json(await call('/auth/me', { token: current.accessToken }), 401);
  await json(await call('/auth/refresh', { method: 'POST', body: { refreshToken: current.refreshToken } }), 401);
  const afterReset = await login(email, nextPassword);
  await json(await call('/auth/me', { token: afterReset.tokens.accessToken }), 200);
  await json(await call('/auth/login', { method: 'POST', body: { email, password } }), 401);
  pass('single-use password reset preserves the account and immediately revokes prior access and refresh tokens');

  deliveryFailure = true;
  assert.deepEqual(await json(await call('/auth/forgot-password', { method: 'POST', body: { email } }), 200), unknown);
  assert.equal((await prisma.user.findUnique({ where: { id: stored.id } })).passwordResetToken, null);
  deliveryFailure = false;
  await json(await call('/auth/logout', { method: 'POST', body: { refreshToken: afterReset.tokens.refreshToken } }), 200);
  await json(await call('/auth/me', { token: afterReset.tokens.accessToken }), 401);
  assert.equal(await prisma.userSession.count({ where: { userId: stored.id, isRevoked: false } }), 0);
  pass('delivery failures disclose no account state; logout immediately revokes access and recorded sessions');

  const redirect = 'https://auth.example.invalid/auth/callback';
  const flow = await service.beginGoogleOAuth(redirect), state = new URL(flow.url).searchParams.get('state');
  const states = await Promise.allSettled([0, 1].map(() => service.validateGoogleOAuthState(state, flow.cookie, redirect)));
  assert.equal(states.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(states.filter(r => r.status === 'rejected').length, 1);
  assert.equal(await prisma.oAuthState.count({ where: { consumedAt: { not: null } } }), 1);
  pass('real PostgreSQL OAuth state consumption rejects concurrent browser-state replay');

  const fixtures = {};
  for (const [name, role] of [['rootOne', 'SUPERADMIN'], ['rootTwo', 'SUPERADMIN'], ['operator', 'ADMIN'], ['victim', 'USER']]) {
    const user = await prisma.user.create({ data: { email: `${name}-${crypto.randomUUID()}@example.invalid`.toLowerCase(), globalRole: role, passwordHash: stored.passwordHash } });
    fixtures[name] = { user, auth: await login(user.email, password) };
  }
  await json(await call(`/admin/users/${stored.id}/role`, { method: 'PATCH', token: fixtures.operator.auth.tokens.accessToken, body: { role: 'SUPERADMIN' } }), 403);
  await json(await call(`/admin/users/${fixtures.rootOne.user.id}/ban`, { method: 'POST', token: fixtures.operator.auth.tokens.accessToken, body: {} }), 403);
  assert.equal((await prisma.user.findUnique({ where: { id: stored.id } })).globalRole, 'USER');
  pass('ordinary administrators cannot escalate roles or suspend super administrators');

  const race = await Promise.all([
    call(`/admin/users/${fixtures.rootTwo.user.id}/role`, { method: 'PATCH', token: fixtures.rootOne.auth.tokens.accessToken, body: { role: 'USER' } }),
    call(`/admin/users/${fixtures.rootOne.user.id}/role`, { method: 'PATCH', token: fixtures.rootTwo.auth.tokens.accessToken, body: { role: 'USER' } }),
  ]);
  assert.equal(race.filter(r => r.status === 200).length, 1);
  await Promise.all(race.map(r => r.arrayBuffer()));
  assert.equal(await prisma.user.count({ where: { globalRole: 'SUPERADMIN', isBanned: false } }), 1);
  const root = await prisma.user.findFirst({ where: { globalRole: 'SUPERADMIN' } });
  const rootToken = Object.values(fixtures).find(f => f.user.id === root.id).auth.tokens.accessToken;
  await json(await call(`/admin/users/${root.id}/ban`, { method: 'POST', token: rootToken, body: {} }), 400);
  pass('concurrent role changes preserve a super administrator; administrative self-suspension is denied');

  const victim = fixtures.victim;
  await json(await call(`/admin/users/${victim.user.id}/ban`, { method: 'POST', token: rootToken, body: { reason: 'Synthetic security test' } }), 200);
  await json(await call('/auth/me', { token: victim.auth.tokens.accessToken }), 401);
  await json(await call('/auth/refresh', { method: 'POST', body: { refreshToken: victim.auth.tokens.refreshToken } }), 401);
  assert.equal((await prisma.user.findUnique({ where: { id: victim.user.id } })).passwordHash, stored.passwordHash);
  assert.equal(await prisma.user.count(), 5);
  pass('authorized suspension revokes credentials immediately while preserving users and password hashes');
  console.log(`PASS: ${passed} real database/HTTP authentication and administrator scenarios; Google and Resend network boundaries are not contacted.`);
})().catch(error => {
  fs.writeFileSync('/tmp/auth-private.log', error.stack || 'Authentication assertion failed', { mode: 0o600 });
  console.error(`FAIL: authentication integration after ${phase}; diagnostics retained privately`); process.exitCode = 1;
}).finally(async () => { if (app) await app.close(); await prisma.$disconnect(); });
