// CI only: fresh labeled resources, synthetic data, no .env loading or cleanup.
import { spawnSync } from 'node:child_process';
import { readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { root } from './isolated.mjs';
import { defaultMinioImage } from '../docker/prepare-env.mjs';
const env = { ...process.env, PDFFORGE_SECURITY_MANIFEST: '.remediation/security-run-ci.json' };
function execute(binary, args) {
  const result = spawnSync(binary, args, { cwd: root, env, stdio: 'inherit', timeout: 3_600_000 });
  if (result.error || result.status !== 0) throw new Error(`CI step failed: ${binary} ${args.join(' ')}`);
}
const script = (name, ...args) => execute(process.execPath, [`scripts/remediation/${name}.mjs`, ...args]);
script('isolated', 'prepare');
for (const image of ['redis:7.4-alpine', defaultMinioImage, 'ghcr.io/gitleaks/gitleaks:v8.30.1']) execute('docker', ['pull', image]);
for (const kind of ['api', 'api-test', 'worker', 'web']) script('build', kind);
script('api-tests'); script('worker', 'test'); script('worker', 'audit');
script('secrets'); script('dependencies'); script('npm-audit'); script('render'); script('migrations'); script('auth'); script('billing'); script('pipeline');
const successful = readdirSync(resolve(root, '.remediation')).filter(name => /^pipeline-[a-f0-9]{8}$/.test(name) && existsSync(resolve(root, '.remediation', name, 'pdf-validation.json')));
if (successful.length !== 1) throw new Error('CI requires exactly one successful fresh pipeline');
const directory = `.remediation/${successful[0]}`;
script('web-runtime', directory); script('performance', directory); script('backup', directory);
