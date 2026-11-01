const http = require('http');

const API_BASE = 'http://localhost:4000/api/v1';

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const parsed = new URL(url);

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          let data = null;
          try {
            data = JSON.parse(buffer.toString('utf8'));
          } catch {
            data = buffer;
          }
          resolve({ status: res.statusCode, headers: res.headers, data });
        });
      }
    );
    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function main() {
  console.log('================================================================');
  console.log('🚀 RUNNING END-TO-END BILLING ENGINE VALIDATION');
  console.log('================================================================');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      failed++;
    }
  }

  // 1. Get Plans Catalog
  console.log('\n--- 1. Plans Catalog & Pricing ---');
  const plansRes = await request('/billing/plans');
  assert(plansRes.status === 200, 'GET /billing/plans returns 200 OK');
  const planList = Array.isArray(plansRes.data) ? plansRes.data : plansRes.data.plans;
  assert(planList && planList.length === 4, 'Catalog contains 4 tiers (FREE, PRO, BUSINESS, ENTERPRISE)');
  const proPlan = planList.find((p) => p.tier === 'PRO');
  assert(proPlan && proPlan.priceMonthly === 12 && proPlan.priceYearly === 120, 'PRO plan has accurate monthly ($12) and yearly ($120) rates');

  // 2. Active Payment Providers
  console.log('\n--- 2. Active Payment Providers ---');
  const provRes = await request('/billing/providers');
  assert(provRes.status === 200, 'GET /billing/providers returns 200 OK');
  assert(provRes.data && Array.isArray(provRes.data.providers), 'Returns list of enabled providers');

  // 3. Coupons Validation
  console.log('\n--- 3. Coupon Calculation ---');
  const couponMonthly = await request('/billing/coupons/apply', {
    method: 'POST',
    body: { code: 'WELCOME50', tier: 'PRO', interval: 'monthly' },
  });
  assert(couponMonthly.status === 200 && couponMonthly.data.finalAmount === 6, 'WELCOME50 on PRO monthly ($12) discounts 50% to $6.00');

  const couponYearly = await request('/billing/coupons/apply', {
    method: 'POST',
    body: { code: 'WELCOME50', tier: 'PRO', interval: 'yearly' },
  });
  assert(couponYearly.status === 200 && couponYearly.data.finalAmount === 60, 'WELCOME50 on PRO yearly ($120) discounts 50% to $60.00');

  // 4. User Registration & Auth
  console.log('\n--- 4. User Registration & Session ---');
  const testEmail = `billing_audit_${Date.now()}@pdfforge.ai`;
  const registerRes = await request('/auth/register', {
    method: 'POST',
    body: { email: testEmail, password: 'StrongPassword2026!', name: 'Billing Audit User' },
  });
  assert(registerRes.status === 201 || registerRes.status === 200, 'User registered successfully');
  const token = registerRes.data.tokens?.accessToken || registerRes.data.accessToken || registerRes.data.token;
  assert(token, 'Access token generated');
  const authHeaders = { Authorization: `Bearer ${token}` };

  // 5. User Billing History Initial State
  console.log('\n--- 5. Initial Billing State ---');
  const histInitial = await request('/billing/history', { headers: authHeaders });
  assert(histInitial.status === 200, 'GET /billing/history returns 200 OK');
  assert(histInitial.data.currentPlan === 'FREE', 'New user starts on FREE tier');
  assert(histInitial.data.subscription === null, 'No active paid subscription initially');

  // 6. Checkout Session Creation for Multiple Providers
  console.log('\n--- 6. Multi-Provider Checkout Initialization ---');
  const stripeCheckout = await request('/billing/checkout', {
    method: 'POST',
    headers: authHeaders,
    body: { tier: 'PRO', provider: 'stripe', interval: 'monthly', couponCode: 'WELCOME50' },
  });
  assert(stripeCheckout.status === 201 || stripeCheckout.status === 200, 'Stripe checkout created');
  assert(stripeCheckout.data.checkoutUrl, 'Stripe returns redirect URL');

  const razorpayCheckout = await request('/billing/checkout', {
    method: 'POST',
    headers: authHeaders,
    body: { tier: 'PRO', provider: 'razorpay', interval: 'monthly' },
  });
  assert(razorpayCheckout.status === 201 || razorpayCheckout.status === 200, 'Razorpay checkout created');
  assert(razorpayCheckout.data.orderId, 'Razorpay returns orderId');

  const paypalCheckout = await request('/billing/checkout', {
    method: 'POST',
    headers: authHeaders,
    body: { tier: 'PRO', provider: 'paypal', interval: 'yearly' },
  });
  assert(paypalCheckout.status === 201 || paypalCheckout.status === 200, 'PayPal checkout created');
  assert(paypalCheckout.data.orderId || paypalCheckout.data.approvalUrl, 'PayPal returns order reference');

  // 7. Payment Verification & Subscription Activation
  console.log('\n--- 7. Payment Verification & Atomic Activation ---');
  const verifyRes = await request('/billing/razorpay/verify', {
    method: 'POST',
    headers: authHeaders,
    body: {
      orderId: razorpayCheckout.data.orderId,
      paymentId: `pay_${Date.now()}`,
      signature: 'mock_signature',
      tier: 'PRO',
      interval: 'monthly',
    },
  });
  assert(verifyRes.status === 200 && verifyRes.data.success, 'Payment verified and subscription activated');

  // 8. Prevent Duplicate Subscriptions
  console.log('\n--- 8. Duplicate Subscription Prevention ---');
  const dupCheckout = await request('/billing/checkout', {
    method: 'POST',
    headers: authHeaders,
    body: { tier: 'PRO', provider: 'stripe', interval: 'monthly' },
  });
  assert(dupCheckout.status === 409, 'Duplicate checkout for currently active plan throws 409 Conflict');

  // 9. Verify Active Subscription in History
  console.log('\n--- 9. Subscription Lifecycle Invariants in History ---');
  const histAfter = await request('/billing/history', { headers: authHeaders });
  assert(histAfter.data.currentPlan === 'PRO', 'User plan updated to PRO');
  assert(histAfter.data.subscription && histAfter.data.subscription.status === 'ACTIVE', 'Active subscription record confirmed');
  assert(histAfter.data.payments && histAfter.data.payments.length >= 1, 'Payment record audit created');
  assert(histAfter.data.invoices && histAfter.data.invoices.length >= 1, 'Invoice ledger record created');

  // 10. Cancellation & Reactivation Flow
  console.log('\n--- 10. Cancellation & Reactivation Lifecycle ---');
  const cancelRes = await request('/billing/subscription/cancel', {
    method: 'POST',
    headers: authHeaders,
  });
  assert(cancelRes.status === 200 && cancelRes.data.success, 'Subscription scheduled for period-end cancellation');

  const histCanceled = await request('/billing/history', { headers: authHeaders });
  assert(histCanceled.data.subscription.cancelAtPeriodEnd === true, 'cancelAtPeriodEnd flag set to true');

  const reactivateRes = await request('/billing/subscription/reactivate', {
    method: 'POST',
    headers: authHeaders,
  });
  assert(reactivateRes.status === 200 && reactivateRes.data.success, 'Subscription successfully reactivated');

  const histReactivated = await request('/billing/history', { headers: authHeaders });
  assert(histReactivated.data.subscription.cancelAtPeriodEnd === false, 'cancelAtPeriodEnd flag reverted to false');

  // 11. Webhook Replay Protection & Idempotency
  console.log('\n--- 11. Webhook Replay Attack Protection ---');
  const eventId = `evt_test_${Date.now()}`;
  const webhookPayload = {
    id: eventId,
    type: 'invoice.payment_succeeded',
    data: {
      object: {
        id: `in_test_${Date.now()}`,
        subscription: histReactivated.data.subscription.stripeSubscriptionId || 'sub_mock_none',
        amount_paid: 1200,
        currency: 'usd',
      },
    },
  };

  const wh1 = await request('/billing/webhook/stripe', {
    method: 'POST',
    headers: { 'stripe-signature': 't=123,v1=mock_sig' },
    body: webhookPayload,
  });
  assert(wh1.status === 200, 'First webhook delivery processed');

  const wh2 = await request('/billing/webhook/stripe', {
    method: 'POST',
    headers: { 'stripe-signature': 't=123,v1=mock_sig' },
    body: webhookPayload,
  });
  assert(wh2.status === 200 && wh2.data.duplicate === true, 'Duplicate webhook replay detected & safely ignored');

  // 12. Tax Invoice PDF Generation & Download
  console.log('\n--- 12. Tax Invoice Streaming ---');
  const invoiceRes = await request('/billing/invoice/download', { headers: authHeaders });
  assert(invoiceRes.status === 200, 'GET /billing/invoice/download returns 200 OK');
  const buf = Buffer.isBuffer(invoiceRes.data) ? invoiceRes.data : Buffer.from(typeof invoiceRes.data === 'string' ? invoiceRes.data : JSON.stringify(invoiceRes.data));
  const isPdf = buf && buf.slice(0, 4).toString() === '%PDF';
  assert(isPdf, 'Invoice downloaded with valid PDF signature (%PDF-)');

  console.log('\n================================================================');
  console.log(`🏁 BILLING SUITE VERIFICATION COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
