// Uses the real Compose model with private synthetic settings and entirely new resources.
// Does not load .env, publish ports, reuse volumes, stop services, or perform cleanup.
import { randomBytes } from 'node:crypto';
import { closeSync, mkdirSync, openSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { command, root } from '../remediation/isolated.mjs';
import { prepareComposeEnvironment, resolveComposeSettings } from './prepare-env.mjs';

const project = `pdfforge-compose-check-${Date.now()}-${randomBytes(4).toString('hex')}`;
const evidence = resolve(root, '.remediation', project);
mkdirSync(evidence, { recursive: true });
const tracked = ['pdfforge-api-gateway', 'pdfforge-postgres', 'pdfforge-redis', 'pdfforge-minio'];
const inspect = names => command('docker', ['inspect', '--format', '{{.Id}} {{.State.StartedAt}} {{.Name}}', ...names]);
const running = command('docker', ['ps', '--format', '{{.Names}}']).split('\n');
const existing = tracked.filter(name => running.includes(name));
const original = existing.length ? inspect(existing) : '';
const credentials = {
  POSTGRES_USER: 'compose_fixture', POSTGRES_DB: 'compose_fixture',
  POSTGRES_PASSWORD: `fixture:@/#%$'${randomBytes(24).toString('hex')}`,
  MINIO_ROOT_USER: 'compose_fixture', MINIO_ROOT_PASSWORD: randomBytes(32).toString('hex'),
  JWT_SECRET: randomBytes(48).toString('hex'), JWT_REFRESH_SECRET: randomBytes(48).toString('hex'),
  WORKER_CALLBACK_SECRET: randomBytes(48).toString('hex'),
  AWS_REGION: 'us-east-1', S3_BUCKET_NAME: 'compose-fixtures', FRONTEND_URL: 'https://compose.fixture.invalid',
};
const envPath = resolve(evidence, 'fixture.env');
const cleanEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|USERPROFILE|HOMEDRIVE|HOMEPATH|PROGRAMDATA|APPDATA|LOCALAPPDATA|DOCKER_CONFIG)$/i.test(key)));
const initialEnvironment = Object.entries(credentials).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join('\n');
writeFileSync(envPath, initialEnvironment, { mode: 0o600 });
writeFileSync(envPath, prepareComposeEnvironment(initialEnvironment, resolveComposeSettings(envPath, cleanEnv)), { mode: 0o600 });
const services = ['postgres', 'redis', 'minio', 'ollama', 'api-gateway', 'pdf-worker', 'celery-worker', 'web', 'migrate', 'storage-init'];
const images = { 'api-gateway': `${project}-api:check`, migrate: `${project}-api:check`,
  'pdf-worker': `${project}-worker:check`, 'celery-worker': `${project}-worker:check`, 'storage-init': `${project}-worker:check` };
const override = ['services:', ...services.flatMap(service => [
  `  ${service}:`, `    container_name: ${project}-${service}`, '    ports: !reset []',
  ...(images[service] ? [`    image: ${images[service]}`] : []),
  '    labels:', `      pdfforge.compose.check: ${project}`,
]), 'networks:', '  default:', `    name: ${project}-network`, '    internal: true', 'volumes:',
...['postgres_data', 'redis_data', 'minio_data', 'ollama_models'].flatMap(volume => [
  `  ${volume}:`, `    name: ${project}-${volume}`, '    labels:', `      pdfforge.compose.check: ${project}`,
])].join('\n');
const overridePath = resolve(evidence, 'override.yml');
writeFileSync(overridePath, override);
const base = ['compose', '--project-name', project, '--env-file', envPath,
  '-f', resolve(root, 'docker-compose.yml'), '-f', overridePath, '--profile', 'setup'];
