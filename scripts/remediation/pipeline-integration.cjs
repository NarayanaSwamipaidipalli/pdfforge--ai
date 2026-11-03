// Executes only in the new API image on the isolated network. No mocks or external provider calls.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const { createRequire } = require('node:module');
const requireApp = createRequire('/app/package.json');
const { PrismaClient } = requireApp('@prisma/client');

const database = new URL(process.env.DATABASE_URL);
const api = new URL(process.env.PIPELINE_API_URL);
const worker = new URL(process.env.PDF_WORKER_URL);
const storage = new URL(process.env.S3_ENDPOINT);
const resource = /^pdfforge-security-\d+-[a-f0-9]{8}-pipeline-[a-f0-9]{8}-(api|worker|minio)$/;
if (!/^pdfforge-security-\d+-[a-f0-9]{8}-postgres$/.test(database.hostname)
  || database.hostname !== process.env.EXPECTED_DB_HOST
  || !/^security_pipeline_[a-f0-9]{8}$/.test(database.pathname.slice(1))
  || database.pathname.slice(1) !== process.env.EXPECTED_DB_NAME
  || api.hostname !== process.env.EXPECTED_API_HOST || !resource.test(api.hostname)
  || worker.hostname !== process.env.EXPECTED_WORKER_HOST || !resource.test(worker.hostname)
  || storage.hostname !== process.env.EXPECTED_S3_HOST || !resource.test(storage.hostname)) {
  throw new Error('Unsafe pipeline target refused');
}
const prisma = new PrismaClient({ log: [] });
const sleep = ms => new Promise(done => setTimeout(done, ms));
let checks = 0;
const pass = label => { checks++; console.log(`PASS: ${label}`); };

