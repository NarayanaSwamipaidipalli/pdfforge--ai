'use client';

import React, { useState, useEffect } from 'react';
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
  ExternalLink,
  Sparkles,
  AlertCircle,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface PlanDetail {
  id: string;
  name: string;
  priceMonthly: number;
  description: string;
  features: string[];
  recommended?: boolean;
}

export default function BillingPage() {
  const { user, token, syncProfile } = useAuthStore();
  const { addToast } = useToast();

  const [loadingCheckout, setLoadingCheckout] = useState<string | null>(null);
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);

  const plans: PlanDetail[] = [
    {
      id: 'FREE',
      name: 'Starter Community',
      priceMonthly: 0,
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
      name: 'Professional',
      priceMonthly: 15,
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
      name: 'Business & Teams',
      priceMonthly: 49,
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
  ];

  const handleCheckout = async (planId: string) => {
    if (planId === 'FREE') {
      addToast('You are already eligible for the Free tier.', 'info');
      return;
    }

    const authToken = token || localStorage.getItem('pdfforge_token');
    if (!authToken) {
      window.location.href = '/login';
      return;
    }

    setLoadingCheckout(planId);
    try {
      const res = await fetch(`${API_BASE}/api/v1/billing/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          plan: planId,
          billingInterval: 'monthly',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Checkout failed');

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        addToast(`Subscription upgraded to ${planId}!`, 'success');
        await syncProfile();
      }
    } catch (err: any) {
      addToast(err.message || 'Could not initiate checkout', 'error');
    } finally {
      setLoadingCheckout(null);
    }
  };

  const handleDownloadInvoice = async () => {
    const authToken = token || localStorage.getItem('pdfforge_token');
    if (!authToken) {
      addToast('Please sign in to download tax invoices.', 'error');
      return;
    }

    setDownloadingInvoice(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/billing/invoice/download`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (!res.ok) throw new Error('Could not generate invoice PDF');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `PDFForge_Tax_Invoice_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      addToast('Invoice PDF downloaded successfully!', 'success');
    } catch (err: any) {
      addToast(err.message || 'Invoice download failed', 'error');
    } finally {
      setDownloadingInvoice(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fbfbfd] dark:bg-black text-zinc-900 dark:text-zinc-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-10">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">
            <CreditCard className="w-4 h-4" /> Subscription & Financial Operations
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white">
            Billing & Invoices
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Manage your subscription tier, monitor cluster quota usage, and download tax-compliant PDF receipts.
          </p>
        </div>

        {/* Current Plan & Quota Card */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs uppercase tracking-wider text-zinc-400 font-bold">Current Subscription</span>
                <div className="flex items-center gap-3 mt-1">
                  <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">
                    {user?.plan || 'PRO'} Plan
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                    Active & Good Standing
                  </span>
                </div>
              </div>
              <button
                onClick={handleDownloadInvoice}
                disabled={downloadingInvoice}
                className="inline-flex items-center gap-2 py-2 px-3.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-xs font-semibold transition"
              >
                <Download className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />
                <span>{downloadingInvoice ? 'Generating PDF...' : 'Latest Invoice'}</span>
              </button>
            </div>

            {/* Quota Usage Meters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 space-y-2">
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span className="flex items-center gap-1.5 font-medium"><HardDrive className="w-3.5 h-3.5" /> Storage</span>
                  <span>1.4 GB / 50 GB</span>
                </div>
                <div className="w-full bg-zinc-200 dark:bg-zinc-700 h-2 rounded-full overflow-hidden">
                  <div className="bg-blue-600 h-full rounded-full" style={{ width: '28%' }} />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 space-y-2">
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span className="flex items-center gap-1.5 font-medium"><Zap className="w-3.5 h-3.5" /> PDF Operations</span>
                  <span>412 / Unlimited</span>
                </div>
                <div className="w-full bg-zinc-200 dark:bg-zinc-700 h-2 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full" style={{ width: '15%' }} />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 space-y-2">
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span className="flex items-center gap-1.5 font-medium"><Cpu className="w-3.5 h-3.5" /> AI Studio Tokens</span>
                  <span>142k / 1.0M</span>
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
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-1">Payment Method</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
                Securely handled by Stripe Payments with 256-bit encryption.
              </p>
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center gap-3">
                <div className="w-10 h-7 rounded bg-blue-900 text-white flex items-center justify-center font-bold text-[10px] tracking-widest">
                  VISA
                </div>
                <div>
                  <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 block">•••• •••• •••• 4242</span>
                  <span className="text-[10px] text-zinc-400">Expires 12/28</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-500 flex items-center justify-between">
              <span>Next billing date: <strong>Nov 24, 2026</strong></span>
              <span className="text-zinc-400 font-mono">$15.00/mo</span>
            </div>
          </div>
        </div>

        {/* Upgrade / Change Plan Cards */}
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">Available Subscription Plans</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Upgrade or downgrade anytime. Unused quota rolls into priority compute allowances.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((p) => {
              const isCurrent = (user?.plan || 'PRO') === p.id;
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
                      <span className="text-3xl font-bold text-zinc-900 dark:text-white">${p.priceMonthly}</span>
                      <span className="text-xs text-zinc-400"> / month</span>
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
                      onClick={() => handleCheckout(p.id)}
                      disabled={isCurrent || loadingCheckout === p.id}
                      className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
                        isCurrent
                          ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-default'
                          : p.recommended
                          ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                          : 'bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 text-white'
                      }`}
                    >
                      {loadingCheckout === p.id ? (
                        'Processing Checkout...'
                      ) : isCurrent ? (
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

        {/* Invoice History Section */}
        <div className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                <Receipt className="w-4 h-4 text-blue-600" /> Tax Invoices & Payment Ledger
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                All invoices comply with EU VAT, IRS Form 1099, and international e-invoicing standards.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
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
                <tr className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                  <td className="py-3 px-4 font-mono font-medium text-zinc-900 dark:text-zinc-100">INV-2026-0091</td>
                  <td className="py-3 px-4 text-zinc-500">October 24, 2026</td>
                  <td className="py-3 px-4 font-semibold text-zinc-800 dark:text-zinc-200">$15.00 USD</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                      Paid
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={handleDownloadInvoice}
                      className="p-1.5 text-blue-600 hover:text-blue-800 transition"
                      title="Download PDF"
                    >
                      <Download className="w-4 h-4 inline" />
                    </button>
                  </td>
                </tr>
                <tr className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                  <td className="py-3 px-4 font-mono font-medium text-zinc-900 dark:text-zinc-100">INV-2026-0042</td>
                  <td className="py-3 px-4 text-zinc-500">September 24, 2026</td>
                  <td className="py-3 px-4 font-semibold text-zinc-800 dark:text-zinc-200">$15.00 USD</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                      Paid
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={handleDownloadInvoice}
                      className="p-1.5 text-blue-600 hover:text-blue-800 transition"
                      title="Download PDF"
                    >
                      <Download className="w-4 h-4 inline" />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