let counter = 0;
function compose(args, options = {}) {
  const log = resolve(evidence, `${++counter}-${args[0]}.log`);
  const descriptor = openSync(log, 'w', 0o600);
  const safeEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|USERPROFILE|HOMEDRIVE|HOMEPATH|PROGRAMDATA|APPDATA|LOCALAPPDATA|DOCKER_CONFIG)$/i.test(key)));
  try {
    const result = spawnSync('docker', [...base, ...args], { cwd: root, env: safeEnv,
      encoding: 'utf8', timeout: options.timeout || 600_000, stdio: ['ignore', descriptor, descriptor] });
    if (result.error || result.status !== 0) throw new Error(`Isolated Compose ${args[0]} failed; private diagnostics retained`);
  } finally { closeSync(descriptor); }
}
try {
  // Config stdout is captured privately and never printed, because it contains credentials.
  const model = JSON.parse(command('docker', [...base, 'config', '--format', 'json']));
  for (const service of Object.values(model.services)) {
    if (!service.container_name.startsWith(`${project}-`) || service.ports?.length) throw new Error('Unsafe container name or published port');
  }
  for (const volume of Object.values(model.volumes)) if (!volume.name.startsWith(`${project}-`)) throw new Error('Unsafe volume name');
  if (!model.networks.default.internal) throw new Error('Verification network must be internal');
  const database = new URL(model.services['api-gateway'].environment.DATABASE_URL);
  if (decodeURIComponent(database.password) !== credentials.POSTGRES_PASSWORD || database.hostname !== 'postgres') throw new Error('PostgreSQL credentials were not preserved through Compose');
  if (model.services['api-gateway'].environment.CORS_ORIGINS !== credentials.FRONTEND_URL) throw new Error('CORS default did not follow the configured frontend origin');
  for (const service of ['api-gateway', 'pdf-worker', 'celery-worker', 'storage-init']) {
    const env = model.services[service].environment;
    if (env.AWS_REGION !== credentials.AWS_REGION || env.S3_BUCKET_NAME !== credentials.S3_BUCKET_NAME) throw new Error('Storage region/bucket settings differ between services');
  }
  for (const service of ['pdf-worker', 'celery-worker']) {
    const env = model.services[service].environment;
    if (env.WORKER_CALLBACK_SECRET !== credentials.WORKER_CALLBACK_SECRET || env.ENVIRONMENT !== 'production' || !env.CELERY_RESULT_BACKEND) throw new Error('Worker production environment mismatch');
  }
  console.log('PASS: real Compose configuration; encoded credentials, production worker settings, isolated names/volumes/network and no published ports.');
  const syntaxCases = [
    { name: 'unquoted-hash', line: 'POSTGRES_PASSWORD=fixture#suffix', expected: 'fixture#suffix' },
    { name: 'interpolation', line: 'FIXTURE_SUFFIX=suffix\nPOSTGRES_PASSWORD=fixture${FIXTURE_SUFFIX}', expected: 'fixturesuffix' },
    { name: 'literal-dollars', line: "POSTGRES_PASSWORD='fixture$$literal${UNCHANGED}:@/#'", expected: 'fixture$$literal${UNCHANGED}:@/#' },
    { name: 'multiline', line: 'POSTGRES_PASSWORD="fixture\nsecond-line"', expected: 'fixture\nsecond-line' },
  ];
  for (const fixture of syntaxCases) {
    const file = resolve(evidence, `${fixture.name}.env`);
    const source = initialEnvironment.replace(/^POSTGRES_PASSWORD=.*$/m, () => fixture.line);
    writeFileSync(file, source, { mode: 0o600 });
    const resolved = resolveComposeSettings(file, cleanEnv);
    if (resolved.POSTGRES_PASSWORD !== fixture.expected) throw new Error(`Compose credential syntax resolution mismatch (${fixture.name})`);
    const prepared = prepareComposeEnvironment(source, resolved);
    writeFileSync(file, prepared, { mode: 0o600 });
    const args = [...base]; args[args.indexOf('--env-file') + 1] = file;
    const checked = JSON.parse(command('docker', [...args, 'config', '--format', 'json']));
    const encoded = new URL(checked.services['api-gateway'].environment.DATABASE_URL);
    if (decodeURIComponent(encoded.password) !== fixture.expected) throw new Error(`Composed database URL changed the resolved credential (${fixture.name})`);
  }
  console.log('PASS: four real Compose parsing regressions: unquoted hash, interpolation, literal dollars and multiline credentials.');
  if (process.argv.includes('--config-only')) {
    console.log('Configuration-only verification complete; no services created.');
  } else {
    compose(['build', 'api-gateway', 'pdf-worker'], { timeout: 1_800_000 });
    console.log('PASS: API and worker images built from current source.');
    compose(['up', '-d', '--no-build', 'postgres', 'redis', 'minio']);
    compose(['run', '--pull', 'never', '--name', `${project}-migration-check`, 'migrate']);
    console.log('PASS: explicit migration setup against a fresh isolated database.');
    compose(['run', '--pull', 'never', '--name', `${project}-storage-check`, 'storage-init']);
    compose(['run', '--pull', 'never', '--name', `${project}-storage-repeat-check`, 'storage-init']);
    console.log('PASS: explicit storage setup and repeat setup preserve the existing bucket.');
    compose(['up', '-d', '--no-build', 'api-gateway', 'pdf-worker', 'celery-worker']);
    const probe = String.raw`import time, urllib.request
for attempt in range(60):
    try:
        for url in ('http://api-gateway:4000/api/v1/health/ready', 'http://pdf-worker:8000/health'):
            with urllib.request.urlopen(url, timeout=2) as result:
                assert result.status == 200
        print('PASS: production API readiness and worker health over isolated Compose network')
        break
    except Exception:
        if attempt == 59: raise RuntimeError('Isolated API or worker did not become ready') from None
        time.sleep(1)
`;
    compose(['run', '--pull', 'never', '--no-deps', '--name', `${project}-health-check`, 'storage-init', 'python', '-c', probe], { timeout: 150_000 });
    for (const name of ['postgres', 'redis', 'minio', 'api-gateway', 'pdf-worker', 'celery-worker']) {
      const status = command('docker', ['inspect', '--format', '{{.State.Status}}', `${project}-${name}`]);
      if (status !== 'running') throw new Error(`Isolated ${name} is not running`);
    }
    console.log('PASS: all six isolated infrastructure/API/worker processes are running.');
  }
  if ((existing.length ? inspect(existing) : '') !== original) throw new Error('Existing development container identity/start timestamps changed during verification');
  writeFileSync(resolve(evidence, 'result.json'), JSON.stringify({ project, result: 'PASS', configOnly: process.argv.includes('--config-only'), existingContainersUnchanged: true, retained: true }, null, 2));
  console.log('PASS: existing development containers retain the same IDs and start timestamps. Test resources retained.');
  console.log(`Evidence: .remediation/${project}`);
} catch (error) {
  writeFileSync(resolve(evidence, 'result.json'), JSON.stringify({ project, result: 'FAIL', error: error.message }, null, 2));
  console.error(error.message);
  console.error('Only the new isolated project was used. Its resources and private diagnostics are retained.');
  process.exitCode = 1;
}
