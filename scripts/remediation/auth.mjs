import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
import { command, readRun, testEnv, root } from './isolated.mjs';

const run = readRun(), suffix = randomBytes(4).toString('hex');
const database = `security_auth_${suffix}`, image = `${run.project}-api:verification`;
const env = { ...testEnv(run), NODE_ENV: 'production',
  FRONTEND_URL: 'https://auth.example.invalid', GOOGLE_CLIENT_ID: 'fixture.apps.googleusercontent.com',
  GOOGLE_CALLBACK_URL: 'https://auth.example.invalid/api/v1/auth/google/callback',
  DATABASE_URL: `postgresql://${run.dbUser}:${encodeURIComponent(run.dbPassword)}@${run.postgres}:5432/${database}?schema=public`,
  EXPECTED_DB_HOST: run.postgres, EXPECTED_DB_NAME: database,
};
try {
  command('docker', ['exec', run.postgres, 'createdb', '-U', run.dbUser, database]);
  command('docker', ['run', '--name', `${run.project}-auth-migrate-${suffix}`, '--network', run.network,
    '--label', `pdfforge.remediation.run=${run.project}`, '--env', 'DATABASE_URL', '--entrypoint', 'node', image,
    '/app/node_modules/prisma/build/index.js', 'migrate', 'deploy'], env);
  const args = ['run', '--name', `${run.project}-auth-http-${suffix}`, '--network', run.network,
    '--label', `pdfforge.remediation.run=${run.project}`, '--mount', `type=bind,source=${resolve(root, 'scripts/remediation')},target=/verification,readonly`];
  for (const key of Object.keys(env)) args.push('--env', key);
  const output = command('docker', [...args, '--entrypoint', 'node', image, '/verification/auth-integration.cjs'], env);
  writeFileSync(resolve(root, '.remediation/auth-results.txt'), output);
  console.log(output); console.log('Isolated authentication database and containers retained.');
} catch (error) {
  writeFileSync(resolve(root, '.remediation/auth-error-private.txt'), error.detail || error.message, { mode: 0o600 });
  console.error('FAIL: isolated authentication integration; private diagnostics retained.'); process.exitCode = 1;
}
