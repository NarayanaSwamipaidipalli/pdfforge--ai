/**
 * Safe local authentication regressions. No URL, database, service, or OAuth test-token bypass is used.
 * Run from the repository: node scripts/verify_google_auth.js
 * Real HTTP/database coverage belongs to the explicitly isolated remediation integration harness.
 */
const path = require('path');
const { spawnSync } = require('child_process');
const api = path.resolve(__dirname, '../apps/api');
const jest = path.join(api, 'node_modules/jest/bin/jest.js');
const env = { NODE_ENV: 'test', JWT_SECRET: 'a'.repeat(64), JWT_REFRESH_SECRET: 'b'.repeat(64) };
// Preserve process execution essentials, without inheriting service URLs or credentials.
for (const key of ['SystemRoot', 'SYSTEMROOT', 'WINDIR', 'PATH', 'Path', 'PATHEXT', 'TEMP', 'TMP']) {
  if (process.env[key]) env[key] = process.env[key];
}
const result = spawnSync(process.execPath, [jest, '--runInBand', '--no-cache',
  'auth.service.spec.ts', 'auth.security.spec.ts', 'auth.controller.spec.ts', 'jwt-auth.guard.spec.ts'],
  { cwd: api, env, stdio: 'inherit', windowsHide: true });
if (result.error) console.error('Could not start the local authentication regression runner. Install API dependencies first.');
process.exitCode = result.status === null ? 1 : result.status;
