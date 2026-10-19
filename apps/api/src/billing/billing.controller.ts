import { Controller, Post, Body, Get, UseGuards, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { CreateCheckoutSessionDto } from './dto/billing.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/roles.decorator';
import { Response } from 'express';

@ApiTags('Billing & Subscriptions')
@Controller('api/v1/billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('plans')
  @ApiOperation({ summary: 'Retrieve subscription plans catalog, features, and quotas' })
  getPlans() {
    return this.billingService.getPlansCatalog();
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('checkout')
  @ApiOperation({ summary: 'Initialize Stripe Checkout Session or Razorpay Order' })
  async createCheckout(
    @Body() dto: CreateCheckoutSessionDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.billingService.createCheckoutSession(userId, dto);
  }

  @Post('webhook/stripe')
  @ApiOperation({ summary: 'Stripe webhook receiver for asynchronous subscription events' })
  async handleStripeWebhook(@Body() event: any) {
    return this.billingService.handleStripeWebhook(event);
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
