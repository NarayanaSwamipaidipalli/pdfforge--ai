/* Local dashboard/workspace QA. Requires an existing Playwright installation.
 * Authentication and baseline data use the real local API. Failure fixtures
 * are explicitly labeled. Every payment mutation is blocked. No payment IDs,
 * signatures, successful charges, or subscription activation are simulated. */
'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
// Set PLAYWRIGHT_MODULE_PATH to use a Playwright install outside this repository.
const defaultPlaywright = 'playwright';
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || defaultPlaywright);
const baseURL = (process.env.UI_TEST_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const origin = new URL(baseURL);
assert(['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname), 'Only local development origins are supported.');
const output = path.resolve(__dirname, '..', '.remediation/ui-redesign/workspace');
fs.mkdirSync(path.join(output, 'shots'), { recursive: true });
const report = { startedAt: new Date().toISOString(), baseURL, checks: [], screenshots: [], applicationErrors: [], expectedErrors: [], fixtures: [], blockedPaymentMutations: 0 };
const contexts = [];
let browser;
let authentication;
let realHistory;
let realProfile;
let fixtureMode = false;
const password = `Workspace!${crypto.randomBytes(18).toString('hex')}`;
const email = `workspace-ui-${Date.now()}-${crypto.randomBytes(3).toString('hex')}@example.com`;

async function check(name, run, source = 'real local backend') {
  try {
    const details = await run();
    report.checks.push({ name, status: 'passed', source, ...(details === undefined ? {} : { details }) });
    process.stdout.write(`PASS ${name}\n`);
    return true;
  } catch (error) {
    report.checks.push({ name, status: 'failed', source, error: error.message || String(error) });
    process.stdout.write(`FAIL ${name}: ${error.message || error}\n`);
    return false;
  }
}
async function api(endpoint, options = {}, token) {
  const response = await fetch(`${baseURL}/api/v1${endpoint}`, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) }, signal: AbortSignal.timeout(30000) });
  const body = await response.json().catch(() => null);
  return { status: response.status, body };
}
async function context({ width = 1440, theme = 'dark', authenticated = true, reducedMotion = 'no-preference' } = {}) {
  const result = await browser.newContext({ baseURL, viewport: { width, height: 960 }, colorScheme: theme, reducedMotion });
  contexts.push(result);
  await result.route('**/api/v1/billing/**', async route => {
    if (route.request().method() === 'GET') return route.continue();
    report.blockedPaymentMutations += 1;
    return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ message: 'Payment mutations are blocked in workspace QA.' }) });
  });
  await result.addInitScript(({ theme, auth }) => {
    try {
      if (!localStorage.getItem('doxera_theme')) localStorage.setItem('doxera_theme', theme);
      if (auth) {
        localStorage.setItem('doxera_token', auth.token);
        localStorage.setItem('doxera_auth_storage', JSON.stringify({ state: { token: auth.token, user: auth.user, isAuthenticated: true, isHydrated: true }, version: 0 }));
      }
    } catch { /* Initial about:blank has no storage origin. */ }
  }, { theme, auth: authenticated ? authentication : null });
  if (authenticated) await result.addCookies([{ name: 'doxera_token', value: authentication.token, url: origin.origin, sameSite: 'Lax' }]);
  result.on('page', page => {
    page.on('pageerror', error => report.applicationErrors.push({ url: page.url(), message: error.message }));
    page.on('console', message => {
      if (message.type() !== 'error') return;
      const entry = { url: page.url(), message: message.text(), location: message.location().url };
      if ((fixtureMode && /Failed to load resource|fixture|503|403/.test(entry.message)) || /GSI_LOGGER|FedCM|accounts\.google\.com/i.test(`${entry.message} ${entry.location}`)) report.expectedErrors.push(entry);
      else report.applicationErrors.push(entry);
    });
  });
  return result;
}
async function open(ctx, route = '/dashboard') {
  const page = await ctx.newPage();
  await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 60000 });
  return page;
}
async function waitDashboard(page) {
  await page.getByRole('heading', { level: 1 }).waitFor({ state: 'visible', timeout: 30000 });
  await page.getByText(/recent (jobs|activity|documents)/i).first().waitFor({ state: 'visible', timeout: 30000 });
  await page.getByText(/no (documents|jobs|activity)|your first (document|job)/i).first().waitFor({ state: 'visible', timeout: 30000 });
}
async function reveal(page) {
  await page.evaluate(async () => {
    for (let top = 0; top < document.documentElement.scrollHeight; top += Math.max(300, innerHeight * .7)) {
      window.scrollTo({ top, behavior: 'instant' });
      await new Promise(resolve => setTimeout(resolve, 90));
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  });
  await page.waitForTimeout(650);
}
async function styleAndOverflow(page, theme) {
  const details = await page.evaluate(() => ({
    width: innerWidth, documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
    headingSize: Number.parseFloat(getComputedStyle(document.querySelector('main h1')).fontSize),
    font: getComputedStyle(document.body).fontFamily,
    dark: document.documentElement.classList.contains('dark'),
  }));
  assert(details.headingSize >= 28, `Tailwind typography missing: ${JSON.stringify(details)}`);
  assert(details.documentWidth <= details.width + 1 && details.bodyWidth <= details.width + 1, `Horizontal overflow: ${JSON.stringify(details)}`);
  assert.equal(details.dark, theme === 'dark');
  assert.equal(await page.locator('main h1').count(), 1);
  const unnamed = await page.locator('main button').evaluateAll(elements => elements.filter(el => el.getClientRects().length > 0 && !(el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('title') || el.innerText.trim())).map(el => el.outerHTML));
  assert.deepEqual(unnamed, []);
  return details;
}
async function screenshot(page, name, source = 'real local backend') {
  const file = path.join(output, 'shots', `${name}.png`);
  await page.screenshot({ path: file, fullPage: true, animations: 'disabled' });
  report.screenshots.push({ name, file, source });
}
async function fixture(page, endpoint, response, run) {
  const pattern = `**/api/v1${endpoint}`;
  fixtureMode = true;
  report.fixtures.push({ endpoint, status: response.status || 200, purpose: response.purpose });
  await page.route(pattern, async route => {
    if (response.delay) await new Promise(resolve => setTimeout(resolve, response.delay));
    await route.fulfill({ status: response.status || 200, contentType: 'application/json', body: JSON.stringify(response.body) });
  });
  try { return await run(); } finally { await page.unroute(pattern); fixtureMode = false; }
}

async function main() {
  const registered = await api('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, name: 'Workspace QA' }) });
  assert.equal(registered.status, 201, registered.body?.message);
  authentication = { token: registered.body.tokens.accessToken, user: { ...registered.body.user, role: registered.body.user.globalRole || registered.body.user.role || 'USER' } };
  await check('Read a real empty recent history and authoritative profile', async () => {
    const [history, profile] = await Promise.all([api('/pdf/jobs/user/history', {}, authentication.token), api('/auth/me', {}, authentication.token)]);
    assert.equal(history.status, 200); assert.equal(profile.status, 200);
    assert.deepEqual(history.body, []);
    realHistory = history.body; realProfile = profile.body;
    return { recentJobs: realHistory.length, plan: realProfile.plan, storageUsedBytes: realProfile.storageUsedBytes, storageLimitBytes: realProfile.storageLimitBytes };
  });
  browser = await chromium.launch({ executablePath: process.env.UI_TEST_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--disable-gpu'] });
  const anonymous = await context({ authenticated: false, theme: 'light' });
  const anonPage = await open(anonymous);
  await check('Anonymous dashboard access redirects to sign-in', async () => {
    await anonPage.waitForURL(/\/login\?redirect=/, { timeout: 15000 });
    assert.equal(new URL(anonPage.url()).searchParams.get('redirect'), '/dashboard');
  });
  await anonymous.close();
  for (const width of [1440, 768, 390]) for (const theme of ['light', 'dark']) {
    const ctx = await context({ width, theme });
    const page = await open(ctx);
    await check(`Dashboard ${width}px ${theme}: real empty state, typography and responsive layout`, async () => {
      await waitDashboard(page); await reveal(page);
      const dimensions = await styleAndOverflow(page, theme);
      const text = await page.locator('main').innerText();
      for (const id of ['dashboard-recent-count', 'dashboard-completed-count', 'dashboard-active-count']) {
        assert.equal((await page.getByTestId(id).innerText()).trim(), '0', `${id} must reflect the real empty job list.`);
      }
      assert(/latest\s*20|up to 20|most recent 20/i.test(text), 'The 20-job history limit must be disclosed.');
      assert(!/1\.8\s*GB|50\.0?\s*GB|DoD|99\.99%|Active Subscription/.test(text), 'Invented dashboard metric or guarantee.');
      assert(/FREE/.test(text), 'The actual FREE account plan must be visible.');
      await screenshot(page, `dashboard-${width}-${theme}`);
      return dimensions;
    });
    if (width === 1440 && theme === 'dark') await check('Desktop sidebar collapses, persists across reload and expands', async () => {
      const sidebar = page.getByRole('complementary', { name: 'Workspace sidebar' });
      await sidebar.getByRole('button', { name: 'Collapse sidebar' }).click();
      assert.equal(await page.evaluate(() => localStorage.getItem('doxera_sidebar_collapsed')), 'true');
      await sidebar.getByRole('button', { name: 'Expand sidebar' }).waitFor();
      await screenshot(page, 'dashboard-sidebar-collapsed');
      await page.reload({ waitUntil: 'domcontentloaded' });
      await sidebar.getByRole('button', { name: 'Expand sidebar' }).waitFor({ timeout: 15000 });
      await sidebar.getByRole('button', { name: 'Expand sidebar' }).click();
      assert.equal(await page.evaluate(() => localStorage.getItem('doxera_sidebar_collapsed')), 'false');
      await sidebar.getByRole('link', { name: 'Overview', exact: true }).waitFor();
    });
    if (width === 390 && theme === 'dark') await check('Mobile workspace drawer traps focus, dismisses and navigates', async () => {
      const trigger = page.getByRole('button', { name: 'Open workspace navigation' });
      await trigger.click();
      const dialog = page.getByRole('dialog', { name: 'Your workspace' });
      await dialog.waitFor({ state: 'visible' });
      assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
      const controls = dialog.locator('button, a[href]');
      await controls.last().focus(); await page.keyboard.press('Tab');
      assert(await dialog.evaluate(el => el.contains(document.activeElement)), 'Tab escaped native modal drawer.');
      await screenshot(page, 'dashboard-mobile-drawer');
      await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
      assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden');
      assert(await trigger.evaluate(el => el === document.activeElement), 'Drawer dismissal must restore focus.');
      await trigger.click(); await dialog.getByRole('link', { name: 'Billing', exact: true }).click();
      await page.waitForURL(/\/billing/);
      await page.getByRole('heading', { name: /Billing.*subscription/i }).waitFor();
      assert.equal(await page.locator('dialog[open]').count(), 0);
    });
    await ctx.close();
  }
  const errorContext = await context({ width: 390, theme: 'dark' });
  const errorPage = await open(errorContext);
  await check('Recent history failure is explicit and recoverable', async () => {
    await fixture(errorPage, '/pdf/jobs/user/history', { status: 503, body: { message: 'Recent jobs failure fixture.' }, purpose: 'Rendering-only API failure; real account history remains empty.' }, async () => {
      await errorPage.reload({ waitUntil: 'domcontentloaded' });
      await errorPage.getByText(/Recent jobs failure fixture\./).first().waitFor({ timeout: 15000 });
      await errorPage.getByRole('button', { name: /try again|retry|refresh/i }).first().waitFor();
      await reveal(errorPage); await screenshot(errorPage, 'dashboard-history-error', 'injected HTTP 503 recent history failure');
    });
    await errorPage.reload({ waitUntil: 'domcontentloaded' }); await waitDashboard(errorPage);
  }, 'injected HTTP503 + real history recovery');
  await check('Dashboard loading state appears before backend results', async () => {
    await fixture(errorPage, '/pdf/jobs/user/history', { delay: 2200, body: realHistory, purpose: 'Delayed real empty history to verify visible loading.' }, async () => {
      await errorPage.reload({ waitUntil: 'domcontentloaded' });
      await errorPage.locator('[role="status"], .skeleton').first().waitFor({ state: 'visible', timeout: 1500 });
      await waitDashboard(errorPage);
    });
  }, 'delayed real API result fixture');
  await check('Reduced-motion dashboard content remains visible', async () => {
    const ctx = await context({ width: 768, theme: 'light', reducedMotion: 'reduce' });
    const page = await open(ctx); await waitDashboard(page); await reveal(page);
    const invisible = await page.locator('main [data-motion-reveal]').evaluateAll(elements => elements.filter(el => Number(getComputedStyle(el).opacity) < .95).length);
    assert.equal(invisible, 0); await screenshot(page, 'dashboard-reduced-motion'); await ctx.close();
  });
  await check('No unexpected browser errors occurred', async () => assert.deepEqual(report.applicationErrors, []), 'Playwright diagnostics');
}

main().catch(error => { report.fatalError = error.message || String(error); process.stderr.write(`${report.fatalError}\n`); process.exitCode = 1; }).finally(async () => {
  for (const ctx of contexts) await ctx.close().catch(() => {});
  if (browser) await browser.close().catch(() => {});
  report.finishedAt = new Date().toISOString();
  report.totals = { passed: report.checks.filter(item => item.status === 'passed').length, failed: report.checks.filter(item => item.status === 'failed').length };
  fs.writeFileSync(path.join(output, 'browser-report.json'), JSON.stringify(report, null, 2));
  process.stdout.write(`Report: ${path.join(output, 'browser-report.json')}\n${report.totals.passed} passed; ${report.totals.failed} failed.\n`);
  if (report.totals.failed) process.exitCode = 1;
});
