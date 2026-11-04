import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { root } from './isolated.mjs';

const directory = resolve(root, '.remediation/prisma-client-generation');
mkdirSync(directory, { recursive: true });
const schema = readFileSync(resolve(root, 'apps/api/prisma/schema.prisma'), 'utf8')
  .replace('provider        = "prisma-client-js"', 'provider        = "prisma-client-js"\n  output = "../../apps/api/node_modules/.prisma/client"');
writeFileSync(resolve(directory, 'schema.prisma'), schema);
const safeEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|USERPROFILE|APPDATA|LOCALAPPDATA)$/i.test(key)));
const result = spawnSync(process.execPath, [resolve(root, 'apps/api/node_modules/prisma/build/index.js'), 'generate', '--schema', resolve(directory, 'schema.prisma')], {
  cwd: directory, env: { ...safeEnv, DATABASE_URL: 'postgresql://fixture:fixture@127.0.0.1:1/unused' }, encoding: 'utf8', timeout: 120000,
});
if (result.status !== 0) { writeFileSync(resolve(directory, 'error.log'), result.stderr || result.stdout || 'Generation failed'); console.error('Prisma client generation failed; private diagnostics retained'); process.exitCode = 1; }
else console.log('PASS: Prisma client generated from copied schema without environment-file loading or database access.');
