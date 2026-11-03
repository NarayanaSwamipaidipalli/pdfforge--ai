-- Track gateway-created orders independently of customer-supplied plan metadata.
CREATE TABLE "razorpay_checkouts" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "interval" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "couponCode" TEXT,
    "paymentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "razorpay_checkouts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "razorpay_checkouts_orderId_key" ON "razorpay_checkouts"("orderId");
CREATE UNIQUE INDEX "razorpay_checkouts_paymentId_key" ON "razorpay_checkouts"("paymentId");
CREATE INDEX "razorpay_checkouts_userId_status_idx" ON "razorpay_checkouts"("userId", "status");
