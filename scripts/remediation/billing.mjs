import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
import { command, readRun, testEnv, root } from './isolated.mjs';

const run = readRun();
const suffix = randomBytes(4).toString('hex');
const database = `security_billing_${suffix}`;
const image = `${run.project}-api:verification`;
const env = { ...testEnv(run),
  DATABASE_URL: `postgresql://${run.dbUser}:${encodeURIComponent(run.dbPassword)}@${run.postgres}:5432/${database}?schema=public`,
  EXPECTED_DB_HOST: run.postgres, EXPECTED_DB_NAME: database,
  ENABLE_RAZORPAY: 'true', RAZORPAY_KEY_ID: `rzp_test_isolated_${suffix}`,
  RAZORPAY_KEY_SECRET: randomBytes(32).toString('hex'), RAZORPAY_WEBHOOK_SECRET: randomBytes(32).toString('hex'),
  RAZORPAY_PRICE_PRO_MONTHLY: '100000', ENABLE_STRIPE: 'false', ENABLE_PAYPAL: 'false',
};
try {
  command('docker', ['exec', run.postgres, 'createdb', '-U', run.dbUser, database]);
  command('docker', ['run', '--name', `${run.project}-billing-migrate-${suffix}`, '--network', run.network,
    '--label', `pdfforge.remediation.run=${run.project}`, '--env', 'DATABASE_URL', '--entrypoint', 'node', image,
    '/app/node_modules/prisma/build/index.js', 'migrate', 'deploy', '--schema', '/app/prisma/schema.prisma'], env);
  const args = ['run', '--name', `${run.project}-billing-http-${suffix}`, '--network', run.network,
    '--label', `pdfforge.remediation.run=${run.project}`,
    '--mount', `type=bind,source=${resolve(root, 'scripts/remediation')},target=/verification,readonly`];
  for (const key of Object.keys(env)) args.push('--env', key);
  args.push('--entrypoint', 'node', image, '/verification/billing-integration.cjs');
  const output = command('docker', args, env);
  writeFileSync(resolve(root, '.remediation/billing-results.txt'), output);
  console.log(output);
  console.log('All isolated billing databases and containers retained.');
} catch (error) {
  if (error.detail) writeFileSync(resolve(root, '.remediation/billing-error-private.txt'), error.detail, { mode: 0o600 });
  console.error(`Billing integration failed: ${error.message}; resources retained`);
  process.exitCode = 1;
}
