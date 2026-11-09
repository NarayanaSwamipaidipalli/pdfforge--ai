'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowUpRight, CreditCard, LockKeyhole, Tag } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Card';
import { useAuthStore } from '@/lib/auth-store';
import { ApiClient } from '@/lib/api-client';
import { completeRazorpayCheckout } from '@/lib/razorpay-checkout';
import { availableProviders, formatMoney, razorpayPrice, type BillingInterval, type BillingPlan, type BillingProviders, type PaymentProvider } from '@/lib/billing';

interface Coupon { valid: boolean; code: string; originalAmount: number; finalAmount: number; currency: string }

export function CheckoutModal({ plan, interval, providers, onClose, onVerified }: {
  plan: BillingPlan | null; interval: BillingInterval; providers: BillingProviders;
  onClose: () => void; onVerified?: () => void | Promise<void>;
}) {
  const router = useRouter();
  const [provider, setProvider] = useState<PaymentProvider>('razorpay');
  const [busy, setBusy] = useState(false);
  const [providerOverlay, setProviderOverlay] = useState(false);
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const inFlight = useRef(false);
  const couponRequest = useRef<AbortController | null>(null);
  const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
  useEffect(() => {
    couponRequest.current?.abort();
    setCouponBusy(false);
    if (!plan) return;
    setProvider(availableProviders(providers, plan.tier, interval)[0] || 'razorpay');
    setCouponCode(''); setCoupon(null); setError(''); setNotice('');
    return () => couponRequest.current?.abort();
  }, [plan, interval, providers]);
  if (!plan) return null;
  const enabled = availableProviders(providers, plan.tier, interval);
  const paise = razorpayPrice(providers, plan.tier, interval);
  const currency = provider === 'razorpay' ? 'INR' : 'USD';
  const baseAmount = provider === 'razorpay' ? (paise === undefined ? undefined : paise / 100) : interval === 'yearly' ? plan.priceYearly : plan.priceMonthly;
  const total = provider !== 'razorpay' && coupon ? coupon.finalAmount : baseAmount;
  const available = enabled.includes(provider) && !demoMode;

  const applyCoupon = async () => {
    if (!couponCode.trim() || provider === 'razorpay') return;
    const controller = new AbortController();
    couponRequest.current?.abort();
    couponRequest.current = controller;
    setCouponBusy(true); setError(''); setCoupon(null);
    try {
      const data = await ApiClient.request<Coupon>('/billing/coupons/apply', { method: 'POST', signal: controller.signal, body: JSON.stringify({ code: couponCode.trim().toUpperCase(), tier: plan.tier, interval }) });
      if (controller.signal.aborted) return;
      if (!data.valid || !Number.isFinite(data.originalAmount) || !Number.isFinite(data.finalAmount) || data.finalAmount < 0 || data.finalAmount > data.originalAmount || data.currency !== 'USD') throw new Error('The coupon could not be validated.');
      setCoupon(data);
    } catch (err) { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'The coupon could not be validated.'); }
    finally { if (!controller.signal.aborted) setCouponBusy(false); }
  };

  const checkout = async () => {
    if (!available || inFlight.current) return;
    if (!useAuthStore.getState().isAuthenticated) { router.push('/login?redirect=/billing'); return; }
    inFlight.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const data = await ApiClient.request('/billing/checkout', { method: 'POST', body: JSON.stringify({ tier: plan.tier, interval, provider, ...(coupon && provider !== 'razorpay' ? { couponCode: coupon.code } : {}) }) });
      const redirect = provider === 'stripe' ? data.checkoutUrl : provider === 'paypal' ? data.approvalUrl : undefined;
      if (redirect) {
        const url = new URL(redirect);
        const trusted = provider === 'stripe' ? url.hostname === 'checkout.stripe.com' : ['paypal.com', 'www.paypal.com', 'sandbox.paypal.com', 'www.sandbox.paypal.com'].includes(url.hostname);
        if (url.protocol !== 'https:' || !trusted) throw new Error('The payment provider returned an invalid checkout address.');
        window.location.assign(url.href);
      } else if (provider === 'razorpay' && data.orderId) {
        const authToken = localStorage.getItem('doxera_token');
        if (!authToken) throw new Error('Please sign in again before continuing.');
        setProviderOverlay(true);
        const result = await completeRazorpayCheckout(data, authToken);
        if (result?.success !== true) throw new Error('Payment confirmation is pending. Refresh Billing before trying another payment.');
        await useAuthStore.getState().syncProfile();
        setNotice('Payment verified by the server. Your latest billing details are being refreshed.');
        await onVerified?.();
        onClose();
      } else throw new Error('Checkout was not confirmed. Refresh Billing before trying again.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Checkout could not be completed.'); }
    finally { inFlight.current = false; setBusy(false); setProviderOverlay(false); }
  };

  return <Modal isOpen onClose={onClose} busy={busy} trapFocus={!providerOverlay} title={`Review ${plan.tier} plan`} description={`${interval === 'yearly' ? 'Yearly' : 'Monthly'} billing · Review the amount before opening the payment provider.`}>
    <div className="space-y-5">
      <div className="rounded-2xl border border-brand-500/20 bg-brand-500/[0.06] p-5">
        <div className="flex items-center justify-between gap-3"><span className="text-sm font-medium">{plan.name}</span><Badge>{plan.tier}</Badge></div>
        <p className="mt-4 text-3xl font-semibold tracking-tight">{total === undefined ? 'Unavailable' : formatMoney(total, currency)} <span className="text-sm font-normal text-[var(--muted)]">{total === undefined ? '' : `${currency} / ${interval === 'yearly' ? 'year' : 'month'}`}</span></p>
        <p className="mt-2 text-xs text-[var(--muted)]">USD catalog: {formatMoney(interval === 'yearly' ? plan.priceYearly : plan.priceMonthly)}. Razorpay uses a separately configured INR price.</p>
      </div>
      <fieldset><legend className="mb-3 text-sm font-semibold">Payment provider</legend><div className="grid grid-cols-3 gap-2">{(['stripe', 'razorpay', 'paypal'] as const).map(item => <label key={item} className={`rounded-xl border p-3 text-center text-xs capitalize transition-colors focus-within:ring-2 focus-within:ring-brand-500 ${provider === item ? 'border-brand-500 bg-brand-500/10' : 'border-[var(--card-border)]'} ${!enabled.includes(item) || busy || couponBusy ? 'cursor-not-allowed opacity-45' : 'cursor-pointer'}`}><input type="radio" name="payment-provider" value={item} checked={provider === item} disabled={!enabled.includes(item) || busy || couponBusy} onChange={() => { setProvider(item); setCoupon(null); setError(''); }} className="sr-only" /><CreditCard className="mx-auto mb-2 h-4 w-4" aria-hidden />{item}</label>)}</div></fieldset>
      {enabled.length === 0 && <p role="status" className="rounded-xl bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">Checkout is unavailable for this plan and billing period. Try another period or contact support.</p>}
      {demoMode && <p role="status" className="rounded-xl bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">Payments are disabled in this demo. No order will be created.</p>}
      {enabled.includes(provider) && provider !== 'razorpay' && <div><label htmlFor="coupon-code" className="mb-2 flex items-center gap-2 text-xs font-semibold"><Tag className="h-3.5 w-3.5" />Coupon code</label><div className="flex gap-2"><input id="coupon-code" value={couponCode} disabled={busy || couponBusy} onChange={event => { setCouponCode(event.target.value); setCoupon(null); }} className="focus-ring min-w-0 flex-1 rounded-xl border border-[var(--card-border)] bg-[var(--background)] px-3 py-2 text-sm" /><Button variant="secondary" onClick={applyCoupon} loading={couponBusy} disabled={busy || !couponCode.trim()}>Apply</Button></div>{coupon && <p role="status" className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">{coupon.code} applied: {formatMoney(coupon.originalAmount - coupon.finalAmount)} off.</p>}</div>}
      <p className="text-xs leading-relaxed text-[var(--muted)]">{provider === 'stripe' ? 'Stripe subscriptions renew automatically until canceled.' : 'Razorpay and PayPal purchases pay for one period. They do not renew automatically.'} A new purchase does not automatically cancel an existing paid plan or prorate its price.</p>
      {error && <div role="alert" className="flex gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-300"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /><span>{error}</span></div>}
      {notice && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{notice}</p>}
      <Button onClick={checkout} loading={busy} disabled={!available || couponBusy} className="w-full">Continue to payment <ArrowUpRight className="h-4 w-4" aria-hidden /></Button>
      <p className="flex items-center justify-center gap-2 text-xs text-[var(--muted)]"><LockKeyhole className="h-3.5 w-3.5" aria-hidden />Your plan updates after server confirmation.</p>
    </div>
  </Modal>;
}
