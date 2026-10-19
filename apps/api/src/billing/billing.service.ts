import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCheckoutSessionDto, BillingProvider, SubscriptionTier } from './dto/billing.dto';
import Stripe from 'stripe';
import axios from 'axios';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly stripe: Stripe | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const stripeKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (stripeKey && stripeKey !== 'mock_key') {
      this.stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' });
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

  async createCheckoutSession(userId: string, dto: CreateCheckoutSessionDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const origin = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');

    if (dto.provider === BillingProvider.RAZORPAY) {
      // Mock / Razorpay order creation
      return {
        provider: 'razorpay',
        orderId: `order_rzp_${Math.random().toString(36).substring(2, 10)}`,
        amount: dto.tier === SubscriptionTier.PRO ? 1200 : 4900,
        currency: 'USD',
        keyId: this.configService.get<string>('RAZORPAY_KEY_ID', 'rzp_test_mock'),
      };
    }

    // Stripe checkout session
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
                  description: `Access to PDFForge AI Enterprise features`,
                },
                unit_amount: dto.tier === SubscriptionTier.PRO ? 1200 : 4900,
                recurring: {
                  interval: dto.interval === 'yearly' ? 'year' : 'month',
                },
              },
              quantity: 1,
            },
          ],
          success_url: `${origin}/dashboard?session_id={CHECKOUT_SESSION_ID}&upgrade=success`,
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
        this.logger.error(`Stripe checkout error: ${(err as Error).message}`);
      }
    }

    // Simulated checkout URL for development/demo
    return {
      provider: 'stripe',
      sessionId: `cs_test_${Math.random().toString(36).substring(2, 12)}`,
      checkoutUrl: `${origin}/dashboard?upgrade=success&tier=${dto.tier}`,
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
        this.logger.log(`User ${userId} successfully upgraded to ${tier}`);
      }
    }

    return { received: true };
  }

  async generateInvoicePdf(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        subscriptions: true,
        organizations: { include: { organization: true } },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const org = user.organizations[0]?.organization;
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
