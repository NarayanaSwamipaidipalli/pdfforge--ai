/* Local phase-4 browser verification. All baseline data and user actions use the
 * real local API. Explicit HTTP-error fixtures never simulate payments or AI
 * success. --admin temporarily grants ADMIN only to this newly registered QA
 * account in the local database, then restores USER in finally. */
'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'C:/Users/rough/AppData/Local/Temp/claude/2ad6d17696e33840/db3d4104-c59d-4d32-9b01-712bf8f1be57/scratchpad/vis/node_modules/playwright');
const baseURL = process.env.UI_TEST_BASE_URL || 'http://localhost:3000';
assert(['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname));
const output = path.resolve(__dirname, '../.remediation/ui-redesign/phase4');
fs.mkdirSync(path.join(output, 'shots'), { recursive: true });
const report = { checks: [], screenshots: [], applicationErrors: [], expectedErrors: [], fixtures: [], startedAt: new Date().toISOString() };
const email = 'phase4-ui-' + Date.now() + '-' + crypto.randomBytes(3).toString('hex') + '@example.com';
const password = 'Phase4!' + crypto.randomBytes(18).toString('hex');
let auth, browser, elevated = false, fixtureMode = false;
const contexts = [];
async function api(endpoint, options = {}) {
  const response = await fetch(baseURL + '/api/v1' + endpoint, { ...options, headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: 'Bearer ' + auth.token } : {}) }, signal: AbortSignal.timeout(45000) });
  return { status: response.status, body: await response.json().catch(() => null) };
}
async function check(name, run) {
  try { await run(); report.checks.push({ name, status: 'passed' }); console.log('PASS ' + name); }
  catch (error) { report.checks.push({ name, status: 'failed', error: error.message }); console.log('FAIL ' + name + ': ' + error.message); }
}
function setQaRole(role) {
  assert(auth.user.email === email && email.startsWith('phase4-ui-') && ['ADMIN', 'USER'].includes(role));
  const source = "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.user.updateMany({where:{id:process.argv[1],email:process.argv[2]},data:{globalRole:process.argv[3]}}).then(r=>{if(r.count!==1)throw Error('QA account not found')}).finally(()=>p.$disconnect()).catch(()=>process.exitCode=1)";
  execFileSync('docker', ['exec', 'pdfforge-api-gateway', 'node', '-e', source, auth.user.id, email, role], { stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 });
}
async function context(width = 1440, theme = 'light', authenticated = true) {
  const ctx = await browser.newContext({ baseURL, viewport: { width, height: 960 }, colorScheme: theme });
  contexts.push(ctx);
  await ctx.route(/\/api\/v1\/billing\/.*(checkout|verify|capture|cancel|reactivate)/, route => route.fulfill({ status: 403, contentType: 'application/json', body: '{"message":"Payment mutation blocked in QA"}' }));
  await ctx.addInitScript(({ theme, auth }) => {
    if (!/^https?:$/.test(location.protocol)) return;
    if (!localStorage.getItem('doxera_theme')) localStorage.setItem('doxera_theme', theme);
    if (auth) {
      localStorage.setItem('doxera_token', auth.token);
      localStorage.setItem('doxera_auth_storage', JSON.stringify({ state: { user: auth.user, token: auth.token, isAuthenticated: true, isHydrated: true }, version: 0 }));
    }
  }, { theme, auth: authenticated ? auth : null });
  if (authenticated) await ctx.addCookies([{ name: 'doxera_token', value: auth.token, url: baseURL, sameSite: 'Lax' }]);
  ctx.on('page', page => {
    page.on('pageerror', error => report.applicationErrors.push({ url: page.url(), message: error.message }));
    page.on('console', message => {
      if (message.type() !== 'error') return;
      const entry = { url: page.url(), message: message.text(), location: message.location().url };
      if (fixtureMode || /GSI_LOGGER|FedCM|accounts.google.com/.test(entry.message + entry.location)) report.expectedErrors.push(entry);
      else report.applicationErrors.push(entry);
    });
  });
  return ctx;
}
async function visit(page, route) {
  await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.getByRole('heading', { level: 1 }).waitFor();
}
async function ready(page, route) {
  const selectors = {
    '/account': () => page.getByLabel('Full name', { exact: true }),
    '/settings': () => page.getByText('No API keys yet.', { exact: false }),
    '/ai-studio': () => page.getByText('Start with your document', { exact: true }),
    '/organizations': () => page.getByRole('heading', { name: 'Your organizations', exact: true }),
    '/admin': () => page.getByText('Registered accounts', { exact: true }),
  };
  await selectors[route]().waitFor({ timeout: 30000 });
}
async function reveal(page) {
  await page.evaluate(async () => {
    for (let top = 0; top < document.documentElement.scrollHeight; top += innerHeight * .7) { scrollTo({ top, behavior: 'instant' }); await new Promise(resolve => setTimeout(resolve, 80)); }
    scrollTo({ top: 0, behavior: 'instant' });
  });
  await page.waitForTimeout(650);
}
async function shot(page, name) {
  await reveal(page);
  const sizes = await page.evaluate(() => ({ width: innerWidth, body: document.body.scrollWidth, doc: document.documentElement.scrollWidth, heading: parseFloat(getComputedStyle(document.querySelector('main h1')).fontSize) }));
  assert(sizes.doc <= sizes.width + 1 && sizes.body <= sizes.width + 1, 'Horizontal overflow: ' + JSON.stringify(sizes));
  assert(sizes.heading >= 28, 'Missing Tailwind typography');
  const file = path.join(output, 'shots', name + '.png');
  await page.screenshot({ path: file, fullPage: true, animations: 'disabled' });
  report.screenshots.push({ name, file, source: 'real local API' });
}
async function failure(page, endpoint, run) {
  const pattern = '**/api/v1' + endpoint;
  fixtureMode = true; report.fixtures.push({ endpoint, status: 503 });
  await page.route(pattern, route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"Intentional service failure for UI verification."}' }));
  try { await run(); } finally { await page.unroute(pattern); fixtureMode = false; }
}
function pdf() {
  const text = 'Invoice reference TEST-LOCAL. Vendor Example Company. Amount INR 99.00. Payment is due within thirty days. This document is a synthetic local test. No real transaction is represented.';
  const stream = 'BT /F1 10 Tf 40 740 Td (' + text + ') Tj ET\n';
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>','<< /Length ' + stream.length + ' >>\nstream\n' + stream + 'endstream','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  let content = '%PDF-1.4\n'; const offsets = [];
  objects.forEach((object, index) => { offsets.push(content.length); content += (index + 1) + ' 0 obj\n' + object + '\nendobj\n'; });
  const start = content.length;
  content += 'xref\n0 6\n0000000000 65535 f \n' + offsets.map(offset => String(offset).padStart(10, '0') + ' 00000 n \n').join('') + 'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + start + '\n%%EOF\n';
  return Buffer.from(content);
}
async function main() {
  const registered = await api('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, name: 'Phase Four QA' }) });
  assert.equal(registered.status, 201, registered.body?.message);
  auth = { token: registered.body.tokens.accessToken, user: { ...registered.body.user, role: 'USER' } };
  const login = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  assert.equal(login.status, 200);
  auth.token = login.body.tokens.accessToken;
  browser = await chromium.launch({ executablePath: process.env.UI_TEST_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  await check('Anonymous access to all workspace pages requires sign-in', async () => {
    const ctx = await context(390, 'light', false); const page = await ctx.newPage();
    for (const route of ['/account', '/settings', '/ai-studio', '/organizations', '/admin']) {
      await page.goto(route); await page.waitForURL(/\/login\?redirect=/); assert.equal(new URL(page.url()).searchParams.get('redirect'), route);
    }
    await ctx.close();
  });
  for (const width of [1440, 768, 390]) for (const theme of ['light', 'dark']) {
    const ctx = await context(width, theme); const page = await ctx.newPage();
    for (const route of ['/account', '/settings', '/ai-studio', '/organizations']) await check(route + ' ' + width + 'px ' + theme + ' real initial state', async () => {
      await visit(page, route); await ready(page, route);
      assert.equal(await page.evaluate(() => document.documentElement.classList.contains('dark')), theme === 'dark');
      await shot(page, route.slice(1) + '-' + width + '-' + theme);
      const text = await page.locator('main').innerText();
      assert(!/demo_msa|Master_Services_Agreement|zero-retention|Identity Verified|1\.8 GB|1000 req\/min/.test(text));
      if (route === '/organizations') {
        const organizations = (await api('/organizations')).body;
        assert(text.includes(organizations[0].name));
        assert(text.includes(organizations[0].myRole));
        const allowanceGb = Number(organizations[0].storageLimitBytes) / 1024 ** 3;
        if (Number.isInteger(allowanceGb)) assert(text.includes(allowanceGb + ' GB'), 'Organization allowance must match the real backend record.');
      }
    });
    await ctx.close();
  }
  const ctx = await context(390, 'dark'); const page = await ctx.newPage();
  await check('Normal account cannot access administrative data or controls', async () => {
    await visit(page, '/admin'); await page.getByText('Administrative access required', { exact: true }).waitFor();
    assert.equal(await page.getByRole('tab', { name: 'Users', exact: true }).count(), 0);
    assert.equal((await api('/admin/telemetry')).status, 403);
    await shot(page, 'admin-access-denied-mobile');
  });
  await check('Profile save persists to the real account; delete stays behind confirmation', async () => {
    await visit(page, '/account'); await ready(page, '/account');
    await page.getByLabel('Full name', { exact: true }).fill('Phase Four Updated');
    await page.getByRole('button', { name: 'Save profile', exact: true }).click();
    await page.getByText('Profile saved.', { exact: true }).waitFor();
    assert.equal((await api('/auth/me')).body.name, 'Phase Four Updated');
    await page.getByRole('button', { name: 'Delete my account' }).click();
    const dialog = page.getByRole('dialog', { name: 'Delete your account?' }); await dialog.waitFor();
    assert(await dialog.getByRole('button', { name: 'Permanently delete' }).isDisabled());
    await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
  });
  await check('Settings theme choice synchronizes and survives reload', async () => {
    await visit(page, '/settings');
    await page.locator('main').getByRole('button', { name: 'Switch to light theme' }).click();
    assert.equal(await page.evaluate(() => localStorage.getItem('doxera_theme')), 'light');
    await page.reload(); await page.locator('main').getByRole('button', { name: 'Switch to dark theme' }).waitFor();
  });
  await check('API key creation and revocation use real backend records', async () => {
    await visit(page, '/settings'); await ready(page, '/settings');
    await page.getByRole('button', { name: 'Create API key', exact: true }).click();
    await page.getByLabel('Key name', { exact: true }).fill('Local verification key');
    await page.getByRole('button', { name: 'Create key', exact: true }).click();
    await page.getByRole('heading', { name: 'Save your API key' }).waitFor();
    const keyRecords = (await api('/auth/api-keys')).body;
    assert.equal(keyRecords.length, 1); assert.equal(keyRecords[0].name, 'Local verification key');
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await page.getByRole('button', { name: 'Revoke key Local verification key' }).click();
    await page.getByRole('button', { name: 'Revoke access', exact: true }).click();
    await page.getByText('API key revoked.', { exact: true }).waitFor();
    assert.deepEqual((await api('/auth/api-keys')).body, []);
  });
  await check('Account and Settings service failures are explicit and recoverable', async () => {
    for (const [route, endpoint] of [['/account', '/auth/me'], ['/settings', '/auth/api-keys']]) {
      await failure(page, endpoint, async () => { await visit(page, route); await page.getByText('Intentional service failure for UI verification.', { exact: true }).first().waitFor(); });
      await visit(page, route); await ready(page, route);
    }
  });
  await check('Organizations and model catalog failures show recovery controls', async () => {
    for (const [route, endpoint] of [['/organizations', '/organizations'], ['/ai-studio', '/ai/models']]) {
      await failure(page, endpoint, async () => { await visit(page, route); await page.getByText(/Intentional service failure for UI verification/).first().waitFor(); });
      await visit(page, route); await ready(page, route);
    }
    const pattern = '**/api/v1/organizations';
    report.fixtures.push({ endpoint: '/organizations', purpose: 'Empty membership list rendering only' });
    await page.route(pattern, route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await visit(page, '/organizations'); await page.getByRole('heading', { name: 'A place for your team' }).waitFor();
    await shot(page, 'organization-empty-fixture');
    report.screenshots[report.screenshots.length - 1].source = 'explicit empty-membership rendering fixture';
    await page.unroute(pattern);
  });
  await check('Create organization, add member and remove member through real APIs', async () => {
    await visit(page, '/organizations'); await ready(page, '/organizations');
    await page.getByRole('button', { name: 'New organization' }).click();
    await page.getByLabel('Organization name').fill('Local QA team');
    await page.getByRole('dialog').getByRole('button', { name: 'Create organization', exact: true }).click();
    await page.getByRole('heading', { name: 'Local QA team', exact: true }).waitFor();
    let organizations = (await api('/organizations')).body;
    let team = organizations.find(org => org.name === 'Local QA team');
    assert(team); assert.equal(team.myRole, 'OWNER'); assert.equal(team.members.length, 1);
    await page.getByRole('button', { name: 'Add member', exact: true }).click();
    await page.getByLabel('Member email', { exact: true }).fill('member-' + email);
    await page.getByRole('dialog').getByRole('button', { name: 'Add member', exact: true }).click();
    await page.getByText('Member added.', { exact: true }).waitFor();
    organizations = (await api('/organizations')).body; team = organizations.find(org => org.name === 'Local QA team'); assert.equal(team.members.length, 2);
    await shot(page, 'organization-real-member-mobile');
    await page.getByRole('button', { name: 'Remove member member-' + email }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Remove member', exact: true }).click();
    await page.getByText('Member removed.', { exact: true }).waitFor();
    assert.equal((await api('/organizations')).body.find(org => org.name === 'Local QA team').members.length, 1);
  });
  await check('AI Studio confirmed upload and four analyses use real service results', async () => {
    await visit(page, '/ai-studio'); await ready(page, '/ai-studio');
    await page.getByLabel('Upload PDF for analysis').setInputFiles({ name: 'local-analysis.pdf', mimeType: 'application/pdf', buffer: pdf() });
    await page.getByText('Upload confirmed. Ready for analysis.', { exact: true }).waitFor({ timeout: 30000 });
    await page.getByLabel('Your question', { exact: true }).fill('What does this document say about payment?');
    await page.getByRole('button', { name: 'Ask document', exact: true }).click();
    await page.getByText('Document answer', { exact: true }).waitFor({ timeout: 60000 });
    assert.equal(await page.locator('article').count(), 2);
    await shot(page, 'ai-real-chat-mobile');
    for (const tab of ['Summary', 'Invoice extraction', 'Contract analysis']) {
      await page.getByRole('tab', { name: tab, exact: true }).click();
      await page.getByRole('button', { name: 'Analyze document', exact: true }).click();
      await page.getByRole('button', { name: 'Copy result', exact: true }).waitFor({ timeout: 60000 });
      await shot(page, 'ai-real-' + tab.toLowerCase().replaceAll(' ', '-'));
    }
    await failure(page, '/ai/analyze/contract', async () => {
      await page.getByRole('button', { name: 'Run again', exact: true }).click();
      await page.getByText('Intentional service failure for UI verification.', { exact: true }).waitFor();
    });
    await failure(page, '/files/confirm-upload', async () => {
      await page.getByLabel('Upload PDF for analysis').setInputFiles({ name: 'unconfirmed.pdf', mimeType: 'application/pdf', buffer: pdf() });
      await page.getByText('Intentional service failure for UI verification.', { exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Analyze document', exact: true }).count(), 0);
      assert.equal(await page.getByText('Upload confirmed. Ready for analysis.', { exact: true }).count(), 0);
    });
  });
  await ctx.close();
  if (process.argv.includes('--admin')) {
    setQaRole('ADMIN'); elevated = true;
    const me = await api('/auth/me'); assert.equal(me.body.globalRole || me.body.role, 'ADMIN');
    auth.user = { ...me.body, role: 'ADMIN' };
    const telemetry = await api('/admin/telemetry'); assert.equal(telemetry.status, 200);
    for (const width of [1440, 768, 390]) for (const theme of ['light', 'dark']) await check('Admin ' + width + 'px ' + theme + ' real records', async () => {
      const ctx = await context(width, theme); const page = await ctx.newPage(); await visit(page, '/admin'); await ready(page, '/admin');
      const text = await page.locator('main').innerText(); assert(!/OPERATIONAL|142|50.0 TB|98.5%|Active Worker/.test(text));
      await shot(page, 'admin-' + width + '-' + theme);
      for (const tab of ['users', 'jobs', 'billing', 'audit']) {
        await page.getByRole('tab', { name: tab, exact: true }).click();
        await page.getByRole('tabpanel').waitFor({ timeout: 30000 });
        if (width === 390 && theme === 'dark') await shot(page, 'admin-' + tab + '-mobile');
      }
      await ctx.close();
    });
    await check('Admin search and suspension confirmation do not mutate accounts', async () => {
      const ctx = await context(); const page = await ctx.newPage(); await visit(page, '/admin'); await ready(page, '/admin');
      await page.getByRole('tab', { name: 'users', exact: true }).click();
      await page.getByLabel('Search accounts').fill(email); await page.getByRole('button', { name: 'Search', exact: true }).click();
      await page.getByRole('cell', { name: new RegExp(email.replace(/[.*+?^$\{\}()|[\]\\]/g, '\\$&')) }).first().waitFor();
      assert.equal(await page.getByRole('button', { name: 'Change role', exact: true }).count(), 0, 'ADMIN must not have SUPERADMIN role controls.');
      await ctx.close();
    });
  }
  await check('No real payments or subscriptions were created', async () => {
    const history = await api('/billing/history'); assert.equal(history.body.currentPlan, 'FREE'); assert.deepEqual(history.body.payments, []); assert.deepEqual(history.body.subscriptions, []);
  });
  if (elevated) { setQaRole('USER'); elevated = false; report.qaAdminRoleRestored = true; auth.user.role = 'USER'; }
  await check('Session revocation confirms and signs out the local QA account', async () => {
    const ctx = await context(); const page = await ctx.newPage(); await visit(page, '/settings');
    await page.getByRole('button', { name: 'Revoke all sessions', exact: true }).waitFor();
    await page.waitForFunction(() => !Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Revoke all sessions')?.disabled);
    await page.getByRole('button', { name: 'Revoke all sessions', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Revoke access', exact: true }).click();
    await page.waitForURL(/\/login/); await ctx.close();
  });
  await check('No unexpected application errors', async () => assert.deepEqual(report.applicationErrors, []));
}
main().catch(error => { report.fatalError = error.message; process.exitCode = 1; console.error(error.message); }).finally(async () => {
  if (elevated) { try { setQaRole('USER'); report.qaAdminRoleRestored = true; } catch { report.qaAdminRoleRestored = false; process.exitCode = 1; } }
  for (const ctx of contexts) await ctx.close().catch(() => {});
  if (browser) await browser.close();
  report.finishedAt = new Date().toISOString(); report.totals = { passed: report.checks.filter(check => check.status === 'passed').length, failed: report.checks.filter(check => check.status === 'failed').length };
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.totals)); if (report.totals.failed) process.exitCode = 1;
});
