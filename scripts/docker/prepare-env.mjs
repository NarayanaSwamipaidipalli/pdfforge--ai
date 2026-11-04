import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

export const defaultMinioImage = 'cgr.dev/chainguard/minio@sha256:2136d593beacf4461187035eca949fe49abd589d5079735025c711ca58fee0c8';
const root = fileURLToPath(new URL('../../', import.meta.url));

export function resolveComposeSettings(envFile, environment = process.env) {
  const keys = ['POSTGRES_USER', 'POSTGRES_DB', 'POSTGRES_PASSWORD', 'MINIO_ROOT_USER', 'MINIO_ROOT_PASSWORD',
    'JWT_SECRET', 'JWT_REFRESH_SECRET', 'WORKER_CALLBACK_SECRET', 'MINIO_IMAGE', 'ALLOW_TEST_TOKENS'];
  const model = { services: { 'settings-check': { image: 'scratch', environment:
    Object.fromEntries(keys.map(key => [key, '${' + key + ':-}'])) } } };
  const result = spawnSync('docker', ['compose', '--project-name', 'pdfforge-settings-check', '--project-directory', root,
    '--env-file', envFile, '-f', '-', 'config', '--format', 'json'], {
    cwd: root, env: environment, input: JSON.stringify(model), encoding: 'utf8', timeout: 30000,
  });
  try {
    if (result.error || result.status !== 0) throw new Error();
    // Compose serializes literal dollars as $$ so its output can be read again.
    // Decode that serialization once. JSON also preserves multiline values safely.
    const settings = JSON.parse(result.stdout).services['settings-check'].environment;
    return Object.fromEntries(keys.map(key => [key, String(settings[key] || '').replace(/\$\$/g, '$')]));
  } catch { throw new Error('Docker Compose could not resolve the selected environment file; no settings changed'); }
}

export function prepareComposeEnvironment(original, values) {
  if (!values || typeof values !== 'object') throw new Error('Resolve settings with Docker Compose before preparing the environment');
  const required = ['POSTGRES_PASSWORD', 'MINIO_ROOT_USER', 'MINIO_ROOT_PASSWORD', 'JWT_SECRET', 'JWT_REFRESH_SECRET', 'WORKER_CALLBACK_SECRET'];
  const missing = required.filter(key => !values[key]);
  if (missing.length) throw new Error(`Supply these settings before setup: ${missing.join(', ')}`);
  const secretKeys = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'WORKER_CALLBACK_SECRET'];
  const weak = secretKeys.filter(key => values[key].length < 32 || /change.?me|your[-_ ]|example|pdfforge[-_](enterprise|worker)|minioadmin/i.test(values[key]));
  if (weak.length) throw new Error(`Production validation rejects these settings; existing values were preserved: ${weak.join(', ')}`);
  if (new Set(secretKeys.map(key => values[key])).size !== 3) throw new Error('JWT and worker secrets must be different; existing values were preserved');
  if (values.ALLOW_TEST_TOKENS === 'true') throw new Error('Remove ALLOW_TEST_TOKENS=true before startup');
  const user = values.POSTGRES_USER || 'pdfforge';
  const database = values.POSTGRES_DB || 'pdfforge_db';
  const uri = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(values.POSTGRES_PASSWORD)}@postgres:5432/${encodeURIComponent(database)}?schema=public`;
  const updates = { COMPOSE_DATABASE_URL: uri, MINIO_IMAGE: values.MINIO_IMAGE || defaultMinioImage };
  let text = original;
  for (const [key, value] of Object.entries(updates)) {
    if (/[\r\n]/.test(value)) throw new Error(`${key} must be a single-line value`);
    const line = `${key}=${JSON.stringify(value)}`;
    const pattern = new RegExp(`^\\s*(?:export\\s+)?${key}\\s*=.*$`, 'gm');
    text = pattern.test(text) ? text.replace(pattern, () => line) : `${text.replace(/\s*$/, '')}\n${line}\n`;
  }
  return text;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 2 || args[0] !== '--env-file') throw new Error('Usage: node scripts/docker/prepare-env.mjs --env-file .env.docker.local');
    const target = resolve(root, args[1]);
    const local = relative(root, target);
    if (local.startsWith('..') || isAbsolute(local) || /(^|[\\/])\.env\.example$/.test(local)) throw new Error('Select a private environment file inside this repository, not an example template');
    let original;
    try { original = readFileSync(target, 'utf8'); } catch { throw new Error('Environment file is missing; copy .env.example to a private .env.docker.local file and supply your credentials first'); }
    const updated = prepareComposeEnvironment(original, resolveComposeSettings(target));
    if (updated !== original) writeFileSync(target, updated, { mode: 0o600 });
    console.log('Compose environment prepared. Only MINIO_IMAGE and COMPOSE_DATABASE_URL were set; existing credentials were preserved.');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
