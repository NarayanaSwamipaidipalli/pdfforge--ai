import { resolve } from 'node:path';
import { command, readRun, root } from './isolated.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
const run = readRun();
let failed = false;
for (const app of ['api', 'web']) {
  const name = `${run.project}-${app}-registry-audit-${Date.now()}`;
  try {
    command('docker', ['run', '--name', name, '--label', `pdfforge.remediation.run=${run.project}`,
      '--mount', `type=bind,source=${resolve(root, 'scripts/remediation/registry-audit.cjs')},target=/verification/registry-audit.cjs,readonly`,
      '--mount', `type=bind,source=${resolve(root, `apps/${app}/package-lock.json`)},target=/verification/package-lock.json,readonly`,
      '--entrypoint', 'node', `${run.project}-api:verification`, '/verification/registry-audit.cjs']);
  } catch { failed = true; }
  const target = resolve(root, `.remediation/${app}-registry-audit.json`);
  try {
    command('docker', ['cp', `${name}:/tmp/registry-audit.json`, target]);
    const result = JSON.parse(readFileSync(target, 'utf8'));
    const counts = result.findings.reduce((counts, finding) => { counts[finding.severity] = (counts[finding.severity] || 0) + 1; return counts; }, {});
    console.log(JSON.stringify({ app, counts, findings: result.findings.map(f => ({ package: f.package, version: f.version, severity: f.severity, devOnly: f.devOnly, range: f.vulnerableRange })) }));
  } catch { writeFileSync(resolve(root, `.remediation/${app}-registry-error.txt`), 'Advisory report unavailable'); console.error(`${app} advisory lookup did not complete`); failed = true; }
}
if (failed) process.exitCode = 1;
