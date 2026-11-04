const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadYaml, verifyStaging, verifyWorkflow, effectiveEnv, appRequire } = require('./render-config.cjs');
const production = () => loadYaml('render.yaml'), staging = () => loadYaml('render.staging.yaml');
const environment = value => value.projects[0].environments[0];
const service = (value, role) => environment(value).services.find(s => s.name === `doxera-staging-${role}`);
const entry = (value, role, key) => service(value, role).envVars.find(e => e.key === key);

test('both Blueprint contracts pass and expose environment names only', () => {
  const inventory = verifyStaging(production(), staging());
  assert.ok(inventory['doxera-staging-api'].includes('JWT_SECRET'));
  assert.ok(inventory['doxera-staging-worker'].includes('CELERY_BROKER_URL'));
});
for (const mode of ['commit', 'checksPass', undefined]) test(`rejects automatic deploy trigger ${mode}`, () => {
  const value = staging(); service(value, 'api').autoDeployTrigger = mode;
  assert.throws(() => verifyStaging(production(), value), /automatic deploys/);
});
test('rejects Render-ignored secret declarations inside groups', () => {
  const value = staging(); environment(value).envVarGroups[0].envVars.push({ key: 'IGNORED_SECRET', sync: false });
  assert.throws(() => verifyStaging(production(), value), /ignores sync:false/);
});
test('rejects production database references even when the variable name is correct', () => {
  const value = staging(); entry(value, 'api', 'DATABASE_URL').fromDatabase.name = 'pdfforge-postgres';
  assert.throws(() => verifyStaging(production(), value), /database reference/);
});
test('rejects external groups and missing required worker names', () => {
  const value = staging(); service(value, 'worker').envVars = service(value, 'worker').envVars.filter(e => e.key !== 'CELERY_BROKER_URL');
  assert.throws(() => verifyStaging(production(), value), /missing required environment name CELERY_BROKER_URL/);
  service(value, 'worker').envVars.unshift({ fromGroup: 'pdfforge-shared' });
  assert.throws(() => verifyStaging(production(), value), /external environment group/);
});
test('rejects incorrect shared credential names and mismatched service types', () => {
  const value = staging(); entry(value, 'worker', 'WORKER_CALLBACK_SECRET').fromService.envVarKey = 'TYPO_SECRET';
  assert.throws(() => verifyStaging(production(), value), /referenced environment name is missing/);
  entry(value, 'worker', 'WORKER_CALLBACK_SECRET').fromService.envVarKey = 'WORKER_CALLBACK_SECRET';
  entry(value, 'api', 'PDF_WORKER_HOSTPORT').fromService.type = 'web';
  assert.throws(() => verifyStaging(production(), value), /match type/);
});
test('does not treat different resource names as network isolation', () => {
  const value = staging(); environment(value).networking.isolation = 'disabled';
  assert.throws(() => verifyStaging(production(), value), /network isolation/);
});
test('rejects production domains and literal secrets without echoing values', () => {
  const value = staging(); service(value, 'web').domains = ['doxera.in'];
  assert.throws(() => verifyStaging(production(), value), /custom domains/);
  delete service(value, 'web').domains;
  entry(value, 'api', 'JWT_SECRET').value = 'synthetic-value-never-to-be-printed';
  assert.throws(() => verifyStaging(production(), value), error => !error.message.includes('synthetic-value') && /secret must/.test(error.message));
});
test('production API validator accepts the staged variable names with synthetic resolved values', () => {
  const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
  const source = fs.readFileSync(path.resolve(__dirname, '../../apps/api/src/common/environment.ts'), 'utf8');
  const code = appRequire('typescript').transpileModule(source, { compilerOptions: { module: appRequire('typescript').ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} }; new Function('require', 'module', 'exports', code)(appRequire, module, module.exports);
  const env = Object.fromEntries([...effectiveEnv(staging(), service(staging(), 'api'))].map(([key, item]) => [key, item.value ?? 'synthetic-input']));
  Object.assign(env, { DATABASE_URL: 'postgresql://test:test@staging-db.invalid:5432/staging', REDIS_URL: 'redis://staging-redis.invalid:6379',
    PDF_WORKER_HOSTPORT: 'staging-worker.invalid:8000', API_GATEWAY_HOSTPORT: 'staging-api.invalid:4000',
    FRONTEND_URL: 'https://staging-web.example.invalid', CORS_ORIGINS: 'https://staging-web.example.invalid',
    JWT_SECRET: crypto.randomBytes(32).toString('hex'), JWT_REFRESH_SECRET: crypto.randomBytes(32).toString('hex'), WORKER_CALLBACK_SECRET: crypto.randomBytes(32).toString('hex') });
  assert.doesNotThrow(() => module.exports.validateEnvironment(env));
});
test('CI is read-only and rejects deployment paths, tokens and actions', () => {
  const baseline = loadYaml('.github/workflows/ci.yml'); assert.doesNotThrow(() => verifyWorkflow(baseline));
  for (const mutate of [
    c => { c.permissions.contents = 'write'; },
    c => { c.jobs.application.environment = 'production'; },
    c => { c.jobs.application.steps.push({ run: 'git push origin main' }); },
    c => { c.jobs.application.steps.push({ uses: 'vendor/deploy-render@v1' }); },
    c => { c.jobs.application.env.DEPLOY_TOKEN = '${{ secrets.RENDER_API_KEY }}'; },
  ]) { const value = structuredClone(baseline); mutate(value); assert.throws(() => verifyWorkflow(value)); }
});
