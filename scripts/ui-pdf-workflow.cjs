/*
 * Real local PDF regression. Requires the running API, storage, and PDF worker.
 * UI_TEST_BASE_URL=http://localhost:3000
 * PLAYWRIGHT_MODULE_PATH=<optional existing Playwright module>
 * UI_TEST_CHROME_PATH=<optional installed Chrome executable>
 *
 * Creates a synthetic example.com account and submits real compression jobs.
 * No PDF responses are mocked. Payment mutations are blocked defensively.
 * Generated documents, screenshots, and the report stay under ignored
 * .remediation/ui-redesign/pdf/. Authentication secrets stay in memory.
 */
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const defaultPlaywright = 'C:/Users/rough/AppData/Local/Temp/claude/2ad6d17696e33840/db3d4104-c59d-4d32-9b01-712bf8f1be57/scratchpad/vis/node_modules/playwright';
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || defaultPlaywright);
const baseURL = (process.env.UI_TEST_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const origin = new URL(baseURL);
assert(['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname), 'This harness is restricted to a local test server.');
const outputDirectory = path.resolve(__dirname, '..', '.remediation', 'ui-redesign', 'pdf');
const screenshotDirectory = path.join(outputDirectory, 'shots');
fs.mkdirSync(screenshotDirectory, { recursive: true });

const report = {
  startedAt: new Date().toISOString(), baseURL,
  source: 'real local browser, authenticated API, object storage, and PDF worker',
  checks: [], screenshots: [], applicationErrors: [], knownGoogleHeadlessErrors: [],
  network: [], jobs: [], blockedPaymentRequests: 0,
};
let browser;
let context;
let page;
let authentication;
const email = `doxera-pdf-ui-${Date.now()}-${crypto.randomBytes(3).toString('hex')}@example.com`;
const password = `Pdf!${crypto.randomBytes(20).toString('hex')}`;

function errorText(error) { return error instanceof Error ? error.message : String(error); }
async function check(name, run, { required = false } = {}) {
  try {
    const details = await run();
    report.checks.push({ name, status: 'passed', ...(details === undefined ? {} : { details }) });
    process.stdout.write(`PASS ${name}\n`);
    return details;
  } catch (error) {
    report.checks.push({ name, status: 'failed', error: errorText(error) });
    process.stdout.write(`FAIL ${name}: ${errorText(error)}\n`);
    if (required) throw error;
    return null;
  }
}

// Generate a complete one-page PDF with correct byte offsets and stream length.
// Its repeated, visible synthetic text also makes compression measurable.
function makePdf() {
  const stream = 'BT /F1 10 Tf 1 TL 72 740 Td\n'
    + Array.from({ length: 650 }, () => '(Doxera PDF workflow verification - synthetic document, no personal data.) Tj T*\n').join('')
    + 'ET\n';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}endstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

const validPdf = makePdf();
const validPath = path.join(outputDirectory, 'synthetic-valid.pdf');
const corruptedPath = path.join(outputDirectory, 'synthetic-corrupted.pdf');
fs.writeFileSync(validPath, validPdf);
fs.writeFileSync(corruptedPath, Buffer.from('%PDF-1.4\nThis synthetic file deliberately has no catalog, pages, or xref.\n%%EOF\n'));

async function api(endpoint) {
  const response = await context.request.get(`/api/v1${endpoint}`, {
    headers: { Authorization: `Bearer ${authentication.token}` }, timeout: 30000,
  });
  const body = await response.json().catch(() => null);
  assert(response.ok(), `GET ${endpoint} returned ${response.status()}`);
  return body;
}

async function screenshot(name) {
  const file = path.join(screenshotDirectory, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true, animations: 'disabled' });
  report.screenshots.push({ name, file });
}

async function noOverflow() {
  const dimensions = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  assert(dimensions.document <= dimensions.viewport + 1, `Document overflow: ${JSON.stringify(dimensions)}`);
  assert(dimensions.body <= dimensions.viewport + 1, `Body overflow: ${JSON.stringify(dimensions)}`);
  return dimensions;
}

async function waitForHydration() {
  await page.getByRole('button', { name: /^Switch to (light|dark) theme$/ }).first().waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForFunction(() => {
    try { return JSON.parse(localStorage.getItem('doxera_auth_storage') || '{}').state?.isHydrated === true; }
    catch { return false; }
  }, undefined, { timeout: 30000 });
}

async function executeJob({ retry = false, expectedStatus = 'COMPLETED', screenshotName }) {
  const jobResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/pdf/jobs' && response.request().method() === 'POST', { timeout: 30000 });
  await page.getByRole('button', { name: retry ? /^retry$/i : /^execute/i }).first().click();
  const dispatch = await jobResponse;
  assert.equal(dispatch.status(), 201, `PDF job dispatch returned ${dispatch.status()}`);
  const job = await dispatch.json();
  const jobId = job.jobId || job.id;
  assert.equal(typeof jobId, 'string');
  const processing = page.getByText(/processing your document/i);
  if (await processing.isVisible().catch(() => false)) await screenshot(`${screenshotName}-processing`);
  const terminal = expectedStatus === 'COMPLETED'
    ? page.getByText(/^your document is ready$/i)
    : page.getByRole('button', { name: /^retry$/i });
  await terminal.waitFor({ state: 'visible', timeout: 120000 });
  const remote = await api(`/pdf/jobs/${jobId}`);
  assert.equal(remote.status, expectedStatus, 'UI terminal state must match the real backend job status.');
  if (expectedStatus === 'FAILED') {
    assert(remote.errorMessage, 'The failed worker job must provide an actual error.');
    assert.equal(await page.getByText(/^your document is ready$/i).count(), 0, 'Corruption must not produce a success state.');
    assert.equal(await page.getByRole('button', { name: /^download processed pdf$/i }).count(), 0);
  }
  report.jobs.push({ jobId, status: remote.status, tool: remote.tool, outputBytes: remote.outputFileSizeBytes, ...(remote.errorMessage ? { errorMessage: remote.errorMessage } : {}) });
  await screenshot(screenshotName);
  return { jobId, remote };
}

async function main() {
  browser = await chromium.launch({ executablePath: process.env.UI_TEST_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--disable-gpu'] });
  context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 }, colorScheme: 'dark', acceptDownloads: true });
  await context.route('**/api/v1/billing/**', async route => {
    if (route.request().method() === 'GET') return route.continue();
    report.blockedPaymentRequests += 1;
    await route.abort('blockedbyclient');
  });

  await check('Synthetic account registered with the real API', async () => {
    const response = await context.request.post('/api/v1/auth/register', { data: { email, password, name: 'PDF UI Verification' }, timeout: 30000 });
    const body = await response.json();
    assert.equal(response.status(), 201, body?.message || 'Registration failed.');
    assert(body?.tokens?.accessToken && body.user?.id, 'Registration must return an actual authenticated account.');
    authentication = { token: body.tokens.accessToken, user: { ...body.user, role: body.user.globalRole || body.user.role || 'USER' } };
    const profile = await api('/auth/me');
    authentication.user = { ...profile, role: profile.globalRole || profile.role || 'USER' };
    return { email, role: authentication.user.role, plan: authentication.user.plan };
  }, { required: true });

  await context.addCookies([{ name: 'doxera_token', value: authentication.token, url: origin.origin, sameSite: 'Lax' }]);
  await context.addInitScript(({ token, user }) => {
    try {
      localStorage.setItem('doxera_token', token);
      localStorage.setItem('doxera_auth_storage', JSON.stringify({ state: { token, user, isAuthenticated: true, isHydrated: true }, version: 0 }));
      if (!localStorage.getItem('doxera_theme')) localStorage.setItem('doxera_theme', 'dark');
    } catch { /* Initial about:blank has no storage origin. */ }
  }, authentication);

  page = await context.newPage();
  page.on('pageerror', error => report.applicationErrors.push({ type: 'pageerror', message: errorText(error), url: page.url() }));
  page.on('console', message => {
    if (message.type() !== 'error') return;
    const entry = { type: 'console', message: message.text(), location: message.location().url };
    if (/GSI_LOGGER|FedCM|accounts\.google\.com|Provider's accounts list is empty/i.test(`${entry.message} ${entry.location}`)) report.knownGoogleHeadlessErrors.push(entry);
    else report.applicationErrors.push(entry);
  });
  page.on('response', response => {
    const parsed = new URL(response.url());
    if (/^\/api\/v1\/(files\/(presign-upload|confirm-upload)|pdf\/jobs)/.test(parsed.pathname)) {
      report.network.push({ method: response.request().method(), path: parsed.pathname, status: response.status() });
    }
  });

  await check('PDF tool loads with a hydrated real account', async () => {
    await page.goto('/tools/compress-pdf', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForHydration();
    await page.locator('input[type="file"]').waitFor({ state: 'attached' });
    assert.equal(await page.getByRole('heading', { name: /^compress pdf$/i }).count(), 1);
    assert.equal(await page.getByRole('button', { name: /^execute/i }).count(), 0, 'Execute should not show before a file is selected.');
    await screenshot('01-empty-desktop-dark');
    return noOverflow();
  }, { required: true });

  await check('Valid PDF is selected through the actual upload control', async () => {
    await page.setInputFiles('input[type="file"]', validPath);
    await page.getByText('synthetic-valid.pdf', { exact: true }).waitFor({ state: 'visible' });
    await page.getByRole('button', { name: /^execute/i }).waitFor({ state: 'visible' });
    await screenshot('02-file-selected');
    return { inputBytes: validPdf.length };
  }, { required: true });

  const completed = await check('Real storage upload and worker compression complete in the UI', () => executeJob({ screenshotName: '03-success' }), { required: true });

  await check('Downloaded result is a real transformed PDF with the reported byte count', async () => {
    const waiting = page.waitForEvent('download', { timeout: 30000 });
    await page.getByRole('button', { name: /^download processed pdf$/i }).click();
    const download = await waiting;
    assert.equal(await download.failure(), null);
    const target = path.join(outputDirectory, 'downloaded-compressed.pdf');
    await download.saveAs(target);
    const bytes = fs.readFileSync(target);
    assert.equal(bytes.subarray(0, 5).toString('ascii'), '%PDF-');
    assert(/%%EOF\s*$/.test(bytes.toString('latin1')), 'PDF must contain its terminal EOF marker.');
    assert(bytes.length > 100, 'Downloaded result should contain a complete document.');
    assert(bytes.length < validPdf.length, 'This compressible synthetic PDF should shrink.');
    assert.notEqual(crypto.createHash('sha256').update(bytes).digest('hex'), crypto.createHash('sha256').update(validPdf).digest('hex'), 'Download must not be the original file fallback.');
    const reported = Number(completed.remote.outputFileSizeBytes ?? completed.remote.outputSizeBytes);
    assert.equal(bytes.length, reported, 'Downloaded byte count must match the worker result.');
    return { inputBytes: validPdf.length, outputBytes: bytes.length, suggestedFilename: download.suggestedFilename() };
  }, { required: true });

  await check('Corrupted PDF produces a genuine worker error and no download', async () => {
    await page.getByRole('button', { name: /^process another file$/i }).click();
    await page.setInputFiles('input[type="file"]', corruptedPath);
    await page.getByText('synthetic-corrupted.pdf', { exact: true }).waitFor({ state: 'visible' });
    return executeJob({ expectedStatus: 'FAILED', screenshotName: '04-corrupted-error' });
  }, { required: true });

  await check('Retry sends a fresh real request and preserves the corrupted-file failure', () => executeJob({ retry: true, expectedStatus: 'FAILED', screenshotName: '05-retry-error' }), { required: true });

  await check('Replacing the corrupted file permits a real successful retry', async () => {
    await page.getByRole('button', { name: /^remove file$/i }).click();
    await page.setInputFiles('input[type="file"]', validPath);
    await page.getByText('synthetic-valid.pdf', { exact: true }).waitFor({ state: 'visible' });
    assert.equal(await page.getByRole('button', { name: /^retry$/i }).count(), 0);
    return executeJob({ screenshotName: '06-recovered-success' });
  }, { required: true });

  await check('Real dashboard history includes the completed and failed PDF jobs', async () => {
    const jobs = await api('/pdf/jobs/user/history');
    assert(Array.isArray(jobs));
    for (const expected of report.jobs) {
      assert(jobs.some(job => job.id === expected.jobId && job.status === expected.status), `Missing ${expected.status} job ${expected.jobId} in history.`);
    }
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForHydration();
    // Headings and navigation also contain words such as Completed/Compress;
    // wait for actual document rows before treating the dashboard as loaded.
    await page.getByText('synthetic-valid.pdf', { exact: true }).first().waitFor({ state: 'visible', timeout: 30000 });
    await page.getByText('synthetic-corrupted.pdf', { exact: true }).first().waitFor({ state: 'visible', timeout: 30000 });
    assert.equal(await page.getByRole('cell', { name: /^completed$/i }).count(), 2);
    assert.equal(await page.getByRole('cell', { name: /^failed$/i }).count(), 2);
    await screenshot('07-dashboard-real-jobs');
    return { recentJobsReturned: jobs.length, completed: jobs.filter(job => job.status === 'COMPLETED').length, failed: jobs.filter(job => job.status === 'FAILED').length };
  });

  for (const width of [1440, 768, 390]) {
    for (const theme of ['light', 'dark']) {
      await check(`PDF tool responsive layout ${width}px ${theme}`, async () => {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
        await page.emulateMedia({ colorScheme: theme });
        await page.evaluate(value => localStorage.setItem('doxera_theme', value), theme);
        await page.goto('/tools/compress-pdf', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await waitForHydration();
        await page.setInputFiles('input[type="file"]', validPath);
        await page.getByText('synthetic-valid.pdf', { exact: true }).waitFor({ state: 'visible' });
        assert.equal(await page.evaluate(() => document.documentElement.classList.contains('dark')), theme === 'dark');
        const sizes = await noOverflow();
        await screenshot(`08-tool-${width}-${theme}`);
        return sizes;
      });
    }
  }

  await check('No application exceptions or unexpected console errors', async () => {
    assert.deepEqual(report.applicationErrors, []);
    return { knownGoogleHeadlessErrors: report.knownGoogleHeadlessErrors.length };
  });
  await check('No payment mutations were attempted', async () => {
    assert.equal(report.blockedPaymentRequests, 0);
    return { realPaymentRequestsSent: 0 };
  });
}

main().catch(async error => {
  report.fatalError = errorText(error);
  if (page) await screenshot('fatal-state').catch(() => {});
}).finally(async () => {
  if (browser) await browser.close();
  report.finishedAt = new Date().toISOString();
  report.summary = { passed: report.checks.filter(check => check.status === 'passed').length, failed: report.checks.filter(check => check.status === 'failed').length };
  fs.writeFileSync(path.join(outputDirectory, 'report.json'), JSON.stringify(report, null, 2));
  process.stdout.write(`PDF workflow: ${report.summary.passed} passed, ${report.summary.failed} failed. Report: ${path.join(outputDirectory, 'report.json')}\n`);
  if (report.fatalError || report.summary.failed) process.exitCode = 1;
});
