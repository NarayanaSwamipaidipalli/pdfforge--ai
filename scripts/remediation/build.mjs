import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { command, readRun, root } from './isolated.mjs';

const kind = process.argv[2];
if (!['worker', 'api', 'web'].includes(kind)) throw new Error('Choose worker, api, or web');
const run = readRun();
const context = { worker: 'services/pdf-worker', api: 'apps/api', web: 'apps/web' }[kind];
const log = resolve(root, '.remediation', `${kind}-build.log`);
try {
  const output = command('docker', ['build', '--progress=plain', '--label', `pdfforge.remediation.run=${run.project}`,
    '-t', `${run.project}-${kind}:verification`, context], {}, { timeout: 1_800_000, combinedOutput: true });
  writeFileSync(log, output);
  console.log(`PASS ${kind} production image built: ${run.project}-${kind}:verification`);
} catch (error) {
  writeFileSync(log, error.detail || error.message);
  console.error(`FAIL ${kind} build; evidence saved in .remediation/${kind}-build.log`);
  process.exitCode = 1;
}
