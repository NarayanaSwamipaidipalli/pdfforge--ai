import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
import { command, readRun, root } from './isolated.mjs';
const run = readRun(), suffix = randomBytes(4).toString('hex'), image = `${run.project}-api-test:verification`;
try {
  const output = command('docker', ['run', '--name', `${run.project}-api-tests-${suffix}`, '--network', 'none',
    '--label', `pdfforge.remediation.run=${run.project}`, '--env', 'NODE_ENV=test', '--env', 'LOAD_LOCAL_ENV=false',
    '--mount', `type=bind,source=${resolve(root, 'apps/api/src')},target=/app/src,readonly`,
    '--entrypoint', 'node', image, 'node_modules/jest/bin/jest.js', '--runInBand'], {}, { combinedOutput: true });
  writeFileSync(resolve(root, '.remediation/api-tests.log'), output);
  console.log(output.split('\n').filter(line => /^(Test Suites:|Tests:|Time:)/.test(line)).join('\n'));
  console.log('PASS: API tests in the final dependency image with networking disabled.');
} catch (error) {
  writeFileSync(resolve(root, '.remediation/api-tests.log'), error.detail || error.message);
  console.error('FAIL API tests; private diagnostics retained.'); process.exitCode = 1;
}
