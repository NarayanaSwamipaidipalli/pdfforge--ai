import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { root } from './isolated.mjs';

const fix = process.argv.includes('--fix');
const docker = process.argv.includes('--docker');
const npm = resolve(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
const evidence = resolve(root, '.remediation');
mkdirSync(evidence, { recursive: true });
let failed = false;
for (const app of ['api', 'web']) {
  const args = [npm, '--prefix', `apps/${app}`, 'audit', ...(fix ? ['fix', '--package-lock-only', '--ignore-scripts'] : ['--package-lock-only']),
    '--json', '--cache', resolve(evidence, 'npm-cache')];
  let binary = process.execPath;
  let runArgs = args;
  if (docker) {
    const { readRun } = await import('./isolated.mjs');
    const run = readRun();
    binary = 'docker';
    runArgs = ['run', '--name', `${run.project}-${app}-audit-${Date.now()}`, '--label', `pdfforge.remediation.run=${run.project}`,
      '--mount', `type=bind,source=${resolve(root, `apps/${app}/package.json`)},target=/scan/package.json,readonly`,
      '--mount', `type=bind,source=${resolve(root, `apps/${app}/package-lock.json`)},target=/scan/package-lock.json${fix ? '' : ',readonly'}`,
      '--workdir', '/scan', 'node:22-alpine', 'npm', 'audit', ...(fix ? ['fix', '--package-lock-only', '--ignore-scripts'] : ['--package-lock-only']), '--json'];
  }
  const result = spawnSync(binary, runArgs, { cwd: root, encoding: 'utf8', timeout: 240000, maxBuffer: 12 * 1024 * 1024 });
  writeFileSync(resolve(evidence, `${app}-audit${fix ? '-fix' : ''}.json`), result.stdout || '{}');
  try {
    const data = JSON.parse(result.stdout);
    console.log(JSON.stringify({ scope: app, action: fix ? 'compatible lockfile fixes' : 'all dependency audit', counts: data.metadata?.vulnerabilities, error: data.error?.code }));
    if (data.error || result.status !== 0) failed = true;
  } catch {
    console.log(`${app}: audit failed without usable JSON (${result.error?.code || result.status})`); failed = true;
  }
}
if (failed) process.exitCode = 1;
