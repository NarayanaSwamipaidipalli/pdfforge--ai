// Installs only this repository's local pre-push hook. Never overwrites another hook.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, lstatSync, chmodSync, realpathSync } from 'node:fs';
import { dirname, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = realpathSync(fileURLToPath(new URL('../../', import.meta.url)));
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
let configured = '';
try { configured = git(['config', '--get', 'core.hooksPath']); } catch (error) { if (error.status !== 1) throw new Error('Cannot inspect Git hook configuration'); }
if (configured) throw new Error('An existing core.hooksPath is configured; refusing to replace it. Keep pushes blocked and integrate the guard with its owner.');
const directory = resolve(root, git(['rev-parse', '--git-dir']), 'hooks');
const rel = relative(root, directory);
if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('Git hooks directory is outside this workspace; no changes made');
for (let path = directory; path !== root; path = dirname(path)) {
  if (existsSync(path) && lstatSync(path).isSymbolicLink()) throw new Error('Refusing a symlinked Git hook directory');
}
const target = resolve(directory, 'pre-push');
const source = readFileSync(resolve(root, 'scripts/deployment/pre-push'), 'utf8').replace(/\r\n/g, '\n');
if (existsSync(target)) {
  if (lstatSync(target).isSymbolicLink() || readFileSync(target, 'utf8').replace(/\r\n/g, '\n') !== source) throw new Error('An existing pre-push hook is present; preserved without changes');
} else {
  mkdirSync(directory, { recursive: true }); writeFileSync(target, source, { flag: 'wx', mode: 0o755 });
}
chmodSync(target, 0o755);
console.log('PASS local pre-push guard installed; no remote connection or push performed.');
