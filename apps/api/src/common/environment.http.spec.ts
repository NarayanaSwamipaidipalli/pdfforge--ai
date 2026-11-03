import { Body, Controller, Get, HttpCode, Module, Post } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { corsOriginCheck, corsOrigins } from './environment';
import { AllExceptionsFilter } from './filters/http-exception.filter';

jest.mock('@sentry/node', () => ({ captureException: jest.fn() }));

let handled = 0;
@Controller('api/v1')
class IsolatedSecurityProbe {
  @Post('auth/login')
  @HttpCode(200)
  login(@Body() body: any) { handled++; return { received: true, email: body?.email }; }

  @Get('failure')
  failure() { throw new Error('private-error-fixture'); }
}
@Module({ controllers: [IsolatedSecurityProbe] })
class IsolatedSecurityModule {}

describe('CORS and error policy through a real isolated HTTP server', () => {
  let app: any;
  let origin: string;
  const frontend = 'https://frontend.example.invalid';

  beforeAll(async () => {
    // This module has no application services, .env loader, Prisma, Redis, object storage, or external calls.
    app = await NestFactory.create(IsolatedSecurityModule, {
      logger: false,
      cors: {
        origin: corsOriginCheck(corsOrigins({ CORS_ORIGINS: frontend })), credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-API-Key', 'Accept'],
      },
    });
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.listen(0, '127.0.0.1');
    origin = await app.getUrl();
  });
  afterAll(async () => { if (app) await app.close(); });
  beforeEach(() => { handled = 0; });

  it.each(['https://attacker.invalid', 'https://frontend.example.invalid.attacker.invalid', 'null'])(
    'rejects a hostile-origin form POST before the authentication handler: %s', async (attacker) => {
      const response = await fetch(`${origin}/api/v1/auth/login`, {
        method: 'POST', headers: { Origin: attacker, 'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: 'pdfforge_refresh_token=synthetic-cookie-fixture' },
        body: 'email=fixture%40example.invalid&password=synthetic-password',
      });
      expect(response.status).toBe(403);
      expect(response.headers.get('access-control-allow-origin')).toBeNull();
      expect(handled).toBe(0);
      expect(await response.json()).toMatchObject({ statusCode: 403, message: 'Origin is not allowed' });
    },
  );

  it('allows the exact configured browser origin and credentialed preflight headers', async () => {
    const preflight = await fetch(`${origin}/api/v1/auth/login`, {
      method: 'OPTIONS', headers: { Origin: frontend, 'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization,content-type,x-api-key' },
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('access-control-allow-origin')).toBe(frontend);
    expect(preflight.headers.get('access-control-allow-credentials')).toBe('true');
    expect(preflight.headers.get('access-control-allow-headers')?.toLowerCase()).toContain('authorization');
    expect(preflight.headers.get('access-control-allow-headers')?.toLowerCase()).toContain('x-api-key');
    expect(preflight.headers.get('vary')?.toLowerCase()).toContain('origin');
    expect(handled).toBe(0);
    const response = await fetch(`${origin}/api/v1/auth/login`, {
      method: 'POST', headers: { Origin: frontend, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'fixture@example.invalid' }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe(frontend);
    expect(await response.json()).toEqual({ received: true, email: 'fixture@example.invalid' });
    expect(handled).toBe(1);
  });

  it('denies hostile preflight requests', async () => {
    const response = await fetch(`${origin}/api/v1/auth/login`, { method: 'OPTIONS',
      headers: { Origin: 'https://attacker.invalid', 'Access-Control-Request-Method': 'POST' } });
    expect(response.status).toBe(403);
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
    expect(handled).toBe(0);
    await response.arrayBuffer();
  });

  it('supports non-browser service callers without Origin', async () => {
    const response = await fetch(`${origin}/api/v1/auth/login`, { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: '{}' });
    expect(response.status).toBe(200);
    expect(handled).toBe(1);
    await response.arrayBuffer();
  });

  it('does not include exception details or credential-bearing query strings in HTTP errors', async () => {
    const response = await fetch(`${origin}/api/v1/failure?code=private-query-fixture`, { headers: { Origin: frontend } });
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toMatchObject({ path: '/api/v1/failure', message: 'Internal server error occurred' });
    expect(JSON.stringify(body)).not.toMatch(/private-/);
  });
});
