// Only creates synthetic databases in the labelled remediation PostgreSQL container.
// No reset, drop, seed, developer environment, production backup, or default Compose usage.
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { command, readRun, root } from './isolated.mjs';

const run = readRun();
const suffix = randomBytes(4).toString('hex');
const image = `${run.project}-api:verification`;
const initial = readFileSync(resolve(root, 'apps/api/prisma/migrations/20261031000000_initial_schema/migration.sql'), 'utf8');
const forward = readFileSync(resolve(root, 'apps/api/prisma/migrations/20261103000000_security_billing/migration.sql'), 'utf8');
const auth = readFileSync(resolve(root, 'apps/api/prisma/migrations/20261104000000_auth_revocation/migration.sql'), 'utf8');
const results = [];
let step = 0;

function sql(database, input) {
  if (!/^security_migration_[a-z_]+_[a-f0-9]{8}$/.test(database)) throw new Error('Unsafe database target');
  return command('docker', ['exec', '-i', run.postgres, 'psql', '-X', '-v', 'ON_ERROR_STOP=1',
    '-U', run.dbUser, '-d', database, '-At'], {}, { input });
}

function prisma(database, args, expectedErrorCode) {
  const name = `${run.project}-migration-${suffix}-${++step}`;
  const env = { DATABASE_URL: `postgresql://${run.dbUser}:${encodeURIComponent(run.dbPassword)}@${run.postgres}:5432/${database}?schema=public` };
  try {
    const output = command('docker', ['run', '--name', name, '--network', run.network,
      '--label', `pdfforge.remediation.run=${run.project}`, '--env', 'DATABASE_URL',
      '--entrypoint', 'node', image, '/app/node_modules/prisma/build/index.js', ...args,
      '--schema', '/app/prisma/schema.prisma'], env);
    if (expectedErrorCode) throw new Error('Expected migration rejection did not occur');
    return output;
  } catch (error) {
    const codes = Array.isArray(expectedErrorCode) ? expectedErrorCode : [expectedErrorCode];
    if (expectedErrorCode && codes.some(code => error.detail?.includes(code))) return 'rejected';
    if (error.detail) writeFileSync(resolve(root, '.remediation/migration-error-private.txt'), error.detail, { mode: 0o600 });
    // Prisma details may include connection strings; keep console output credential-free.
    throw new Error(`Isolated Prisma ${args[0]} ${args[1]} failed; resources retained`);
  }
}

function diff(database) {
  const name = `${run.project}-migration-${suffix}-${++step}`;
  const env = { DATABASE_URL: `postgresql://${run.dbUser}:${encodeURIComponent(run.dbPassword)}@${run.postgres}:5432/${database}?schema=public` };
  command('docker', ['run', '--name', name, '--network', run.network,
    '--label', `pdfforge.remediation.run=${run.project}`, '--env', 'DATABASE_URL', '--entrypoint', 'node', image,
    '/app/node_modules/prisma/build/index.js', 'migrate', 'diff', '--from-schema-datasource', '/app/prisma/schema.prisma',
    '--to-schema-datamodel', '/app/prisma/schema.prisma', '--exit-code'], env);
}

const sentinel = `
INSERT INTO users (id,email,"passwordHash",name,"globalRole",plan,"updatedAt")
VALUES ('sentinel-user','sentinel@example.invalid','synthetic-password-hash','Preserve me','USER','BUSINESS',TIMESTAMP '2026-01-01');
INSERT INTO subscriptions (id,"userId",plan,status,provider,"stripeSubscriptionId","currentPeriodStart","currentPeriodEnd","updatedAt")
VALUES ('sentinel-sub','sentinel-user','BUSINESS','ACTIVE','stripe','sub_sentinel',TIMESTAMP '2026-01-01',TIMESTAMP '2027-01-01',TIMESTAMP '2026-01-01');
INSERT INTO payments (id,"userId","subscriptionId",provider,"providerPaymentId",amount,currency,status)
VALUES ('sentinel-payment','sentinel-user','sentinel-sub','stripe','payment_sentinel',49,'USD','COMPLETED');
INSERT INTO invoices (id,"userId","invoiceNumber",amount,currency,status)
VALUES ('sentinel-invoice','sentinel-user','invoice_sentinel',49,'USD','PAID');
`;

// Snapshot original fields and all nonmigration data, including any pre-adopted fields.
// New additive columns are excluded from before/after comparisons unless already present.
function snapshot(database) {
  const tables = sql(database, `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations' ORDER BY tablename;`).split('\n').filter(Boolean);
  return Object.fromEntries(tables.map(table => {
    if (!/^[a-z_]+$/.test(table)) throw new Error('Unexpected table name');
    const columns = sql(database, `SELECT quote_ident(column_name) FROM information_schema.columns WHERE table_schema='public' AND table_name='${table}' ORDER BY ordinal_position;`).split('\n').filter(Boolean);
    return [table, { columns, rows: sql(database, `SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb)::text FROM (SELECT ${columns.join(',')} FROM "${table}") t;`) }];
  }));
}

function preserved(database, before) {
  for (const [table, value] of Object.entries(before)) {
    const after = sql(database, `SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb)::text FROM (SELECT ${value.columns.join(',')} FROM "${table}") t;`);
    if (after !== value.rows) throw new Error(`Sentinel data changed in ${table}`);
  }
}

