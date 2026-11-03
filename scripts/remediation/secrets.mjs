import { mkdirSync, copyFileSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, resolve, relative, isAbsolute } from 'node:path';
import { command, readRun, root } from './isolated.mjs';

const run = readRun();
const snapshot = resolve(root, '.remediation', `scan-source-${Date.now()}`);
const files = command('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard']).split('\0').filter(Boolean);
for (const file of files) {
  if (/(^|\/)(\.remediation|migration-backups|node_modules|\.git|\.next|\.pytest_cache)(\/|$)/.test(file)) continue;
  const source = resolve(root, file), target = resolve(snapshot, file);
  const rel = relative(root, source);
  if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('Unsafe snapshot path');
  mkdirSync(dirname(target), { recursive: true }); copyFileSync(source, target);
}
const name = `${run.project}-secret-scan-${Date.now()}`;
let failure;
try {
  command('docker', ['run', '--name', name, '--network', 'none', '--label', `pdfforge.remediation.run=${run.project}`,
    '--mount', `type=bind,source=${snapshot},target=/scan,readonly`, 'ghcr.io/gitleaks/gitleaks:v8.30.1',
    'dir', '/scan', '--redact', '--no-banner', '--report-format', 'json', '--report-path', '/tmp/findings.json']);
} catch (error) { failure = error; }
const report = resolve(root, '.remediation', 'secret-scan.json');
try {
  command('docker', ['cp', `${name}:/tmp/findings.json`, report]);
  const findings = JSON.parse(readFileSync(report, 'utf8'));
  console.log(JSON.stringify({ secretScanFindings: findings.map(finding => ({ rule: finding.RuleID, file: finding.File, line: finding.StartLine })) }));
  if (findings.length || failure) process.exitCode = 1;
} catch {
  writeFileSync(resolve(root, '.remediation/secret-scan-error.log'), failure?.detail || 'Scanner report unavailable');
  console.error('Secret scanning did not complete; private evidence retained.'); process.exitCode = 1;
}
