import { corsOriginCheck, corsOrigins, validateEnvironment } from './environment';

const good = () => ({
  NODE_ENV: 'production', JWT_SECRET: 'a'.repeat(48), JWT_REFRESH_SECRET: 'b'.repeat(48),
  WORKER_CALLBACK_SECRET: 'c'.repeat(48), DATABASE_URL: 'postgresql://fixture:fixture@isolated:5432/security',
  REDIS_URL: 'redis://redis:6379', PDF_WORKER_URL: 'http://worker:8000',
  API_GATEWAY_INTERNAL_URL: 'http://api:4000', S3_BUCKET_NAME: 'fixtures', FRONTEND_URL: 'https://app.example.org',
});

describe('production environment and CORS', () => {
  it('accepts explicit service configuration and IAM credentials', () => expect(validateEnvironment(good())).toBeDefined());
  it.each(['JWT_SECRET', 'JWT_REFRESH_SECRET', 'WORKER_CALLBACK_SECRET', 'DATABASE_URL', 'REDIS_URL', 'S3_BUCKET_NAME'])('requires %s', name => {
    const env = good(); delete env[name]; expect(() => validateEnvironment(env)).toThrow();
  });
  it('rejects reused keys and enabled token bypass configuration', () => {
    expect(() => validateEnvironment({ ...good(), JWT_REFRESH_SECRET: good().JWT_SECRET })).toThrow();
    expect(() => validateEnvironment({ ...good(), ALLOW_TEST_TOKENS: 'true' })).toThrow();
  });
  it.each(['*', 'null', 'https://app.example.org/path', 'https://user:password@app.example.org'])('rejects unsafe origin configuration %s', origin => {
    expect(() => corsOrigins({ CORS_ORIGINS: origin })).toThrow();
  });
  it('allows exact origins and non-browser callers, rejecting suffix attacks and null', () => {
    const check = corsOriginCheck(corsOrigins(good()));
    for (const origin of [undefined, 'https://app.example.org']) {
      const callback = jest.fn(); check(origin, callback); expect(callback).toHaveBeenCalledWith(null, true);
    }
    for (const origin of ['null', 'https://app.example.org.attacker.invalid', 'https://attacker.invalid']) {
      const callback = jest.fn(); check(origin, callback); expect(callback.mock.calls[0][0]).toBeInstanceOf(Error);
    }
  });
});