try {
  const all = ['fresh', 'baseline', 'partial', 'already', 'unbaselined', 'incompatible', 'duplicates', 'bad_index', 'auth_partial', 'auth_adopted', 'auth_incompatible'];
  const variants = process.argv[2] === '--variants' ? process.argv[3].split(',') : all;
  if (variants.some(variant => !all.includes(variant))) throw new Error('Unknown migration fixture');
  for (const variant of variants) {
    const database = `security_migration_${variant}_${suffix}`;
    command('docker', ['exec', run.postgres, 'createdb', '-U', run.dbUser, database]);
    if (variant !== 'fresh') sql(database, initial);
    if (variant === 'partial') sql(database, `ALTER TABLE users ADD COLUMN provider TEXT DEFAULT 'LOCAL'; ALTER TABLE subscriptions ADD COLUMN "paypalSubscriptionId" TEXT;`);
    if (variant === 'already') sql(database, forward);
    if (['auth_adopted', 'auth_incompatible'].includes(variant)) sql(database, forward);
    if (variant === 'auth_adopted') sql(database, auth);
    if (variant === 'auth_partial') sql(database, 'ALTER TABLE users ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 7;');
    if (variant === 'auth_incompatible') sql(database, 'ALTER TABLE users ADD COLUMN "tokenVersion" TEXT NOT NULL DEFAULT \'synthetic\';');
    if (variant === 'incompatible') sql(database, 'ALTER TABLE users ADD COLUMN "googleId" INTEGER;');
    if (variant === 'bad_index') sql(database, 'ALTER TABLE users ADD COLUMN "googleId" TEXT; CREATE INDEX "users_googleId_key" ON users("googleId");');
    if (variant === 'duplicates') sql(database, `ALTER TABLE users ADD COLUMN "googleId" TEXT;
      INSERT INTO users (id,email,"googleId","updatedAt") VALUES ('duplicate-one','one@example.invalid','duplicate-google-sub',now()),('duplicate-two','two@example.invalid','duplicate-google-sub',now());`);
    if (variant !== 'fresh') sql(database, sentinel);
    if (variant === 'already') sql(database, `
      UPDATE users SET provider='GOOGLE', "googleId"='google-sentinel' WHERE id='sentinel-user';
      UPDATE subscriptions SET "paypalSubscriptionId"='paypal-sentinel', interval='yearly',"trialEndsAt"=TIMESTAMP '2026-02-01' WHERE id='sentinel-sub';
      INSERT INTO webhook_events (id,"eventId",provider,"eventType",payload) VALUES ('sentinel-webhook','legacy-event','razorpay','payment.captured','{"synthetic":true}');`);
    const before = snapshot(database);
    const providerBefore = sql(database, `SELECT count(*) FROM information_schema.columns WHERE table_name='users' AND column_name='provider';`);
    if (variant === 'unbaselined') prisma(database, ['migrate', 'deploy'], 'P3005');
    if (variant !== 'fresh') prisma(database, ['migrate', 'resolve', '--applied', '20261031000000_initial_schema']);
    if (['auth_adopted', 'auth_incompatible'].includes(variant)) prisma(database, ['migrate', 'resolve', '--applied', '20261103000000_security_billing']);
    if (variant === 'auth_adopted') prisma(database, ['migrate', 'resolve', '--applied', '20261104000000_auth_revocation']);
    const rejecting = ['incompatible', 'duplicates', 'bad_index', 'auth_incompatible'].includes(variant);
    if (rejecting) {
      const expected = { incompatible: 'Incompatible schema', duplicates: 'could not create unique index', bad_index: 'Incompatible index', auth_incompatible: 'Incompatible users.tokenVersion' }[variant];
      let rejected = false;
      try { sql(database, variant === 'auth_incompatible' ? auth : forward); }
      catch (error) { if (error.detail?.includes(expected)) rejected = true; else throw error; }
      if (!rejected) throw new Error('Expected SQL schema rejection did not occur');
    }
    // Prisma 5 can mask a SQL exception inside BEGIN/COMMIT with PostgreSQL 25P02.
    // The direct SQL check above establishes the original failure reason first.
    prisma(database, ['migrate', 'deploy'], rejecting ? ['P3018', 'current transaction is aborted'] : undefined);
    preserved(database, before);
    if (rejecting) {
      // BEGIN/COMMIT must roll back every additive DDL change on incompatibility or duplicate values.
      if (sql(database, `SELECT count(*) FROM information_schema.columns WHERE table_name='users' AND column_name='provider';`) !== providerBefore) {
        throw new Error('Rejected migration left partial schema changes');
      }
    } else {
      diff(database);
      const expected = sql(database, `SELECT count(*) FROM information_schema.columns WHERE (table_name='users' AND column_name IN ('provider','googleId')) OR (table_name='subscriptions' AND column_name IN ('interval','trialEndsAt','paypalSubscriptionId','lastProviderEventAt'));`);
      if (expected !== '6') throw new Error('Required reconciliation columns are missing');
      prisma(database, ['migrate', 'deploy']);
      preserved(database, before);
    }
    results.push({ variant, database, result: rejecting ? 'correctly rejected; data and schema preserved' : 'migration, schema diff, repeat deploy, and data preservation passed' });
    console.log(`PASS: isolated migration ${variant}`);
  }
  writeFileSync(resolve(root, '.remediation/migration-results.json'), JSON.stringify({ run: run.project, image, results }, null, 2));
  writeFileSync(resolve(root, `.remediation/migration-results-${suffix}.json`), JSON.stringify({ run: run.project, image, results }, null, 2));
  console.log('Migration matrix passed. All isolated databases and containers retained.');
} catch (error) {
  writeFileSync(resolve(root, '.remediation/migration-results.json'), JSON.stringify({ run: run.project, image, results, failed: true, error: error.message }, null, 2));
  console.error(`Migration verification failed: ${error.message}`);
  process.exitCode = 1;
}
