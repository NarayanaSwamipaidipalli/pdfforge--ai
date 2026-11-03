'use client';

type RazorpayOrder = {
  orderId: string;
  keyId: string;
  amount: number;
  currency: string;
  tier: string;
  interval: string;
  user?: { name?: string; email?: string };
};

let scriptLoad: Promise<void> | null = null;

function loadCheckoutScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Checkout requires a browser'));
  if ((window as any).Razorpay) return Promise.resolve();
  if (scriptLoad) return scriptLoad;
  scriptLoad = new Promise<void>((resolve, reject) => {
    const element = document.createElement('script');
    element.src = 'https://checkout.razorpay.com/v1/checkout.js';
    element.async = true;
    element.onload = () => resolve();
    element.onerror = () => { scriptLoad = null; reject(new Error('Could not load Razorpay checkout')); };
    document.head.appendChild(element);
  });
  return scriptLoad;
}

/** Returns only after the authenticated API confirms a captured payment. */
export async function openRazorpayCheckout(
  order: RazorpayOrder,
  apiBase: string,
  accessToken: string,
): Promise<void> {
  if (!order.orderId || !order.keyId?.startsWith('rzp_') ||
      !Number.isSafeInteger(order.amount) || order.amount < 100 || order.currency !== 'INR') {
    throw new Error('Invalid checkout order');
  }
  await loadCheckoutScript();
  return new Promise<void>((resolve, reject) => {
    const Razorpay = (window as any).Razorpay;
    if (!Razorpay) { reject(new Error('Razorpay checkout is unavailable')); return; }
    const checkout = new Razorpay({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amount,
      currency: order.currency,
      name: 'PDFForge AI',
      description: `${order.tier} access, ${order.interval} period (not auto-renewing)`,
      prefill: {
        name: order.user?.name || '',
        email: order.user?.email || '',
      },
      handler: async (response: {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
      }) => {
        try {
          if (response.razorpay_order_id !== order.orderId) {
            throw new Error('Payment order did not match checkout');
          }
          const verification = await fetch(`${apiBase}/billing/razorpay/verify`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
            }),
          });
          const result = await verification.json();
          if (!verification.ok || !result.success) {
            throw new Error(result.message || 'Payment could not be verified');
          }
          resolve();
        } catch (err) {
          reject(err);
        }
      },
      modal: {
        ondismiss: () => reject(new Error('Payment checkout closed')),
      },
      theme: { color: '#2563eb' },
    });
    checkout.on('payment.failed', (response: any) => {
      reject(new Error(response?.error?.description || 'Payment failed'));
    });
    checkout.open();
  });
}
