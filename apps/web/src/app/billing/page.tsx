'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, ArrowRight, ArrowUpRight, AlertCircle, CalendarDays, CheckCircle2,
  ChevronRight, CreditCard, Download, FileText, Layers3, Loader2, Receipt,
  RefreshCw, ShieldCheck, Sparkles, Wallet, XCircle,
} from 'lucide-react';
import { ApiClient } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';
import {
  type BillingHistory, type BillingInterval, type BillingPlan, type PlanTier,
  formatDate, formatMoney, selectCurrentSubscription, useBillingCatalog,
} from '@/lib/billing';
import { CheckoutModal } from '@/components/billing/CheckoutModal';
import { BillingToggle, PlanCards } from '@/components/billing/PlanCards';
import { Badge, Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Reveal } from '@/components/ui/Motion';
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell';

const tiers: PlanTier[] = ['FREE', 'PRO', 'BUSINESS', 'ENTERPRISE'];
const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function Status({ status }: { status: string }) {
  const positive = ['COMPLETED', 'PAID', 'ACTIVE', 'TRIALING'].includes(status);
  const failed = ['FAILED', 'UNPAID', 'PAST_DUE'].includes(status);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
      positive
        ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
        : failed
          ? 'border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300'
          : 'border-zinc-500/20 bg-zinc-500/10 text-zinc-600 dark:text-zinc-300'
    }`}>
      <span className={`h-1.5 w-1.5 rounded-full ${positive ? 'bg-emerald-500' : failed ? 'bg-rose-500' : 'bg-zinc-400'}`} />
      {status.replaceAll('_', ' ').toLowerCase()}
    </span>
  );
}

function HistorySkeleton() {
  return (
    <div role="status" aria-label="Loading billing information" className="space-y-6">
      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        {[0, 1].map((index) => (
          <Card key={index} className="p-6 sm:p-8">
            <div className="skeleton h-4 w-28 rounded" />
            <div className="skeleton mt-5 h-10 w-48 rounded-lg" />
            <div className="skeleton mt-5 h-4 w-4/5 rounded" />
            <div className="skeleton mt-8 h-10 w-full rounded-xl" />
          </Card>
        ))}
      </div>
      <Card className="p-6 sm:p-8">
        <div className="skeleton h-5 w-44 rounded" />
        {[0, 1, 2].map((index) => <div key={index} className="skeleton mt-6 h-12 rounded-xl" />)}
      </Card>
      <span className="sr-only">Loading your subscription and transactions.</span>
    </div>
  );
}

export default function BillingPage() {
  const router = useRouter();
  const { user, token, isAuthenticated, isHydrated, syncProfile, refreshTokens } = useAuthStore();
  const catalog = useBillingCatalog();
  const [history, setHistory] = useState<BillingHistory | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'success' | 'info'; text: string } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [interval, setInterval] = useState<BillingInterval>('monthly');
  const [selectedPlan, setSelectedPlan] = useState<BillingPlan | null>(null);
  const [showCancel, setShowCancel] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [reactivating, setReactivating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [returnLoading, setReturnLoading] = useState(false);
  const processedReturn = useRef(false);
  const historyRequest = useRef(0);
  const signedIn = isAuthenticated || Boolean(token);

  const loadHistory = useCallback(async () => {
    const requestId = ++historyRequest.current;
    setRefreshing(true);
    setHistoryError(null);
    try {
      const data = await ApiClient.request<BillingHistory>('/billing/history');
      if (!data || !tiers.includes(data.currentPlan) || !Array.isArray(data.subscriptions) || !Array.isArray(data.payments) || !Array.isArray(data.invoices)) {
        throw new Error('The billing service returned incomplete information. Please try again.');
      }
      if (requestId === historyRequest.current) setHistory(data);
      return data;
    } catch (error) {
      if (requestId === historyRequest.current) setHistoryError(errorMessage(error, 'Your billing information could not be loaded.'));
      return null;
    } finally {
      if (requestId === historyRequest.current) {
        setLoadingHistory(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    if (!signedIn) {
      router.replace('/login?redirect=/billing');
      return;
    }
    void loadHistory();
  }, [isHydrated, signedIn, router, loadHistory]);

  // Return URLs are navigation hints only. PayPal still requires authenticated
  // server capture; Stripe entitlements arrive through verified webhooks.
  useEffect(() => {
    if (!isHydrated || !signedIn || processedReturn.current) return;
    processedReturn.current = true;
    const params = new URLSearchParams(window.location.search);
    const paypalOrder = params.get('token');
    if (params.get('provider') === 'paypal' && paypalOrder && demoMode) {
      setNotice({ kind: 'info', text: 'Payment confirmation is disabled in this shared demo.' });
    } else if (params.get('provider') === 'paypal' && paypalOrder) {
      setReturnLoading(true);
      void (async () => {
        try {
          const result = await ApiClient.request<{ success?: boolean }>('/billing/paypal/capture', {
            method: 'POST', body: JSON.stringify({ orderId: paypalOrder }),
          });
          if (result.success !== true) throw new Error('Payment confirmation is pending. Refresh your billing information before trying again.');
          setNotice({ kind: 'success', text: 'The billing service verified your PayPal payment.' });
          await Promise.all([loadHistory(), syncProfile()]);
          window.history.replaceState({}, '', '/billing');
        } catch (error) {
          setActionError(errorMessage(error, 'Payment could not be verified. Check your payment history before trying again.'));
        } finally {
          setReturnLoading(false);
        }
      })();
    } else if (params.has('session_id')) {
      setNotice({ kind: 'info', text: 'You have returned from checkout. Subscription access below comes from the billing service. Refresh if your payment is still being processed.' });
      window.history.replaceState({}, '', '/billing');
    }
  }, [isHydrated, signedIn, loadHistory, syncProfile]);

  const subscription = history ? selectCurrentSubscription(history) : null;
  const currentPlan = history?.currentPlan;
  const plan = catalog.plans.find((item) => item.tier === currentPlan);
  const latestPaidInvoice = history?.invoices.find((invoice) => invoice.status === 'PAID');
  // Cancellation currently targets the newest ACTIVE record, rather than a
  // selectable subscription ID. Do not describe a different record as canceled.
  const cancellationTarget = history?.subscriptions.find((item) => item.status === 'ACTIVE') || null;
  const multipleActive = (history?.subscriptions.filter((item) => item.status === 'ACTIVE').length || 0) > 1;
  const cancellationMatches = !subscription || cancellationTarget?.id === subscription.id;
  const recurring = subscription?.provider === 'stripe' && Boolean(subscription.stripeSubscriptionId);
  const cancelScheduled = subscription?.cancelAtPeriodEnd === true;
  const canCancel = subscription?.status === 'ACTIVE' && !cancelScheduled;
  const paymentProvider = subscription?.provider
    ? subscription.provider.charAt(0).toUpperCase() + subscription.provider.slice(1)
    : null;

  const afterVerified = async () => {
    setNotice({ kind: 'success', text: 'Your payment was verified by the billing service.' });
    await Promise.all([loadHistory(), syncProfile()]);
  };

  const choosePlan = (nextPlan: BillingPlan) => {
    setActionError(null);
    if (!history || historyError) {
      setActionError('Load your current billing information before changing plans.');
      return;
    }
    if (nextPlan.tier === currentPlan) return;
    if (nextPlan.tier === 'FREE') {
      if (!cancellationMatches || multipleActive) {
        setActionError('This account has multiple active paid periods. A move to Free cannot be scheduled from this page until those subscriptions have been reviewed.');
        return;
      }
      setShowCancel(true);
      return;
    }
    if (tiers.indexOf(nextPlan.tier) < tiers.indexOf(history.currentPlan)) {
      setActionError('Switching to a lower paid plan is not currently supported. You can move to Free at the end of your paid period, then choose another plan.');
      return;
    }
    setSelectedPlan(nextPlan);
  };

  const cancelSubscription = async () => {
    if (demoMode || canceling || !cancellationMatches || multipleActive) return;
    setCanceling(true);
    setActionError(null);
    try {
      const result = await ApiClient.request<{ message?: string }>(subscription ? '/billing/subscription/cancel' : '/billing/checkout', {
        method: 'POST',
        ...(subscription ? {} : { body: JSON.stringify({ tier: 'FREE', interval: 'monthly' }) }),
      });
      setShowCancel(false);
      setNotice({ kind: 'success', text: result.message || 'Your plan change was saved by the billing service.' });
      await Promise.all([loadHistory(), syncProfile()]);
    } catch (error) {
      setActionError(errorMessage(error, 'Your cancellation could not be saved. Please try again.'));
    } finally {
      setCanceling(false);
    }
  };

  const reactivate = async () => {
    if (demoMode || reactivating || !cancellationMatches || multipleActive) return;
    setReactivating(true);
    setActionError(null);
    try {
      const result = await ApiClient.request<{ message?: string }>('/billing/subscription/reactivate', { method: 'POST' });
      setNotice({ kind: 'success', text: result.message || 'Your scheduled cancellation was removed.' });
      await Promise.all([loadHistory(), syncProfile()]);
    } catch (error) {
      setActionError(errorMessage(error, 'Your subscription could not be reactivated.'));
    } finally {
      setReactivating(false);
    }
  };

  const downloadInvoice = async () => {
    if (!latestPaidInvoice || downloading) return;
    setDownloading(true);
    setActionError(null);
    try {
      let accessToken = useAuthStore.getState().token || localStorage.getItem('doxera_token');
      const request = () => fetch('/api/v1/billing/invoice/download', {
        credentials: 'include', headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
      let response = await request();
      if (response.status === 401) {
        accessToken = await refreshTokens();
        if (accessToken) response = await request();
      }
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(typeof data?.message === 'string' ? data.message : 'The invoice could not be downloaded.');
      }
      if (!response.headers.get('Content-Type')?.includes('application/pdf')) throw new Error('The billing service did not return a PDF invoice.');
      const blob = await response.blob();
      if (await blob.slice(0, 5).text() !== '%PDF-') throw new Error('The downloaded invoice is not a valid PDF. Please try again.');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${latestPaidInvoice.invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice({ kind: 'success', text: 'Your latest paid invoice was downloaded.' });
    } catch (error) {
      setActionError(errorMessage(error, 'Your invoice could not be downloaded.'));
    } finally {
      setDownloading(false);
    }
  };

  if (!isHydrated || !signedIn) {
    return <div className="flex min-h-[65vh] items-center justify-center" role="status"><Loader2 className="h-6 w-6 animate-spin text-brand-500" /><span className="sr-only">Checking your account</span></div>;
  }

  return (
    <WorkspaceShell>
    <div className="relative min-h-screen overflow-hidden bg-zinc-50 text-ink-900 dark:bg-ink-950 dark:text-white">
      <div aria-hidden className="pointer-events-none absolute -right-48 -top-48 h-[500px] w-[500px] rounded-full bg-brand-500/[0.07] blur-[100px]" />
      <div className="relative mx-auto max-w-7xl space-y-8">
        <Reveal>
          <div className="mb-6 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <Link href="/dashboard" className="focus-ring rounded-md transition-colors hover:text-brand-600 dark:hover:text-brand-300">Workspace</Link>
            <ChevronRight className="h-3 w-3" aria-hidden />
            <span className="text-zinc-700 dark:text-zinc-200">Billing</span>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <Badge tone="neutral" className="mb-4"><Wallet className="h-3 w-3" aria-hidden /> Your workspace, your plan</Badge>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Billing &amp; subscription<span className="text-brand-500">.</span></h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">Manage your plan, keep track of payments, and find your invoices in one place.</p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => void loadHistory()} loading={refreshing} disabled={returnLoading}>
              {!refreshing && <RefreshCw className="h-3.5 w-3.5" aria-hidden />} Refresh billing
            </Button>
          </div>
        </Reveal>

        <div aria-live="polite" className="space-y-3">
          {notice && (
            <div className={`flex items-start gap-3 rounded-2xl border p-4 text-sm ${notice.kind === 'success' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200' : 'border-brand-500/20 bg-brand-500/10 text-brand-800 dark:text-brand-200'}`}>
              {notice.kind === 'success' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> : <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
              <p className="flex-1 leading-relaxed">{notice.text}</p>
              <button onClick={() => setNotice(null)} aria-label="Dismiss notification" className="focus-ring shrink-0 rounded p-0.5"><XCircle className="h-4 w-4" /></button>
            </div>
          )}
          {returnLoading && <div role="status" className="flex items-center gap-3 rounded-2xl border border-brand-500/20 bg-brand-500/10 p-4 text-sm text-brand-700 dark:text-brand-200"><Loader2 className="h-4 w-4 animate-spin" />Verifying your payment with the billing service…</div>}
          {actionError && <div role="alert" className="flex items-start gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-300"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><p>{actionError}</p></div>}
          {historyError && (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-300">
              <p className="flex items-start gap-2"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{historyError}{history ? ' Previously loaded information is shown below.' : ''}</p>
              <Button size="sm" variant="secondary" onClick={() => void loadHistory()} loading={refreshing}>Try again</Button>
            </div>
          )}
        </div>

        {loadingHistory ? <HistorySkeleton /> : history && (
          <>
            <Reveal delay={0.05}>
              <div className="grid items-stretch gap-5 lg:grid-cols-[1.5fr_1fr]">
                <Card className="relative overflow-hidden p-6 sm:p-8" gradientRing>
                  <div aria-hidden className="pointer-events-none absolute -right-10 -top-12 h-48 w-48 rounded-full bg-brand-500/10 blur-3xl" />
                  <div className="relative">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400"><Layers3 className="h-4 w-4 text-brand-500" aria-hidden /> Current plan</span>
                      {subscription ? <Status status={subscription.status} /> : <Badge tone="neutral">{currentPlan === 'FREE' ? 'Free workspace' : 'Account entitlement'}</Badge>}
                    </div>
                    <div className="mt-7 flex flex-wrap items-end gap-x-3 gap-y-2">
                      <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">{currentPlan}</h2>
                      {plan && <span className="pb-1 text-sm text-zinc-500 dark:text-zinc-400">{plan.name}</span>}
                    </div>
                    <p className="mt-3 max-w-md text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                      {subscription
                        ? cancelScheduled ? `Your paid access continues through ${formatDate(subscription.currentPeriodEnd)}. A move to Free is scheduled.`
                          : recurring ? 'Your recurring subscription is managed through Stripe.'
                            : 'A prepaid plan period. Payments are not collected automatically.'
                        : currentPlan === 'FREE' ? 'A little document magic, whenever you need it. Explore a paid plan when your work needs more room.'
                          : 'This account has plan access without a current paid period to display.'}
                    </p>
                    <div className="mt-7 grid grid-cols-2 gap-4 border-t border-black/[0.07] pt-5 dark:border-white/[0.08]">
                      <div>
                        <p className="mb-1.5 flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400"><CalendarDays className="h-3.5 w-3.5" aria-hidden />{recurring && !cancelScheduled ? 'Current period ends' : 'Paid through'}</p>
                        <p className="text-sm font-semibold">{subscription ? formatDate(subscription.currentPeriodEnd) : 'No paid period'}</p>
                      </div>
                      <div>
                        <p className="mb-1.5 text-xs text-zinc-500 dark:text-zinc-400">Payment schedule</p>
                        <p className="text-sm font-semibold">{subscription ? `${subscription.interval === 'yearly' ? 'Yearly' : 'Monthly'} · ${recurring ? 'Recurring' : 'Prepaid'}` : 'No scheduled payments'}</p>
                      </div>
                    </div>
                    <div className="mt-7 flex flex-wrap items-center gap-3">
                      <Button href="#plans" size="sm">Explore plans <ArrowRight className="h-3.5 w-3.5" aria-hidden /></Button>
                      {cancelScheduled ? <Button variant="secondary" size="sm" onClick={() => void reactivate()} loading={reactivating} disabled={demoMode || !cancellationMatches || multipleActive}>Keep this plan</Button>
                        : (canCancel || (currentPlan !== 'FREE' && !subscription)) && <Button variant="ghost" size="sm" onClick={() => { setActionError(null); setShowCancel(true); }} disabled={demoMode || !cancellationMatches || multipleActive}>Move to Free</Button>}
                    </div>
                  </div>
                </Card>
                <Card className="flex flex-col p-6 sm:p-8">
                  <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl border border-brand-500/20 bg-brand-500/10 text-brand-600 dark:text-brand-300"><CreditCard className="h-5 w-5" aria-hidden /></div>
                  <h2 className="text-lg font-semibold">Payment details</h2>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{paymentProvider ? `Your current paid period was purchased through ${paymentProvider}.` : 'Payment details will appear here when you purchase a paid plan.'}</p>
                  <dl className="my-6 space-y-4 text-sm">
                    <div className="flex items-center justify-between gap-3"><dt className="text-zinc-500 dark:text-zinc-400">Account</dt><dd className="max-w-[65%] break-all text-right font-medium">{user?.email || 'Your signed-in account'}</dd></div>
                    <div className="flex items-center justify-between gap-3"><dt className="text-zinc-500 dark:text-zinc-400">Recent transactions</dt><dd className="font-semibold tabular-nums">{history.payments.length}</dd></div>
                    <div className="flex items-center justify-between gap-3"><dt className="text-zinc-500 dark:text-zinc-400">Available invoices</dt><dd className="font-semibold tabular-nums">{history.invoices.length}</dd></div>
                  </dl>
                  <div className="mt-auto flex items-start gap-2.5 rounded-xl bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-500 dark:bg-white/[0.04] dark:text-zinc-400"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" aria-hidden />Payment status and subscription access are confirmed by the billing service.</div>
                </Card>
              </div>
            </Reveal>

            {(multipleActive || !cancellationMatches) && <div className="flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm leading-relaxed text-amber-800 dark:text-amber-200"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /><p>This account has multiple active paid periods. Cancellation and reactivation need a subscription review before changes can be made here.</p></div>}

            {plan && (
              <Reveal delay={0.1}>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {[
                    { label: 'Upload size per file', value: `${plan.limits.maxFileSizeMb.toLocaleString()} MB`, icon: FileText },
                    { label: 'Documents per batch', value: plan.limits.batchLimit.toLocaleString(), icon: Layers3 },
                    { label: 'AI queries per month', value: plan.limits.aiQueries === -1 ? 'Unlimited' : plan.limits.aiQueries.toLocaleString(), icon: Sparkles },
                  ].map((item) => <Card key={item.label} className="flex items-center gap-4 p-5"><item.icon className="h-5 w-5 shrink-0 text-brand-500 dark:text-brand-300" aria-hidden /><div><p className="text-xs text-zinc-500 dark:text-zinc-400">{item.label}</p><p className="mt-1 text-lg font-semibold tabular-nums">{item.value}</p></div></Card>)}
                </div>
              </Reveal>
            )}

            <Reveal>
              <Card className="overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-black/[0.07] p-6 dark:border-white/[0.08] sm:px-8">
                  <div><h2 className="flex items-center gap-2 text-lg font-semibold"><Receipt className="h-4 w-4 text-brand-500" aria-hidden />Payment history</h2><p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Your latest transactions and their recorded payment status.</p></div>
                  <Badge tone="neutral">{history.payments.length} recent</Badge>
                </div>
                {history.payments.length === 0 ? (
                  <div className="flex flex-col items-center px-6 py-14 text-center"><div className="mb-4 rounded-2xl bg-zinc-100 p-4 text-zinc-400 dark:bg-white/[0.05]"><Receipt className="h-7 w-7" aria-hidden /></div><h3 className="text-sm font-semibold">No payments yet</h3><p className="mt-2 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">When you purchase a plan, your transactions will appear here.</p></div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[540px] text-left text-sm">
                      <caption className="sr-only">Recent payments from your billing history</caption>
                      <thead className="bg-zinc-50 text-[11px] uppercase tracking-wider text-zinc-500 dark:bg-white/[0.025] dark:text-zinc-400"><tr><th scope="col" className="px-6 py-4 font-medium sm:pl-8">Date</th><th scope="col" className="px-4 py-4 font-medium">Provider</th><th scope="col" className="px-4 py-4 font-medium">Status</th><th scope="col" className="px-6 py-4 text-right font-medium sm:pr-8">Amount</th></tr></thead>
                      <tbody className="divide-y divide-black/[0.05] dark:divide-white/[0.06]">{history.payments.map((payment) => <tr key={payment.id} className="transition-colors hover:bg-zinc-50/80 dark:hover:bg-white/[0.02]"><td className="px-6 py-5 text-zinc-600 dark:text-zinc-300 sm:pl-8">{formatDate(payment.createdAt)}</td><td className="px-4 py-5 font-medium capitalize">{payment.provider}</td><td className="px-4 py-5"><Status status={payment.status} /></td><td className="px-6 py-5 text-right font-semibold tabular-nums sm:pr-8">{formatMoney(payment.amount, payment.currency)}</td></tr>)}</tbody>
                    </table>
                  </div>
                )}
              </Card>
            </Reveal>

            <Reveal>
              <Card className="overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-black/[0.07] p-6 dark:border-white/[0.08] sm:px-8">
                  <div><h2 className="flex items-center gap-2 text-lg font-semibold"><FileText className="h-4 w-4 text-brand-500" aria-hidden />Invoices</h2><p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">Invoice records from your account. PDF download is available for the latest paid invoice.</p></div>
                  {latestPaidInvoice && <Button size="sm" variant="secondary" onClick={() => void downloadInvoice()} loading={downloading}><Download className="h-3.5 w-3.5" aria-hidden /> Download latest paid invoice</Button>}
                </div>
                {history.invoices.length === 0 ? (
                  <div className="px-6 py-12 text-center"><FileText className="mx-auto mb-4 h-7 w-7 text-zinc-400" aria-hidden /><h3 className="text-sm font-semibold">Your invoices will live here</h3><p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">No invoices have been recorded for this account.</p></div>
                ) : (
                  <ul className="divide-y divide-black/[0.05] dark:divide-white/[0.06]">{history.invoices.map((invoice) => <li key={invoice.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-6 py-5 sm:px-8"><div className="flex min-w-0 flex-1 items-start gap-3"><div className="hidden shrink-0 rounded-xl bg-zinc-100 p-2.5 text-zinc-500 dark:bg-white/[0.05] sm:block"><FileText className="h-4 w-4" aria-hidden /></div><div className="min-w-0"><p className="break-all text-xs font-semibold">{invoice.invoiceNumber}</p><p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">{formatDate(invoice.createdAt)}</p></div></div><div className="flex items-center gap-4"><Status status={invoice.status} /><span className="min-w-[85px] text-right text-sm font-semibold tabular-nums">{formatMoney(invoice.amount, invoice.currency)}</span></div></li>)}</ul>
                )}
              </Card>
            </Reveal>
          </>
        )}

        <section id="plans" className="scroll-mt-24 space-y-7 pb-8 pt-8">
          <Reveal><div className="flex flex-wrap items-end justify-between gap-5"><div><Badge className="mb-3"><Sparkles className="h-3 w-3" aria-hidden /> Room for what’s next</Badge><h2 className="text-2xl font-bold tracking-tight sm:text-3xl">A plan for your next chapter.</h2><p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Compare the current plans and choose what fits your work.</p></div><BillingToggle value={interval} onChange={setInterval} /></div></Reveal>
          {catalog.error ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-5 text-sm text-rose-700 dark:text-rose-300"><p>{catalog.error}</p><Button size="sm" variant="secondary" onClick={catalog.reload}>Reload plans</Button></div>
            : catalog.loading ? <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4" role="status" aria-label="Loading plans">{[0, 1, 2, 3].map((index) => <Card key={index} className="h-80 p-6"><div className="skeleton h-5 w-24 rounded" /><div className="skeleton mt-6 h-12 w-32 rounded-lg" /><div className="skeleton mt-8 h-28 rounded-xl" /></Card>)}</div>
              : <PlanCards plans={catalog.plans} providers={catalog.providers} interval={interval} currentPlan={currentPlan} onSelect={choosePlan} />}
          <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">Paid plan changes create a separate paid period. Existing payments are not prorated and existing recurring subscriptions are not automatically replaced. To move to Free, use the plan controls above. Lower paid plan changes are not currently available.</p>
          {demoMode && <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-800 dark:text-amber-200">Payment and subscription changes are disabled in this shared demo.</p>}
          <Link href="/pricing#compare" className="focus-ring inline-flex items-center gap-1.5 rounded-lg text-sm font-medium text-brand-600 hover:text-brand-500 dark:text-brand-300">See the full plan comparison <ArrowUpRight className="h-4 w-4" aria-hidden /></Link>
        </section>

        <div className="border-t border-black/[0.07] py-5 dark:border-white/[0.08]"><Link href="/dashboard" className="focus-ring inline-flex items-center gap-2 rounded-md text-sm text-zinc-500 transition-colors hover:text-ink-900 dark:text-zinc-400 dark:hover:text-white"><ArrowLeft className="h-4 w-4" aria-hidden /> Back to your workspace</Link></div>
      </div>

      <CheckoutModal plan={selectedPlan} interval={interval} providers={catalog.providers} onClose={() => setSelectedPlan(null)} onVerified={afterVerified} />
      <Modal isOpen={showCancel} busy={canceling} onClose={() => { if (!canceling) setShowCancel(false); }} title="Move to the Free plan?" description={subscription ? 'Review what happens to your current paid period.' : 'Confirm this change to your account entitlement.'}>
        <div className="space-y-5">
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm leading-relaxed text-amber-800 dark:text-amber-200">
            {subscription ? <>Your current paid access continues through <strong>{formatDate(subscription.currentPeriodEnd)}</strong>. This schedules a cancellation at the end of that period.</> : <>Your account will move to Free when the billing service confirms the change.</>}
          </div>
          <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">The Free plan has lower processing and upload limits. Review the plan comparison before making this change.</p>
          {actionError && <p role="alert" className="text-sm text-rose-600 dark:text-rose-300">{actionError}</p>}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Button variant="secondary" onClick={() => setShowCancel(false)} disabled={canceling}>Keep my plan</Button><Button variant="danger" onClick={() => void cancelSubscription()} loading={canceling} disabled={demoMode || !cancellationMatches || multipleActive}>Confirm move to Free</Button></div>
        </div>
      </Modal>
    </div>
    </WorkspaceShell>
  );
}
