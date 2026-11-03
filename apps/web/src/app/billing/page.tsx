'use client';
import { completeRazorpayCheckout } from '@/lib/razorpay-checkout';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/auth-store';
import { useToast } from '@/components/ui/Toast';
import {
  CreditCard,
  CheckCircle2,
  Download,
  Shield,
  Zap,
  ArrowRight,
  HardDrive,
  Cpu,
  Receipt,
  FileCheck2,
  Sparkles,
  AlertCircle,
  Check,
  Building,
  Clock,
  X,
  RefreshCw,
  AlertTriangle,
  Lock,
} from 'lucide-react';

// Normalize API URL to prevent double '/api/v1' or missing '/api/v1'
const rawApiUrl = '/api/v1';
const API_BASE = rawApiUrl.replace(/\/api\/v1\/?$/, '');
const API_V1 = `${API_BASE}/api/v1`;

interface PlanDetail {
  id: string;
  tier: 'FREE' | 'PRO' | 'BUSINESS' | 'ENTERPRISE';
  name: string;
  priceMonthly: number;
  priceYearly: number;
  description: string;
  features: string[];
  recommended?: boolean;
}

interface SubscriptionData {
  id: string;
  userId: string;
  tier: string;
  interval: string;
  provider: string;
  status: 'ACTIVE' | 'TRIALING' | 'PAST_DUE' | 'CANCELED' | 'INCOMPLETE';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  canceledAt?: string | null;
}

interface InvoiceData {
  id: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
}

interface EnabledProviders {
  stripe: boolean;
  razorpay: boolean;
  paypal: boolean;
  providers: string[];
}

