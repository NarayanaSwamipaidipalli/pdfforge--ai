let sdkPromise: Promise<void> | undefined;

async function loadSdk() {
  if ((window as any).Razorpay) return;
  if (!sdkPromise) sdkPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => { sdkPromise = undefined; reject(new Error('Payment checkout could not be loaded')); };
    document.head.appendChild(script);
  });
  await sdkPromise;
}

export async function completeRazorpayCheckout(order: any, token: string): Promise<any> {
  if (!order.keyId || !order.orderId || !Number.isSafeInteger(order.amount) || order.amount <= 0 || order.currency !== 'INR') {
    throw new Error('Invalid payment checkout response');
  }
  await loadSdk();
  return new Promise((resolve, reject) => {
    let finished = false;
    const checkout = new (window as any).Razorpay({
      key: order.keyId, order_id: order.orderId, amount: order.amount, currency: order.currency,
      name: 'Doxera', prefill: order.user || {},
      handler: async (payment: any) => {
        finished = true;
        try {
          const response = await fetch('/api/v1/billing/razorpay/verify', {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ orderId: payment.razorpay_order_id, paymentId: payment.razorpay_payment_id, signature: payment.razorpay_signature }),
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.message || 'Payment verification is pending; check billing before retrying');
          resolve(result);
        } catch (error) { reject(error); }
      },
      modal: { ondismiss: () => { if (!finished) reject(new Error('Payment checkout was closed')); } },
    });
    checkout.on('payment.failed', () => { finished = true; reject(new Error('Payment was not completed')); });
    checkout.open();
  });
}
