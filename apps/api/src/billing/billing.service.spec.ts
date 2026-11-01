import { Test, TestingModule } from '@nestjs/testing';
import { BillingService } from './billing.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { SubscriptionTier, BillingProvider } from './dto/billing.dto';

describe('BillingService', () => {
  let service: BillingService;
  let prisma: any;
  let config: any;

  beforeEach(async () => {
    prisma = {
      coupon: {
        count: jest.fn().mockResolvedValue(3),
        findUnique: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      user: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: 'user_1', plan: 'PRO' }),
      },
      subscription: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 'sub_1', plan: 'PRO', status: 'ACTIVE' }),
        update: jest.fn().mockResolvedValue({ id: 'sub_1', status: 'ACTIVE' }),
      },
      payment: {
        upsert: jest.fn().mockResolvedValue({ id: 'pay_1', status: 'COMPLETED' }),
        create: jest.fn().mockResolvedValue({ id: 'pay_1', status: 'COMPLETED' }),
      },
      invoice: {
        create: jest.fn().mockResolvedValue({ id: 'inv_1', invoiceNumber: 'INV-123' }),
      },
      webhookEvent: {
        findUnique: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 'evt_1' }),
      },
      $transaction: jest.fn((callback) => callback(prisma)),
    };

    config = {
      get: jest.fn((key: string, defaultVal?: any) => {
        if (key === 'ENABLE_STRIPE') return 'true';
        if (key === 'ENABLE_RAZORPAY') return 'true';
        if (key === 'ENABLE_PAYPAL') return 'true';
        if (key === 'FRONTEND_URL') return 'http://localhost:3000';
        if (key === 'RAZORPAY_KEY_SECRET') return 'mock_rzp_secret';
        return defaultVal;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);
  });

  describe('Plans Catalog & Provider Management', () => {
    it('should return catalog of available plans with monthly and yearly pricing', () => {
      const plans = service.getPlansCatalog();
      expect(plans.length).toBe(4);
      expect(plans.map((p) => p.tier)).toEqual(['FREE', 'PRO', 'BUSINESS', 'ENTERPRISE']);
      const proPlan = plans.find((p) => p.tier === 'PRO');
      expect(proPlan?.priceMonthly).toBe(12);
      expect(proPlan?.priceYearly).toBe(120);
    });

    it('should return enabled providers correctly', () => {
      const providers = service.getEnabledProviders();
      expect(providers).toEqual({
        stripe: true,
        razorpay: true,
        paypal: true,
        providers: ['stripe', 'razorpay', 'paypal'],
      });
    });

    it('should accurately compute base amounts for monthly and yearly intervals', () => {
      expect(service.getTierBaseAmount(SubscriptionTier.PRO, 'monthly')).toBe(12);
      expect(service.getTierBaseAmount(SubscriptionTier.PRO, 'yearly')).toBe(120);
      expect(service.getTierBaseAmount(SubscriptionTier.BUSINESS, 'monthly')).toBe(49);
      expect(service.getTierBaseAmount(SubscriptionTier.BUSINESS, 'yearly')).toBe(490);
    });
  });

  describe('Coupon Calculations', () => {
    it('should apply percentage discount coupon correctly', async () => {
      prisma.coupon.findUnique.mockResolvedValue({
        code: 'WELCOME50',
        discountPercent: 50,
        discountAmount: null,
        maxUses: 100,
        usedCount: 5,
        isActive: true,
        validUntil: null,
        currency: 'USD',
      });

      const result = await service.applyCoupon({
        code: 'WELCOME50',
        tier: SubscriptionTier.PRO,
        interval: 'monthly',
      });

      expect(result.valid).toBe(true);
      expect(result.originalAmount).toBe(12);
      expect(result.finalAmount).toBe(6);
    });

    it('should apply fixed discount amount coupon correctly on yearly interval', async () => {
      prisma.coupon.findUnique.mockResolvedValue({
        code: 'SAVE100',
        discountPercent: null,
        discountAmount: 100,
        maxUses: 100,
        usedCount: 0,
        isActive: true,
        validUntil: null,
        currency: 'USD',
      });

      const result = await service.applyCoupon({
        code: 'SAVE100',
        tier: SubscriptionTier.BUSINESS,
        interval: 'yearly',
      });

      expect(result.valid).toBe(true);
      expect(result.originalAmount).toBe(490);
      expect(result.finalAmount).toBe(390);
    });

    it('should reject inactive or expired coupon code', async () => {
      prisma.coupon.findUnique.mockResolvedValue({
        code: 'EXPIRED20',
        isActive: false,
      });

      await expect(
        service.applyCoupon({ code: 'EXPIRED20', tier: SubscriptionTier.PRO }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject coupon that exceeded max uses', async () => {
      prisma.coupon.findUnique.mockResolvedValue({
        code: 'MAXEDOUT',
        isActive: true,
        maxUses: 10,
        usedCount: 10,
      });

      await expect(
        service.applyCoupon({ code: 'MAXEDOUT', tier: SubscriptionTier.PRO }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Checkout Session Flow', () => {
    it('should throw NotFoundException if user is not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.createCheckoutSession('missing_user', { tier: SubscriptionTier.PRO }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should prevent duplicate active subscriptions for identical plan and interval', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user_1', email: 'test@example.com' });
      prisma.subscription.findFirst.mockResolvedValue({
        id: 'sub_active',
        plan: 'PRO',
        interval: 'monthly',
        status: 'ACTIVE',
        cancelAtPeriodEnd: false,
      });

      await expect(
        service.createCheckoutSession('user_1', {
          tier: SubscriptionTier.PRO,
          interval: 'monthly',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should initialize Razorpay order payload correctly', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user_1', email: 'test@example.com', name: 'Test' });
      prisma.subscription.findFirst.mockResolvedValue(null);

      const session: any = await service.createCheckoutSession('user_1', {
        tier: SubscriptionTier.PRO,
        provider: BillingProvider.RAZORPAY,
        interval: 'monthly',
      });

      expect(session.provider).toBe('razorpay');
      expect(session.orderId).toBeDefined();
      expect(session.amount).toBe(Math.round(12 * 100 * 83));
      expect(session.currency).toBe('INR');
    });

    it('should initialize PayPal order payload correctly', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user_1', email: 'test@example.com' });
      prisma.subscription.findFirst.mockResolvedValue(null);

      const session: any = await service.createCheckoutSession('user_1', {
        tier: SubscriptionTier.BUSINESS,
        provider: BillingProvider.PAYPAL,
        interval: 'yearly',
      });

      expect(session.provider).toBe('paypal');
      expect(session.orderId).toBeDefined();
      expect(session.amount).toBe(490);
      expect(session.approvalUrl).toContain('status=approved');
    });
  });

  describe('Payment Verification & Activation', () => {
    it('should atomically verify Razorpay payment and upgrade subscription', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user_1', plan: 'FREE' });

      const result = await service.verifyRazorpayPayment('user_1', {
        orderId: 'order_123',
        paymentId: 'pay_123',
        signature: 'mock_sig',
        tier: SubscriptionTier.PRO,
      });

      expect(result.success).toBe(true);
      expect(result.plan).toBe('PRO');
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user_1' },
        data: { plan: 'PRO' },
      });
    });

    it('should atomically capture PayPal order and upgrade subscription', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user_1', plan: 'FREE' });

      const result = await service.capturePayPalOrder('user_1', {
        orderId: 'PAYPAL-1234',
        tier: SubscriptionTier.BUSINESS,
      });

      expect(result.success).toBe(true);
      expect(result.plan).toBe('BUSINESS');
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('Idempotent Webhooks & Lifecycle', () => {
    it('should process Stripe checkout.session.completed and prevent duplicate execution', async () => {
      prisma.webhookEvent.findUnique.mockResolvedValue(null); // first time
      prisma.user.findUnique.mockResolvedValue({ id: 'user_1' });

      const mockEvent: any = {
        id: 'evt_stripe_123',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_123',
            customer: 'cus_123',
            subscription: 'sub_stripe_123',
            amount_total: 1200,
            currency: 'usd',
            metadata: {
              userId: 'user_1',
              tier: 'PRO',
              interval: 'monthly',
            },
          },
        },
      };

      const res1 = await service.handleStripeWebhook(mockEvent);
      expect(res1).toEqual({ received: true });
      expect(prisma.webhookEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ eventId: 'evt_stripe_123' }),
      });

      // Second attempt (duplicate replay)
      prisma.webhookEvent.findUnique.mockResolvedValue({ id: 'evt_stripe_123' });
      const res2 = await service.handleStripeWebhook(mockEvent);
      expect(res2).toEqual({ received: true, duplicate: true });
    });

    it('should handle Stripe customer.subscription.deleted by downgrading user to FREE', async () => {
      prisma.webhookEvent.findUnique.mockResolvedValue(null);
      prisma.subscription.findUnique.mockResolvedValue({
        id: 'sub_db_1',
        userId: 'user_1',
        stripeSubscriptionId: 'sub_stripe_del',
      });

      const mockEvent: any = {
        id: 'evt_del_999',
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: 'sub_stripe_del',
          },
        },
      };

      await service.handleStripeWebhook(mockEvent);
      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub_db_1' },
        data: expect.objectContaining({ status: 'CANCELED' }),
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user_1' },
        data: { plan: 'FREE' },
      });
    });
  });

  describe('Subscription Cancellation & Reactivation', () => {
    it('should schedule active subscription for cancellation at period end', async () => {
      prisma.subscription.findFirst.mockResolvedValue({
        id: 'sub_1',
        status: 'ACTIVE',
        cancelAtPeriodEnd: false,
        currentPeriodEnd: new Date('2026-12-01'),
      });

      const res = await service.cancelSubscription('user_1');
      expect(res.success).toBe(true);
      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub_1' },
        data: expect.objectContaining({ cancelAtPeriodEnd: true }),
      });
    });

    it('should reactivate scheduled cancellation', async () => {
      prisma.subscription.findFirst.mockResolvedValue({
        id: 'sub_1',
        status: 'ACTIVE',
        cancelAtPeriodEnd: true,
        currentPeriodEnd: new Date('2026-12-01'),
      });

      const res = await service.reactivateSubscription('user_1');
      expect(res.success).toBe(true);
      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub_1' },
        data: expect.objectContaining({ cancelAtPeriodEnd: false, canceledAt: null }),
      });
    });
  });
});
