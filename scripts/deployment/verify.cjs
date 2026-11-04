'use strict';
const fs = require('node:fs'), path = require('node:path');
const { root, appRequire, loadYaml, verifyStaging, verifyWorkflow } = require('./render-config.cjs');
(async () => {
  const files = ['render.yaml', 'render.staging.yaml'];
  const blueprints = files.map(loadYaml);
  const inventory = verifyStaging(...blueprints);
  for (const file of fs.readdirSync(path.join(root, '.github/workflows')).filter(f => /\.ya?ml$/.test(f))) {
    verifyWorkflow(loadYaml(`.github/workflows/${file}`));
  }
  const example = fs.readFileSync(path.join(root, '.env.staging.example'), 'utf8');
  const keys = new Set(example.split(/\r?\n/).filter(line => /^[A-Z_][A-Z0-9_]*=/.test(line)).map(line => line.split('=')[0]));
  for (const key of new Set(Object.values(inventory).flat())) if (!keys.has(key)) throw new Error(`Staging example is missing environment name ${key}`);
  console.log('PASS staging resource isolation, environment names, shared credential references and repository deployment guards');
  if (process.argv.includes('--inventory')) console.log(JSON.stringify({ environmentNamesOnly: inventory }, null, 2));
  if (process.argv.includes('--schema')) {
    const response = await fetch('https://render.com/schema/render.yaml.json', { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error('Official Render schema unavailable');
    const Ajv = appRequire('ajv/dist/2020');
    const validate = new Ajv({ allErrors: true, strict: false, validateFormats: false }).compile(await response.json());
    for (let index = 0; index < files.length; index++) {
      if (!validate(blueprints[index])) {
        console.error(JSON.stringify({ file: files[index], errors: validate.errors.map(e => ({ path: e.instancePath, message: e.message })) }));
        throw new Error('Render schema validation failed');
      }
      console.log(`PASS ${files[index]} against the current official Render schema`);
    }
  }
  console.log('External Render Auto-Deploy/Blueprint Auto Sync and GitHub webhook settings: UNVERIFIED; pushes remain blocked.');
})().catch(error => { console.error(error.message || 'Staging configuration verification failed'); process.exitCode = 1; });
