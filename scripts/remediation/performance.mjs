import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { command, readRun, root } from './isolated.mjs';

const run = readRun(), location = process.argv[2];
if (!location || !/^\.remediation[\\/]pipeline-[a-f0-9]{8}$/.test(location)) throw new Error('Select an isolated pipeline evidence directory');
const directory = resolve(root, location), pipeline = JSON.parse(readFileSync(resolve(directory, 'resources.json'), 'utf8'));
if (pipeline.project !== run.project || pipeline.network !== run.network || !/^pdfforge-[a-f0-9]{8}-pipeline-api$/.test(pipeline.names.api)) throw new Error('Unsafe performance target');
for (const name of [pipeline.names.api, pipeline.names.worker, pipeline.names.celery]) {
  if (command('docker', ['inspect', '--format', '{{index .Config.Labels "pdfforge.remediation.run"}}', name]) !== run.project) throw new Error('Performance target ownership mismatch');
}
const suffix = randomBytes(4).toString('hex'), name = `${run.project}-performance-${suffix}`;
const env = { PERF_API_URL: `http://${pipeline.names.api}:4000`, PERF_S3_HOST: pipeline.names.minio, EXPECTED_API_HOST: pipeline.names.api };
try {
  const args = ['run', '--name', name, '--network', run.network, '--label', `pdfforge.remediation.run=${run.project}`,
    '--mount', `type=bind,source=${resolve(root, 'scripts/remediation/performance-runner.cjs')},target=/verification/performance.cjs,readonly`,
    '--mount', `type=bind,source=${resolve(root, '.remediation/conversion/image-table-fixture.docx')},target=/verification/input.docx,readonly`];
  for (const key of Object.keys(env)) args.push('--env', key);
  const output = command('docker', [...args, '--entrypoint', 'node', `${run.project}-api:verification`, '/verification/performance.cjs'], env, { timeout: 240000 });
  command('docker', ['cp', `${name}:/tmp/performance-results.json`, resolve(directory, 'performance-results.json')]);
  writeFileSync(resolve(directory, 'performance-results.txt'), output); console.log(output);
} catch (error) {
  writeFileSync(resolve(directory, 'performance-private-error.txt'), error.detail || error.message, { mode: 0o600 });
  console.error('FAIL: bounded isolated performance checks; private diagnostics retained.'); process.exitCode = 1;
}
