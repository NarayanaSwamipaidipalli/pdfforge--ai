// Deliberately never loads .env, the normal Compose project, seeds, or existing volumes.
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const root = fileURLToPath(new URL('../../', import.meta.url));
const evidence = resolve(root, '.remediation');
const manifestPath = process.env.PDFFORGE_SECURITY_MANIFEST ? resolve(root, process.env.PDFFORGE_SECURITY_MANIFEST) : resolve(evidence, 'isolated-run.json');
if (!manifestPath.startsWith(evidence + (evidence.includes('\\') ? '\\' : '/'))) throw new Error('Test manifest must stay inside .remediation');
const safeEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|USERPROFILE|HOMEDRIVE|HOMEPATH|PROGRAMDATA|APPDATA|LOCALAPPDATA|DOCKER_CONFIG)$/i.test(key)));

export function command(binary, args, env = {}, options = {}) {
  const { combinedOutput, ...spawnOptions } = options;
  const result = spawnSync(binary, args, {
    cwd: root, env: { ...safeEnv, ...env }, encoding: 'utf8', timeout: 600_000,
    maxBuffer: 12 * 1024 * 1024, ...spawnOptions,
  });
  if (result.error || result.status !== 0) {
    const error = new Error(`${binary} failed (exit ${result.status ?? 'unavailable'})`);
    error.detail = `${result.stderr || ''}\n${result.stdout || ''}`;
    throw error;
  }
  return (combinedOutput ? `${result.stdout}\n${result.stderr}` : result.stdout).trim();
}

export function readRun() {
  if (!existsSync(manifestPath)) throw new Error('Prepare a new isolated run first.');
  const run = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (!/^pdfforge-security-\d+-[a-f0-9]{8}$/.test(run.project) ||
      run.postgres !== `${run.project}-postgres` || run.network !== `${run.project}-network`) {
    throw new Error('Invalid isolated resource manifest.');
  }
  const label = command('docker', ['inspect', '--format', '{{index .Config.Labels "pdfforge.remediation.run"}}', run.postgres]);
  if (label !== run.project) throw new Error('Resource ownership check failed.');
  return run;
}

export function testEnv(run) {
  return {
    NODE_ENV: 'test', ENVIRONMENT: 'test', LOAD_LOCAL_ENV: 'false',
    DATABASE_URL: `postgresql://${run.dbUser}:${encodeURIComponent(run.dbPassword)}@${run.postgres}:5432/security_fresh?schema=public`,
    JWT_SECRET: run.jwtSecret, JWT_REFRESH_SECRET: run.refreshSecret,
    WORKER_CALLBACK_SECRET: run.workerSecret,
    FRONTEND_URL: 'http://web:3000', CORS_ORIGINS: 'http://web:3000',
    PDF_WORKER_URL: 'http://worker:8000', API_GATEWAY_INTERNAL_URL: 'http://api:4000',
    REDIS_URL: 'redis://redis:6379/0', CELERY_BROKER_URL: 'redis://redis:6379/0',
    CELERY_RESULT_BACKEND: 'redis://redis:6379/1', S3_BUCKET_NAME: 'security-fixtures',
    AWS_REGION: 'us-east-1', AWS_EC2_METADATA_DISABLED: 'true',
  };
}

async function prepare() {
  if (existsSync(manifestPath)) {
    const run = readRun();
    console.log(`Isolated resources already recorded: ${run.project}; retained without modification.`);
    return;
  }
  const project = `pdfforge-security-${Date.now()}-${randomBytes(4).toString('hex')}`;
  const run = {
    project, network: `${project}-network`, postgres: `${project}-postgres`,
    volume: `${project}-postgres-data`, dbUser: 'security_test',
    dbPassword: randomBytes(32).toString('hex'), jwtSecret: randomBytes(48).toString('hex'),
    refreshSecret: randomBytes(48).toString('hex'), workerSecret: randomBytes(48).toString('hex'),
    createdAt: new Date().toISOString(),
  };
  mkdirSync(evidence, { recursive: true });
  writeFileSync(manifestPath, JSON.stringify(run, null, 2), { mode: 0o600, flag: 'wx' });
  command('docker', ['network', 'create', '--internal', '--label', `pdfforge.remediation.run=${project}`, run.network]);
  command('docker', ['volume', 'create', '--label', `pdfforge.remediation.run=${project}`, run.volume]);
  command('docker', ['run', '-d', '--name', run.postgres, '--network', run.network,
    '--label', `pdfforge.remediation.run=${project}`,
    '--mount', `type=volume,source=${run.volume},target=/var/lib/postgresql/data`,
    '--env', 'POSTGRES_USER', '--env', 'POSTGRES_PASSWORD', '--env', 'POSTGRES_DB',
    'pgvector/pgvector:pg16'], {
      POSTGRES_USER: run.dbUser, POSTGRES_PASSWORD: run.dbPassword, POSTGRES_DB: 'security_fresh',
    });
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      command('docker', ['exec', run.postgres, 'pg_isready', '-U', run.dbUser, '-d', 'security_fresh']);
      console.log(`Prepared isolated PostgreSQL: ${project}. No host ports published; no existing resources changed.`);
      return;
    } catch { await new Promise(done => setTimeout(done, 1000)); }
  }
  throw new Error('Isolated PostgreSQL did not become ready. Resources retained for inspection.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv[2] !== 'prepare') throw new Error('Usage: node scripts/remediation/isolated.mjs prepare');
    await prepare();
  } catch (error) {
    // Details may contain connection strings. Keep terminal output credential-free.
    console.error(error.message);
    if (error.detail) writeFileSync(resolve(evidence, 'last-command-error.txt'), error.detail, { mode: 0o600 });
    process.exitCode = 1;
  }
}
