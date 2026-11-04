// Run inside the newly built API image against an isolated synthetic PostgreSQL database.
// Provider HTTPS boundaries are simulated; HMAC, Nest HTTP, Prisma, constraints and transactions are real.
const { createRequire } = require('node:module');
const requireApp = createRequire('/app/package.json');
requireApp('reflect-metadata');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { PrismaClient } = requireApp('@prisma/client');
const { ConfigService } = requireApp('@nestjs/config');
const { JwtService } = requireApp('@nestjs/jwt');
const { Module } = requireApp('@nestjs/common');
const { NestFactory } = requireApp('@nestjs/core');
const axios = requireApp('axios').default;
const { BillingService } = require('/app/dist/billing/billing.service.js');
const { BillingController } = require('/app/dist/billing/billing.controller.js');
const { effectivePlan, reserveAiUsage } = require('/app/dist/common/effective-plan.js');
const { FilesService } = require('/app/dist/files/files.service.js');
const { PdfJobsService } = require('/app/dist/pdf-jobs/pdf-jobs.service.js');
const { PrismaService } = require('/app/dist/prisma/prisma.service.js');

const url = new URL(process.env.DATABASE_URL);
if (!/^pdfforge-security-\d+-[a-f0-9]{8}-postgres$/.test(url.hostname) ||
    url.hostname !== process.env.EXPECTED_DB_HOST || !/^security_billing_[a-f0-9]{8}$/.test(url.pathname.slice(1)) ||
    url.pathname.slice(1) !== process.env.EXPECTED_DB_NAME) throw new Error('Unsafe database target refused');
const base = new PrismaClient({ log: [] });
let failInvoice = false;
const prisma = base.$extends({ query: { invoice: { async create({ args, query }) {
  if (failInvoice) throw new Error('Synthetic invoice failure to verify rollback');
  return query(args);
} } } });
const config = new ConfigService({ ...process.env });
const billing = new BillingService(prisma, config);
const orders = new Map();
const payments = new Map();
let providerCalls = 0;
axios.request = async request => {
  providerCalls++;
  if (request.url === 'https://api.razorpay.com/v1/orders' && request.method === 'post') {
    const id = `order_${crypto.randomBytes(8).toString('hex')}`;
    const remote = { id, ...request.data };
    orders.set(id, remote);
    return { data: remote };
  }
  const id = request.url.split('/').pop();
  if (request.url.startsWith('https://api.razorpay.com/v1/payments/') && payments.has(id)) return { data: payments.get(id) };
  throw new Error('Unexpected provider boundary call');
};
// Invoice download can use the local receipt fallback without any worker/network call.
axios.post = async () => { throw new Error('Provider boundary not configured in this test'); };

let app;
let origin;
let passed = 0;
function pass(label) { passed++; console.log(`PASS: ${label}`); }
const seconds = () => Math.floor(Date.now() / 1000);
const capturedEventTime = seconds();
const hmac = (body, secret) => crypto.createHmac('sha256', secret).update(body).digest('hex');
async function webhook(payload, id, signature, path = 'razorpay') {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return fetch(`${origin}/api/v1/billing/webhook/${path}`, { method: 'POST', headers: {
    'content-type': 'application/json', ...(id ? { 'x-razorpay-event-id': id } : {}),
    'x-razorpay-signature': signature ?? hmac(body, process.env.RAZORPAY_WEBHOOK_SECRET),
  }, body });
}
function payload(payment, event = 'payment.captured', at = capturedEventTime) {
  return { event, created_at: at, payload: { payment: { entity: payment } } };
}
function payment(orderId, overrides = {}) {
  const remote = { id: `pay_${crypto.randomBytes(8).toString('hex')}`, order_id: orderId,
    amount: 100000, currency: 'INR', status: 'captured', captured: true,
    notes: { tier: 'ENTERPRISE', interval: 'yearly', userId: 'attacker' }, ...overrides };
  payments.set(remote.id, remote); return remote;
}
async function counts(userId) {
  return { subscriptions: await base.subscription.count({ where: { userId } }), payments: await base.payment.count({ where: { userId } }),
    invoices: await base.invoice.count({ where: { userId } }), events: await base.webhookEvent.count() };
}
async function callback(userId, remote, extra = {}) {
  return billing.verifyRazorpayPayment(userId, { orderId: remote.order_id, paymentId: remote.id,
    signature: hmac(`${remote.order_id}|${remote.id}`, process.env.RAZORPAY_KEY_SECRET), ...extra });
}

