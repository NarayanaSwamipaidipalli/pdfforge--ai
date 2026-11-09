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
        stripe: false,
        razorpay: false,
        paypal: false,
        providers: [],
      });
    });

    it('should accurately compute base amounts for monthly and yearly intervals', () => {
      expect(service.getTierBaseAmount(SubscriptionTier.PRO, 'monthly')).toBe(12);
      expect(service.getTierBaseAmount(SubscriptionTier.PRO, 'yearly')).toBe(120);
      expect(service.getTierBaseAmount(SubscriptionTier.BUSINESS, 'monthly')).toBe(49);
      expect(service.getTierBaseAmount(SubscriptionTier.BUSINESS, 'yearly')).toBe(490);
    });
  });

  describe('Razorpay INR pricing', () => {
    const razorpayConfig = (prices: Record<string, string>) => (key: string, fallback?: any) => {
      const values: Record<string, string> = {
        ENABLE_RAZORPAY: 'true', RAZORPAY_KEY_ID: 'rzp_test_fixture', RAZORPAY_KEY_SECRET: 'fixture-secret',
        RAZORPAY_WEBHOOK_SECRET: 'fixture-webhook', FRONTEND_URL: 'http://localhost:3000', ...prices,
      };
      return values[key] ?? fallback;
    };

    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user_1', email: 'buyer@example.com', name: 'Buyer', isBanned: false });
      prisma.billingOrder = { create: jest.fn().mockResolvedValue({ id: 'order_local_1' }), update: jest.fn() };
    });

    it('rejects a yearly Razorpay checkout when only the monthly INR price is configured', async () => {
      config.get.mockImplementation(razorpayConfig({ RAZORPAY_PRICE_PRO_MONTHLY: '9900' }));
      await expect(service.createCheckoutSession('user_1', { tier: 'PRO', interval: 'yearly', provider: 'razorpay' } as any))
        .rejects.toThrow('Razorpay INR price is not configured for this plan');
      expect(prisma.billingOrder.create).not.toHaveBeenCalled();
    });

    it('creates a Razorpay order for the configured monthly INR price and reports it to the client', async () => {
      config.get.mockImplementation(razorpayConfig({ RAZORPAY_PRICE_PRO_MONTHLY: '9900' }));
      const razorpay = jest.spyOn(service as any, 'razorpayRequest').mockResolvedValue({ id: 'order_rzp_fixture', amount: 9900, currency: 'INR' });
      const result = await service.createCheckoutSession('user_1', { tier: 'PRO', interval: 'monthly', provider: 'razorpay' } as any);
      expect(razorpay).toHaveBeenCalledWith('post', '/orders', expect.objectContaining({ amount: 9900, currency: 'INR' }));
      expect(result).toMatchObject({ provider: 'razorpay', orderId: 'order_rzp_fixture', amount: 9900, currency: 'INR' });
    });

    it('publishes only configured INR prices alongside enabled providers', () => {
      config.get.mockImplementation(razorpayConfig({ RAZORPAY_PRICE_PRO_MONTHLY: '9900', RAZORPAY_PRICE_BUSINESS_YEARLY: '0' }));
      expect(service.getEnabledProviders()).toMatchObject({ razorpay: true, providers: ['razorpay'], razorpayPrices: { PRO_MONTHLY: 9900 } });
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

});
