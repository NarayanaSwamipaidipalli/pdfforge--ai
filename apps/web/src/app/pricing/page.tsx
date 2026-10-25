'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';
import {
  Check,
  Sparkles,
  Zap,
  Building,
  ShieldCheck,
  HelpCircle,
  CreditCard,
  Tag,
  X,
  Lock,
  ArrowRight,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function PricingPage() {
  const router = useRouter();
  const { user, token, isAuthenticated } = useAuthStore();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');

  // Checkout Modal State
  const [selectedPlan, setSelectedPlan] = useState<any | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<'stripe' | 'razorpay' | 'paypal'>('stripe');
  const [couponCode, setCouponCode] = useState('');
  const [couponData, setCouponData] = useState<any | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const plans = [
    {
      id: 'free',
      tier: 'FREE',
      name: 'Starter',
      price: 0,
      description: 'Ideal for occasional document conversions and basic PDF merges.',
      features: [
        '10 daily conversions',
        'Max 25 MB file size limit',
        'Standard processing queue',
        'Basic tools (Merge, Split, Rotate)',
        'Community email support',
      ],
      cta: 'Get Started Free',
      popular: false,
    },
    {
      id: 'pro',
      tier: 'PRO',
      name: 'Professional',
      priceMonthly: 12,
      priceYearly: 10,
      period: 'per month',
      description: 'For power users needing unlimited processing, OCR, and AI document chat.',
      features: [
        'Unlimited daily conversions',
        'Max 250 MB file size limit',
        'Priority high-speed worker queue',
        'Full OCR & Searchable PDF generation',
        '500 AI Document Intelligence queries / mo',
        'Zero advertisements or watermarks',
      ],
      cta: 'Upgrade to Pro',
      popular: true,
    },
    {
      id: 'business',
      tier: 'BUSINESS',
      name: 'Team & Business',
      priceMonthly: 49,
      priceYearly: 40,
      period: 'per month',
      description: 'Engineered for growing teams, shared workspaces, and automated API workloads.',
      features: [
        'Up to 15 team workspace seats',
        'Max 500 MB file size limit',
        'Full REST & GraphQL API access',
        'Role-based permissions & audit logging',
        '2,500 AI Document queries / mo',
        'Custom corporate brand watermarks',
        '24/7 Priority SLA response time',
      ],
      cta: 'Upgrade to Business',
      popular: false,
    },
    {
      id: 'enterprise',
      tier: 'ENTERPRISE',
      name: 'Enterprise Cloud',
      priceMonthly: 199,
      priceYearly: 165,
      period: 'per month',
      description: 'Dedicated infrastructure, custom SLA, and on-premises RAG deployment.',
      features: [
        'Unlimited team seats & storage',
        'Dedicated worker pod cluster',
        'Single Sign-On (SAML / Okta / Azure AD)',
        'Signed BAA for HIPAA / SOC2 compliance',
        'Custom LLM & fine-tuned RAG models',
        'Dedicated solutions architect',
      ],
      cta: 'Deploy Enterprise',
      popular: false,
    },
  ];

  const handleOpenCheckout = (plan: any) => {
    if (plan.id === 'free') {
      router.push('/dashboard');
      return;
    }
    if (!isAuthenticated) {
      router.push('/register?redirect=/pricing');
      return;
    }
    setSelectedPlan(plan);
    setCouponCode('');
    setCouponData(null);
  };

  const handleApplyCoupon = async () => {
    if (!couponCode || !selectedPlan) return;
    setCouponLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/billing/coupons/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode.trim(), tier: selectedPlan.tier }),
      });
      const data = await res.json();
      if (res.ok) {
        setCouponData(data);
      } else {
        alert(data.message || 'Invalid coupon code');
      }
    } catch {
      alert('Could not validate coupon code.');
    } finally {
      setCouponLoading(false);
    }
  };

  const handleExecuteCheckout = async () => {
    if (!selectedPlan) return;
    setCheckoutLoading(true);

    const authToken =
      token || (typeof window !== 'undefined' ? localStorage.getItem('pdfforge_token') : null);

    try {
      const res = await fetch(`${API_BASE}/api/v1/billing/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          tier: selectedPlan.tier,
          provider: selectedProvider,
          interval: billingCycle,
          couponCode: couponData?.code || undefined,
        }),
      });

      const data = await res.json();

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else if (data.approvalUrl) {
        window.location.href = data.approvalUrl;
      } else if (data.orderId) {
        // Razorpay checkout modal simulation
        const confirmPay = confirm(`Razorpay Order Created: ${data.orderId}\nAmount: ₹${(data.amount / 100).toFixed(2)}\nProceed with payment simulation?`);
        if (confirmPay) {
          const verifyRes = await fetch(`${API_BASE}/api/v1/billing/razorpay/verify`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify({
              orderId: data.orderId,
              paymentId: `pay_${Date.now()}`,
              signature: 'mock_signature',
              tier: selectedPlan.tier,
            }),
          });
          const vData = await verifyRes.json();
          alert(vData.message || 'Payment verified! Plan activated.');
          router.push('/dashboard?upgrade=success');
        }
      }
    } catch (err: any) {
      alert(`Checkout failed: ${err.message}`);
    } finally {
      setCheckoutLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fbfbfd] py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Transparent, Scalable Enterprise SaaS Pricing</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-semibold text-zinc-900 tracking-tight leading-tight mb-4">
            Pick the plan that scales with your documents
          </h1>
          <p className="text-zinc-600 text-sm sm:text-base">
            Upgrade with Stripe, Razorpay, or PayPal. All plans include 256-bit encryption and zero-retention guarantee.
          </p>

          {/* Billing Switcher */}
          <div className="mt-8 inline-flex items-center p-1 rounded-full bg-zinc-200/60 border border-zinc-200">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                billingCycle === 'monthly'
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Monthly Billing
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                billingCycle === 'yearly'
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <span>Annual Billing</span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-full font-semibold">
                Save 20%
              </span>
            </button>
          </div>
        </div>

        {/* 4-Card Pricing Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
          {plans.map((p) => {
            const displayPrice = p.price === 0 ? 0 : billingCycle === 'yearly' ? p.priceYearly : p.priceMonthly;

            return (
              <div
                key={p.id}
                className={`rounded-3xl p-6 flex flex-col justify-between transition-all duration-200 ${
                  p.popular
                    ? 'bg-white border-2 border-blue-600 shadow-apple-hover relative scale-[1.02]'
                    : 'bg-white border border-zinc-200 shadow-sm hover:border-zinc-300'
                }`}
              >
                {p.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold uppercase tracking-wider">
                    Most Popular
                  </div>
                )}

                <div>
                  <h3 className="text-base font-semibold text-zinc-900 mb-1">{p.name}</h3>
                  <p className="text-xs text-zinc-500 mb-4 min-h-[36px]">{p.description}</p>

                  <div className="mb-6 pb-6 border-b border-zinc-100">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl sm:text-4xl font-bold text-zinc-900">
                        ${displayPrice}
                      </span>
                      {displayPrice! > 0 && (
                        <span className="text-xs text-zinc-500">{p.period}</span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3 mb-8">
                    {p.features.map((feat, i) => (
                      <div key={i} className="flex items-start gap-2.5 text-xs text-zinc-600">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <button
                    onClick={() => handleOpenCheckout(p)}
                    className={`w-full py-2.5 rounded-full text-xs font-semibold transition-all ${
                      p.popular
                        ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                        : 'bg-zinc-900 text-white hover:bg-zinc-800'
                    }`}
                  >
                    {p.cta}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Multi-Gateway Checkout Modal */}
        {selectedPlan && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-zinc-100 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
                <div>
                  <h3 className="font-bold text-zinc-900 text-base">
                    Upgrade to {selectedPlan.name} Tier
                  </h3>
                  <p className="text-xs text-zinc-500">
                    {billingCycle === 'yearly' ? 'Annual Billing (20% off)' : 'Monthly Recurring'}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedPlan(null)}
                  className="p-1 rounded-full text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Gateway Selector */}
              <div className="mt-5 space-y-4">
                <label className="block text-xs font-semibold text-zinc-800">
                  Select Payment Gateway
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedProvider('stripe')}
                    className={`p-3 rounded-2xl border text-center transition ${
                      selectedProvider === 'stripe'
                        ? 'border-blue-600 bg-blue-50/50 text-blue-900 font-semibold'
                        : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                    }`}
                  >
                    <CreditCard className="w-5 h-5 mx-auto mb-1 text-blue-600" />
                    <div className="text-xs font-bold">Stripe</div>
                    <div className="text-[10px] text-zinc-400">Cards, Apple Pay</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedProvider('razorpay')}
                    className={`p-3 rounded-2xl border text-center transition ${
                      selectedProvider === 'razorpay'
                        ? 'border-blue-600 bg-blue-50/50 text-blue-900 font-semibold'
                        : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                    }`}
                  >
                    <Zap className="w-5 h-5 mx-auto mb-1 text-emerald-600" />
                    <div className="text-xs font-bold">Razorpay</div>
                    <div className="text-[10px] text-zinc-400">UPI, Netbanking</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedProvider('paypal')}
                    className={`p-3 rounded-2xl border text-center transition ${
                      selectedProvider === 'paypal'
                        ? 'border-blue-600 bg-blue-50/50 text-blue-900 font-semibold'
                        : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                    }`}
                  >
                    <Building className="w-5 h-5 mx-auto mb-1 text-indigo-600" />
                    <div className="text-xs font-bold">PayPal</div>
                    <div className="text-[10px] text-zinc-400">Instant Wallet</div>
                  </button>
                </div>

                {/* Promo Code Input */}
                <div className="pt-2">
                  <label className="block text-xs font-semibold text-zinc-800 mb-1">
                    Promotional Coupon
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. WELCOME50 or PRO2026"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      className="text-xs px-3 py-2 rounded-xl border border-zinc-200 flex-1 focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleApplyCoupon}
                      disabled={couponLoading || !couponCode}
                      className="px-4 py-2 rounded-xl bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 disabled:opacity-50"
                    >
                      {couponLoading ? '...' : 'Apply'}
                    </button>
                  </div>

                  {couponData && (
                    <div className="mt-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 p-2 rounded-lg flex items-center justify-between">
                      <span>Coupon {couponData.code} Applied!</span>
                      <span className="font-bold">
                        ${couponData.finalAmount} (was ${couponData.originalAmount})
                      </span>
                    </div>
                  )}
                </div>

                {/* Summary & Checkout Action */}
                <div className="pt-4 border-t border-zinc-100 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-zinc-400 uppercase font-semibold">Total Due Today</div>
                    <div className="text-2xl font-extrabold text-zinc-900">
                      ${couponData ? couponData.finalAmount : (billingCycle === 'yearly' ? selectedPlan.priceYearly : selectedPlan.priceMonthly)}
                      <span className="text-xs text-zinc-500 font-normal"> / {billingCycle === 'yearly' ? 'yr' : 'mo'}</span>
                    </div>
                  </div>

                  <button
                    onClick={handleExecuteCheckout}
                    disabled={checkoutLoading}
                    className="px-6 py-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition flex items-center gap-2"
                  >
                    <span>{checkoutLoading ? 'Redirecting...' : 'Proceed to Checkout'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Security & Compliance Footer Callout */}
        <div className="p-8 rounded-3xl bg-white border border-zinc-200 shadow-sm text-center max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="text-left">
            <h4 className="font-semibold text-zinc-900 text-sm mb-1 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              Need custom enterprise security or BAA signing?
            </h4>
            <p className="text-xs text-zinc-500">
              We provide on-premises private VPC deployments, custom VPC peering, and custom retention SLAs.
            </p>
          </div>
          <Link
            href="/contact"
            className="px-5 py-2.5 rounded-full border border-zinc-300 text-zinc-800 text-xs font-semibold hover:bg-zinc-50 transition-colors whitespace-nowrap"
          >
            Talk to Solutions Architect
          </Link>
        </div>
      </div>
    </div>
  );
}
