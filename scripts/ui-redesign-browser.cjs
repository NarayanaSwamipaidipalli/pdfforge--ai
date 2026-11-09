/*
 * Local UI verification. No project dependency installation is required.
 *
 * UI_TEST_BASE_URL=http://localhost:3100
 * PLAYWRIGHT_MODULE_PATH=<optional path to an existing playwright module>
 * UI_TEST_CHROME_PATH=<optional installed Chrome executable>
 *
 * Authentication and the initial billing reads use the real local backend.
 * Rendering fixtures are explicitly identified in the report. Checkout is
 * always intercepted with an error, so this harness cannot create an order,
 * supply payment credentials, verify a payment, or activate a subscription.
 */
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const defaultPlaywright = 'C:/Users/rough/AppData/Local/Temp/claude/2ad6d17696e33840/db3d4104-c59d-4d32-9b01-712bf8f1be57/scratchpad/vis/node_modules/playwright';
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || defaultPlaywright);
const baseURL = (process.env.UI_TEST_BASE_URL || 'http://localhost:3100').replace(/\/$/, '');
const origin = new URL(baseURL);
assert(['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname), 'Run this registration/fixture harness against a local test server only.');
const outputDirectory = path.resolve(__dirname, '..', '.remediation', 'ui-redesign');
const screenshotDirectory = path.join(outputDirectory, 'shots');
fs.mkdirSync(screenshotDirectory, { recursive: true });

const report = {
  startedAt: new Date().toISOString(),
  baseURL,
  checks: [],
  screenshots: [],
  applicationErrors: [],
  knownGoogleHeadlessErrors: [],
  expectedFixtureErrors: [],
  fixtures: [],
  checkoutSafety: { blockedCheckoutRequests: 0, blockedVerificationRequests: 0, realPaymentRequestsSent: 0 },
};

let browser;
let fixtureMode = false;
let authentication;
let realPlans;
let realProviders;
let realHistory;
const contexts = [];
const password = `Ui!${crypto.randomBytes(18).toString('hex')}`;
const email = `doxera-ui-${Date.now()}-${crypto.randomBytes(3).toString('hex')}@example.com`;

function errorText(error) {
  return error instanceof Error ? error.message : String(error);
}

async function check(name, run, { source = 'real local backend', required = false } = {}) {
  try {
    const details = await run();
    report.checks.push({ name, status: 'passed', source, ...(details === undefined ? {} : { details }) });
    process.stdout.write(`PASS ${name}\n`);
    return true;
  } catch (error) {
    report.checks.push({ name, status: 'failed', source, error: errorText(error) });
    process.stdout.write(`FAIL ${name}: ${errorText(error)}\n`);
    if (required) throw error;
    return false;
  }
}

async function api(endpoint, options = {}, token) {
  const response = await fetch(`${baseURL}/api/v1${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    signal: AbortSignal.timeout(30000),
  });
  const body = await response.json().catch(() => null);
  return { status: response.status, ok: response.ok, body };
}

function attachPageDiagnostics(page) {
  page.on('pageerror', (error) => {
    report.applicationErrors.push({ type: 'pageerror', url: page.url(), message: errorText(error) });
  });
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const item = { type: 'console', url: page.url(), message: message.text(), location: message.location().url };
    if (/GSI_LOGGER|FedCM|accounts\.google\.com|Provider's accounts list is empty/i.test(`${item.message} ${item.location}`)) {
      report.knownGoogleHeadlessErrors.push(item);
    } else if (fixtureMode && /Failed to load resource|fixture|503/i.test(item.message)) {
      report.expectedFixtureErrors.push(item);
    } else {
      report.applicationErrors.push(item);
    }
  });
}

async function createContext({ authenticated = false, width = 1440, height = 960, theme = 'dark', reducedMotion = 'no-preference' } = {}) {
  const context = await browser.newContext({
    baseURL,
    viewport: { width, height },
    colorScheme: theme,
    reducedMotion,
    acceptDownloads: true,
  });
  contexts.push(context);
  // Deliberately fail every checkout. There is no live payment path in this test.
  await context.route('**/api/v1/billing/checkout', async (route) => {
    report.checkoutSafety.blockedCheckoutRequests += 1;
    await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Checkout failure fixture: no order was created.' }) });
  });
  for (const endpoint of ['razorpay/verify', 'paypal/capture']) {
    await context.route(`**/api/v1/billing/${endpoint}`, async (route) => {
      report.checkoutSafety.blockedVerificationRequests += 1;
      await route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ message: 'Payment verification is prohibited in this rendering harness.' }) });
    });
  }
  await context.addInitScript(({ desiredTheme }) => {
    try {
      if (!localStorage.getItem('doxera_theme')) localStorage.setItem('doxera_theme', desiredTheme);
    } catch { /* Chrome's initial about:blank document has no storage origin. */ }
  }, { desiredTheme: theme });
  if (authenticated) {
    assert(authentication, 'A real authenticated session is required.');
    await context.addCookies([{ name: 'doxera_token', value: authentication.token, url: origin.origin, sameSite: 'Lax' }]);
    await context.addInitScript(({ token, user }) => {
      try {
        localStorage.setItem('doxera_token', token);
        localStorage.setItem('doxera_auth_storage', JSON.stringify({ state: { token, user, isAuthenticated: true, isHydrated: true }, version: 0 }));
      } catch { /* Ignore only the initial document without a storage origin. */ }
    }, authentication);
  }
  context.on('page', attachPageDiagnostics);
  return context;
}

async function openPage(context, route) {
  const page = await context.newPage();
  await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 60000 });
  return page;
}

async function waitForPlans(page) {
  await page.locator('[data-testid="plan-PRO"]').waitFor({ state: 'visible', timeout: 30000 });
}

async function chooseCycle(page, cycle) {
  const expression = cycle === 'yearly' ? /^(yearly|annually)(\s|$)/i : /^monthly(\s|$)/i;
  const button = page.getByRole('button', { name: expression }).first();
  await button.click();
  return button;
}

async function openProCheckout(page) {
  const card = page.locator('[data-testid="plan-PRO"]');
  await card.getByRole('button').last().click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor({ state: 'visible', timeout: 10000 });
  return dialog;
}

async function assertNoOverflow(page) {
  const sizes = await page.evaluate(() => ({
    width: window.innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  assert(sizes.document <= sizes.width + 1, `Document overflow: ${JSON.stringify(sizes)}`);
  assert(sizes.body <= sizes.width + 1, `Body overflow: ${JSON.stringify(sizes)}`);
  return sizes;
}

async function assertNamedControls(page) {
  const unnamed = await page.locator('main button').evaluateAll((buttons) => buttons
    .filter((button) => button.getBoundingClientRect().width > 0)
    .filter((button) => !(button.getAttribute('aria-label') || button.getAttribute('aria-labelledby') || button.getAttribute('title') || button.innerText.trim()))
    .map((button) => button.outerHTML.slice(0, 160)));
  assert.deepEqual(unnamed, [], 'Visible buttons must have an accessible name.');
}

async function assertUtilityStyles(page) {
  const styles = await page.evaluate(() => {
    const heading = document.querySelector('main h1');
    const plan = document.querySelector('[data-testid="plan-PRO"]');
    return {
      headingSize: heading ? Number.parseFloat(getComputedStyle(heading).fontSize) : 0,
      planDisplay: plan ? getComputedStyle(plan).display : 'missing',
      cardRadius: plan?.parentElement ? Number.parseFloat(getComputedStyle(plan.parentElement).borderTopLeftRadius) : 0,
    };
  });
  assert(styles.headingSize >= 28, `Page appears unstyled: ${JSON.stringify(styles)}`);
  assert.equal(styles.planDisplay, 'flex', `Plan utilities are not applied: ${JSON.stringify(styles)}`);
  assert(styles.cardRadius >= 12, `Card utilities are not applied: ${JSON.stringify(styles)}`);
  return styles;
}

async function revealPage(page) {
  await page.evaluate(async () => {
    const height = document.documentElement.scrollHeight;
    for (let top = 0; top < height; top += Math.max(300, window.innerHeight * 0.75)) {
      // The app intentionally uses CSS scroll-smooth. Force instant motion here
      // so each sampled viewport actually reaches the content being revealed.
      window.scrollTo({ top, behavior: 'instant' });
      await new Promise((resolve) => window.setTimeout(resolve, 90));
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  });
  await page.waitForTimeout(650);
  const hidden = await page.locator('main [style*="opacity"]').evaluateAll((elements) => elements
    .filter((element) => element.getBoundingClientRect().height > 0 && Number(getComputedStyle(element).opacity) < 0.05)
    .map((element) => ({ tag: element.tagName, className: element.className })));
  assert.deepEqual(hidden, [], 'Scroll-revealed page sections should be visible before capture.');
}

async function screenshot(page, name, { source = 'real local backend', fullPage = true } = {}) {
  const file = path.join(screenshotDirectory, `${name}.png`);
  await page.screenshot({ path: file, fullPage, animations: 'disabled' });
  report.screenshots.push({ name, file, source });
}

async function assertDialogFocusTrap(page, dialog) {
  const focusable = dialog.locator('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]');
  const count = await focusable.count();
  assert(count > 1, 'Dialog must provide keyboard controls.');
  await focusable.last().focus();
  await page.keyboard.press('Tab');
  assert(await dialog.evaluate((element) => element.contains(document.activeElement)), 'Tab escaped the modal.');
  await focusable.first().focus();
  await page.keyboard.press('Shift+Tab');
  assert(await dialog.evaluate((element) => element.contains(document.activeElement)), 'Shift+Tab escaped the modal.');
}

async function withFixture(page, endpoint, response, run) {
  const pattern = `**/api/v1${endpoint}`;
  fixtureMode = true;
  report.fixtures.push({ endpoint, purpose: response.purpose, status: response.status || 200 });
  await page.route(pattern, async (route) => {
    if (response.delay) await new Promise((resolve) => setTimeout(resolve, response.delay));
    await route.fulfill({ status: response.status || 200, contentType: 'application/json', body: JSON.stringify(response.body) });
  });
  try {
    return await run();
  } finally {
    await page.unroute(pattern);
    fixtureMode = false;
  }
}

async function main() {
  await check('Real billing catalog matches server configuration', async () => {
    const result = await api('/billing/plans');
    assert.equal(result.status, 200);
    assert(Array.isArray(result.body));
    realPlans = result.body;
    const prices = Object.fromEntries(realPlans.map((plan) => [plan.tier, [plan.priceMonthly, plan.priceYearly]]));
    assert.deepEqual(prices, { FREE: [0, 0], PRO: [12, 120], BUSINESS: [49, 490], ENTERPRISE: [199, 1990] });
    return { currency: 'USD', monthlyAndYearlyTotals: prices };
  }, { required: true });

  await check('Real Razorpay availability and configured INR amounts', async () => {
    const result = await api('/billing/providers');
    assert.equal(result.status, 200);
    realProviders = result.body;
    assert.equal(realProviders.razorpay, true, 'This local handoff expects Razorpay Test Mode to remain enabled.');
    assert.equal(realProviders.razorpayPrices?.PRO_MONTHLY, 9900);
    assert.equal(realProviders.razorpayPrices?.PRO_YEARLY, undefined);
    return { providers: realProviders.providers, razorpayPrices: realProviders.razorpayPrices };
  }, { required: true });

  await check('Register a synthetic local account through the real API', async () => {
    const result = await api('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, name: 'UI Verification' }) });
    assert.equal(result.status, 201, `Registration failed with HTTP ${result.status}: ${result.body?.message || 'unknown error'}`);
    assert(result.body?.user?.id && result.body?.tokens?.accessToken);
    return { email, role: result.body.user.globalRole || result.body.user.role, plan: result.body.user.plan };
  }, { required: true });

  browser = await chromium.launch({
    executablePath: process.env.UI_TEST_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    args: ['--disable-gpu'],
  });

  const anonymous = await createContext({ theme: 'light' });
  const anonymousPage = await openPage(anonymous, '/pricing');
  await check('Anonymous Pricing loads real catalog and all four plans', async () => {
    await waitForPlans(anonymousPage);
    await assertUtilityStyles(anonymousPage);
    for (const tier of ['FREE', 'PRO', 'BUSINESS', 'ENTERPRISE']) {
      assert.equal(await anonymousPage.locator(`[data-testid="plan-${tier}"]`).count(), 1);
    }
    await chooseCycle(anonymousPage, 'yearly');
    const text = await anonymousPage.locator('[data-testid="plan-PRO"]').innerText();
    assert(/120/.test(text), 'Yearly Pro card must state the full $120 billed total.');
    assert(!/save\s*20\s*%/i.test(await anonymousPage.locator('main').innerText()), 'Unsupported 20% discount claim.');
  });
  await check('Anonymous Billing and Dashboard require sign-in', async () => {
    for (const route of ['/billing', '/dashboard']) {
      await anonymousPage.goto(route, { waitUntil: 'domcontentloaded' });
      await anonymousPage.waitForURL(/\/login\?redirect=/, { timeout: 15000 });
      assert.equal(new URL(anonymousPage.url()).searchParams.get('redirect'), route);
    }
  });
  await check('Password sign-in completes through the real UI and backend', async () => {
    await anonymousPage.goto('/login?redirect=/billing', { waitUntil: 'domcontentloaded' });
    // A visible server-rendered form is not proof that React has attached its
    // submit handler. The mounted theme control and store hydration are.
    await anonymousPage.getByRole('button', { name: /^Switch to (light|dark) theme$/ }).first().waitFor({ state: 'visible', timeout: 30000 });
    await anonymousPage.waitForFunction(() => {
      const persisted = JSON.parse(localStorage.getItem('doxera_auth_storage') || '{}');
      return persisted.state?.isHydrated === true;
    });
    await anonymousPage.locator('input[type="email"]').fill(email);
    await anonymousPage.locator('input[type="password"]').fill(password);
    const loginResponse = anonymousPage.waitForResponse(response => response.url().endsWith('/api/v1/auth/login') && response.request().method() === 'POST');
    await anonymousPage.locator('form button[type="submit"]').click();
    const resultOfLogin = await loginResponse;
    const loginPayload = await resultOfLogin.json().catch(() => ({}));
    assert.equal(resultOfLogin.status(), 200, `Password sign-in returned HTTP ${resultOfLogin.status()}: ${loginPayload.message || 'No server error message'}`);
    await anonymousPage.waitForURL(/\/billing(?:\?|$)/, { timeout: 30000 });
    const persisted = await anonymousPage.evaluate(() => ({ token: localStorage.getItem('doxera_token'), state: JSON.parse(localStorage.getItem('doxera_auth_storage') || '{}') }));
    assert(persisted.token);
    const result = await api('/auth/me', {}, persisted.token);
    assert.equal(result.status, 200);
    assert.equal(result.body.email, email);
    authentication = { token: persisted.token, user: { ...persisted.state.state.user, ...result.body, role: result.body.globalRole || result.body.role || 'USER' } };
    return { email: result.body.email, plan: result.body.plan };
  }, { required: true });
  await check('Real new-account billing has no fabricated payments or subscription', async () => {
    const result = await api('/billing/history', {}, authentication.token);
    assert.equal(result.status, 200);
    realHistory = result.body;
    assert.equal(realHistory.subscription, null);
    assert.deepEqual(realHistory.payments, []);
    assert.deepEqual(realHistory.invoices, []);
    await anonymousPage.getByText(/no (payments|payment history|transactions)/i).first().waitFor({ state: 'visible', timeout: 15000 });
    assert.equal(await anonymousPage.getByRole('button', { name: /download.*invoice/i }).count(), 0, 'No invoice download should be offered without a paid invoice.');
    return { payments: 0, invoices: 0, subscription: null };
  });
  await check('A normal user cannot access administrative APIs or controls', async () => {
    const result = await api('/admin/telemetry', {}, authentication.token);
    assert.equal(result.status, 403);
    fixtureMode = true; // The browser's expected 403 is an access-control check.
    try {
      await anonymousPage.goto('/admin', { waitUntil: 'domcontentloaded' });
      await anonymousPage.getByText(/administrative access required|admin access required|access denied|administrator access/i).first().waitFor({ state: 'visible', timeout: 15000 });
      assert.equal(await anonymousPage.getByRole('button', { name: /suspend|change role/i }).count(), 0);
    } finally { fixtureMode = false; }
  });

  for (const width of [1440, 768, 390]) {
    for (const theme of ['light', 'dark']) {
      const context = await createContext({ authenticated: true, width, theme });
      const page = await openPage(context, '/pricing');
      await check(`Pricing ${width}px ${theme}: responsive layout and theme`, async () => {
        await waitForPlans(page);
        await assertUtilityStyles(page);
        await chooseCycle(page, 'yearly');
        await revealPage(page);
        const dimensions = await assertNoOverflow(page);
        assert.equal(await page.evaluate(() => document.documentElement.classList.contains('dark')), theme === 'dark');
        assert.equal(await page.locator('main h1').count(), 1);
        await assertNamedControls(page);
        await screenshot(page, `pricing-${width}-${theme}`);
        if (width === 390) await screenshot(page, `pricing-${width}-${theme}-viewport`, { fullPage: false });
        return dimensions;
      });
      await check(`Billing ${width}px ${theme}: responsive layout and real empty state`, async () => {
        await page.goto('/billing', { waitUntil: 'domcontentloaded' });
        await waitForPlans(page);
        await assertUtilityStyles(page);
        await revealPage(page);
        const dimensions = await assertNoOverflow(page);
        assert.equal(await page.evaluate(() => document.documentElement.classList.contains('dark')), theme === 'dark');
        assert.equal(await page.locator('main h1').count(), 1);
        await assertNamedControls(page);
        await screenshot(page, `billing-${width}-${theme}`);
        if (width === 390) await screenshot(page, `billing-${width}-${theme}-viewport`, { fullPage: false });
        return dimensions;
      });
      await context.close();
    }
  }

  const interactionContext = await createContext({ authenticated: true, width: 390, height: 700, theme: 'dark' });
  const interactionPage = await openPage(interactionContext, '/pricing');
  await waitForPlans(interactionPage);
  await check('Mobile checkout has the actual INR amount, focus trap and Escape dismissal', async () => {
    await chooseCycle(interactionPage, 'monthly');
    const dialog = await openProCheckout(interactionPage);
    assert(/99/.test(await dialog.innerText()), 'Actual Razorpay INR 99 price must be visible.');
    await assertDialogFocusTrap(interactionPage, dialog);
    await assertNoOverflow(interactionPage);
    const dimensions = await dialog.evaluate((element) => ({ viewport: window.innerHeight, top: element.getBoundingClientRect().top, bottom: element.getBoundingClientRect().bottom, scrollHeight: element.scrollHeight, clientHeight: element.clientHeight }));
    assert(dimensions.top >= -1 && dimensions.bottom <= dimensions.viewport + 1, `Modal outside viewport: ${JSON.stringify(dimensions)}`);
    await screenshot(interactionPage, 'checkout-390-dark', { fullPage: false });
    await interactionPage.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    assert.notEqual(await interactionPage.evaluate(() => document.body.style.overflow), 'hidden');
    assert(await interactionPage.locator('[data-testid="plan-PRO"]').evaluate((element) => element.contains(document.activeElement)), 'Closing checkout should restore focus to its trigger.');
    return dimensions;
  });
  await check('Unconfigured yearly Razorpay checkout is visibly unavailable', async () => {
    await chooseCycle(interactionPage, 'yearly');
    const dialog = await openProCheckout(interactionPage);
    const text = await dialog.innerText();
    assert(/not (available|configured)|unavailable/i.test(text));
    const disabled = await dialog.getByRole('button').evaluateAll((buttons) => buttons.some((button) => button.disabled && /pay|continue|checkout/i.test(button.innerText)));
    assert(disabled, 'Unavailable checkout must have a disabled submission control.');
    await interactionPage.keyboard.press('Escape');
  });
  await check('Failed checkout remains an error and never activates a plan', async () => {
    fixtureMode = true;
    try {
      await chooseCycle(interactionPage, 'monthly');
      const dialog = await openProCheckout(interactionPage);
      const submit = dialog.getByRole('button', { name: /pay|continue|checkout/i }).last();
      await submit.click();
      await dialog.getByText(/Checkout failure fixture: no order was created\./).waitFor({ state: 'visible', timeout: 10000 });
      const profile = await api('/auth/me', {}, authentication.token);
      assert.equal(profile.body.plan, 'FREE');
      const billing = await api('/billing/history', {}, authentication.token);
      assert.equal(billing.body.subscription, null);
      assert.deepEqual(billing.body.payments, []);
      await screenshot(interactionPage, 'checkout-failure-fixture-390-dark', { source: 'injected HTTP 503 checkout failure; real account remains FREE', fullPage: false });
      await interactionPage.keyboard.press('Escape');
    } finally { fixtureMode = false; }
  }, { source: 'injected HTTP 503 checkout failure + real backend state read' });

  await check('Billing loading and request-failure states are explicit', async () => {
    await withFixture(interactionPage, '/billing/history', {
      status: 503,
      delay: 2200,
      body: { message: 'Billing history failure fixture.' },
      purpose: 'Delayed failure verifies loading and error states; no payment records changed.',
    }, async () => {
      await interactionPage.goto('/billing', { waitUntil: 'domcontentloaded' });
      const loading = interactionPage.locator('[aria-busy="true"], [role="status"], .skeleton').first();
      await loading.waitFor({ state: 'visible', timeout: 1500 });
      await interactionPage.getByText(/Billing history failure fixture\./).first().waitFor({ state: 'visible', timeout: 10000 });
      await screenshot(interactionPage, 'billing-failure-fixture-390-dark', { source: 'delayed injected HTTP 503 history failure' });
    });
  }, { source: 'delayed injected HTTP 503 history failure' });

  await check('Pricing catalog failure offers recovery', async () => {
    await withFixture(interactionPage, '/billing/plans', {
      status: 503,
      body: { message: 'Plan catalog failure fixture.' },
      purpose: 'Unavailable catalog must be an error, not invented fallback prices.',
    }, async () => {
      await interactionPage.goto('/pricing', { waitUntil: 'domcontentloaded' });
      await interactionPage.getByText(/Plan catalog failure fixture\./).first().waitFor({ state: 'visible', timeout: 10000 });
      await interactionPage.getByRole('button', { name: /retry|try again/i }).first().waitFor({ state: 'visible' });
      assert.equal(await interactionPage.locator('[data-testid="plan-PRO"]').count(), 0);
      await screenshot(interactionPage, 'pricing-failure-fixture-390-dark', { source: 'injected HTTP 503 plan catalog failure' });
    });
  }, { source: 'injected HTTP 503 plan catalog failure' });

  await check('History rendering retains failed and pending statuses and currency', async () => {
    const timestamp = new Date().toISOString();
    await withFixture(interactionPage, '/billing/history', {
      body: {
        ...realHistory,
        payments: [
          { id: 'rendering-fixture-row-a', provider: 'RAZORPAY', amount: 99, currency: 'INR', status: 'FAILED', createdAt: timestamp },
          { id: 'rendering-fixture-row-b', provider: 'STRIPE', amount: 12, currency: 'USD', status: 'PENDING', createdAt: timestamp },
        ],
      },
      purpose: 'Rendering-only failed/pending database rows. No order IDs, payment IDs, signatures, completed payments, or paid activation.',
    }, async () => {
      await interactionPage.goto('/billing', { waitUntil: 'domcontentloaded' });
      await interactionPage.getByText(/^Failed$/i).first().waitFor({ state: 'visible', timeout: 10000 });
      await interactionPage.getByText(/^Pending$/i).first().waitFor({ state: 'visible' });
      const mainText = await interactionPage.locator('main').innerText();
      assert(/INR|₹/.test(mainText));
      assert(/USD|\$/.test(mainText));
      await assertNoOverflow(interactionPage);
      await screenshot(interactionPage, 'billing-status-fixtures-390-dark', { source: 'rendering-only FAILED INR and PENDING USD history fixtures' });
    });
  }, { source: 'rendering-only failed/pending history fixtures; no completed payment' });

  await check('Prepaid cancellation confirmation and failure preserve the real account', async () => {
    const start = new Date(Date.now() - 86400000).toISOString();
    const end = new Date(Date.now() + 29 * 86400000).toISOString();
    // This is a read-only UI snapshot, not an activated subscription. The real
    // account is checked below and remains FREE with no payments/subscription.
    const subscriptionSnapshot = {
      id: 'rendering-fixture-subscription-snapshot', plan: 'PRO', provider: 'razorpay', interval: 'monthly',
      status: 'ACTIVE', currentPeriodStart: start, currentPeriodEnd: end, cancelAtPeriodEnd: false,
    };
    await withFixture(interactionPage, '/billing/history', {
      body: { ...realHistory, currentPlan: 'PRO', subscription: subscriptionSnapshot, subscriptions: [subscriptionSnapshot] },
      purpose: 'Read-only prepaid-period rendering snapshot for cancellation controls. No payment identifiers, successful requests, or paid activation.',
    }, async () => {
      await interactionPage.goto('/billing', { waitUntil: 'domcontentloaded' });
      const moveToFree = interactionPage.getByRole('button', { name: /^Move to Free$/i });
      await moveToFree.waitFor({ state: 'visible', timeout: 10000 });
      await moveToFree.click();
      let dialog = interactionPage.getByRole('dialog', { name: 'Move to the Free plan?' });
      await dialog.waitFor({ state: 'visible' });
      assert(/paid access continues through/i.test(await dialog.innerText()));
      await assertDialogFocusTrap(interactionPage, dialog);
      await screenshot(interactionPage, 'cancellation-confirmation-snapshot-390-dark', { source: 'read-only prepaid subscription rendering snapshot; no paid activation', fullPage: false });
      await dialog.getByRole('button', { name: 'Keep my plan' }).click();
      await dialog.waitFor({ state: 'hidden' });
      await moveToFree.click();
      dialog = interactionPage.getByRole('dialog', { name: 'Move to the Free plan?' });
      await withFixture(interactionPage, '/billing/subscription/cancel', {
        status: 503,
        body: { message: 'Cancellation failure fixture: no plan was changed.' },
        purpose: 'Cancellation request fails; no successful mutation is simulated.',
      }, async () => {
        await dialog.getByRole('button', { name: 'Confirm move to Free' }).click();
        await dialog.getByText('Cancellation failure fixture: no plan was changed.').waitFor({ state: 'visible', timeout: 10000 });
        await interactionPage.keyboard.press('Escape');
        await dialog.waitFor({ state: 'hidden' });
      });
      const actual = await api('/billing/history', {}, authentication.token);
      assert.equal(actual.body.currentPlan, 'FREE');
      assert.equal(actual.body.subscription, null);
      assert.deepEqual(actual.body.payments, []);
    });
  }, { source: 'read-only prepaid-period rendering snapshot + injected cancellation HTTP 503 + real backend state read' });

  await check('Reduced-motion content stays visible and the theme toggle persists', async () => {
    const context = await createContext({ authenticated: true, width: 768, theme: 'dark', reducedMotion: 'reduce' });
    const page = await openPage(context, '/pricing');
    await waitForPlans(page);
    await revealPage(page);
    const invisiblePlans = await page.locator('[data-testid^="plan-"]').evaluateAll((elements) => elements.filter((element) => Number(getComputedStyle(element).opacity) < 0.95).length);
    assert.equal(invisiblePlans, 0);
    await page.getByRole('button', { name: 'Switch to light theme' }).first().click();
    assert.equal(await page.evaluate(() => localStorage.getItem('doxera_theme')), 'light');
    await page.reload({ waitUntil: 'domcontentloaded' });
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains('dark')), false);
    await screenshot(page, 'pricing-reduced-motion-768-light');
    await context.close();
  });

  await check('No unexpected application errors occurred', async () => {
    assert.equal(report.applicationErrors.length, 0, `${report.applicationErrors.length} unexpected browser errors; first: ${report.applicationErrors[0]?.message.slice(0, 220)}`);
    return { knownGoogleHeadlessErrors: report.knownGoogleHeadlessErrors.length, expectedFixtureErrors: report.expectedFixtureErrors.length };
  }, { source: 'Playwright browser console and pageerror listeners' });
  assert.equal(report.checkoutSafety.blockedVerificationRequests, 0, 'No payment credentials should ever be submitted by this harness.');
}

main().catch((error) => {
  report.fatalError = errorText(error);
  process.stderr.write(`${errorText(error)}\n`);
  process.exitCode = 1;
}).finally(async () => {
  for (const context of contexts) await context.close().catch(() => {});
  if (browser) await browser.close().catch(() => {});
  report.finishedAt = new Date().toISOString();
  report.totals = { passed: report.checks.filter((item) => item.status === 'passed').length, failed: report.checks.filter((item) => item.status === 'failed').length };
  fs.writeFileSync(path.join(outputDirectory, 'browser-report.json'), JSON.stringify(report, null, 2));
  if (report.totals.failed || report.fatalError) process.exitCode = 1;
  process.stdout.write(`Report: ${path.join(outputDirectory, 'browser-report.json')}\n${report.totals.passed} passed; ${report.totals.failed} failed.\n`);
});
