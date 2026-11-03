import { ForbiddenException } from '@nestjs/common';

function required(env: Record<string, any>, name: string): string {
  const value = env[name];
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} is required`);
  return value;
}

export function validateEnvironment(env: Record<string, any>) {
  if (!env.PDF_WORKER_URL && env.PDF_WORKER_HOSTPORT) env.PDF_WORKER_URL = `http://${env.PDF_WORKER_HOSTPORT}`;
  if (!env.API_GATEWAY_INTERNAL_URL && env.API_GATEWAY_HOSTPORT) env.API_GATEWAY_INTERNAL_URL = `http://${env.API_GATEWAY_HOSTPORT}`;
  if (env.ALLOW_TEST_TOKENS === 'true') throw new Error('Test-token authentication is not supported');
  for (const name of ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'WORKER_CALLBACK_SECRET']) {
    const value = required(env, name);
    if (value.length < 32 || /change.?me|your[-_ ]|example|pdfforge[-_](enterprise|worker)|minioadmin/i.test(value)) {
      throw new Error(`${name} must be a unique randomly generated secret of at least 32 characters`);
    }
  }
  if (new Set([env.JWT_SECRET, env.JWT_REFRESH_SECRET, env.WORKER_CALLBACK_SECRET]).size !== 3) {
    throw new Error('Authentication and worker secrets must be different');
  }
  if (env.NODE_ENV === 'production') {
    let database: URL;
    try { database = new URL(required(env, 'DATABASE_URL')); } catch { throw new Error('DATABASE_URL must be a valid PostgreSQL URL'); }
    if (!['postgres:', 'postgresql:'].includes(database.protocol)) throw new Error('DATABASE_URL must use PostgreSQL');
    for (const [name, protocols] of [
      ['REDIS_URL', ['redis:', 'rediss:']], ['PDF_WORKER_URL', ['http:', 'https:']],
      ['API_GATEWAY_INTERNAL_URL', ['http:', 'https:']],
    ] as const) {
      let value: URL;
      try { value = new URL(required(env, name)); } catch { throw new Error(`${name} must be a valid service URL`); }
      if (!(protocols as readonly string[]).includes(value.protocol)) throw new Error(`${name} has an unsupported protocol`);
      if (name !== 'REDIS_URL' && (value.username || value.password || value.search || value.hash || value.pathname !== '/')) {
        throw new Error(`${name} must be a service origin without credentials, query, or path`);
      }
    }
    required(env, 'S3_BUCKET_NAME');
    const frontend = checkedOrigin(required(env, 'FRONTEND_URL'));
    if (frontend.startsWith('http:') && !['localhost', '127.0.0.1', '[::1]'].includes(new URL(frontend).hostname)) {
      throw new Error('FRONTEND_URL must use HTTPS outside local development');
    }
    corsOrigins(env);
  }
  if (!!env.AWS_ACCESS_KEY_ID !== !!env.AWS_SECRET_ACCESS_KEY) throw new Error('Configure both AWS credential fields or use the default IAM credential chain');
  return env;
}

function checkedOrigin(value: string): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('CORS origins must be valid HTTP origins'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.origin === 'null' || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash || value === '*') {
    throw new Error('CORS origins must be exact HTTP origins without paths or credentials');
  }
  return url.origin;
}

export function corsOrigins(env: Record<string, any>): Set<string> {
  const configured = env.CORS_ORIGINS || env.FRONTEND_URL;
  if (!configured) throw new Error('CORS_ORIGINS or FRONTEND_URL is required');
  return new Set(String(configured).split(',').map(value => checkedOrigin(value.trim())));
}

export function corsOriginCheck(origins: Set<string>) {
  return (origin: string | undefined, callback: (error: Error | null, allowed?: boolean) => void) => {
    // Requests without Origin include internal service callers and signed provider webhooks.
    if (origin === undefined || origins.has(origin)) return callback(null, true);
    callback(new ForbiddenException('Origin is not allowed'));
  };
}
