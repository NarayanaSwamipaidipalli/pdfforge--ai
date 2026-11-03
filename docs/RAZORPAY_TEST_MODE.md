# PDFForge AI — Razorpay Test Mode Setup

This integration is designed for **test mode first**. Test transactions do not move real money.

## 1. Generate test keys in Razorpay
Open https://dashboard.razorpay.com/, switch to **Test Mode**, then open **Account & Settings → API Keys → Generate Key**.

Keep the **Key Secret** private. Do not commit it, place it in frontend code, or paste it into issues or chats. A Key ID is a publishable checkout identifier; the backend Key Secret must remain on the server.

## 2. Configure API environment privately
The Docker Compose API service receives the following variables from a locally created **.env** file (not .env.example):

```dotenv
ENABLE_RAZORPAY=true
ALLOW_RAZORPAY_LIVE=false
RAZORPAY_KEY_ID=rzp_test_REPLACE_WITH_YOUR_TEST_KEY_ID
RAZORPAY_KEY_SECRET=REPLACE_PRIVATELY_WITH_YOUR_TEST_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET=
RAZORPAY_INR_PRO_MONTHLY_PAISE=
RAZORPAY_INR_PRO_YEARLY_PAISE=
RAZORPAY_INR_BUSINESS_MONTHLY_PAISE=
RAZORPAY_INR_BUSINESS_YEARLY_PAISE=
RAZORPAY_INR_ENTERPRISE_MONTHLY_PAISE=
RAZORPAY_INR_ENTERPRISE_YEARLY_PAISE=
```

Enter the prices **you want to charge**, in integer paise. For example, INR 990 equals `99000` paise. Configure a positive amount for every plan/interval you offer. The API deliberately does not guess USD→INR conversion rates. The current web catalog uses USD plan labels: before live launch, display accurate local INR prices and ensure tax disclosures are correct.

If running the NestJS API outside Docker, set these variables privately in `apps/api/.env` instead. Do **not** commit either real .env file.

## 3. Start the application
From the repository root:

```bash
docker compose up -d --build postgres redis api-gateway web
```

The API container runs `prisma migrate deploy` automatically at startup. The new `razorpay_checkouts` table must exist before testing checkout.

Open http://localhost:3000/pricing or http://localhost:3000/billing, sign in, choose Razorpay, and proceed.

## 4. How this payment flow works
1. Authenticated web page asks the API to create a checkout for the selected plan.
2. API creates a **real Razorpay Order** using the private test key and a merchant-configured amount, and stores the order's owner and amount.
3. Frontend opens official `https://checkout.razorpay.com/v1/checkout.js`.
4. Razorpay returns a payment ID, order ID and signature.
5. Backend checks the cryptographic signature and independently fetches the payment using the Razorpay API.
6. Only a **captured** payment matching the original user-owned order, currency and amount activates plan access. Duplicate callbacks must not create duplicate invoices or grants.

Current Razorpay checkout grants a fixed access period (monthly or yearly). **It does not set up automatic recurring debits**. Do not advertise auto-renewal or recurring subscriptions without a separate RBI-compliant subscription mandate integration.

## 5. Webhooks
Once there is a public **HTTPS** staging endpoint, in Razorpay **Test Mode** configure a webhook to:

```text
https://YOUR-STAGING-API/api/v1/billing/webhook/razorpay
```

Select the `payment.captured` event. Set a strong new webhook secret in Razorpay and the same secret as `RAZORPAY_WEBHOOK_SECRET` in the API environment. This is a separate secret from the API Key Secret. Razorpay cannot send webhooks directly to localhost without a trusted public tunnel.

## 6. Test cases
- Successful captured payment grants the requested plan once.
- Failed, abandoned or non-captured payment does not grant access.
- Modified amount, currency or order reference must fail verification.
- User A cannot verify User B's order.
- Duplicate callback/webhook must not grant a second billing period.
- Verify payment and order IDs in Razorpay Test Mode dashboard.

## Go-live gate
Do not enable live keys or merge the security branch until all GitHub Actions checks pass, account verification completes, all secrets are rotated from sample values, pricing and business policies match reality, and end-to-end payment tests have passed.
