import { Injectable, Logger, BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
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
import Stripe from 'stripe';
import axios from 'axios';
import * as crypto from 'crypto';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private stripe: Stripe | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const stripeKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (stripeKey && stripeKey !== 'mock_key') {
      this.stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' });
    }
    // Seed default coupons asynchronously
    this.ensureDefaultCoupons().catch((err) =>
      this.logger.warn(`Coupons initialization warning: ${err.message}`),
    );
  }

  verifyStripeWebhook(rawBody?: Buffer, signature?: string): Stripe.Event {
    const secret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!rawBody || !signature || !secret || !this.stripe) {
      throw new UnauthorizedException('Invalid Stripe webhook request');
    }
    try {
      return this.stripe.webhooks.constructEvent(rawBody, signature, secret);
    } catch {
      throw new UnauthorizedException('Invalid Stripe webhook signature');
    }
  }

  verifyRazorpayWebhook(rawBody?: Buffer, signature?: string): void {
    const secret = this.configService.get<string>('RAZORPAY_WEBHOOK_SECRET');
    if (!rawBody || !signature || !secret) {
      throw new UnauthorizedException('Invalid Razorpay webhook request');
    }
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    const expectedBuffer = Buffer.from(expected, 'utf8');
    const signatureBuffer = Buffer.from(signature, 'utf8');
    if (
      expectedBuffer.length !== signatureBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, signatureBuffer)
    ) {
      throw new UnauthorizedException('Invalid Razorpay webhook signature');
    }
  }

  async verifyPayPalWebhook(rawBody?: Buffer, headers: Record<string, string> = {}): Promise<void> {
    const webhookId = this.configService.get<string>('PAYPAL_WEBHOOK_ID');
    if (!rawBody || !webhookId) {
      throw new UnauthorizedException('Invalid PayPal webhook request');
    }
    const transmissionId = headers['paypal-transmission-id'];
    const transmissionTime = headers['paypal-transmission-time'];
    const transmissionSig = headers['paypal-transmission-sig'];
    const certUrl = headers['paypal-cert-url'];
    if (!transmissionId || !transmissionTime || !transmissionSig || !certUrl) {
      throw new UnauthorizedException('Invalid PayPal webhook signature');
    }
    if (!/^https:\/\/api\.paypal\.com\/|^https:\/\/api\.sandbox\.paypal\.com\//.test(certUrl)) {
      throw new UnauthorizedException('Invalid PayPal certificate URL');
    }
    const certResponse = await axios.get(certUrl, { timeout: 5000 });
    const cert = certResponse.data as string;
    let crcValue = 0xffffffff;
    for (const byte of rawBody) {
      crcValue ^= byte;
      for (let bit = 0; bit < 8; bit++) {
        crcValue = (crcValue >>> 1) ^ ((crcValue & 1) ? 0xedb88320 : 0);
      }
    }
    const crc = ((crcValue ^ 0xffffffff) >>> 0).toString();
    const signedPayload = `${transmissionId}|${transmissionTime}|${webhookId}|${crc}`;
    const valid = crypto.verify('RSA-SHA256', Buffer.from(signedPayload), cert, Buffer.from(transmissionSig, 'base64'));
    if (!valid) throw new UnauthorizedException('Invalid PayPal webhook signature');
  }

  private async ensureDefaultCoupons() {
    const existing = await this.prisma.coupon.count();
    if (existing === 0) {
      await this.prisma.coupon.createMany({
        data: [
          {
            code: 'WELCOME50',
            discountPercent: 50,
            maxUses: 1000,
            isActive: true,
          },
          {
            code: 'PRO2026',
            discountPercent: 20,
            maxUses: 500,
            isActive: true,
          },
          {
            code: 'ENTERPRISE100',
            discountAmount: 100,
            maxUses: 100,
            isActive: true,
          },
        ],
      });
      this.logger.log('Seeded default promotional coupons (WELCOME50, PRO2026, ENTERPRISE100)');
    }
  }

  getPlansCatalog() {
    return [
      {
        id: 'free',
        tier: 'FREE',
        name: 'Starter',
        priceMonthly: 0,
        priceYearly: 0,
        features: [
          '10 daily PDF conversions',
          'Max 25 MB per file upload',
          'Basic tools (Merge, Split, Rotate)',
          'Standard processing speed',
          'Community support',
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
        priceYearly: 120,
        popular: true,
        features: [
          'Unlimited PDF conversions',
          'Max 250 MB per file upload',
          'All Conversion & OCR Tools',
          'Priority High-Speed Processing Queue',
          'Full AI Document Intelligence (500 queries/mo)',
          'No Advertisements or Watermarks',
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
        priceYearly: 490,
        features: [
          'Everything in Pro plus:',
          'Up to 15 Team Workspaces',
          'Max 500 MB per file upload',
          'Dedicated REST & GraphQL API Access',
          'Custom Brand Watermarks',
          'Role-Based Access Control & Audit Logs',
          '24/7 Priority SLA Support',
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
        priceYearly: 1990,
        features: [
          'Unlimited Team Seats & File Sizes',
          'Dedicated Worker Node Cluster',
          'Custom RAG & On-Premise LLM deployment',
          'Single Sign-On (SAML / Okta / Azure AD)',
          'BAA for HIPAA / SOC2 Type II compliance',
          'Dedicated Account Solutions Architect',
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
      where: { code: dto.code.toUpperCase() },
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

    const baseAmount = this.getTierBaseAmount(dto.tier, 'monthly');
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
      message: `Coupon ${coupon.code} applied successfully!`,
    };
  }

  async createCheckoutSession(userId: string, dto: CreateCheckoutSessionDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const origin = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const interval = dto.interval || 'monthly';
    let baseAmount = this.getTierBaseAmount(dto.tier, interval);

    // Apply coupon if specified
    if (dto.couponCode) {
      try {
        const couponRes = await this.applyCoupon({ code: dto.couponCode, tier: dto.tier });
        baseAmount = couponRes.finalAmount;
      } catch {
        // Fallback to base
      }
    }

    // 1. RAZORPAY GATEWAY
    if (dto.provider === BillingProvider.RAZORPAY) {
      const orderId = `order_rzp_${crypto.randomBytes(8).toString('hex')}`;
      const amountPaise = Math.round(baseAmount * 100 * 83); // USD to INR conversion approximate

      return {
        provider: 'razorpay',
        orderId,
        amount: amountPaise,
        currency: 'INR',
        keyId: this.configService.get<string>('RAZORPAY_KEY_ID', 'rzp_test_mock_enterprise'),
        plan: dto.tier,
        user: { name: user.name, email: user.email },
      };
    }

    // 2. PAYPAL GATEWAY
    if (dto.provider === BillingProvider.PAYPAL) {
      const orderId = `PAYPAL-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      return {
        provider: 'paypal',
        orderId,
        amount: baseAmount,
        currency: 'USD',
        plan: dto.tier,
        approvalUrl: `${origin}/dashboard?provider=paypal&orderId=${orderId}&tier=${dto.tier}&status=approved`,
      };
    }

    // 3. STRIPE GATEWAY
    if (this.stripe) {
      try {
        const session = await this.stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          mode: 'subscription',
          customer_email: user.email,
          line_items: [
            {
              price_data: {
                currency: 'usd',
                product_data: {
                  name: `PDFForge AI ${dto.tier} Plan`,
                  description: `Access to PDFForge AI Enterprise features (${interval})`,
                },
                unit_amount: Math.round(baseAmount * 100),
                recurring: {
                  interval: interval === 'yearly' ? 'year' : 'month',
                },
              },
              quantity: 1,
            },
          ],
          success_url: `${origin}/dashboard?session_id={CHECKOUT_SESSION_ID}&upgrade=success&tier=${dto.tier}`,
          cancel_url: `${origin}/pricing?canceled=true`,
          metadata: {
            userId: user.id,
            tier: dto.tier,
            orgId: dto.orgId || '',
          },
        });

        return {
          provider: 'stripe',
          sessionId: session.id,
          checkoutUrl: session.url,
        };
      } catch (err) {
        this.logger.error(`Stripe checkout session error: ${(err as Error).message}`);
      }
    }

    // Simulated sandbox checkout URL for development/demo environments
    return {
      provider: 'stripe',
      sessionId: `cs_test_${crypto.randomBytes(8).toString('hex')}`,
      checkoutUrl: `${origin}/dashboard?upgrade=success&tier=${dto.tier}&provider=stripe`,
    };
  }

  async verifyRazorpayPayment(userId: string, dto: VerifyPaymentDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const keySecret = this.configService.get<string>('RAZORPAY_KEY_SECRET', 'mock_rzp_secret');
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${dto.orderId}|${dto.paymentId}`)
      .digest('hex');

    // In production, signature must match; in dev/test sandbox we allow mock verification
    const isValid = dto.signature === expectedSignature || keySecret === 'mock_rzp_secret';

    if (!isValid) {
      throw new BadRequestException('Invalid Razorpay cryptographic payment signature');
    }

    const tier = dto.tier || SubscriptionTier.PRO;
    const amount = this.getTierBaseAmount(tier);

    // Update user plan
    await this.prisma.user.update({
      where: { id: userId },
      data: { plan: tier },
    });

    // Create / Update subscription
    await this.prisma.subscription.create({
      data: {
        userId,
        plan: tier,
        status: 'ACTIVE',
        provider: 'razorpay',
        razorpaySubscriptionId: dto.orderId,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    // Record transaction
    await this.prisma.payment.create({
      data: {
        userId,
        provider: 'razorpay',
        providerPaymentId: dto.paymentId,
        amount,
        currency: 'USD',
        status: 'COMPLETED',
        metadata: { orderId: dto.orderId, tier },
      },
    });

    return {
      success: true,
      message: `Your account has been upgraded to ${tier} with Razorpay!`,
      plan: tier,
    };
  }

  async capturePayPalOrder(userId: string, dto: CapturePayPalOrderDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const tier = dto.tier || SubscriptionTier.PRO;
    const amount = this.getTierBaseAmount(tier);

    await this.prisma.user.update({
      where: { id: userId },
      data: { plan: tier },
    });

    await this.prisma.subscription.create({
      data: {
        userId,
        plan: tier,
        status: 'ACTIVE',
        provider: 'paypal',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    await this.prisma.payment.create({
      data: {
        userId,
        provider: 'paypal',
        providerPaymentId: dto.orderId,
        amount,
        currency: 'USD',
        status: 'COMPLETED',
        metadata: { orderId: dto.orderId, tier },
      },
    });

    return {
      success: true,
      message: `Your account has been upgraded to ${tier} with PayPal!`,
      plan: tier,
    };
  }

  async handleStripeWebhook(event: Stripe.Event) {
    this.logger.log(`Received Stripe Webhook Event: ${event.type}`);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const tier = (session.metadata?.tier as SubscriptionTier) || SubscriptionTier.PRO;

      if (userId) {
        await this.prisma.user.update({
          where: { id: userId },
          data: { plan: tier },
        });

        await this.prisma.subscription.create({
          data: {
            userId,
            plan: tier,
            status: 'ACTIVE',
            provider: 'stripe',
            stripeCustomerId: typeof session.customer === 'string' ? session.customer : 'cus_mock',
            stripeSubscriptionId: typeof session.subscription === 'string' ? session.subscription : 'sub_mock',
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        });

        await this.prisma.payment.create({
          data: {
            userId,
            provider: 'stripe',
            providerPaymentId: session.id,
            amount: (session.amount_total || 1200) / 100,
            currency: session.currency?.toUpperCase() || 'USD',
            status: 'COMPLETED',
            metadata: { sessionId: session.id, tier },
          },
        });

        this.logger.log(`User ${userId} successfully upgraded to ${tier} via Stripe Webhook`);
      }
    }

    return { received: true };
  }

  async getUserBillingHistory(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        invoices: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!user) throw new NotFoundException('User not found');

    const activeSubscription = user.subscriptions.find((s) => s.status === 'ACTIVE') || null;

    return {
      currentPlan: user.plan,
      subscription: activeSubscription,
      payments: user.payments,
      invoices: user.invoices,
    };
  }

  async cancelSubscription(userId: string) {
    const sub = await this.prisma.subscription.findFirst({
      where: { userId, status: 'ACTIVE' },
    });

    if (!sub) {
      throw new BadRequestException('No active subscription found to cancel');
    }

    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: {
        cancelAtPeriodEnd: true,
        canceledAt: new Date(),
      },
    });

    return {
      success: true,
      message: 'Your subscription has been scheduled to cancel at the end of the current billing cycle.',
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

    const org = user.memberships[0]?.organization;
    const invoiceNum = `INV-2026-${userId.substring(0, 4).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const workerUrl = this.configService.get<string>('PDF_WORKER_URL', 'http://localhost:8000');

    try {
      const res = await axios.post(
        `${workerUrl}/api/v1/invoices/generate`,
        {
          invoiceNumber: invoiceNum,
          customerName: user.name || 'Valued Customer',
          customerEmail: user.email,
          organizationName: org?.name || 'Personal Workspace',
          planTier: user.plan,
          currency: 'USD',
        },
        { responseType: 'arraybuffer' },
      );

      // Save invoice record in database
      await this.prisma.invoice.create({
        data: {
          userId,
          invoiceNumber: invoiceNum,
          amount: this.getTierBaseAmount(user.plan as any),
          currency: 'USD',
          status: 'PAID',
        },
      });

      return {
        invoiceNumber: invoiceNum,
        buffer: Buffer.from(res.data),
      };
    } catch (err) {
      this.logger.error(`Invoice worker error: ${(err as Error).message}`);
      throw new BadRequestException('Invoice generation failed');
    }
  }
}
