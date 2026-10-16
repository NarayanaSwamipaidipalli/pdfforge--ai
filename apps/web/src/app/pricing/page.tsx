'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Check,
  Sparkles,
  Zap,
  Building,
  ShieldCheck,
  HelpCircle,
  CreditCard,
} from 'lucide-react';

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');

  const plans = [
    {
      id: 'free',
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
      cta: 'Current Plan',
      popular: false,
    },
    {
      id: 'pro',
      name: 'Professional',
      price: billingCycle === 'yearly' ? 10 : 12,
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
      name: 'Team & Business',
      price: billingCycle === 'yearly' ? 40 : 49,
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
      cta: 'Start 14-Day Free Trial',
      popular: false,
    },
    {
      id: 'enterprise',
      name: 'Enterprise Cloud',
      price: 'Custom',
      description: 'Dedicated infrastructure, custom SLA, and on-premises RAG deployment.',
      features: [
        'Unlimited team seats & storage',
        'Dedicated worker pod cluster (EKS)',
        'Single Sign-On (SAML / Okta / Azure AD)',
        'Signed BAA for HIPAA / SOC2 compliance',
        'Custom LLM & fine-tuned RAG models',
        'Dedicated solutions architect',
      ],
      cta: 'Contact Enterprise Sales',
      popular: false,
    },
  ];

  return (
    <div className="min-h-screen bg-[#fbfbfd] py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Transparent, Scalable Enterprise Pricing</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-semibold text-zinc-900 tracking-tight leading-tight mb-4">
            Pick the plan that scales with your documents
          </h1>
          <p className="text-zinc-600 text-sm sm:text-base">
            Start for free and upgrade as your team grows. All plans include 256-bit encryption and our Zero-Retention Guarantee.
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
          {plans.map((p) => (
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
                  {typeof p.price === 'number' ? (
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl sm:text-4xl font-bold text-zinc-900">
                        ${p.price}
                      </span>
                      {p.price > 0 && (
                        <span className="text-xs text-zinc-500">{p.period}</span>
                      )}
                    </div>
                  ) : (
                    <div className="text-3xl font-bold text-zinc-900">{p.price}</div>
                  )}
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
                <Link
                  href={p.id === 'free' ? '/dashboard' : `/dashboard?upgrade=${p.id}`}
                  className={`w-full block text-center py-2.5 rounded-full text-xs font-semibold transition-all ${
                    p.popular
                      ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                      : 'bg-zinc-900 text-white hover:bg-zinc-800'
                  }`}
                >
                  {p.cta}
                </Link>
              </div>
            </div>
          ))}
        </div>

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
            href="/contact-sales"
            className="px-5 py-2.5 rounded-full border border-zinc-300 text-zinc-800 text-xs font-semibold hover:bg-zinc-50 transition-colors whitespace-nowrap"
          >
            Talk to Solutions Architect
          </Link>
        </div>
      </div>
    </div>
  );
}
