const assert = require('node:assert/strict'), fs = require('node:fs'), crypto = require('node:crypto');
const api = new URL(process.env.PERF_API_URL);
if (api.hostname !== process.env.EXPECTED_API_HOST || !/^pdfforge-[a-f0-9]{8}-pipeline-api$/.test(api.hostname)) throw new Error('Unsafe performance target');
let token, phase = 'setup';
const sleep = ms => new Promise(done => setTimeout(done, ms));
async function call(path, method = 'GET', body) {
  return fetch(new URL('/api/v1' + path, api), { method, signal: AbortSignal.timeout(30000), headers: {
    'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}),
  }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
async function json(response, status) { assert.equal(response.status, status); return response.json(); }
const percentile = (values, p) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * p) - 1];
(async () => {
  const registered = await json(await call('/auth/register', 'POST', { email: `performance-${crypto.randomUUID()}@example.invalid`,
    password: crypto.randomBytes(24).toString('base64url'), name: 'Synthetic performance user' }), 201);
  token = registered.tokens.accessToken;
  phase = 'bounded HTTP concurrency';
  const latencies = [], start = performance.now(); let cursor = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    for (;;) {
      const index = cursor++; if (index >= 60) break;
      const began = performance.now(), response = await call(['/health/live', '/billing/plans', '/auth/me'][index % 3]);
      assert.equal(response.status, 200); await response.arrayBuffer(); latencies.push(performance.now() - began);
    }
  }));
  const elapsed = performance.now() - start;
  assert.equal(latencies.length, 60); assert.ok(percentile(latencies, .95) < 2000, 'Local HTTP p95 exceeded 2 seconds');
  phase = 'queued document conversion';
  const fixture = fs.readFileSync('/verification/input.docx');
  const mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const signed = await json(await call('/files/presign-upload', 'POST', { fileName: 'performance-image-table.docx', fileSizeBytes: fixture.length,
    mimeType, checksumSha256: crypto.createHash('sha256').update(fixture).digest('hex') }), 201);
  assert.equal(new URL(signed.uploadUrl).hostname, process.env.PERF_S3_HOST);
  const uploaded = await fetch(signed.uploadUrl, { method: 'PUT', headers: { 'content-type': mimeType }, body: fixture });
  assert.equal(uploaded.status, 200); await uploaded.arrayBuffer();
  await json(await call('/files/confirm-upload', 'POST', { fileId: signed.fileId }), 201);
  const pending = new Map(), durations = [], conversionStart = performance.now();
  for (let batch = 0; batch < 3; batch++) {
    await Promise.all([0, 1].map(async () => {
      const began = performance.now(), job = await json(await call('/pdf/jobs', 'POST', { tool: 'word_to_pdf', fileIds: [signed.fileId] }), 201);
      pending.set(job.jobId, began);
    }));
  }
  for (let attempt = 0; pending.size && attempt < 120; attempt++) {
    const response = await json(await call('/pdf/jobs/user/history'), 200);
    const jobs = Array.isArray(response) ? response : response.jobs;
    assert.ok(Array.isArray(jobs));
    for (const job of jobs) {
      const id = job.id || job.jobId; if (!pending.has(id)) continue;
      assert.notEqual(job.status, 'FAILED');
      if (job.status === 'COMPLETED') {
        durations.push(performance.now() - pending.get(id)); pending.delete(id);
        const result = await call(`/pdf/jobs/${id}/download`); assert.equal(result.status, 200);
        assert.equal(Buffer.from(await result.arrayBuffer()).subarray(0, 5).toString(), '%PDF-');
      }
    }
    if (pending.size) await sleep(1000);
  }
  assert.equal(pending.size, 0); assert.equal(durations.length, 6);
  assert.ok(performance.now() - conversionStart < 120000, 'Six fixture conversions exceeded 120 seconds');
  const results = { scope: 'Synthetic isolated shared-host baseline; not a production capacity estimate',
    http: { requests: 60, concurrency: 4, errors: 0, elapsedMs: Math.round(elapsed), requestsPerSecond: +(60000 / elapsed).toFixed(2),
      p50Ms: +percentile(latencies, .5).toFixed(2), p95Ms: +percentile(latencies, .95).toFixed(2), p99Ms: +percentile(latencies, .99).toFixed(2) },
    conversion: { jobs: 6, concurrentDispatch: 2, errors: 0, elapsedMs: Math.round(performance.now() - conversionStart),
      p50Ms: +percentile(durations, .5).toFixed(2), p95Ms: +percentile(durations, .95).toFixed(2) } };
  fs.writeFileSync('/tmp/performance-results.json', JSON.stringify(results, null, 2));
  console.log('PASS: bounded HTTP and real S3/Celery/LibreOffice conversion performance budgets'); console.log(JSON.stringify(results));
})().catch(() => { console.error(`FAIL: isolated performance ${phase}`); process.exitCode = 1; });