(async () => {
  await base.$connect();
  class BillingTestModule {}
  Module({ controllers: [BillingController], providers: [
    { provide: BillingService, useValue: billing }, { provide: ConfigService, useValue: config },
    { provide: JwtService, useValue: new JwtService() },
    { provide: PrismaService, useValue: prisma },
  ] })(BillingTestModule);
  app = await NestFactory.create(BillingTestModule, { rawBody: true, logger: false });
  await app.listen(0, '127.0.0.1');
  origin = await app.getUrl();
  const user = await base.user.create({ data: { email: `billing-${crypto.randomUUID()}@example.invalid`, passwordHash: 'synthetic-hash' } });
  const attacker = await base.user.create({ data: { email: `attacker-${crypto.randomUUID()}@example.invalid` } });
  const checkout = await billing.createCheckoutSession(user.id, { tier: 'PRO', provider: 'razorpay', interval: 'monthly' });
  const trusted = await base.billingOrder.findUnique({ where: { provider_providerOrderId: { provider: 'razorpay', providerOrderId: checkout.orderId } } });
  assert.equal(trusted.userId, user.id); assert.equal(trusted.amountMinor, 100000); assert.equal(trusted.currency, 'INR');
  assert.equal(providerCalls, 1); pass('real checkout code persists trusted provider order terms');
  const captured = payment(checkout.orderId);
  const before = await counts(user.id);
  assert.equal((await webhook(payload(captured), 'evt_invalid', '0'.repeat(64))).status, 401);
  const original = JSON.stringify(payload(captured));
  assert.equal((await webhook(original + ' ', 'evt_tampered', hmac(original, process.env.RAZORPAY_WEBHOOK_SECRET))).status, 401);
  assert.equal((await webhook(payload(captured), undefined)).status, 400);
  assert.equal((await webhook('{', 'evt_invalid_json')).status, 400);
  assert.equal((await webhook(payload(captured), 'evt_stripe', undefined, 'stripe')).status, 401);
  assert.equal((await webhook(payload(captured), 'evt_paypal', undefined, 'paypal')).status, 401);
  assert.deepEqual(await counts(user.id), before); pass('HTTP rejects unsigned/tampered/missing-ID/unconfigured-provider requests without writes');

  await assert.rejects(() => callback(attacker.id, captured), error => error.getStatus() === 401);
  const authorized = payment(checkout.orderId, { status: 'authorized', captured: false });
  await assert.rejects(() => callback(user.id, authorized), error => error.getStatus() === 400);
  assert.equal((await webhook(payload(payment(checkout.orderId, { amount: 1 })), 'evt_underpaid')).status, 400);
  assert.equal((await webhook(payload(payment(checkout.orderId, { currency: 'USD' })), 'evt_currency')).status, 400);
  assert.equal((await webhook(payload(payment('order_untrusted')), 'evt_orphan')).status, 404);
  assert.deepEqual(await counts(user.id), before); pass('ownership, capture, amount, currency and orphan-order checks leave no events or entitlements');
  assert.equal((await webhook({ event: 'subscription.charged', created_at: seconds(), payload: {} }, 'evt_unreconciled')).status, 503);
  assert.deepEqual(await counts(user.id), before); pass('unreconciled legacy recurring payment fails retryably without consuming its event');

  failInvoice = true;
  assert.equal((await webhook(payload(captured), 'evt_rollback')).status, 500);
  assert.deepEqual(await counts(user.id), before);
  assert.equal((await base.billingOrder.findUnique({ where: { id: trusted.id } })).status, 'CREATED');
  failInvoice = false;
  assert.equal((await webhook(payload(captured), 'evt_rollback')).status, 200);
  assert.equal(await base.webhookEvent.count({ where: { eventId: 'razorpay:evt_rollback' } }), 1);
  pass('invoice failure rolls back event, subscription, payment and order; authentic retry succeeds');

  const [sub] = await base.subscription.findMany({ where: { userId: user.id } });
  const periodEnd = sub.currentPeriodEnd.getTime();
  const responses = await Promise.all([
    webhook(payload(captured), 'evt_rollback'), webhook(payload(captured), 'evt_rollback'),
    webhook(payload(captured, 'order.paid'), 'evt_order_paid'), webhook(payload(captured, 'order.paid'), 'evt_order_paid'),
    callback(user.id, captured, { tier: 'ENTERPRISE', plan: 'ENTERPRISE', interval: 'yearly' }),
  ]);
  for (const result of responses.slice(0, 4)) assert.equal(result.status, 200);
  assert.equal(responses[4].plan, 'PRO');
  assert.equal(await base.subscription.count({ where: { userId: user.id } }), 1);
  assert.equal(await base.payment.count({ where: { userId: user.id } }), 1);
  assert.equal(await base.invoice.count({ where: { userId: user.id } }), 1);
  assert.equal((await base.subscription.findUnique({ where: { id: sub.id } })).currentPeriodEnd.getTime(), periodEnd);
  assert.equal(sub.razorpaySubscriptionId, null);
  const paid = await base.payment.findFirst({ where: { userId: user.id } });
  assert.equal(paid.currency, 'INR'); assert.equal(paid.amount, 1000);
  assert.equal((await base.user.findUnique({ where: { id: user.id } })).plan, 'PRO');
  pass('concurrent HTTP replay, dual provider events and forged client plan produce one payment/invoice/period');

  // A new unpaid order tests concurrent first delivery, including independent event IDs for one payment.
  const secondUser = await base.user.create({ data: { email: `concurrent-${crypto.randomUUID()}@example.invalid` } });
  const secondCheckout = await billing.createCheckoutSession(secondUser.id, { tier: 'PRO', provider: 'razorpay' });
  const secondPayment = payment(secondCheckout.orderId);
  const racing = await Promise.all([
    webhook(payload(secondPayment), 'evt_race_one'), webhook(payload(secondPayment), 'evt_race_one'),
    webhook(payload(secondPayment, 'order.paid'), 'evt_race_two'), callback(secondUser.id, secondPayment),
  ]);
  racing.slice(0, 3).forEach(response => assert.equal(response.status, 200));
  assert.equal(await base.subscription.count({ where: { userId: secondUser.id } }), 1);
  assert.equal(await base.payment.count({ where: { userId: secondUser.id } }), 1);
  assert.equal(await base.invoice.count({ where: { userId: secondUser.id } }), 1);
  pass('concurrent initial provider delivery and client verification serialize on real PostgreSQL');

  const lifecycleUser = await base.user.create({ data: { email: `lifecycle-${crypto.randomUUID()}@example.invalid`, plan: 'BUSINESS' } });
  const end = new Date(Date.now() + 86400000 * 30);
  await base.subscription.create({ data: { userId: lifecycleUser.id, plan: 'BUSINESS', status: 'ACTIVE', provider: 'stripe',
    currentPeriodStart: new Date(), currentPeriodEnd: end } });
  const recurring = await base.subscription.create({ data: { userId: lifecycleUser.id, plan: 'PRO', status: 'ACTIVE', provider: 'razorpay',
    razorpaySubscriptionId: 'sub_fixture_actual', currentPeriodStart: new Date(), currentPeriodEnd: end } });
  const at = seconds();
  const lifecycle = { event: 'subscription.cancelled', created_at: at,
    payload: { subscription: { entity: { id: 'sub_fixture_actual' } } } };
  assert.equal((await webhook(lifecycle, 'evt_cancel')).status, 200);
  assert.equal((await base.subscription.findUnique({ where: { id: recurring.id } })).status, 'CANCELED');
  assert.equal((await base.user.findUnique({ where: { id: lifecycleUser.id } })).plan, 'BUSINESS');
  lifecycle.event = 'subscription.resumed'; lifecycle.created_at = at - 1;
  assert.equal((await webhook(lifecycle, 'evt_stale_resume')).status, 200);
  assert.equal((await base.subscription.findUnique({ where: { id: recurring.id } })).status, 'CANCELED');
  pass('provider cancellation and out-of-order events preserve remaining subscriptions and terminal state');

  const unpaidInvoices = await base.invoice.count({ where: { userId: attacker.id } });
  await assert.rejects(() => billing.generateInvoicePdf(attacker.id), error => error.getStatus() === 404);
  assert.equal(await base.invoice.count({ where: { userId: attacker.id } }), unpaidInvoices);
  pass('invoice download cannot fabricate paid records');

  const expired = await base.user.create({ data: { email: `expired-${crypto.randomUUID()}@example.invalid`, plan: 'ENTERPRISE' } });
  await base.subscription.create({ data: { userId: expired.id, plan: 'ENTERPRISE', status: 'ACTIVE', provider: 'razorpay',
    currentPeriodStart: new Date('2020-01-01Z'), currentPeriodEnd: new Date('2020-02-01Z') } });
  const manual = await base.user.create({ data: { email: `manual-${crypto.randomUUID()}@example.invalid`, plan: 'BUSINESS' } });
  assert.equal(await effectivePlan(base, expired), 'FREE'); assert.equal(await effectivePlan(base, manual), 'BUSINESS');
  const fileService = new FilesService(base, config);
  await assert.rejects(() => fileService.generatePresignedUpload({ fileName: 'large.pdf', fileSizeBytes: 26 * 1024 * 1024,
    mimeType: 'application/pdf', checksumSha256: 'synthetic' }, expired.id), error => error.getStatus() === 400);
  pass('expired cached paid plans lose upload entitlements while no-history manual grants persist');

  const quotaFile = await base.fileRecord.create({ data: { userId: expired.id, originalName: 'quota.pdf',
    storedKey: `synthetic/${crypto.randomUUID()}.pdf`, fileSizeBytes: 100, checksumSha256: 'synthetic', expiresAt: new Date(Date.now() + 86400000) } });
  for (let index = 0; index < 3; index++) await reserveAiUsage(base, expired.id, quotaFile.id);
  const aiRaces = await Promise.allSettled(Array.from({ length: 4 }, () => reserveAiUsage(base, expired.id, quotaFile.id)));
  assert.equal(aiRaces.filter(result => result.status === 'fulfilled').length, 2);
  aiRaces.filter(result => result.status === 'rejected').forEach(result => assert.equal(result.reason.getStatus?.(), 400));
  assert.equal(await base.aiJob.count({ where: { userId: expired.id } }), 5);
  pass('real concurrent monthly AI reservations cannot exceed the expired-account free quota');

  await base.processingJob.createMany({ data: Array.from({ length: 9 }, () => ({ userId: expired.id, tool: 'compress', inputFilesPayload: [], parametersPayload: {} })) });
  const jobService = new PdfJobsService(base, fileService, config);
  jobService.dispatchToWorker = async () => {}; // Quota-only integration; worker has its own real image suite.
  const pdfRaces = await Promise.allSettled(Array.from({ length: 3 }, () => jobService.createJob({ tool: 'compress', fileIds: [quotaFile.id] }, expired.id)));
  assert.equal(pdfRaces.filter(result => result.status === 'fulfilled').length, 1);
  pdfRaces.filter(result => result.status === 'rejected').forEach(result => assert.equal(result.reason.getStatus?.(), 400));
  assert.equal(await base.processingJob.count({ where: { userId: expired.id } }), 10);
  pass('real concurrent PDF job creation reserves daily quota in the same transaction');
  console.log(JSON.stringify({ suite: 'real-postgresql-billing-http', passed, providerBoundary: 'simulated', isolated: true }));
})().catch(error => {
  // Never emit provider configs, HTTP headers, Prisma argument objects, or URLs.
  console.error(`FAIL: billing integration (${error.name || 'Error'}): ${String(error.message).split('\n')[0]}`);
  process.exitCode = 1;
}).finally(async () => { if (app) await app.close(); await base.$disconnect(); });
