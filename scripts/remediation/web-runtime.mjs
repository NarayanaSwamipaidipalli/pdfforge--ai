import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { command, readRun, root } from './isolated.mjs';
const run = readRun(), location = process.argv[2];
if (!/^\.remediation[\\/]pipeline-[a-f0-9]{8}$/.test(location || '')) throw new Error('Select isolated pipeline evidence');
const directory = resolve(root, location), pipeline = JSON.parse(readFileSync(resolve(directory, 'resources.json'), 'utf8'));
if (pipeline.project !== run.project || pipeline.network !== run.network || !/^pdfforge-[a-f0-9]{8}-pipeline-api$/.test(pipeline.names.api)) throw new Error('Unsafe runtime target');
if (command('docker', ['inspect', '--format', '{{index .Config.Labels "pdfforge.remediation.run"}}', pipeline.names.api]) !== run.project) throw new Error('API ownership mismatch');
const suffix = randomBytes(4).toString('hex'), name = `pdfforge-${suffix}-web-test`;
const script = String.raw`
const assert=require('node:assert/strict');
(async()=>{
 const base='http://${name}:3000';
 for(let attempt=0;;attempt++) { try {const r=await fetch(base+'/login'); if(r.ok)break;}catch{} if(attempt===59)throw Error('Frontend did not start');await new Promise(r=>setTimeout(r,1000)); }
 const page=await fetch(base+'/login');const html=await page.text();assert.match(html,/Doxera/);assert.doesNotMatch(html,/PDFForge/);
 for(const path of ['/manifest.webmanifest','/icon.svg','/opengraph-image']) {const response=await fetch(base+path);assert.equal(response.status,200,path);if(path==='/manifest.webmanifest')assert.match((await response.json()).name,/^Doxera/);else await response.arrayBuffer();}
 const health=await fetch(base+'/api/v1/health/live');assert.equal(health.status,200);assert.match(health.headers.get('cache-control'),/no-store/);await health.arrayBuffer();
 const protectedRoute=await fetch(base+'/api/v1/auth/me');assert.equal(protectedRoute.status,401);await protectedRoute.arrayBuffer();
 const sentry=require('/app/node_modules/@sentry/node');sentry.init({enabled:false,defaultIntegrations:false});sentry.captureException(new Error('Synthetic disabled monitoring smoke'));
 require('/app/node_modules/@prisma/client');require('/app/node_modules/prisma/package.json');
 for(const pkg of ['jest','@nestjs/testing','@nestjs/cli','graphql','passport','bullmq']) {let found=true;try{require.resolve('/app/node_modules/'+pkg);}catch{found=false;}assert.equal(found,false,pkg+' should be absent from production image');}
 console.log('PASS: Doxera HTML, manifest, icon, social image, runtime API proxy, protected-route rejection and pruned API runtime dependencies');
})().catch(error=>{console.error('Runtime verification failed: '+error.message);process.exitCode=1;});`;
try {
  command('docker', ['run', '-d', '--name', name, '--network', run.network, '--label', `pdfforge.remediation.run=${run.project}`,
    '--env', `API_GATEWAY_INTERNAL_URL=http://${pipeline.names.api}:4000`, '--env', 'NEXT_PUBLIC_APP_URL=https://doxera.in', `${run.project}-web:verification`]);
  const output = command('docker', ['run', '--name', `${name}-runner`, '--network', run.network,
    '--label', `pdfforge.remediation.run=${run.project}`, '--entrypoint', 'node', `${run.project}-api:verification`, '-e', script]);
  writeFileSync(resolve(directory, 'web-runtime-results.txt'), output); console.log(output);
} catch(error) {
  writeFileSync(resolve(directory, 'web-runtime-private-error.txt'), error.detail || error.message);
  console.error('FAIL frontend/runtime verification; isolated containers retained.');process.exitCode=1;
}
