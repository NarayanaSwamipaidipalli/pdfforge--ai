'use strict';
// Runs inside the isolated API image with only this script and render.yaml mounted.
const fs = require('fs');
const yaml = require('/app/node_modules/js-yaml');
const Ajv = require('/app/node_modules/ajv/dist/2020');

(async () => {
  const response = await fetch('https://render.com/schema/render.yaml.json', { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error('Official Render schema unavailable');
  const schema = await response.json();
  const ajv = new Ajv({ allErrors: true, strict: false, validateFormats: false });
  const validate = ajv.compile(schema);
  const blueprint = yaml.load(fs.readFileSync('/verification/render.yaml', 'utf8'));
  if (!validate(blueprint)) {
    console.error(JSON.stringify(validate.errors.map(error => ({ path: error.instancePath || error.dataPath, message: error.message, params: error.params }))));
    process.exitCode = 1;
  } else console.log('PASS Render Blueprint against official JSON schema. No deployment performed.');
})().catch(error => { console.error(`Render schema validation could not complete: ${error.name}: ${error.message}`); process.exitCode = 1; });
