import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum BillingProvider {
  STRIPE = 'stripe',
  RAZORPAY = 'razorpay',
}

export enum SubscriptionTier {
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
  orgId?: string;
}

export class VerifyPaymentDto {
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @IsString()
  @IsNotEmpty()
  paymentId: string;

  @IsString()
  @IsNotEmpty()
  signature: string;
}
