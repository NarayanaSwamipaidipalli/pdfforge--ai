import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateCheckoutSessionDto,
  BillingProvider,
  SubscriptionTier,
  VerifyPaymentDto,
  CreatePayPalOrderDto,
  CapturePayPalOrderDto,
  ApplyCouponDto,
  CreateCouponDto,
} from './dto/billing.dto';
import { Prisma, PlanTier } from '@prisma/client';
import Stripe from 'stripe';
import axios from 'axios';
import * as crypto from 'crypto';
import { effectivePlan } from '../common/effective-plan';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private stripe: Stripe | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const stripeKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (this.configured(stripeKey)) {
      this.stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' });
    }
  }

  // ============================================================================
  // 1. PROVIDER CAPABILITY & CONFIGURATION
  // ============================================================================

  isStripeEnabled(): boolean {
    return this.configService.get<string>('ENABLE_STRIPE') === 'true' && !!this.stripe &&
      this.configured(this.configService.get<string>('STRIPE_WEBHOOK_SECRET'));
  }

  isRazorpayEnabled(): boolean {
    return this.configService.get<string>('ENABLE_RAZORPAY') === 'true' &&
      ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET'].every(
        (key) => this.configured(this.configService.get<string>(key)),
      );
  }

  isPayPalEnabled(): boolean {
    return this.configService.get<string>('ENABLE_PAYPAL') === 'true' &&
      ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_WEBHOOK_ID'].every(
        (key) => this.configured(this.configService.get<string>(key)),
      );
  }

  getEnabledProviders() {
    const stripe = this.isStripeEnabled();
    const razorpay = this.isRazorpayEnabled();
    const paypal = this.isPayPalEnabled();
    return {
      stripe,
      razorpay,
      paypal,
      providers: [
        ...(stripe ? ['stripe'] : []),
        ...(razorpay ? ['razorpay'] : []),
        ...(paypal ? ['paypal'] : []),
      ],
    };
  }

  // ============================================================================
  // 2. WEBHOOK SIGNATURE VERIFICATION
  // ============================================================================

  verifyStripeWebhook(rawBody?: Buffer, signature?: string): Stripe.Event {
    const secret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!this.isStripeEnabled() || !Buffer.isBuffer(rawBody) || !rawBody.length || !signature || !secret) {
      throw new UnauthorizedException('Invalid Stripe webhook request or unconfigured secret');
    }
    try {
      return this.stripe.webhooks.constructEvent(rawBody, signature, secret);
    } catch (err) {
      throw new UnauthorizedException('Invalid Stripe webhook signature');
    }
  }

  verifyRazorpayWebhook(rawBody?: Buffer, signature?: string): void {
    const secret = this.configService.get<string>('RAZORPAY_WEBHOOK_SECRET');
    if (!this.isRazorpayEnabled() || !Buffer.isBuffer(rawBody) || !rawBody.length || !secret) {
      throw new UnauthorizedException('Invalid Razorpay webhook request or unconfigured secret');
    }
    this.verifyHmac(rawBody, signature, secret);
  }

  async verifyPayPalWebhook(rawBody?: Buffer, headers: Record<string, string> = {}): Promise<void> {
    const webhookId = this.configService.get<string>('PAYPAL_WEBHOOK_ID');
    if (!this.isPayPalEnabled() || !webhookId || !Buffer.isBuffer(rawBody) || !rawBody.length) {
      throw new UnauthorizedException('Invalid PayPal webhook request');
    }
    const transmissionId = headers['paypal-transmission-id'];
    const transmissionTime = headers['paypal-transmission-time'];
    const transmissionSig = headers['paypal-transmission-sig'];
    const certUrl = headers['paypal-cert-url'];
    if (!transmissionId || !transmissionTime || !transmissionSig || !certUrl) {
      throw new UnauthorizedException('Missing required PayPal signature headers');
    }
    // Send to PayPal's fixed API endpoint. Never fetch caller-controlled certificate URLs.
    let event: unknown;
    try { event = JSON.parse(rawBody.toString('utf8')); }
    catch { throw new UnauthorizedException('Invalid PayPal webhook payload'); }
    const response = await this.paypalRequest('post', '/v1/notifications/verify-webhook-signature', {
      transmission_id: transmissionId, transmission_time: transmissionTime,
      transmission_sig: transmissionSig, cert_url: certUrl,
      auth_algo: headers['paypal-auth-algo'], webhook_id: webhookId, webhook_event: event,
    });
    if (response.verification_status !== 'SUCCESS') throw new UnauthorizedException('Invalid PayPal webhook signature');
  }

  // ============================================================================
  // 3. CATALOG, PRICING & COUPONS
  // ============================================================================

  getPlansCatalog() {
    return [
      {
        id: 'free',
        tier: 'FREE',
        name: 'Starter Community',
        priceMonthly: 0,
        priceYearly: 0,
        description: 'Ideal for occasional document processing, evaluation, and personal usage.',
        features: [
          '10 daily PDF conversions',
          'Max 25 MB per file upload',
          'Standard PyMuPDF compression',
          'Basic tools (Merge, Split, Rotate)',
          'Community forum support',
        ],
        limits: {
          maxFileSizeMb: 25,
          dailyConversions: 10,
          batchLimit: 3,
          ocrEnabled: false,
          aiQueries: 5,
        },
      },
      {
        id: 'pro',
        tier: 'PRO',
        name: 'Professional',
        priceMonthly: 12,
        priceYearly: 120, // 17% savings
        popular: true,
        description: 'For power users, legal practitioners, analysts, and independent creators.',
        features: [
          'Unlimited daily PDF conversions',
          'Max 250 MB per file upload',
          'Full OCR & Multi-language Tesseract engine',
          'Priority High-Speed processing queue',
          'AI Document Intelligence & RAG (500 queries/mo)',
          'Zero advertisements or brand watermarks',
        ],
        limits: {
          maxFileSizeMb: 250,
          dailyConversions: -1, // Unlimited
          batchLimit: 50,
          ocrEnabled: true,
          aiQueries: 500,
        },
      },
      {
        id: 'business',
        tier: 'BUSINESS',
        name: 'Team & Business',
        priceMonthly: 49,
        priceYearly: 490, // 17% savings
        description: 'For growing organizations needing shared workspaces, RBAC, and dedicated APIs.',
        features: [
          'Everything in Pro plus:',
          'Up to 15 Team Workspaces with RBAC',
          'Max 500 MB per file upload',
          'Dedicated REST & GraphQL API Access (100k req/mo)',
          'Custom brand watermarks & automated Bates numbering',
          'DoD 5220.22-M zero data retention compliance',
          '24/7 Priority SLA support',
        ],
        limits: {
          maxFileSizeMb: 500,
          dailyConversions: -1,
          batchLimit: 200,
          ocrEnabled: true,
          aiQueries: 2500,
        },
      },
      {
        id: 'enterprise',
        tier: 'ENTERPRISE',
        name: 'Enterprise Cloud',
        priceMonthly: 199,
        priceYearly: 1990, // 17% savings
        description: 'Dedicated infrastructure, custom SLAs, private on-premise RAG, and audit vaults.',
        features: [
          'Unlimited Team Seats & File Sizes (up to 2GB)',
          'Dedicated Celery Worker Pod Cluster',
          'Custom LLM & Private Air-Gapped RAG models',
          'Single Sign-On (SAML / Okta / Azure AD)',
          'Signed BAA for HIPAA / SOC2 Type II compliance',
          'Dedicated Enterprise Solutions Architect',
        ],
        limits: {
          maxFileSizeMb: 2048,
          dailyConversions: -1,
          batchLimit: 1000,
          ocrEnabled: true,
          aiQueries: -1,
        },
      },
    ];
  }

  getTierBaseAmount(tier: SubscriptionTier, interval: 'monthly' | 'yearly' = 'monthly'): number {
    if (interval === 'yearly') {
      if (tier === SubscriptionTier.PRO) return 120;
      if (tier === SubscriptionTier.BUSINESS) return 490;
      if (tier === SubscriptionTier.ENTERPRISE) return 1990;
      return 0;
    }
    if (tier === SubscriptionTier.PRO) return 12;
    if (tier === SubscriptionTier.BUSINESS) return 49;
    if (tier === SubscriptionTier.ENTERPRISE) return 199;
    return 0;
  }

  async applyCoupon(dto: ApplyCouponDto) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { code: dto.code.trim().toUpperCase() },
    });

    if (!coupon || !coupon.isActive) {
      throw new BadRequestException('Invalid or inactive coupon code');
    }

    if (coupon.validUntil && coupon.validUntil < new Date()) {
      throw new BadRequestException('This coupon code has expired');
    }

    if (coupon.usedCount >= coupon.maxUses) {
      throw new BadRequestException('This coupon code has reached its maximum usage limit');
    }

    const interval = dto.interval || 'monthly';
    const baseAmount = this.getTierBaseAmount(dto.tier, interval);
    let discount = 0;

    if (coupon.discountPercent) {
      discount = (baseAmount * coupon.discountPercent) / 100;
    } else if (coupon.discountAmount) {
      discount = Math.min(baseAmount, coupon.discountAmount);
    }

    const finalAmount = Math.max(0, +(baseAmount - discount).toFixed(2));

    return {
      valid: true,
      code: coupon.code,
      discountPercent: coupon.discountPercent,
      discountAmount: coupon.discountAmount,
      originalAmount: baseAmount,
      finalAmount,
      currency: coupon.currency,
      interval,
      message: `Coupon ${coupon.code} applied successfully!`,
    };
  }

  // ============================================================================
  // 4. CHECKOUT SESSION CREATION
  // ============================================================================

  private configured(value?: string): boolean {
    return typeof value === 'string' && value.trim().length > 0 &&
      !/^(mock|changeme|placeholder|replace|example|your[_-])/i.test(value.trim());
  }

  private verifyHmac(body: Buffer | string, signature: string | undefined, secret: string): void {
    if (typeof signature !== 'string' || !/^[a-fA-F0-9]{64}$/.test(signature)) {
      throw new UnauthorizedException('Invalid payment signature');
    }
    const expected = crypto.createHmac('sha256', secret).update(body).digest();
    if (!crypto.timingSafeEqual(expected, Buffer.from(signature, 'hex'))) {
      throw new UnauthorizedException('Invalid payment signature');
    }
  }

  private identifier(value: unknown, label: string): string {
    if (typeof value !== 'string' || !/^[a-zA-Z0-9_.:-]{1,200}$/.test(value)) {
      throw new BadRequestException(`Missing or invalid ${label}`);
    }
    return value;
  }

  private timestamp(value: unknown, allowFuture = false): Date {
    if (!Number.isSafeInteger(value) || (value as number) <= 0) {
      throw new BadRequestException('Missing provider event timestamp');
    }
    const result = new Date((value as number) * 1000);
    if (!Number.isFinite(result.getTime()) || (!allowFuture && result.getTime() > Date.now() + 300000)) {
      throw new BadRequestException('Invalid provider event timestamp');
    }
    return result;
  }

  private calendarEnd(start: Date, interval: string): Date {
    const result = new Date(start);
    const day = result.getUTCDate();
    result.setUTCDate(1);
    result.setUTCMonth(result.getUTCMonth() + (interval === 'yearly' ? 12 : 1));
    const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
    result.setUTCDate(Math.min(day, lastDay));
    return result;
  }

  private stripeState(status: string): 'ACTIVE' | 'PAST_DUE' | 'CANCELED' {
    if (['active', 'trialing'].includes(status)) return 'ACTIVE';
    if (['canceled', 'incomplete_expired'].includes(status)) return 'CANCELED';
    if (['past_due', 'unpaid', 'paused', 'incomplete'].includes(status)) return 'PAST_DUE';
    throw new BadRequestException('Invalid provider subscription status');
  }

  private async atomic<T>(action: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        return await this.prisma.$transaction(action, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 10000, timeout: 15000,
        });
      } catch (error) {
        // Retry the whole transaction after a conflicting event/payment wins. Side effects roll back.
        if (!['P2034', 'P2002'].includes((error as any)?.code) || attempt === 3) throw error;
      }
    }
    throw new ConflictException('Concurrent billing update; retry the request');
  }

  private async razorpayRequest(method: 'get' | 'post', path: string, data?: unknown): Promise<any> {
    if (!this.isRazorpayEnabled()) throw new ServiceUnavailableException('Razorpay is not configured');
    try {
      const response = await axios.request({
        method, url: `https://api.razorpay.com/v1${path}`, data,
        auth: {
          username: this.configService.get<string>('RAZORPAY_KEY_ID'),
          password: this.configService.get<string>('RAZORPAY_KEY_SECRET'),
        },
        timeout: 10000, maxRedirects: 0,
      });
      return response.data;
    } catch {
      throw new ServiceUnavailableException('Razorpay request failed');
    }
  }

  private async paypalRequest(method: 'get' | 'post', path: string, data?: unknown, requestId?: string): Promise<any> {
    if (!this.isPayPalEnabled()) throw new ServiceUnavailableException('PayPal is not configured');
    const mode = this.configService.get<string>('PAYPAL_MODE', 'sandbox');
    if (!['live', 'sandbox'].includes(mode)) throw new ServiceUnavailableException('Invalid PayPal environment');
    const origin = mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
    try {
      const token = await axios.post(`${origin}/v1/oauth2/token`, 'grant_type=client_credentials', {
        auth: {
          username: this.configService.get<string>('PAYPAL_CLIENT_ID'),
          password: this.configService.get<string>('PAYPAL_CLIENT_SECRET'),
        },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10000, maxRedirects: 0,
      });
      if (!token.data?.access_token) throw new Error('Missing access token');
      const response = await axios.request({
        method, url: `${origin}${path}`, data,
        headers: {
          Authorization: `Bearer ${token.data.access_token}`, 'Content-Type': 'application/json',
          ...(requestId ? { 'PayPal-Request-Id': requestId } : {}),
        },
        timeout: 10000, maxRedirects: 0,
      });
      return response.data;
    } catch {
      throw new ServiceUnavailableException('PayPal request failed');
    }
  }

  async createCheckoutSession(userId: string, dto: CreateCheckoutSessionDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.isBanned) throw new NotFoundException('User not found');
    const tier = dto.tier || dto.plan;
    const interval = dto.interval || dto.billingInterval || 'monthly';
    const provider = dto.provider || BillingProvider.STRIPE;
    if (!tier || !Object.values(SubscriptionTier).includes(tier) || !['monthly', 'yearly'].includes(interval)) {
      throw new BadRequestException('An explicit valid plan and billing interval are required');
    }
    if (dto.orgId) throw new BadRequestException('Organization checkout requires a separately authorized billing flow');
    if (tier === SubscriptionTier.FREE) return this.handleDowngradeToFree(userId);
    if (!(provider === 'stripe' ? this.isStripeEnabled() : provider === 'razorpay' ? this.isRazorpayEnabled() : provider === 'paypal' && this.isPayPalEnabled())) {
      throw new ServiceUnavailableException('Payment provider is not configured');
    }
    const existing = await this.prisma.subscription.findFirst({
      where: { userId, status: 'ACTIVE', plan: tier, interval, currentPeriodEnd: { gt: new Date() }, cancelAtPeriodEnd: false },
    });
    if (existing) throw new ConflictException('This plan and interval are already active');

    let amountMinor: number;
    let currency = 'USD';
    let couponCode: string | undefined;
    if (provider === 'razorpay') {
      // Explicit paise prices; never convert USD using an approximate exchange rate.
      const price = this.configService.get<string>(`RAZORPAY_PRICE_${tier}_${interval.toUpperCase()}`);
      if (!price || !/^\d+$/.test(price) || !Number.isSafeInteger(Number(price)) || Number(price) <= 0 || Number(price) > 2147483647) {
        throw new ServiceUnavailableException('Razorpay INR price is not configured for this plan');
      }
      amountMinor = Number(price);
      currency = 'INR';
      if (dto.couponCode) throw new BadRequestException('USD coupons cannot be applied to INR orders');
    } else {
      let amount = this.getTierBaseAmount(tier, interval);
      if (dto.couponCode) {
        const coupon = await this.applyCoupon({ code: dto.couponCode, tier, interval });
        if (coupon.currency !== 'USD') throw new BadRequestException('Coupon currency does not match checkout');
        amount = coupon.finalAmount;
        couponCode = coupon.code;
      }
      amountMinor = Math.round(amount * 100);
      if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) throw new BadRequestException('A positive purchase amount is required');
    }
    const order = await this.prisma.billingOrder.create({
      data: { userId, provider, plan: tier, interval, amountMinor, currency, couponCode },
    });
    const origin = this.configService.get<string>('FRONTEND_URL');
    if (!origin || !/^https?:\/\//.test(origin)) throw new ServiceUnavailableException('Frontend URL is not configured');

    if (provider === 'razorpay') {
      const remote = await this.razorpayRequest('post', '/orders', {
        amount: amountMinor, currency, receipt: order.id,
        notes: { billingOrderId: order.id },
      });
      this.identifier(remote?.id, 'Razorpay order ID');
      if (remote.amount !== amountMinor || remote.currency !== currency) throw new BadRequestException('Provider order amount does not match');
      await this.prisma.billingOrder.update({ where: { id: order.id }, data: { providerOrderId: remote.id } });
      return { provider, orderId: remote.id, amount: amountMinor, currency,
        keyId: this.configService.get<string>('RAZORPAY_KEY_ID'), tier, interval,
        user: { name: user.name || 'Doxera Member', email: user.email } };
    }
    if (provider === 'paypal') {
      const remote = await this.paypalRequest('post', '/v2/checkout/orders', {
        intent: 'CAPTURE', purchase_units: [{ reference_id: order.id, custom_id: order.id,
          amount: { currency_code: currency, value: (amountMinor / 100).toFixed(2) } }],
        application_context: { return_url: `${origin}/billing?provider=paypal`, cancel_url: `${origin}/pricing?canceled=true` },
      }, order.id);
      this.identifier(remote?.id, 'PayPal order ID');
      const approvalUrl = remote.links?.find((link: any) => link.rel === 'approve')?.href;
      if (typeof approvalUrl !== 'string' || !/^https:\/\/(www\.)?(sandbox\.)?paypal\.com\//.test(approvalUrl)) {
        throw new BadRequestException('Missing provider approval URL');
      }
      await this.prisma.billingOrder.update({ where: { id: order.id }, data: { providerOrderId: remote.id } });
      return { provider, orderId: remote.id, amount: amountMinor / 100, currency, tier, interval, approvalUrl };
    }
    let session: Stripe.Checkout.Session;
    try {
      session = await this.stripe.checkout.sessions.create({
        mode: 'subscription', payment_method_types: ['card'], customer_email: user.email,
        line_items: [{ price_data: { currency: 'usd', product_data: { name: `Doxera ${tier}` },
          unit_amount: amountMinor, recurring: { interval: interval === 'yearly' ? 'year' : 'month' } }, quantity: 1 }],
        success_url: `${origin}/billing?session_id={CHECKOUT_SESSION_ID}`, cancel_url: `${origin}/pricing?canceled=true`,
        metadata: { billingOrderId: order.id }, subscription_data: { metadata: { billingOrderId: order.id } },
      }, { idempotencyKey: order.id });
    } catch { throw new ServiceUnavailableException('Stripe checkout request failed'); }
    await this.prisma.billingOrder.update({ where: { id: order.id }, data: { providerOrderId: session.id } });
    return { provider, sessionId: session.id, checkoutUrl: session.url, tier, interval };
  }

  private async handleDowngradeToFree(userId: string) {
    const active = await this.prisma.subscription.findFirst({ where: { userId, status: 'ACTIVE' } });
    if (active) return this.cancelSubscription(userId);
    await this.prisma.user.update({ where: { id: userId }, data: { plan: 'FREE' } });
    return { message: 'Account updated to Free tier.', plan: 'FREE' };
  }

  private async refreshEntitlement(tx: Prisma.TransactionClient, userId: string) {
    const plan = await effectivePlan(tx, { id: userId, plan: 'FREE' });
    await tx.user.update({ where: { id: userId }, data: { plan } });
  }

  private async findOrder(tx: Prisma.TransactionClient | PrismaService, provider: string, providerOrderId: string) {
    const order = await tx.billingOrder.findUnique({ where: { provider_providerOrderId: { provider, providerOrderId } } });
    if (!order) throw new NotFoundException('No trusted checkout order matches this payment');
    return order;
  }

  private async existingPayment(tx: Prisma.TransactionClient, provider: string, paymentId: string) {
    return tx.payment.findFirst({ where: { provider, providerPaymentId: { in: [paymentId, `${provider}:${paymentId}`] } } });
  }

  private async settleOrder(tx: Prisma.TransactionClient, provider: string, providerOrderId: string,
    paymentId: string, amountMinor: number, currency: string,
    options: { subscriptionId?: string; customerId?: string; start?: Date; end?: Date; eventAt?: Date; userId?: string;
      status?: 'ACTIVE' | 'PAST_DUE' | 'CANCELED' } = {}) {
    this.identifier(paymentId, 'payment ID');
    const order = await this.findOrder(tx, provider, providerOrderId);
    if (options.userId && order.userId !== options.userId) throw new UnauthorizedException('Payment order belongs to another user');
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0 || order.amountMinor !== amountMinor || order.currency !== currency) {
      throw new BadRequestException('Captured payment does not match trusted order amount and currency');
    }
    if (order.status === 'PAID') {
      if (order.providerPaymentId !== paymentId) throw new ConflictException('Order was paid by a different payment');
      return { success: true, duplicate: true, plan: order.plan, interval: order.interval };
    }
    if (order.status !== 'CREATED') throw new BadRequestException('Checkout order is not payable');
    if (await this.existingPayment(tx, provider, paymentId)) throw new ConflictException('Payment is already bound to another order');
    const user = await tx.user.findUnique({ where: { id: order.userId } });
    if (!user || user.isBanned) throw new UnauthorizedException('Account is unavailable');
    const remoteField = provider === 'stripe' ? 'stripeSubscriptionId' : provider === 'razorpay' ? 'razorpaySubscriptionId' : 'paypalSubscriptionId';
    const existing = await tx.subscription.findFirst({ where: {
      userId: order.userId, provider, plan: order.plan, interval: order.interval, status: 'ACTIVE',
      [remoteField]: options.subscriptionId || null,
    }, orderBy: { createdAt: 'desc' } });
    const now = new Date();
    const renewalBase = existing?.currentPeriodEnd > now ? existing.currentPeriodEnd : now;
    const start = options.start || (existing?.currentPeriodEnd > now ? existing.currentPeriodStart : now);
    const end = options.end || this.calendarEnd(renewalBase, order.interval);
    if (end <= start) throw new BadRequestException('Invalid subscription period');
    const data = { plan: order.plan, provider, interval: order.interval, status: options.status || 'ACTIVE' as const,
      currentPeriodStart: start, currentPeriodEnd: end, cancelAtPeriodEnd: false, canceledAt: options.status === 'CANCELED' ? now : null,
      lastProviderEventAt: options.eventAt || now,
      ...(options.subscriptionId ? { [remoteField]: options.subscriptionId } : {}),
      ...(options.customerId ? { stripeCustomerId: options.customerId } : {}) };
    const sub = existing ? await tx.subscription.update({ where: { id: existing.id }, data }) :
      await tx.subscription.create({ data: { ...data, userId: order.userId } });
    await this.recordPayment(tx, order.userId, sub.id, provider, paymentId, amountMinor, currency);
    await tx.billingOrder.update({ where: { id: order.id }, data: {
      status: 'PAID', providerPaymentId: paymentId, subscriptionId: sub.id, paidAt: now,
    } });
    if (order.couponCode) await tx.coupon.updateMany({ where: { code: order.couponCode }, data: { usedCount: { increment: 1 } } });
    await this.refreshEntitlement(tx, order.userId);
    return { success: true, plan: order.plan, interval: order.interval, currentPeriodEnd: end };
  }

  private async recordPayment(tx: Prisma.TransactionClient, userId: string, subscriptionId: string,
    provider: string, paymentId: string, amountMinor: number, currency: string) {
    await tx.payment.create({ data: { userId, subscriptionId, provider,
      providerPaymentId: `${provider}:${paymentId}`, amount: amountMinor / 100, currency, status: 'COMPLETED' } });
    const invoiceNumber = `INV-${crypto.createHash('sha256').update(`${provider}:${paymentId}`).digest('hex').slice(0, 32)}`;
    await tx.invoice.create({ data: { userId, invoiceNumber, amount: amountMinor / 100, currency, status: 'PAID' } });
  }

  async verifyRazorpayPayment(userId: string, dto: VerifyPaymentDto) {
    if (!this.isRazorpayEnabled()) throw new ServiceUnavailableException('Razorpay is not configured');
    this.identifier(dto.orderId, 'order ID'); this.identifier(dto.paymentId, 'payment ID');
    const order = await this.findOrder(this.prisma, 'razorpay', dto.orderId);
    if (order.userId !== userId) throw new UnauthorizedException('Payment order belongs to another user');
    this.verifyHmac(`${order.providerOrderId}|${dto.paymentId}`, dto.signature, this.configService.get<string>('RAZORPAY_KEY_SECRET'));
    const payment = await this.razorpayRequest('get', `/payments/${encodeURIComponent(dto.paymentId)}`);
    if (payment.id !== dto.paymentId || payment.order_id !== order.providerOrderId || payment.status !== 'captured' || payment.captured !== true) {
      throw new BadRequestException('Payment has not been captured for this order');
    }
    return this.atomic((tx) => this.settleOrder(tx, 'razorpay', order.providerOrderId, payment.id, payment.amount, payment.currency, { userId }));
  }

  private decimalMinor(value: unknown): number {
    if (typeof value !== 'string' || !/^\d+\.\d{2}$/.test(value)) throw new BadRequestException('Invalid provider amount');
    const minor = Number(value.replace('.', ''));
    if (!Number.isSafeInteger(minor) || minor <= 0) throw new BadRequestException('Invalid provider amount');
    return minor;
  }

  async capturePayPalOrder(userId: string, dto: CapturePayPalOrderDto) {
    this.identifier(dto.orderId, 'PayPal order ID');
    const order = await this.findOrder(this.prisma, 'paypal', dto.orderId);
    if (order.userId !== userId) throw new UnauthorizedException('Payment order belongs to another user');
    let remote = await this.paypalRequest('get', `/v2/checkout/orders/${encodeURIComponent(dto.orderId)}`);
    if (remote.status !== 'COMPLETED') remote = await this.paypalRequest('post', `/v2/checkout/orders/${encodeURIComponent(dto.orderId)}/capture`, {}, order.id);
    const capture = remote.purchase_units?.[0]?.payments?.captures?.[0];
    if (remote.id !== dto.orderId || remote.status !== 'COMPLETED' || remote.purchase_units?.length !== 1 ||
      remote.purchase_units[0]?.payments?.captures?.length !== 1 || capture?.status !== 'COMPLETED') {
      throw new BadRequestException('PayPal capture is not complete');
    }
    return this.atomic((tx) => this.settleOrder(tx, 'paypal', dto.orderId, capture.id,
      this.decimalMinor(capture.amount?.value), capture.amount?.currency_code, { userId }));
  }

  private async processEvent(provider: string, eventId: string, type: string, payload: unknown,
    apply: (tx: Prisma.TransactionClient) => Promise<void>) {
    this.identifier(eventId, 'provider event ID');
    this.identifier(type, 'provider event type');
    const key = `${provider}:${eventId}`;
    return this.atomic(async (tx) => {
      // Recognize old rows too, while namespacing all new provider event identifiers.
      const existing = await tx.webhookEvent.findFirst({ where: { provider, eventId: { in: [eventId, key] } } });
      const digest = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
      if (existing) {
        const prior = existing.payload as { sha256?: string } | null;
        if (existing.eventType !== type || prior?.sha256 && prior.sha256 !== digest) {
          throw new ConflictException('Webhook event identifier was reused with different content');
        }
        if (existing.status !== 'PROCESSED') throw new ServiceUnavailableException('Prior webhook processing requires reconciliation');
        return { received: true, duplicate: true };
      }
      await tx.webhookEvent.create({ data: { eventId: key, provider, eventType: type,
        payload: { sha256: digest }, status: 'PROCESSED' } });
      await apply(tx);
      return { received: true };
    });
  }

  private async lifecycle(tx: Prisma.TransactionClient, provider: string, remoteId: string,
    status: 'ACTIVE' | 'PAST_DUE' | 'CANCELED', at: Date, period?: { start: Date; end: Date }) {
    const field = provider === 'stripe' ? 'stripeSubscriptionId' : provider === 'razorpay' ? 'razorpaySubscriptionId' : 'paypalSubscriptionId';
    this.identifier(remoteId, 'provider subscription ID');
    const sub = await tx.subscription.findFirst({ where: { provider, [field]: remoteId } });
    if (!sub) throw new NotFoundException('No matching provider subscription');
    if (sub.status === 'CANCELED' && status !== 'CANCELED') return;
    if (sub.lastProviderEventAt && (at < sub.lastProviderEventAt || (at.getTime() === sub.lastProviderEventAt.getTime() && sub.status === 'CANCELED'))) return;
    // Provider timestamps have second precision. An ambiguous replay cannot restore access.
    if (sub.lastProviderEventAt?.getTime() === at.getTime() && sub.status === 'PAST_DUE' && status === 'ACTIVE') return;
    if (status === 'ACTIVE' && !period && sub.currentPeriodEnd <= new Date()) return;
    await tx.subscription.update({ where: { id: sub.id }, data: {
      status, lastProviderEventAt: at,
      ...(status === 'CANCELED' ? { canceledAt: at } : {}),
      ...(period ? { currentPeriodStart: period.start, currentPeriodEnd: period.end } : {}),
    } });
    if (sub.userId) await this.refreshEntitlement(tx, sub.userId);
  }

  async handleRazorpayWebhook(payload: any, eventId?: string) {
    const at = this.timestamp(payload?.created_at);
    return this.processEvent('razorpay', eventId, payload?.event, payload, async (tx) => {
      if (['payment.captured', 'order.paid'].includes(payload.event)) {
        const payment = payload.payload?.payment?.entity;
        if (payment?.status !== 'captured' || payment?.captured !== true) throw new BadRequestException('Webhook payment is not captured');
        this.identifier(payment.order_id, 'Razorpay order ID');
        await this.settleOrder(tx, 'razorpay', payment.order_id, payment.id, payment.amount, payment.currency, { eventAt: at });
      } else if (payload.event === 'subscription.charged') {
        // Legacy recurring contracts have no trusted stored amount/plan binding. Do not consume
        // their payment events or invent renewals; retain a retryable failure for reconciliation.
        throw new ServiceUnavailableException('Recurring Razorpay billing contract requires reconciliation');
      } else if (['subscription.cancelled', 'subscription.completed', 'subscription.expired', 'subscription.pending',
        'subscription.halted', 'subscription.paused', 'subscription.resumed', 'subscription.activated'].includes(payload.event)) {
        const sub = payload.payload?.subscription?.entity;
        const status = ['subscription.cancelled', 'subscription.completed', 'subscription.expired'].includes(payload.event) ? 'CANCELED' :
          ['subscription.resumed', 'subscription.activated'].includes(payload.event) ? 'ACTIVE' : 'PAST_DUE';
        await this.lifecycle(tx, 'razorpay', sub?.id, status, at);
      }
    });
  }

  async handleStripeWebhook(event: Stripe.Event) {
    const at = this.timestamp(event?.created);
    const object = event?.data?.object as any;
    // Retrieve authoritative provider periods; never extend by an approximate 30/365 days.
    let remote: Stripe.Subscription | undefined;
    if (event.type === 'checkout.session.completed' || event.type === 'invoice.payment_succeeded') {
      if (!this.stripe) throw new ServiceUnavailableException('Stripe is not configured');
      const subscriptionId = typeof object?.subscription === 'string' ? object.subscription : object?.subscription?.id;
      this.identifier(subscriptionId, 'Stripe subscription ID');
      try { remote = await this.stripe.subscriptions.retrieve(subscriptionId); }
      catch { throw new ServiceUnavailableException('Stripe subscription lookup failed'); }
    }
    return this.processEvent('stripe', event?.id, event?.type, object, async (tx) => {
      if (event.type === 'checkout.session.completed') {
        if (object.payment_status !== 'paid' || object.mode !== 'subscription') throw new BadRequestException('Stripe checkout is not paid');
        const invoiceId = typeof object.invoice === 'string' ? object.invoice : object.invoice?.id;
        await this.settleOrder(tx, 'stripe', object.id, this.identifier(invoiceId, 'Stripe invoice ID'),
          object.amount_total, object.currency?.toUpperCase(), { subscriptionId: remote.id,
            customerId: typeof object.customer === 'string' ? object.customer : undefined,
            start: this.timestamp(remote.current_period_start), end: this.timestamp(remote.current_period_end, true), eventAt: at,
            status: this.stripeState(remote.status) });
      } else if (event.type === 'invoice.payment_succeeded') {
        const sub = await tx.subscription.findUnique({ where: { stripeSubscriptionId: remote.id } });
        if (!sub?.userId) throw new NotFoundException('Stripe checkout must be reconciled before renewal');
        if (await this.existingPayment(tx, 'stripe', object.id)) return;
        if (!Number.isSafeInteger(object.amount_paid) || object.amount_paid <= 0 || !/^[a-zA-Z]{3}$/.test(object.currency)) {
          throw new BadRequestException('Invalid Stripe invoice amount');
        }
        const end = this.timestamp(remote.current_period_end, true);
        if (end < sub.currentPeriodEnd) throw new BadRequestException('Stale Stripe subscription period');
        await this.recordPayment(tx, sub.userId, sub.id, 'stripe', object.id, object.amount_paid, object.currency.toUpperCase());
        await this.lifecycle(tx, 'stripe', remote.id, this.stripeState(remote.status), at, { start: this.timestamp(remote.current_period_start), end });
      } else if (event.type === 'customer.subscription.deleted') {
        await this.lifecycle(tx, 'stripe', object?.id, 'CANCELED', at);
      } else if (event.type === 'customer.subscription.updated') {
        const state = this.stripeState(object?.status);
        await this.lifecycle(tx, 'stripe', object?.id, state, at);
        // Updates never extend the paid period; that requires a unique captured invoice.
        const sub = await tx.subscription.findUnique({ where: { stripeSubscriptionId: object?.id } });
        if (sub && (!sub.lastProviderEventAt || at >= sub.lastProviderEventAt)) {
          await tx.subscription.update({ where: { id: sub.id }, data: { cancelAtPeriodEnd: object.cancel_at_period_end === true } });
        }
      } else if (event.type === 'invoice.payment_failed') {
        await this.lifecycle(tx, 'stripe', typeof object.subscription === 'string' ? object.subscription : object.subscription?.id, 'PAST_DUE', at);
      }
    });
  }

  async handlePayPalWebhook(payload: any) {
    const at = new Date(payload?.create_time);
    if (!Number.isFinite(at.getTime())) throw new BadRequestException('Missing PayPal event timestamp');
    return this.processEvent('paypal', payload?.id, payload?.event_type, payload, async (tx) => {
      if (payload.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
        const capture = payload.resource;
        if (capture?.status !== 'COMPLETED') throw new BadRequestException('PayPal capture is not complete');
        const orderId = capture.supplementary_data?.related_ids?.order_id;
        this.identifier(orderId, 'PayPal order ID');
        await this.settleOrder(tx, 'paypal', orderId, capture.id, this.decimalMinor(capture.amount?.value), capture.amount?.currency_code, { eventAt: at });
      } else if (payload.event_type === 'BILLING.SUBSCRIPTION.CANCELLED' || payload.event_type === 'BILLING.SUBSCRIPTION.SUSPENDED') {
        await this.lifecycle(tx, 'paypal', payload.resource?.id,
          payload.event_type === 'BILLING.SUBSCRIPTION.CANCELLED' ? 'CANCELED' : 'PAST_DUE', at);
      } else if (payload.event_type === 'PAYMENT.SALE.COMPLETED') {
        throw new ServiceUnavailableException('Recurring PayPal billing contract requires reconciliation');
      }
      // CHECKOUT.ORDER.APPROVED is approval, not capture, and never grants entitlements.
    });
  }

  async cancelSubscription(userId: string) {
    const sub = await this.prisma.subscription.findFirst({ where: { userId, status: 'ACTIVE' }, orderBy: { createdAt: 'desc' } });
    if (!sub || sub.cancelAtPeriodEnd) throw new BadRequestException('No active subscription available to cancel');
    if (sub.provider === 'stripe' && sub.stripeSubscriptionId) {
      if (!this.isStripeEnabled()) throw new ServiceUnavailableException('Stripe is not configured');
      try { await this.stripe.subscriptions.update(sub.stripeSubscriptionId, { cancel_at_period_end: true }); }
      catch { throw new ServiceUnavailableException('Provider cancellation failed'); }
    } else if (sub.razorpaySubscriptionId || sub.paypalSubscriptionId) {
      throw new ServiceUnavailableException('Manage this recurring subscription with the payment provider');
    }
    await this.prisma.subscription.update({ where: { id: sub.id }, data: { cancelAtPeriodEnd: true } });
    return { success: true, message: 'Cancellation is scheduled for the end of the paid period.', currentPeriodEnd: sub.currentPeriodEnd };
  }

  async reactivateSubscription(userId: string) {
    const sub = await this.prisma.subscription.findFirst({ where: { userId, status: 'ACTIVE', cancelAtPeriodEnd: true, currentPeriodEnd: { gt: new Date() } }, orderBy: { createdAt: 'desc' } });
    if (!sub) throw new BadRequestException('No unexpired subscription is scheduled for cancellation');
    if (sub.provider === 'stripe' && sub.stripeSubscriptionId) {
      if (!this.isStripeEnabled()) throw new ServiceUnavailableException('Stripe is not configured');
      try { await this.stripe.subscriptions.update(sub.stripeSubscriptionId, { cancel_at_period_end: false }); }
      catch { throw new ServiceUnavailableException('Provider reactivation failed'); }
    } else if (sub.razorpaySubscriptionId || sub.paypalSubscriptionId) {
      throw new ServiceUnavailableException('Manage this recurring subscription with the payment provider');
    }
    await this.prisma.subscription.update({ where: { id: sub.id }, data: { cancelAtPeriodEnd: false, canceledAt: null } });
    return { success: true, message: 'Subscription reactivated.', currentPeriodEnd: sub.currentPeriodEnd };
  }

  async getUserBillingHistory(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        invoices: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!user) throw new NotFoundException('User not found');

    const activeSubscription = user.subscriptions.find((s) => s.status === 'ACTIVE') || null;

    return {
      currentPlan: await effectivePlan(this.prisma, user),
      subscription: activeSubscription,
      subscriptions: user.subscriptions,
      payments: user.payments,
      invoices: user.invoices,
    };
  }

  async generateInvoicePdf(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        subscriptions: true,
        memberships: { include: { organization: true } },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const invoice = await this.prisma.invoice.findFirst({
      where: { userId, status: 'PAID' }, orderBy: { createdAt: 'desc' },
    });
    if (!invoice) throw new NotFoundException('No paid invoice is available');

    const org = user.memberships[0]?.organization;
    const invoiceNum = invoice.invoiceNumber;
    const workerUrl = this.configService.get<string>('PDF_WORKER_URL', 'http://pdf-worker:8000');
    const workerSecret = this.configService.get<string>('WORKER_CALLBACK_SECRET');
    const amount = invoice.amount;

    let pdfBuffer: Buffer;
    try {
      if (!this.configured(workerSecret)) throw new Error('Worker authentication unavailable');
      const res = await axios.post(
        `${workerUrl}/api/v1/invoices/generate`,
        {
          invoiceNumber: invoiceNum,
          customerName: user.name || 'Valued Customer',
          customerEmail: user.email,
          organizationName: org?.name || 'Personal Workspace',
          planTier: user.plan,
          amount,
          currency: invoice.currency,
        },
        {
          headers: { 'x-pdfforge-worker-secret': workerSecret },
          responseType: 'arraybuffer',
          timeout: 4000,
        },
      );
      pdfBuffer = Buffer.from(res.data);
    } catch {
      this.logger.warn(`PDF worker unavailable for invoice generation, using high-fidelity fallback generator`);
      pdfBuffer = this.generateMinimalPdf(invoiceNum, user.name || 'Valued Customer', user.plan, amount, invoice.currency);
    }

    return {
      invoiceNumber: invoiceNum,
      buffer: pdfBuffer,
    };
  }

  private generateMinimalPdf(
    invoiceNumber: string,
    customerName: string,
    planTier: string,
    amount: number,
    currency: string,
  ): Buffer {
    const cleanCustomer = customerName.replace(/[^\x20-\x7E]|[()\\]/g, '');
    const dateStr = new Date().toISOString().slice(0, 10);
    const stream = `BT /F1 16 Tf 50 740 Td (Doxera - Official Tax Invoice) Tj ET
BT /F1 12 Tf 50 700 Td (Invoice Reference: ${invoiceNumber}) Tj ET
BT /F1 12 Tf 50 675 Td (Billed To: ${cleanCustomer}) Tj ET
BT /F1 12 Tf 50 650 Td (Plan Tier: ${planTier}) Tj ET
BT /F1 12 Tf 50 625 Td (Total Amount Paid: ${amount.toFixed(2)} ${currency}) Tj ET
BT /F1 12 Tf 50 600 Td (Payment Status: COMPLETED / PAID) Tj ET
BT /F1 12 Tf 50 575 Td (Issue Date: ${dateStr}) Tj ET
BT /F1 10 Tf 50 530 Td (Payment receipt for the recorded transaction.) Tj ET
BT /F1 10 Tf 50 510 Td (Thank you for subscribing to Doxera Enterprise SaaS Cloud.) Tj ET`;

    const pdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length ${stream.length} >>
stream
${stream}
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000060 00000 n 
0000000117 00000 n 
0000000247 00000 n 
0000000300 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
368
%%EOF`;

    return Buffer.from(pdf, 'utf-8');
  }
}
