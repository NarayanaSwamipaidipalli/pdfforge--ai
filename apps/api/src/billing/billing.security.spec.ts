import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { BadRequestException, UnauthorizedException, ServiceUnavailableException } from '@nestjs/common';
import { BillingProvider, SubscriptionTier } from './dto/billing.dto';
import * as crypto from 'crypto';
import axios from 'axios';
import Stripe from 'stripe';

jest.mock('axios');
const http = axios as jest.Mocked<typeof axios>;

describe('Billing security', () => {
  let service: BillingService;
  let prisma: any;
  let values: Record<string, string>;
  let order: any;
  const seconds = () => Math.floor(Date.now() / 1000);
  const sign = (body: string | Buffer, secret: string) => crypto.createHmac('sha256', secret).update(body).digest('hex');
  const event = (type = 'payment.captured', overrides: any = {}) => ({ event: type, created_at: seconds(),
    payload: { payment: { entity: { id: 'pay_security', order_id: 'order_security', status: 'captured', captured: true,
      amount: 100000, currency: 'INR', notes: { userId: 'attacker', tier: 'ENTERPRISE', interval: 'yearly' }, ...overrides } } } });

  beforeEach(() => {
    jest.resetAllMocks();
    values = { ENABLE_RAZORPAY: 'true', RAZORPAY_KEY_ID: 'rzp_test_security_fixture',
      RAZORPAY_KEY_SECRET: 'synthetic-key-secret-for-unit-tests', RAZORPAY_WEBHOOK_SECRET: 'synthetic-webhook-secret-for-unit-tests',
      RAZORPAY_PRICE_PRO_MONTHLY: '100000', FRONTEND_URL: 'https://web.example.invalid' };
    order = { id: 'local-order', userId: 'user_1', provider: 'razorpay', providerOrderId: 'order_security',
      plan: 'PRO', interval: 'monthly', amountMinor: 100000, currency: 'INR', status: 'CREATED', couponCode: null };
    prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'user_1', email: 'user@example.invalid', isBanned: false }), update: jest.fn() },
      billingOrder: { findUnique: jest.fn().mockImplementation(async () => ({ ...order })),
        create: jest.fn().mockImplementation(async ({ data }) => ({ id: 'local-order', ...data })),
        update: jest.fn().mockImplementation(async ({ data }) => Object.assign(order, data)) },
      subscription: { findFirst: jest.fn().mockResolvedValue(null), findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([
        { plan: 'PRO', status: 'ACTIVE', currentPeriodStart: new Date(0), currentPeriodEnd: new Date(Date.now() + 86400000) }]),
        create: jest.fn().mockResolvedValue({ id: 'sub_local' }), update: jest.fn() },
      payment: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() }, invoice: { create: jest.fn(), findFirst: jest.fn() },
      coupon: { findUnique: jest.fn(), updateMany: jest.fn(), count: jest.fn() },
      webhookEvent: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
      $transaction: jest.fn(async action => action(prisma)),
    };
    service = new BillingService(prisma, { get: (key: string, fallback?: any) => values[key] ?? fallback } as any);
  });

  it('disables providers with missing or placeholder credentials and never seeds from the constructor', () => {
    expect(service.getEnabledProviders().providers).toEqual(['razorpay']);
    delete values.RAZORPAY_WEBHOOK_SECRET;
    expect(service.isRazorpayEnabled()).toBe(false);
    values.RAZORPAY_WEBHOOK_SECRET = 'mock_secret';
    expect(service.isRazorpayEnabled()).toBe(false);
    expect(prisma.coupon.count).not.toHaveBeenCalled();
  });

  it.each([undefined, '', 'mock_sig', 'a'.repeat(63), 'g'.repeat(64), '0'.repeat(64)])('rejects invalid Razorpay webhook signature %p', signature => {
    expect(() => service.verifyRazorpayWebhook(Buffer.from('{}'), signature)).toThrow(UnauthorizedException);
  });

  it('verifies exact raw bytes even with a test-mode key and refuses missing secrets', () => {
    const body = Buffer.from('{ "event": "payment.captured" }');
    const digest = sign(body, values.RAZORPAY_WEBHOOK_SECRET);
    expect(() => service.verifyRazorpayWebhook(body, digest)).not.toThrow();
    expect(() => service.verifyRazorpayWebhook(Buffer.from('{"event":"payment.captured"}'), digest)).toThrow(UnauthorizedException);
    expect(() => service.verifyRazorpayWebhook(undefined, digest)).toThrow(UnauthorizedException);
    delete values.RAZORPAY_WEBHOOK_SECRET;
    expect(() => service.verifyRazorpayWebhook(body, digest)).toThrow(UnauthorizedException);
  });

  it('fails Stripe closed without secrets and validates SDK signatures for test-mode secrets', () => {
    const body = Buffer.from('{"id":"evt_security","type":"test","data":{"object":{}}}');
    expect(() => service.verifyStripeWebhook(body, 'anything')).toThrow(UnauthorizedException);
    values.ENABLE_STRIPE = 'true'; values.STRIPE_SECRET_KEY = 'sk_test_synthetic_security'; values.STRIPE_WEBHOOK_SECRET = 'whsec_test_synthetic_security';
    service = new BillingService(prisma, { get: (key: string, fallback?: any) => values[key] ?? fallback } as any);
    const stripe = new Stripe(values.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
    const header = stripe.webhooks.generateTestHeaderString({ payload: body.toString(), secret: values.STRIPE_WEBHOOK_SECRET });
    expect(service.verifyStripeWebhook(body, header).id).toBe('evt_security');
    expect(() => service.verifyStripeWebhook(Buffer.from('{}'), header)).toThrow(UnauthorizedException);
  });

  it('forwards the provider event header only after verifying raw bytes', async () => {
    const controller = new BillingController(service);
    const body = Buffer.from(JSON.stringify(event()));
    const handler = jest.spyOn(service, 'handleRazorpayWebhook').mockResolvedValue({ received: true });
    await controller.handleRazorpayWebhook({ rawBody: body } as any, sign(body, values.RAZORPAY_WEBHOOK_SECRET), 'evt_provider');
    expect(handler).toHaveBeenCalledWith(JSON.parse(body.toString()), 'evt_provider');
  });

  it('creates a real Razorpay order and saves trusted explicit INR purchase terms', async () => {
    http.request.mockResolvedValue({ data: { id: 'order_security', amount: 100000, currency: 'INR' } });
    expect(await service.createCheckoutSession('user_1', { provider: BillingProvider.RAZORPAY, tier: SubscriptionTier.PRO })).toMatchObject({
      provider: 'razorpay', orderId: 'order_security', amount: 100000, currency: 'INR' });
    expect(http.request).toHaveBeenCalledWith(expect.objectContaining({ method: 'post', url: 'https://api.razorpay.com/v1/orders',
      data: { amount: 100000, currency: 'INR', receipt: 'local-order', notes: { billingOrderId: 'local-order' } } }));
    expect(prisma.billingOrder.create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: 'user_1', plan: 'PRO', amountMinor: 100000, interval: 'monthly' }) });
  });

  it('rejects missing INR prices/plans, invalid intervals and organization spoofing', async () => {
    delete values.RAZORPAY_PRICE_PRO_MONTHLY;
    await expect(service.createCheckoutSession('user_1', { provider: BillingProvider.RAZORPAY, tier: SubscriptionTier.PRO })).rejects.toThrow(ServiceUnavailableException);
    await expect(service.createCheckoutSession('user_1', {})).rejects.toThrow(BadRequestException);
    await expect(service.createCheckoutSession('user_1', { tier: SubscriptionTier.PRO, interval: 'forever' as any })).rejects.toThrow(BadRequestException);
    await expect(service.createCheckoutSession('user_1', { tier: SubscriptionTier.PRO, orgId: 'another-org' })).rejects.toThrow(BadRequestException);
    expect(http.request).not.toHaveBeenCalled();
  });

  it('uses stored terms despite forged callback claims and never stores order IDs as subscription IDs', async () => {
    http.request.mockResolvedValue({ data: event().payload.payment.entity });
    expect(await service.verifyRazorpayPayment('user_1', { orderId: 'order_security', paymentId: 'pay_security',
      signature: sign('order_security|pay_security', values.RAZORPAY_KEY_SECRET), tier: SubscriptionTier.ENTERPRISE, interval: 'yearly' }))
      .toMatchObject({ success: true, plan: 'PRO', interval: 'monthly' });
    expect(prisma.subscription.create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: 'user_1', plan: 'PRO', interval: 'monthly' }) });
    expect(prisma.subscription.create.mock.calls[0][0].data.razorpaySubscriptionId).toBeUndefined();
    expect(prisma.payment.create).toHaveBeenCalledWith({ data: expect.objectContaining({ providerPaymentId: 'razorpay:pay_security', amount: 1000, currency: 'INR' }) });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ isolationLevel: 'Serializable' }));
  });

  it('rejects another user before fetching or changing a payment', async () => {
    await expect(service.verifyRazorpayPayment('attacker', { orderId: 'order_security', paymentId: 'pay_security', signature: '0'.repeat(64) })).rejects.toThrow(UnauthorizedException);
    expect(http.request).not.toHaveBeenCalled(); expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('rejects uncaptured payments and valid-signature amount mismatches before any entitlement update', async () => {
    const dto = { orderId: 'order_security', paymentId: 'pay_security', signature: sign('order_security|pay_security', values.RAZORPAY_KEY_SECRET) };
    http.request.mockResolvedValueOnce({ data: event('payment.captured', { status: 'authorized', captured: false }).payload.payment.entity });
    await expect(service.verifyRazorpayPayment('user_1', dto)).rejects.toThrow(BadRequestException);
    http.request.mockResolvedValueOnce({ data: event('payment.captured', { amount: 1 }).payload.payment.entity });
    await expect(service.verifyRazorpayPayment('user_1', dto)).rejects.toThrow(BadRequestException);
    expect(prisma.payment.create).not.toHaveBeenCalled(); expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('deduplicates payment.captured and order.paid independently of event IDs', async () => {
    await service.handleRazorpayWebhook(event(), 'evt_payment'); await service.handleRazorpayWebhook(event('order.paid'), 'evt_order');
    expect(prisma.webhookEvent.create).toHaveBeenCalledTimes(2); expect(prisma.payment.create).toHaveBeenCalledTimes(1);
    expect(prisma.invoice.create).toHaveBeenCalledTimes(1); expect(prisma.subscription.create).toHaveBeenCalledTimes(1);
    expect(prisma.user.update).toHaveBeenCalledTimes(1);
    expect(prisma.webhookEvent.create.mock.calls[0][0].data).toMatchObject({ eventId: 'razorpay:evt_payment' });
  });

  it('rejects missing provider event IDs rather than manufacturing timestamps', async () => {
    await expect(service.handleRazorpayWebhook(event())).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('makes already processed provider events a no-op', async () => {
    prisma.webhookEvent.findFirst.mockResolvedValue({ eventId: 'razorpay:evt_existing' });
    expect(await service.handleRazorpayWebhook(event(), 'evt_existing')).toEqual({ received: true, duplicate: true });
    expect(prisma.billingOrder.findUnique).not.toHaveBeenCalled(); expect(prisma.invoice.create).not.toHaveBeenCalled();
  });

  it('retries an entire rolled-back serializable transaction after a race', async () => {
    prisma.$transaction.mockRejectedValueOnce({ code: 'P2034' }).mockImplementation(async action => action(prisma));
    await service.handleRazorpayWebhook(event(), 'evt_race');
    expect(prisma.$transaction).toHaveBeenCalledTimes(2); expect(prisma.payment.create).toHaveBeenCalledTimes(1);
  });

  it('ignores stale lifecycle events and preserves other active entitlements on cancellation', async () => {
    prisma.subscription.findFirst.mockResolvedValue({ id: 'sub_actual', userId: 'user_1', currentPeriodEnd: new Date(Date.now() + 100000), lastProviderEventAt: new Date() });
    const payload = { event: 'subscription.cancelled', created_at: seconds() - 60, payload: { subscription: { entity: { id: 'sub_real_provider' } } } };
    await service.handleRazorpayWebhook(payload, 'evt_stale'); expect(prisma.subscription.update).not.toHaveBeenCalled();
    payload.created_at = seconds() + 1; prisma.subscription.findMany.mockResolvedValue([
      { plan: 'BUSINESS', status: 'ACTIVE', currentPeriodStart: new Date(0), currentPeriodEnd: new Date(Date.now() + 86400000) }]);
    await service.handleRazorpayWebhook(payload, 'evt_cancel');
    expect(prisma.subscription.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'CANCELED' }) }));
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'user_1' }, data: { plan: 'BUSINESS' } });
  });

  it('never grants PayPal entitlements from order approval or an unconfigured capture', async () => {
    await service.handlePayPalWebhook({ id: 'paypal_evt', event_type: 'CHECKOUT.ORDER.APPROVED', create_time: new Date().toISOString(), resource: { id: 'forged', custom_id: 'user_1' } });
    expect(prisma.payment.create).not.toHaveBeenCalled();
    await expect(service.capturePayPalOrder('user_1', { orderId: 'order_security', tier: SubscriptionTier.ENTERPRISE })).rejects.toThrow(ServiceUnavailableException);
    await expect(service.verifyPayPalWebhook(Buffer.from('{}'), {})).rejects.toThrow(UnauthorizedException);
  });

  it('binds Stripe fulfillment to its stored order and deduplicates the initial paid invoice', async () => {
    order = { ...order, provider: 'stripe', providerOrderId: 'cs_security', amountMinor: 1200, currency: 'USD' };
    const remote = { id: 'sub_stripe_security', status: 'active', current_period_start: seconds() - 60, current_period_end: seconds() + 86400 };
    (service as any).stripe = { subscriptions: { retrieve: jest.fn().mockResolvedValue(remote) } };
    const checkout: any = { id: 'evt_checkout', type: 'checkout.session.completed', created: seconds(), data: { object: {
      id: 'cs_security', mode: 'subscription', payment_status: 'paid', invoice: 'in_security', subscription: remote.id,
      amount_total: 1200, currency: 'usd', metadata: { tier: 'ENTERPRISE', userId: 'attacker' },
    } } };
    await service.handleStripeWebhook(checkout);
    expect(prisma.subscription.create).toHaveBeenCalledWith({ data: expect.objectContaining({ plan: 'PRO', stripeSubscriptionId: remote.id,
      currentPeriodEnd: new Date(remote.current_period_end * 1000) }) });
    prisma.subscription.findUnique.mockResolvedValue({ id: 'sub_local', userId: 'user_1', currentPeriodEnd: new Date(remote.current_period_end * 1000) });
    prisma.payment.findFirst.mockResolvedValue({ providerPaymentId: 'stripe:in_security' });
    await service.handleStripeWebhook({ id: 'evt_invoice', type: 'invoice.payment_succeeded', created: seconds(),
      data: { object: { id: 'in_security', subscription: remote.id, amount_paid: 1200, currency: 'usd' } } } as any);
    expect(prisma.invoice.create).toHaveBeenCalledTimes(1); expect(prisma.payment.create).toHaveBeenCalledTimes(1);
  });

  it('uses completed PayPal capture data and stored terms instead of callback claims', async () => {
    Object.assign(values, { ENABLE_PAYPAL: 'true', PAYPAL_CLIENT_ID: 'synthetic-client', PAYPAL_CLIENT_SECRET: 'synthetic-paypal-secret', PAYPAL_WEBHOOK_ID: 'synthetic-webhook' });
    order = { ...order, provider: 'paypal', providerOrderId: 'PAYPAL_SECURITY', amountMinor: 1200, currency: 'USD' };
    http.post.mockResolvedValue({ data: { access_token: 'synthetic-access-token' } });
    http.request.mockResolvedValue({ data: { id: 'PAYPAL_SECURITY', status: 'COMPLETED', purchase_units: [{ payments: {
      captures: [{ id: 'CAPTURE_SECURITY', status: 'COMPLETED', amount: { value: '12.00', currency_code: 'USD' } }],
    } }] } });
    expect(await service.capturePayPalOrder('user_1', { orderId: 'PAYPAL_SECURITY', tier: SubscriptionTier.ENTERPRISE, interval: 'yearly' }))
      .toMatchObject({ success: true, plan: 'PRO', interval: 'monthly' });
    expect(prisma.payment.create).toHaveBeenCalledWith({ data: expect.objectContaining({ providerPaymentId: 'paypal:CAPTURE_SECURITY', amount: 12, currency: 'USD' }) });
  });

  it('verifies PayPal through its fixed API endpoint and rejects verification failure', async () => {
    Object.assign(values, { ENABLE_PAYPAL: 'true', PAYPAL_CLIENT_ID: 'synthetic-client', PAYPAL_CLIENT_SECRET: 'synthetic-paypal-secret', PAYPAL_WEBHOOK_ID: 'synthetic-webhook' });
    http.post.mockResolvedValue({ data: { access_token: 'synthetic-access-token' } });
    http.request.mockResolvedValueOnce({ data: { verification_status: 'SUCCESS' } }).mockResolvedValueOnce({ data: { verification_status: 'FAILURE' } });
    const headers = { 'paypal-transmission-id': 'synthetic-id', 'paypal-transmission-time': new Date().toISOString(),
      'paypal-transmission-sig': 'synthetic-signature', 'paypal-cert-url': 'http://internal.invalid/cert', 'paypal-auth-algo': 'SHA256withRSA' };
    await service.verifyPayPalWebhook(Buffer.from('{}'), headers);
    expect(http.request).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://api-m.sandbox.paypal.com/v1/notifications/verify-webhook-signature', maxRedirects: 0 }));
    expect(http.get).not.toHaveBeenCalled();
    await expect(service.verifyPayPalWebhook(Buffer.from('{}'), headers)).rejects.toThrow(UnauthorizedException);
  });

  it('never creates a paid invoice on download', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user_1', name: 'Customer', email: 'user@example.invalid', plan: 'PRO', memberships: [] });
    prisma.invoice.findFirst.mockResolvedValue(null);
    await expect(service.generateInvoicePdf('user_1')).rejects.toThrow('No paid invoice'); expect(prisma.invoice.create).not.toHaveBeenCalled();
  });

  it('uses calendar periods including month-end and leap-year boundaries', () => {
    expect((service as any).calendarEnd(new Date('2024-01-31T10:00:00Z'), 'monthly').toISOString()).toBe('2024-02-29T10:00:00.000Z');
    expect((service as any).calendarEnd(new Date('2024-02-29T10:00:00Z'), 'yearly').toISOString()).toBe('2025-02-28T10:00:00.000Z');
  });
});
