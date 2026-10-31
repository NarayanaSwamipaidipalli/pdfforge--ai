import { Controller, Post, Body, Get, UseGuards, Res, Req, Headers, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import {
  CreateCheckoutSessionDto,
  VerifyPaymentDto,
  CapturePayPalOrderDto,
  ApplyCouponDto,
} from './dto/billing.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/roles.decorator';
import { Response } from 'express';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Billing & Subscriptions')
@Controller('api/v1/billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('plans')
  @ApiOperation({ summary: 'Retrieve subscription plans catalog, features, and quotas' })
  getPlans() {
    return this.billingService.getPlansCatalog();
  }

  @Post('coupons/apply')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate and calculate discount for a promotional coupon' })
  async applyCoupon(@Body() dto: ApplyCouponDto) {
    return this.billingService.applyCoupon(dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('checkout')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Initialize Stripe Checkout Session, Razorpay Order, or PayPal Order' })
  async createCheckout(
    @Body() dto: CreateCheckoutSessionDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.billingService.createCheckoutSession(userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('razorpay/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify Razorpay payment signature and activate subscription' })
  async verifyRazorpay(
    @CurrentUser('sub') userId: string,
    @Body() dto: VerifyPaymentDto,
  ) {
    return this.billingService.verifyRazorpayPayment(userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('paypal/capture')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Capture PayPal order and activate subscription' })
  async capturePayPal(
    @CurrentUser('sub') userId: string,
    @Body() dto: CapturePayPalOrderDto,
  ) {
    return this.billingService.capturePayPalOrder(userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('history')
  @ApiOperation({ summary: 'Retrieve user billing history, payment transactions, and active subscriptions' })
  async getBillingHistory(@CurrentUser('sub') userId: string) {
    return this.billingService.getUserBillingHistory(userId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('subscription/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Schedule active subscription cancellation at period end' })
  async cancelSubscription(@CurrentUser('sub') userId: string) {
    return this.billingService.cancelSubscription(userId);
  }

  @Post('webhook/stripe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stripe webhook receiver for asynchronous subscription events' })
  async handleStripeWebhook(
    @Req() req: Request,
    @Headers('stripe-signature') signature: string,
  ) {
    const event = this.billingService.verifyStripeWebhook((req as any).rawBody, signature);
    return this.billingService.handleStripeWebhook(event);
  }

  @Post('webhook/razorpay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Razorpay webhook receiver' })
  async handleRazorpayWebhook(
    @Req() req: Request,
    @Headers('x-razorpay-signature') signature: string,
  ) {
    this.billingService.verifyRazorpayWebhook((req as any).rawBody, signature);
    return { received: true };
  }

  @Post('webhook/paypal')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'PayPal webhook receiver' })
  async handlePayPalWebhook(@Req() req: Request, @Headers() headers: Record<string, string>) {
    await this.billingService.verifyPayPalWebhook((req as any).rawBody, headers);
    return { received: true };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('invoice/download')
  @ApiOperation({ summary: 'Generate and stream official PDF tax invoice / receipt' })
  async downloadInvoice(
    @CurrentUser('sub') userId: string,
    @Res() res: Response,
  ) {
    const invoice = await this.billingService.generateInvoicePdf(userId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}.pdf"`);
    res.send(invoice.buffer);
  }
}