async function call(path, { method = 'GET', token, body, headers = {} } = {}) {
  return fetch(new URL(path, api), { method, signal: AbortSignal.timeout(15_000),
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
async function json(response, status) {
  assert.equal(response.status, status, 'Unexpected HTTP status');
  return response.json();
}
async function ready(url) {
  for (let attempt = 0; attempt < 90; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
      const success = response.status === 200;
      await response.arrayBuffer();
      if (success) return;
    } catch { /* New services can take time to initialize. */ }
    await sleep(1000);
  }
  throw new Error('Isolated production service did not become ready');
}

(async () => {
  await ready(new URL('/api/v1/health/ready', api));
  await ready(new URL('/health', worker));
  await prisma.$connect();
  pass('real production API, worker and isolated database are ready');

  await json(await call('/api/v1/files/presign-upload', { method: 'POST', body: {} }), 401);
  await json(await call('/api/v1/pdf/jobs', { method: 'POST', body: {} }), 401);
  const protectedWorker = await fetch(new URL('/api/v1/jobs/process', worker), { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(protectedWorker.status, 401); await protectedWorker.arrayBuffer();
  const forbiddenCallback = await call('/api/v1/pdf/jobs/callback', { method: 'POST',
    body: { jobId: crypto.randomUUID(), status: 'COMPLETED' } });
  await json(forbiddenCallback, 401);
  pass('real upload, job, worker and callback endpoints reject missing authentication');

  const email = `pipeline-${crypto.randomBytes(8).toString('hex')}@example.invalid`;
  const password = crypto.randomBytes(24).toString('base64url');
  const registration = await call('/api/v1/auth/register', { method: 'POST', body: { email, password, name: 'Isolated Pipeline' } });
  const registered = await json(registration, 201);
  assert.equal(registered.user.role, 'USER');
  assert.equal(await prisma.user.count({ where: { globalRole: 'SUPERADMIN' } }), 0);
  const loginResponse = await call('/api/v1/auth/login', { method: 'POST', body: { email, password } });
  const login = await json(loginResponse, 200);
  const cookie = loginResponse.headers.get('set-cookie') || '';
  assert.match(cookie, /HttpOnly/i); assert.match(cookie, /Secure/i); assert.match(cookie, /SameSite=Lax/i);
  pass('real registration/login creates an ordinary user and a secure HttpOnly refresh cookie');

  const recovery = await call('/api/v1/auth/forgot-password', { method: 'POST', body: { email } });
  await json(recovery, 503);
  assert.equal((await prisma.user.findUnique({ where: { id: registered.user.id } })).passwordResetToken, null);
  pass('unconfigured password delivery fails closed without reset credentials');

  const hostileEmail = `hostile-${crypto.randomBytes(8).toString('hex')}@example.invalid`;
  const hostile = await call('/api/v1/auth/register', { method: 'POST', body: { email: hostileEmail, password },
    headers: { Origin: 'https://attacker.invalid' } });
  await json(hostile, 403);
  assert.equal(await prisma.user.count({ where: { email: hostileEmail } }), 0);
  pass('production CORS rejects a hostile-origin registration before database writes');

  const rotations = await Promise.all([0, 1].map(() => call('/api/v1/auth/refresh', { method: 'POST', body: { refreshToken: login.tokens.refreshToken } })));
  assert.deepEqual(rotations.map(r => r.status).sort(), [200, 401]);
  const rotated = await json(rotations.find(r => r.status === 200), 200);
  await rotations.find(r => r.status === 401).arrayBuffer();
  await json(await call('/api/v1/auth/refresh', { method: 'POST', body: { refreshToken: login.tokens.refreshToken } }), 401);
  const token = rotated.accessToken;
  pass('real database refresh compare-and-swap accepts exactly one concurrent rotation and rejects replay');

  const fixture = fs.readFileSync('/verification/input.docx');
  const mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const signed = await json(await call('/api/v1/files/presign-upload', { method: 'POST', token, body: {
    fileName: 'image-table-fixture.docx', fileSizeBytes: fixture.length, mimeType: mime,
    checksumSha256: crypto.createHash('sha256').update(fixture).digest('hex'),
  } }), 201);
  assert.equal(new URL(signed.uploadUrl).origin, storage.origin, 'Upload must target the isolated object store');
  const upload = await fetch(signed.uploadUrl, { method: 'PUT', headers: { 'Content-Type': mime }, body: fixture,
    signal: AbortSignal.timeout(30_000) });
  assert.equal(upload.status, 200, 'Real signed S3 upload failed'); await upload.arrayBuffer();
  await json(await call('/api/v1/files/confirm-upload', { method: 'POST', token, body: { fileId: signed.fileId } }), 201);
  pass('real presign, S3 PUT and confirmation upload the DOCX image/table fixture');

  const other = await json(await call('/api/v1/auth/register', { method: 'POST', body: {
    email: `other-${crypto.randomBytes(8).toString('hex')}@example.invalid`, password,
  } }), 201);
  await json(await call(`/api/v1/files/${signed.fileId}/download`, { token: other.tokens.accessToken }), 403);
  pass('another real user cannot access the uploaded source document');

  const created = await json(await call('/api/v1/pdf/jobs', { method: 'POST', token,
    body: { tool: 'word_to_pdf', fileIds: [signed.fileId], parameters: {} } }), 201);
  let completed;
  for (let attempt = 0; attempt < 120; attempt++) {
    const current = await json(await call(`/api/v1/pdf/jobs/${created.jobId}`, { token }), 200);
    if (current.status === 'COMPLETED') { completed = current; break; }
    if (current.status === 'FAILED') throw new Error('Real Celery conversion or callback failed');
    await sleep(1500);
  }
  assert.ok(completed, 'Conversion did not complete within the isolated test timeout');
  const persisted = await prisma.processingJob.findUnique({ where: { id: created.jobId } });
  assert.equal(persisted.status, 'COMPLETED');
  assert.ok(persisted.outputFileKey.startsWith(`processed/${created.jobId}/`));
  assert.ok(persisted.completedAt); assert.ok(persisted.outputFileSizeBytes > 0);
  pass('API dispatch, authenticated worker, Redis/Celery, real LibreOffice, S3 output and callback complete the job');

  await json(await call(`/api/v1/pdf/jobs/${created.jobId}`, { token: other.tokens.accessToken }), 403);
  await json(await call(`/api/v1/pdf/jobs/${created.jobId}/download`, { token: other.tokens.accessToken }), 403);
  const download = await call(`/api/v1/pdf/jobs/${created.jobId}/download`, { token });
  assert.equal(download.status, 200); assert.match(download.headers.get('content-type'), /application\/pdf/);
  const pdf = Buffer.from(await download.arrayBuffer());
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  assert.equal(Number(persisted.outputFileSizeBytes), pdf.length);
  fs.writeFileSync('/tmp/pipeline-result.pdf', pdf, { flag: 'wx', mode: 0o644 });
  pass('authenticated download streams the actual PDF bytes; cross-user status/download requests are denied');
  console.log(`PASS: ${checks} full isolated production pipeline assertions; PDF retained for worker-image structural validation`);
})().catch(() => {
  // Do not print fetch URLs, JWTs, request objects or Prisma connection diagnostics.
  console.error('FAIL: isolated pipeline assertion failed; inspect newly labeled resources and private test evidence');
  process.exitCode = 1;
}).finally(async () => { await prisma.$disconnect(); });
