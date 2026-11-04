import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
import { command, readRun, root } from './isolated.mjs';
const run = readRun();
try {
  const output = command('docker', ['run', '--name', `${run.project}-render-schema-${randomBytes(4).toString('hex')}`,
    '--label', `pdfforge.remediation.run=${run.project}`,
    '--mount', `type=bind,source=${resolve(root, 'scripts/remediation/validate-render.cjs')},target=/verification/validate-render.cjs,readonly`,
    '--mount', `type=bind,source=${resolve(root, 'render.yaml')},target=/verification/render.yaml,readonly`,
    '--entrypoint', 'node', `${run.project}-api-test:verification`, '/verification/validate-render.cjs']);
  writeFileSync(resolve(root, '.remediation/render-validation.txt'), output); console.log(output);
} catch (error) {
  writeFileSync(resolve(root, '.remediation/render-error-private.txt'), error.detail || error.message);
  console.error('FAIL official Render schema validation; private diagnostics retained.'); process.exitCode = 1;
}
