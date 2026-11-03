import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { command, readRun, root } from './isolated.mjs';

const run = readRun();
const action = process.argv[2] || 'test';
if (!['test', 'audit'].includes(action)) throw new Error('Choose test or audit');
const tag = `${run.project}-worker:verification`;
const label = command('docker', ['image', 'inspect', '--format', '{{index .Config.Labels "pdfforge.remediation.run"}}', tag]);
if (label !== run.project) throw new Error('Image ownership check failed');
const name = `${run.project}-worker-${action}-${Date.now()}`;
const common = ['run', '--name', name, '--label', `pdfforge.remediation.run=${run.project}`];
try {
  if (action === 'test') {
    const output = command('docker', [...common, '--network', 'none', '--env', 'ENVIRONMENT=test',
      '--env', 'TEST_ARTIFACT_DIR=/tmp/remediation-evidence', tag,
      'python', '-m', 'unittest', 'discover', '-s', 'tests', '-v'], {}, { combinedOutput: true });
    writeFileSync(resolve(root, '.remediation/worker-tests.log'), output);
    console.log(output.split('\n').filter(line => /^Ran \d+ tests|^OK$|^FAILED|^LibreOffice/.test(line)).join('\n'));
    mkdirSync(resolve(root, '.remediation/conversion'), { recursive: true });
    command('docker', ['cp', `${name}:/tmp/remediation-evidence/.`, resolve(root, '.remediation/conversion')]);
    console.log('PASS worker image tests; conversion evidence copied to .remediation/conversion. Test container retained.');
  } else {
    let auditFailure;
    try {
      command('docker', [...common, '--env', 'ENVIRONMENT=test', '--entrypoint', 'sh', tag, '-c',
        'python -m pip install --disable-pip-version-check --no-cache-dir --target /tmp/auditor pip-audit >/tmp/auditor-install.log 2>&1 && PYTHONPATH=/tmp/auditor python -m pip_audit --format json --output /tmp/worker-audit.json'], {}, { combinedOutput: true });
    } catch (error) { auditFailure = error; }
    const target = resolve(root, '.remediation/worker-audit.json');
    command('docker', ['cp', `${name}:/tmp/worker-audit.json`, target]);
    const audit = JSON.parse(readFileSync(target, 'utf8'));
    const findings = audit.dependencies.filter(dep => dep.vulns?.length).map(dep => ({ package: dep.name, version: dep.version, vulnerabilities: dep.vulns.map(v => ({ id: v.id, fixes: v.fix_versions })) }));
    console.log(JSON.stringify({ workerDependencyFindings: findings }));
    if (findings.length || auditFailure) process.exitCode = 1;
  }
} catch (error) {
  writeFileSync(resolve(root, `.remediation/worker-${action}-error.log`), error.detail || error.message);
  console.error(`FAIL worker ${action}; details retained locally without printing credentials.`);
  process.exitCode = 1;
}
