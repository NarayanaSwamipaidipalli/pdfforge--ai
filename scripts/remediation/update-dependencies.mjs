// Resolves only package manifests in a new container; never installs into the host workspace.
import { resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
import { command, readRun, root } from './isolated.mjs';

const run = readRun(), file = resolve(root, 'apps/api/package.json');
// The checked-in manifest is authoritative. Review version changes there before resolving.
try {
  const output = command('docker', ['run', '--name', `${run.project}-dependency-lock-${Date.now()}`, '--label', `pdfforge.remediation.run=${run.project}`,
    '--mount', `type=bind,source=${file},target=/work/package.json,readonly`,
    '--mount', `type=bind,source=${resolve(root, 'apps/api/package-lock.json')},target=/work/package-lock.json`,
    '--workdir', '/work', 'node:22-alpine', 'npm', 'install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund'], {}, { timeout: 600000, combinedOutput: true });
  writeFileSync(resolve(root, '.remediation/dependency-lock-update.log'), output);
  console.log('PASS: compatible patched API dependency lockfile resolved; host dependencies and running services untouched.');
} catch (error) {
  writeFileSync(resolve(root, '.remediation/dependency-lock-error.log'), error.detail || error.message);
  console.error('Dependency resolution failed; private diagnostics retained.'); process.exitCode = 1;
}
