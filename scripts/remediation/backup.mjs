// Restore drill for synthetic pipeline data only. Never accepts a live database URL.
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { resolve } from 'node:path';
import { command, readRun, root } from './isolated.mjs';

const run = readRun(), location = process.argv[2];
if (!/^\.remediation[\\/]pipeline-[a-f0-9]{8}$/.test(location || '')) throw new Error('Select isolated pipeline evidence');
const directory = resolve(root, location), pipeline = JSON.parse(readFileSync(resolve(directory, 'resources.json'), 'utf8'));
if (pipeline.project !== run.project || pipeline.network !== run.network || !/^security_pipeline_[a-f0-9]{8}$/.test(pipeline.database)) throw new Error('Unsafe backup source');
const suffix = randomBytes(4).toString('hex'), restored = `security_restore_${suffix}`, dump = `/tmp/synthetic-${suffix}.dump`;
const snapshotSql = `SELECT format('SELECT %L AS name, count(*) AS rows, md5(coalesce(string_agg(row_to_json(t)::text, chr(10) ORDER BY row_to_json(t)::text), %L)) AS digest FROM %I.%I t;',
  tablename, '', schemaname, tablename) FROM pg_tables WHERE schemaname='public' ORDER BY tablename;`;
function sql(database, query) {
  return command('docker', ['exec', run.postgres, 'psql', '-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-U', run.dbUser, '-d', database, '-c', query]);
}
function snapshot(database) {
  return sql(database, snapshotSql).split('\n').filter(Boolean).map(query => sql(database, query)).join('\n');
}
try {
  const before = snapshot(pipeline.database);
  command('docker', ['exec', run.postgres, 'pg_dump', '-U', run.dbUser, '-d', pipeline.database, '-Fc', '--no-owner', '--no-acl', '-f', dump]);
  const target = resolve(directory, 'synthetic-backup.dump');
  command('docker', ['cp', `${run.postgres}:${dump}`, target]); chmodSync(target, 0o600);
  command('docker', ['exec', run.postgres, 'createdb', '-U', run.dbUser, restored]);
  command('docker', ['exec', run.postgres, 'pg_restore', '-U', run.dbUser, '-d', restored, '--no-owner', '--no-acl', '--exit-on-error', dump]);
  if (before !== snapshot(restored) || before !== snapshot(pipeline.database)) throw new Error('Synthetic restore did not preserve all table contents');
  const result = { result: 'PASS', scope: 'Synthetic isolated data only; not a live Render backup', tablesCompared: before.split('\n').length,
    sourceUnchanged: true, restoredRowCountsAndContentsMatch: true, restoreDatabase: restored };
  writeFileSync(resolve(directory, 'backup-results.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
} catch (error) {
  writeFileSync(resolve(directory, 'backup-error-private.txt'), error.detail || error.message, { mode: 0o600 });
  console.error('FAIL synthetic backup/restore; resources retained and private diagnostics saved.'); process.exitCode = 1;
}
