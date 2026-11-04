'use strict';
// Static public configuration only: never loads .env, connects to services or prints values.
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const appRequire = createRequire(path.resolve(__dirname, '../../apps/api/package.json'));
const yaml = appRequire('js-yaml');
const root = path.resolve(__dirname, '../..');
const shared = ['WORKER_CALLBACK_SECRET', 'S3_BUCKET_NAME', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'];
const required = {
  web: ['NEXT_PUBLIC_APP_URL', 'PORT', 'API_GATEWAY_HOSTPORT'],
  api: ['NODE_ENV', 'LOAD_LOCAL_ENV', 'PORT', 'DATABASE_URL', 'REDIS_URL', 'PDF_WORKER_HOSTPORT', 'API_GATEWAY_HOSTPORT',
    'FRONTEND_URL', 'CORS_ORIGINS', 'JWT_SECRET', 'JWT_REFRESH_SECRET', ...shared, 'AWS_REGION', 'S3_AUTO_CREATE_BUCKET',
    'MAIL_PROVIDER', 'RESEND_API_KEY', 'MAIL_FROM', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_CALLBACK_URL',
    'ENABLE_STRIPE', 'ENABLE_RAZORPAY', 'ENABLE_PAYPAL', 'SENTRY_DSN'],
  worker: ['ENVIRONMENT', 'PORT', ...shared, 'AWS_REGION', 'API_GATEWAY_HOSTPORT', 'REDIS_URL', 'CELERY_BROKER_URL', 'CELERY_RESULT_BACKEND'],
  celery: ['ENVIRONMENT', ...shared, 'AWS_REGION', 'API_GATEWAY_HOSTPORT', 'REDIS_URL', 'CELERY_BROKER_URL', 'CELERY_RESULT_BACKEND'],
};
const check = (condition, message) => { if (!condition) throw new Error(message); };
function loadYaml(file) {
  try { return yaml.load(fs.readFileSync(path.resolve(root, file), 'utf8')); }
  catch { throw new Error(`Cannot parse configuration: ${path.basename(file)}`); }
}
function scopes(blueprint) {
  return [blueprint, blueprint.ungrouped || {}, ...(blueprint.projects || []).flatMap(p => p.environments || [])];
}
function resources(blueprint, kind) { return scopes(blueprint).flatMap(scope => scope[kind] || []); }
function effectiveEnv(blueprint, service) {
  const groups = new Map(resources(blueprint, 'envVarGroups').map(g => [g.name, g]));
  const entries = [];
  for (const entry of service.envVars || []) {
    if (entry.fromGroup) {
      check(groups.has(entry.fromGroup), `${service.name}: external environment group is forbidden`);
      entries.push(...groups.get(entry.fromGroup).envVars);
    } else entries.push(entry);
  }
  const result = new Map();
  for (const item of entries) {
    check(!result.has(item.key), `${service.name}: duplicate environment name`);
    result.set(item.key, item);
  }
  return result;
}
function verifyBlueprint(blueprint, prefix) {
  const services = resources(blueprint, 'services'), databases = resources(blueprint, 'databases');
  const serviceMap = new Map(services.map(s => [s.name, s]));
  const databaseMap = new Map(databases.map(d => [d.name, d]));
  const names = [...services, ...databases, ...resources(blueprint, 'envVarGroups')].map(r => r.name);
  check(new Set(names).size === names.length, 'Duplicate resource names');
  check(names.every(name => name.startsWith(prefix)), 'Resource namespace mismatch');
  check(blueprint.previews?.generation === 'off', 'Blueprint preview generation must be off');
  for (const group of resources(blueprint, 'envVarGroups')) {
    check(group.envVars.every(e => e.sync !== false), 'Render ignores sync:false inside environment groups');
  }
  const inventory = {};
  for (const service of services) {
    if (service.runtime) {
      check(service.autoDeployTrigger === 'off' && service.autoDeploy !== true, `${service.name}: automatic deploys must be explicitly off`);
      check(!service.previews?.generation && service.pullRequestPreviewsEnabled !== true, `${service.name}: service previews must be disabled`);
      check(service.branch === (prefix === 'pdfforge-' ? 'main' : 'staging'), `${service.name}: unexpected source branch`);
    }
    const env = effectiveEnv(blueprint, service);
    inventory[service.name] = [...env.keys()].sort();
    for (const [key, item] of env) {
      if (item.fromService) {
        const source = serviceMap.get(item.fromService.name);
        check(source && source.type === item.fromService.type, `${service.name}/${key}: service reference must stay within its Blueprint and match type`);
        const referenced = item.fromService.envVarKey;
        check(Boolean(referenced) !== Boolean(item.fromService.property), `${service.name}/${key}: select exactly one service property or environment name`);
        if (referenced) check((referenced === 'RENDER_EXTERNAL_URL' && source.type === 'web') ||
          effectiveEnv(blueprint, source).has(referenced), `${service.name}/${key}: referenced environment name is missing`);
      }
      if (item.fromDatabase) check(databaseMap.has(item.fromDatabase.name), `${service.name}/${key}: database reference must stay within its Blueprint`);
      if (/SECRET|PASSWORD|_API_KEY|JWT_SECRET|AWS_ACCESS_KEY_ID/.test(key)) {
        check(!Object.hasOwn(item, 'value') && !item.generateValue, `${service.name}/${key}: secret must be an operator input or service reference`);
      }
    }
    const role = service.name.slice(prefix.length);
    for (const key of required[role] || []) check(env.has(key), `${service.name}: missing required environment name ${key}`);
    if (role === 'api') {
      for (const key of ['LOAD_LOCAL_ENV', 'S3_AUTO_CREATE_BUCKET', 'ENABLE_STRIPE', 'ENABLE_RAZORPAY', 'ENABLE_PAYPAL']) {
        check(env.get(key)?.value === 'false', `${service.name}/${key}: feature must be explicitly disabled before approval`);
      }
      check(env.get('NODE_ENV')?.value === 'production', 'Staging must use production authentication safeguards');
    }
    if (['worker', 'celery'].includes(role)) {
      check(env.get('ENVIRONMENT')?.value === 'production', 'Worker must use production safeguards');
      for (const key of shared) check(env.get(key)?.fromService?.name === `${prefix}api` &&
        env.get(key).fromService.envVarKey === key, `${service.name}/${key}: must use the API shared value`);
    }
  }
  for (const resource of [...databases, ...services.filter(s => s.type === 'keyvalue')]) {
    check(Array.isArray(resource.ipAllowList) && resource.ipAllowList.length === 0, `${resource.name}: external datastore access must be disabled`);
  }
  return { names, inventory };
}
function verifyStaging(production, staging) {
  const prod = verifyBlueprint(production, 'pdfforge-'), stage = verifyBlueprint(staging, 'doxera-staging-');
  check(!stage.names.some(name => prod.names.includes(name)), 'Staging must not reuse production resources');
  check(staging.projects?.length === 1 && staging.projects[0].environments?.length === 1, 'Staging must have one explicit environment');
  check(staging.projects[0].name === 'doxera-staging', 'Staging must have its own project');
  const env = staging.projects[0].environments[0];
  check(env.name === 'staging' && env.networking?.isolation === 'enabled', 'Staging private network isolation must be enabled');
  check(env.permissions?.protection === 'enabled', 'Staging environment protection must be enabled');
  for (const kind of ['services', 'databases', 'envVarGroups']) check(resources(staging, kind).length === (env[kind] || []).length, 'All staging resources must belong to its isolated environment');
  check(env.services.length === 5 && env.databases.length === 1 && env.envVarGroups.length === 1, 'Staging resource set is incomplete');
  check(env.services.find(s => s.name === 'doxera-staging-worker')?.type === 'pserv', 'Staging worker must be private');
  check(!env.services.some(s => s.domains?.length), 'Staging must not claim custom domains before ownership approval');
  const regional = [...env.services, ...env.databases];
  check(regional.every(r => r.region && r.region === regional[0].region), 'Staging resources must explicitly share a region');
  check(env.databases[0].databaseName === 'doxera_staging' && env.databases[0].user === 'doxera_staging', 'Staging database identity must be distinct');
  check(!/https?:\/\/(?:api\.)?doxera\.in\b/.test(JSON.stringify(staging)), 'Staging must not target proposed production domains');
  return stage.inventory;
}
function verifyWorkflow(workflow) {
  check(JSON.stringify(workflow.permissions) === JSON.stringify({ contents: 'read' }), 'CI must have read-only repository permissions');
  check(!workflow.on?.pull_request_target, 'Privileged pull_request_target is forbidden');
  check(!/\$\{\{\s*(secrets|vars)\./.test(JSON.stringify(workflow)), 'CI must not consume deployment secrets or repository variables');
  for (const job of Object.values(workflow.jobs || {})) {
    check(!job.uses && !job.environment && !job.permissions, 'CI must not invoke deployment environments, reusable workflows or permission overrides');
    for (const step of job.steps || []) {
      if (step.uses) check(/^actions\/(checkout|setup-node|upload-artifact)@/.test(step.uses), 'Unreviewed CI action; deployment review required');
      check(!/\b(?:git|docker)\s+push\b|\brender\s+(?:deploys?|blueprints?)\b|api\.render\.com|deploy[-_ ]?hook|kubectl|terraform\s+apply/i.test(step.run || ''), 'CI contains a deployment command');
    }
  }
}
module.exports = { root, appRequire, loadYaml, scopes, resources, effectiveEnv, verifyStaging, verifyWorkflow, required };