export default function BillingPage() {
  const { user, token, syncProfile } = useAuthStore();
  const { addToast } = useToast();

  const [loadingHistory, setLoadingHistory] = useState(true);
  const [activeSub, setActiveSub] = useState<SubscriptionData | null>(null);
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [enabledProviders, setEnabledProviders] = useState<EnabledProviders>({
    stripe: true,
    razorpay: true,
    paypal: true,
    providers: ['stripe', 'razorpay', 'paypal'],
  });

  // Billing Cycle Toggle (Monthly vs Yearly)
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');

  // Checkout Modal State
  const [selectedPlanForCheckout, setSelectedPlanForCheckout] = useState<PlanDetail | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<'stripe' | 'razorpay' | 'paypal'>('stripe');
  const [couponCode, setCouponCode] = useState('');
  const [couponData, setCouponData] = useState<any | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  // Cancellation & Reactivation States
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [reactivating, setReactivating] = useState(false);
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);

  const plans: PlanDetail[] = [
    {
      id: 'FREE',
      tier: 'FREE',
      name: 'Starter Community',
      priceMonthly: 0,
      priceYearly: 0,
      description: 'Ideal for occasional document processing and evaluation.',
      features: [
        '50 PDF operations per day',
        'Standard PyMuPDF compression',
        'Max 25MB file upload limit',
        '100 AI Studio RAG queries/mo',
        'Community Forum Support',
      ],
    },
    {
      id: 'PRO',
      tier: 'PRO',
      name: 'Professional',
      priceMonthly: 15,
      priceYearly: 12,
      description: 'For power users, legal practitioners, and financial analysts.',
      features: [
        'Unlimited PDF conversions',
        '2GB single file upload capacity',
        'OCR with multi-language Tesseract engine',
        'GPT-4o & Claude 3.5 Sonnet RAG Studio',
        '10,000 API requests / month',
        'Priority Celery worker execution queue',
      ],
      recommended: true,
    },
    {
      id: 'BUSINESS',
      tier: 'BUSINESS',
      name: 'Business & Teams',
      priceMonthly: 49,
      priceYearly: 40,
      description: 'For growing organizations needing team collaboration and custom SLAs.',
      features: [
        'Unlimited high-speed Celery slots',
        'Multi-tenant Team Workspace & RBAC',
        'Audit logs & DoD 5220.22-M zero retention',
        '100,000 API requests / month',
        'Custom Webhooks & pgvector embeddings',
        '99.99% SLA guarantee + dedicated rep',
      ],
    },
    {
      id: 'ENTERPRISE',
      tier: 'ENTERPRISE',
      name: 'Enterprise Cloud',
      priceMonthly: 199,
      priceYearly: 165,
      description: 'Dedicated infrastructure, custom SLAs, and air-gapped on-premise RAG deployment.',
      features: [
        'Unlimited team seats & private storage',
        'Dedicated worker pod cluster',
        'Single Sign-On (SAML / Okta / Azure AD)',
        'Signed BAA for HIPAA / SOC2 compliance',
        'Custom LLM & fine-tuned RAG models',
        'Dedicated solutions architect',
      ],
    },
  ];

  const fetchBillingData = useCallback(async () => {
    const authToken = token || (typeof window !== 'undefined' ? localStorage.getItem('pdfforge_token') : null);
    if (!authToken) {
      setLoadingHistory(false);
      return;
    }

    try {
      // Fetch enabled providers
      const provRes = await fetch(`${API_V1}/billing/providers`);
      if (provRes.ok) {
        const provData = await provRes.json();
        setEnabledProviders(provData);
        if (provData.providers && provData.providers.length > 0) {
          if (!provData[selectedProvider]) {
            setSelectedProvider(provData.providers[0]);
          }
        }
      }

      // Fetch user billing history & active subscription
      const histRes = await fetch(`${API_V1}/billing/history`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (histRes.ok) {
        const histData = await histRes.json();
        setActiveSub(histData.subscription || null);
        setInvoices(histData.invoices || []);
      }
    } catch (err) {
      console.error('Error fetching billing data:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, [token, selectedProvider]);

  useEffect(() => {
    fetchBillingData();
  }, [fetchBillingData]);

  // Open Checkout Modal
  const handleOpenCheckoutModal = (plan: PlanDetail) => {
    if (plan.tier === 'FREE') {
      addToast('You are currently on the Starter tier.', 'info');
      return;
    }

    const authToken = token || (typeof window !== 'undefined' ? localStorage.getItem('pdfforge_token') : null);
    if (!authToken) {
      window.location.href = '/login?redirect=/billing';
      return;
    }

    setSelectedPlanForCheckout(plan);
    setCouponCode('');
    setCouponData(null);
  };

  // Apply Coupon
  const handleApplyCoupon = async () => {
    if (!couponCode.trim() || !selectedPlanForCheckout) return;
    setCouponLoading(true);
    try {
      const res = await fetch(`${API_V1}/billing/coupons/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: couponCode.trim().toUpperCase(),
          tier: selectedPlanForCheckout.tier,
          interval: billingCycle,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setCouponData(data);
        addToast(`Coupon ${data.code} applied! You saved $${data.discountAmount}.`, 'success');
      } else {
        addToast(data.message || 'Invalid or expired coupon code', 'error');
      }
    } catch (err: any) {
      addToast(err.message || 'Failed to validate coupon', 'error');
    } finally {
      setCouponLoading(false);
    }
  };

  // Execute Checkout Session
  const handleExecuteCheckout = async () => {
    if (!selectedPlanForCheckout) return;

    const authToken = token || (typeof window !== 'undefined' ? localStorage.getItem('pdfforge_token') : null);
    if (!authToken) {
      window.location.href = '/login?redirect=/billing';
      return;
    }

    setCheckoutLoading(true);
    try {
      const res = await fetch(`${API_V1}/billing/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          tier: selectedPlanForCheckout.tier,
          provider: selectedProvider,
          interval: billingCycle,
          couponCode: couponData?.code || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Checkout failed');

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else if (data.approvalUrl) {
        window.location.href = data.approvalUrl;
      } else if (data.orderId) {
        const result = await completeRazorpayCheckout(data, authToken);
        addToast(result.message || 'Payment verified.', 'success');
        setSelectedPlanForCheckout(null);
        await syncProfile();
        await fetchBillingData();
      } else {
        addToast(`Subscription upgraded to ${selectedPlanForCheckout.name}!`, 'success');
        setSelectedPlanForCheckout(null);
        await syncProfile();
        await fetchBillingData();
      }
    } catch (err: any) {
      addToast(err.message || 'Checkout could not be completed', 'error');
    } finally {
      setCheckoutLoading(false);
    }
  };

  // Cancel Subscription
  const handleCancelSubscription = async () => {
    const authToken = token || (typeof window !== 'undefined' ? localStorage.getItem('pdfforge_token') : null);
    if (!authToken) return;

    setCanceling(true);
    try {
      const res = await fetch(`${API_V1}/billing/subscription/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Cancellation failed');

      addToast(data.message || 'Subscription scheduled to cancel at period end.', 'info');
      setShowCancelModal(false);
      await fetchBillingData();
      await syncProfile();
    } catch (err: any) {
      addToast(err.message || 'Could not cancel subscription', 'error');
    } finally {
      setCanceling(false);
    }
  };

  // Reactivate Subscription
  const handleReactivateSubscription = async () => {
    const authToken = token || (typeof window !== 'undefined' ? localStorage.getItem('pdfforge_token') : null);
    if (!authToken) return;

    setReactivating(true);
    try {
      const res = await fetch(`${API_V1}/billing/subscription/reactivate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Reactivation failed');

      addToast(data.message || 'Subscription successfully reactivated!', 'success');
      await fetchBillingData();
      await syncProfile();
    } catch (err: any) {
      addToast(err.message || 'Could not reactivate subscription', 'error');
    } finally {
      setReactivating(false);
    }
  };

  // Download Invoice PDF
  const handleDownloadInvoice = async () => {
    const authToken = token || (typeof window !== 'undefined' ? localStorage.getItem('pdfforge_token') : null);
    if (!authToken) {
      addToast('Please sign in to download tax invoices.', 'error');
      return;
    }

    setDownloadingInvoice(true);
    try {
      const res = await fetch(`${API_V1}/billing/invoice/download`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (!res.ok) throw new Error('Could not generate tax invoice PDF');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `PDFForge_Tax_Invoice_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      addToast('Tax invoice PDF downloaded successfully!', 'success');
    } catch (err: any) {
      addToast(err.message || 'Invoice download failed', 'error');
    } finally {
      setDownloadingInvoice(false);
    }
  };

  const currentTier = user?.plan || activeSub?.tier || 'FREE';
  const isCanceledAtEnd = activeSub?.cancelAtPeriodEnd ?? false;
  const renewalDate = activeSub?.currentPeriodEnd
    ? new Date(activeSub.currentPeriodEnd).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Dec 01, 2026';

  return (
    <div className="min-h-screen bg-[#fbfbfd] dark:bg-black text-zinc-900 dark:text-zinc-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-10">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">
            <CreditCard className="w-4 h-4" /> Enterprise Subscription & Billing Operations
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white">
            Billing & Invoices
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Manage your subscription tier, monitor cluster quota usage, and download tax-compliant PDF receipts.
          </p>
        </div>

        {/* Cancellation Notice Banner */}
        {isCanceledAtEnd && (
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                  Subscription Scheduled for Cancellation
                </h4>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                  You will maintain full access to your <strong>{currentTier}</strong> plan privileges until{' '}
                  <strong>{renewalDate}</strong>. No further recurring charges will occur.
                </p>
              </div>
            </div>
            <button
              onClick={handleReactivateSubscription}
              disabled={reactivating}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-sm transition whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${reactivating ? 'animate-spin' : ''}`} />
              <span>{reactivating ? 'Reactivating...' : 'Reactivate Subscription'}</span>
            </button>
          </div>
        )}

        {/* Current Plan & Quota Card */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs uppercase tracking-wider text-zinc-400 font-bold">
                  Current Subscription
                </span>
                <div className="flex items-center gap-3 mt-1">
                  <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">
                    {currentTier} Plan
                  </h2>
                  {isCanceledAtEnd ? (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                      Cancels {renewalDate}
                    </span>
                  ) : currentTier === 'FREE' ? (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                      Free Starter
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                      Active & Good Standing
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {currentTier !== 'FREE' && !isCanceledAtEnd && (
                  <button
                    onClick={() => setShowCancelModal(true)}
                    className="py-2 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-xs font-medium text-zinc-600 dark:text-zinc-300 transition"
                  >
                    Cancel Plan
                  </button>
                )}

                <button
                  onClick={handleDownloadInvoice}
                  disabled={downloadingInvoice}
                  className="inline-flex items-center gap-2 py-2 px-3.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-xs font-semibold transition"
                >
                  <Download className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />
                  <span>{downloadingInvoice ? 'Generating PDF...' : 'Latest Invoice'}</span>
                </button>
              </div>
            </div>

            {/* Quota Usage Meters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 space-y-2">
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span className="flex items-center gap-1.5 font-medium">
                    <HardDrive className="w-3.5 h-3.5" /> Storage
                  </span>
                  <span>
                    {currentTier === 'ENTERPRISE'
                      ? '12.4 GB / Unlimited'
                      : currentTier === 'BUSINESS'
                      ? '4.2 GB / 250 GB'
                      : currentTier === 'PRO'
                      ? '1.4 GB / 50 GB'
                      : '180 MB / 1 GB'}
                  </span>
                </div>
                <div className="w-full bg-zinc-200 dark:bg-zinc-700 h-2 rounded-full overflow-hidden">
                  <div className="bg-blue-600 h-full rounded-full" style={{ width: '28%' }} />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 space-y-2">
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Zap className="w-3.5 h-3.5" /> PDF Operations
                  </span>
                  <span>
                    {currentTier === 'FREE' ? '32 / 50 daily' : '412 / Unlimited'}
                  </span>
                </div>
                <div className="w-full bg-zinc-200 dark:bg-zinc-700 h-2 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full" style={{ width: '15%' }} />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 space-y-2">
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Cpu className="w-3.5 h-3.5" /> AI Studio Tokens
                  </span>
                  <span>
                    {currentTier === 'ENTERPRISE'
                      ? '420k / Dedicated'
                      : currentTier === 'BUSINESS'
                      ? '185k / 2.5M'
                      : currentTier === 'PRO'
                      ? '142k / 1.0M'
                      : '45k / 100k'}
                  </span>
                </div>
                <div className="w-full bg-zinc-200 dark:bg-zinc-700 h-2 rounded-full overflow-hidden">
                  <div className="bg-indigo-600 h-full rounded-full" style={{ width: '14%' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Payment Method Card */}
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-1">
                Payment Method & Gateway
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
                Securely encrypted via PCI-DSS Level 1 compliant gateway.
              </p>
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center gap-3">
                <div className="w-10 h-7 rounded bg-blue-900 text-white flex items-center justify-center font-bold text-[10px] tracking-widest uppercase">
                  {activeSub?.provider || 'CARD'}
                </div>
                <div>
                  <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 block">
                    {activeSub?.provider === 'paypal'
                      ? 'PayPal Digital Wallet'
                      : activeSub?.provider === 'razorpay'
                      ? 'Razorpay UPI / Netbanking'
                      : '•••• •••• •••• 4242'}
                  </span>
                  <span className="text-[10px] text-zinc-400">
                    {activeSub?.provider ? 'Connected & Active' : 'Expires 12/28'}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-500 flex items-center justify-between">
              <span>
                {isCanceledAtEnd ? 'Access ends:' : 'Next billing cycle:'}{' '}
                <strong>{renewalDate}</strong>
              </span>
              <span className="text-zinc-400 font-mono">
                {currentTier === 'PRO'
                  ? '$15.00/mo'
                  : currentTier === 'BUSINESS'
                  ? '$49.00/mo'
                  : currentTier === 'ENTERPRISE'
                  ? '$199.00/mo'
                  : '$0.00'}
              </span>
            </div>
          </div>
        </div>

        {/* Upgrade / Change Plan Cards */}
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">
                Available Subscription Plans
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Upgrade, downgrade, or switch billing frequency anytime. Instant prorated credit applied automatically.
              </p>
            </div>

            {/* Monthly / Annual Switcher */}
            <div className="inline-flex items-center p-1 rounded-full bg-zinc-200/70 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 self-start sm:self-auto">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`px-3.5 py-1 rounded-full text-xs font-semibold transition ${
                  billingCycle === 'monthly'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle('yearly')}
                className={`px-3.5 py-1 rounded-full text-xs font-semibold transition flex items-center gap-1.5 ${
                  billingCycle === 'yearly'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                <span>Annual</span>
                <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.2 rounded-full font-bold">
                  Save 20%
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((p) => {
              const isCurrent = currentTier === p.tier;
              const displayPrice = billingCycle === 'yearly' ? p.priceYearly : p.priceMonthly;

              return (
                <div
                  key={p.id}
                  className={`bg-white dark:bg-zinc-900 rounded-3xl p-6 border transition flex flex-col justify-between relative ${
                    p.recommended
                      ? 'border-blue-500 shadow-lg shadow-blue-500/5'
                      : 'border-zinc-200 dark:border-zinc-800'
                  }`}
                >
                  {p.recommended && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-sm">
                      <Sparkles className="w-3 h-3" /> Most Popular
                    </div>
                  )}

                  <div>
                    <h3 className="text-base font-semibold text-zinc-900 dark:text-white">{p.name}</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 min-h-[32px]">{p.description}</p>

                    <div className="mt-4 mb-6">
                      <span className="text-3xl font-bold text-zinc-900 dark:text-white">${displayPrice}</span>
                      <span className="text-xs text-zinc-400"> / month</span>
                      {billingCycle === 'yearly' && displayPrice > 0 && (
                        <span className="block text-[11px] text-zinc-400 mt-0.5">
                          Billed annually (${displayPrice * 12}/yr)
                        </span>
                      )}
                    </div>

                    <ul className="space-y-2.5 text-xs text-zinc-600 dark:text-zinc-300">
                      {p.features.map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-8 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                    <button
                      onClick={() => handleOpenCheckoutModal(p)}
                      disabled={isCurrent}
                      className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
                        isCurrent
                          ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-default'
                          : p.recommended
                          ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                          : 'bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 text-white'
                      }`}
                    >
                      {isCurrent ? (
                        'Current Plan'
                      ) : (
                        <>
                          <span>Select {p.name}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Multi-Gateway Checkout Modal */}
        {selectedPlanForCheckout && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
                <div>
                  <h3 className="font-bold text-zinc-900 dark:text-white text-base">
                    Upgrade to {selectedPlanForCheckout.name} Tier
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {billingCycle === 'yearly' ? 'Annual Subscription (20% savings)' : 'Monthly Recurring Billing'}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedPlanForCheckout(null)}
                  className="p-1.5 rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Gateway Selector */}
              <div className="mt-5 space-y-4">
                <label className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                  Select Payment Gateway
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {enabledProviders.stripe && (
                    <button
                      type="button"
                      onClick={() => setSelectedProvider('stripe')}
                      className={`p-3 rounded-2xl border text-center transition ${
                        selectedProvider === 'stripe'
                          ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200 font-semibold'
                          : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <CreditCard className="w-5 h-5 mx-auto mb-1 text-blue-600" />
                      <div className="text-xs font-bold">Stripe</div>
                      <div className="text-[10px] text-zinc-400">Cards & Apple Pay</div>
                    </button>
                  )}

                  {enabledProviders.razorpay && (
                    <button
                      type="button"
                      onClick={() => setSelectedProvider('razorpay')}
                      className={`p-3 rounded-2xl border text-center transition ${
                        selectedProvider === 'razorpay'
                          ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200 font-semibold'
                          : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <Zap className="w-5 h-5 mx-auto mb-1 text-emerald-600" />
                      <div className="text-xs font-bold">Razorpay</div>
                      <div className="text-[10px] text-zinc-400">UPI, Netbanking</div>
                    </button>
                  )}

                  {enabledProviders.paypal && (
                    <button
                      type="button"
                      onClick={() => setSelectedProvider('paypal')}
                      className={`p-3 rounded-2xl border text-center transition ${
                        selectedProvider === 'paypal'
                          ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200 font-semibold'
                          : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <Building className="w-5 h-5 mx-auto mb-1 text-indigo-600" />
                      <div className="text-xs font-bold">PayPal</div>
                      <div className="text-[10px] text-zinc-400">Instant Wallet</div>
                    </button>
                  )}
                </div>

                {/* Promo Code Input */}
                <div className="pt-2">
                  <label className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200 mb-1">
                    Promotional Coupon
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. WELCOME50 or PRO2026"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      className="text-xs px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white flex-1 focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleApplyCoupon}
                      disabled={couponLoading || !couponCode.trim()}
                      className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-white text-xs font-semibold disabled:opacity-50 transition"
                    >
                      {couponLoading ? 'Checking...' : 'Apply'}
                    </button>
                  </div>

                  {couponData && (
                    <div className="mt-2 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-2.5 rounded-xl flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-medium">
                        <Check className="w-4 h-4" /> Coupon {couponData.code} applied!
                      </span>
                      <span className="font-bold">
                        ${couponData.finalAmount} (was ${couponData.originalAmount})
                      </span>
                    </div>
                  )}
                </div>

                {/* Summary & Checkout Action */}
                <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-zinc-400 uppercase font-semibold">Total Due Today</div>
                    <div className="text-2xl font-extrabold text-zinc-900 dark:text-white">
                      $
                      {couponData
                        ? couponData.finalAmount
                        : billingCycle === 'yearly'
                        ? selectedPlanForCheckout.priceYearly * 12
                        : selectedPlanForCheckout.priceMonthly}
                      <span className="text-xs text-zinc-500 font-normal">
                        {' '}
                        / {billingCycle === 'yearly' ? 'yr' : 'mo'}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={handleExecuteCheckout}
                    disabled={checkoutLoading}
                    className="px-6 py-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition flex items-center gap-2 disabled:opacity-50"
                  >
                    <span>{checkoutLoading ? 'Redirecting...' : 'Proceed to Checkout'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Cancellation Confirmation Modal */}
        {showCancelModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 animate-in fade-in zoom-in-95 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-6 h-6" />
              </div>

              <div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                  Cancel {currentTier} Subscription?
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                  You will maintain all <strong>{currentTier}</strong> perks, OCR queues, and unlimited conversion capacity until{' '}
                  <strong>{renewalDate}</strong>. At that point, your account will safely revert to the Starter Community plan.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
                >
                  Keep Subscription
                </button>
                <button
                  type="button"
                  onClick={handleCancelSubscription}
                  disabled={canceling}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50"
                >
                  {canceling ? 'Scheduling Cancel...' : 'Confirm Cancellation'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Invoice History Section */}
        <div className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                <Receipt className="w-4 h-4 text-blue-600" /> Tax Invoices & Payment Ledger
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                All receipts comply with international VAT, IRS Form 1099, and digital e-invoicing standards.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            {invoices.length === 0 ? (
              <div className="text-center py-10 space-y-2">
                <Receipt className="w-8 h-8 text-zinc-300 dark:text-zinc-600 mx-auto" />
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  No payment invoices found yet.
                </p>
                <p className="text-[11px] text-zinc-400">
                  When your plan renews or you upgrade, generated tax receipts will appear here automatically.
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-400 uppercase tracking-wider font-semibold">
                    <th className="py-3 px-4">Invoice Reference</th>
                    <th className="py-3 px-4">Billing Date</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">PDF Download</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                      <td className="py-3 px-4 font-mono font-medium text-zinc-900 dark:text-zinc-100">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-3 px-4 text-zinc-500">
                        {new Date(inv.createdAt).toLocaleDateString('en-US', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="py-3 px-4 font-semibold text-zinc-800 dark:text-zinc-200">
                        ${inv.amount.toFixed(2)} {inv.currency}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={handleDownloadInvoice}
                          className="p-1.5 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition"
                          title="Download PDF"
                        >
                          <Download className="w-4 h-4 inline" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}