import { IsString, IsNotEmpty, IsEnum, IsOptional, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum BillingProvider {
  STRIPE = 'stripe',
  RAZORPAY = 'razorpay',
  PAYPAL = 'paypal',
}

export enum SubscriptionTier {
  FREE = 'FREE',
  PRO = 'PRO',
  BUSINESS = 'BUSINESS',
  ENTERPRISE = 'ENTERPRISE',
}

export class CreateCheckoutSessionDto {
  @ApiProperty({ enum: SubscriptionTier, example: SubscriptionTier.PRO })
  @IsEnum(SubscriptionTier)
  @IsNotEmpty()
  tier: SubscriptionTier;

  @ApiProperty({ enum: BillingProvider, default: BillingProvider.STRIPE })
  @IsEnum(BillingProvider)
  @IsOptional()
  provider?: BillingProvider;

  @ApiProperty({ example: 'monthly', enum: ['monthly', 'yearly'] })
  @IsString()
  @IsOptional()
  interval?: 'monthly' | 'yearly';

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  couponCode?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  orgId?: string;
}

export class VerifyPaymentDto {
  @ApiProperty({ example: 'order_rzp_123456' })
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty({ example: 'pay_rzp_987654' })
  @IsString()
  @IsNotEmpty()
  paymentId: string;

  @ApiProperty({ example: 'hmac_sha256_signature_string' })
  @IsString()
  @IsNotEmpty()
  signature: string;

  @ApiProperty({ enum: SubscriptionTier, example: SubscriptionTier.PRO })
  @IsEnum(SubscriptionTier)
  @IsOptional()
  tier?: SubscriptionTier;
}

export class CreatePayPalOrderDto {
  @ApiProperty({ enum: SubscriptionTier, example: SubscriptionTier.PRO })
  @IsEnum(SubscriptionTier)
  @IsNotEmpty()
  tier: SubscriptionTier;

  @ApiProperty({ example: 'monthly', enum: ['monthly', 'yearly'] })
  @IsString()
  @IsOptional()
  interval?: 'monthly' | 'yearly';

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  couponCode?: string;
}

export class CapturePayPalOrderDto {
  @ApiProperty({ example: 'PAYPAL-ORDER-12345' })
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty({ enum: SubscriptionTier, example: SubscriptionTier.PRO })
  @IsEnum(SubscriptionTier)
  @IsOptional()
  tier?: SubscriptionTier;
}

export class ApplyCouponDto {
  @ApiProperty({ example: 'WELCOME50' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ enum: SubscriptionTier, example: SubscriptionTier.PRO })
  @IsEnum(SubscriptionTier)
  @IsNotEmpty()
  tier: SubscriptionTier;
}

export class CreateCouponDto {
  @ApiProperty({ example: 'BLACKFRIDAY' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ example: 25, required: false })
  @IsNumber()
  @IsOptional()
  discountPercent?: number;

  @ApiProperty({ example: 10, required: false })
  @IsNumber()
  @IsOptional()
  discountAmount?: number;

  @ApiProperty({ example: 200, required: false })
  @IsNumber()
  @IsOptional()
  maxUses?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  validUntil?: string;
}
