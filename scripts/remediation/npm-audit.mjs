// Full npm audit including propagated advisories. Only public manifests are mounted.
import { resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
import { command, readRun, root } from './isolated.mjs';
const run = readRun(); let failed = false;
for (const app of ['api', 'web']) for (const production of [false, true]) {
  let output, failure;
  try {
    output = command('docker', ['run', '--name', `${run.project}-${app}-npm-audit-${production ? 'production' : 'all'}-${Date.now()}`,
      '--label', `pdfforge.remediation.run=${run.project}`,
      ...['package.json', 'package-lock.json'].flatMap(file => ['--mount', `type=bind,source=${resolve(root, 'apps', app, file)},target=/verification/${file},readonly`]),
      '--workdir', '/verification', '--entrypoint', 'npm', `${run.project}-api-test:verification`,
      'audit', '--package-lock-only', '--audit-level=high', ...(production ? ['--omit=dev'] : []), '--json']);
  } catch (error) { failure = error; output = error.detail; }
  try {
    const start = output.indexOf('{'), end = output.lastIndexOf('}');
    const report = JSON.parse(output.slice(start, end + 1));
    writeFileSync(resolve(root, `.remediation/${app}-npm-audit${production ? '-production' : ''}.json`), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ app, scope: production ? 'production' : 'all', npmAudit: report.metadata?.vulnerabilities }));
    if (!report.metadata || failure || report.metadata.vulnerabilities.high || report.metadata.vulnerabilities.critical) failed = true;
  } catch { console.error(`${app}: npm audit did not complete`); failed = true; }
}
if (failed) process.exitCode = 1;
