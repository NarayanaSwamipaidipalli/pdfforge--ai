'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/auth-store';
import {
  FileText,
  Download,
  Trash2,
  Key,
  HardDrive,
  Activity,
  Plus,
  Copy,
  CheckCircle2,
  ShieldCheck,
  RefreshCw,
  Clock,
  AlertCircle,
  CreditCard,
  Settings,
  Lock,
  Smartphone,
  RotateCcw,
  Sparkles,
  Tag,
  Check,
  XCircle,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface UserJob {
  id: string;
  tool: string;
  status: string;
  progress: number;
  outputFileKey: string | null;
  outputFileSizeBytes: number | string | null;
  durationMs: number | null;
  createdAt: string;
  inputFilesPayload: any;
  errorMessage?: string;
}

interface ApiKeyItem {
  id: string;
  name: string;
  keyPrefix: string;
  rateLimitRpm: number;
  lastUsedAt: string | null;
  createdAt: string;
}

interface UserSessionItem {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  lastActiveAt: string;
  createdAt: string;
}

interface PaymentItem {
  id: string;
  provider: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
}

interface InvoiceItem {
  id: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
}

export default function DashboardPage() {
  const { user, token, isAuthenticated, syncProfile } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'jobs' | 'subscription' | 'keys' | 'security'>('jobs');

  const [jobs, setJobs] = useState<UserJob[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [sessions, setSessions] = useState<UserSessionItem[]>([]);
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);

  // API Key creation
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [createdPlainKey, setCreatedPlainKey] = useState<string | null>(null);
  const [keyGenerating, setKeyGenerating] = useState(false);

  // Security / Password
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Coupon / Promo
  const [couponCode, setCouponCode] = useState('');
  const [couponResult, setCouponResult] = useState<any>(null);
  const [applyingCoupon, setApplyingCoupon] = useState(false);

  const fetchDashboardData = async () => {
    setLoading(true);
    const authToken =
      token || (typeof window !== 'undefined' ? localStorage.getItem('pdfforge_token') : null);

    if (!authToken) {
      setLoading(false);
      return;
    }

    try {
      // 1. Fetch User Jobs History
      const jobsRes = await fetch(`${API_BASE}/api/v1/pdf/jobs/user/history`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (jobsRes.ok) {
        const jobsData = await jobsRes.json();
        setJobs(jobsData || []);
      }

      // 2. Fetch Developer API Keys
      const keysRes = await fetch(`${API_BASE}/api/v1/auth/api-keys`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (keysRes.ok) {
        const keysData = await keysRes.json();
        setApiKeys(keysData || []);
      }

      // 3. Fetch Billing History
      const billingRes = await fetch(`${API_BASE}/api/v1/billing/history`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (billingRes.ok) {
        const billingData = await billingRes.json();
        if (billingData.payments) setPayments(billingData.payments);
        if (billingData.invoices) setInvoices(billingData.invoices);
      }

      // 4. Fetch Active Sessions
      const sessionsRes = await fetch(`${API_BASE}/api/v1/auth/sessions`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (sessionsRes.ok) {
        const sessionsData = await sessionsRes.json();
        setSessions(sessionsData || []);
      }
    } catch (err) {
      console.warn('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [token]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleGenerateApiKey = async () => {
    const keyName = prompt('Enter a recognizable name for this API Key:', 'Production Integration Key');
    if (!keyName) return;

    const authToken =
      token || (typeof window !== 'undefined' ? localStorage.getItem('pdfforge_token') : null);
    if (!authToken) return;

    setKeyGenerating(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/api-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ name: keyName, permissions: ['pdf:process', 'ai:query'] }),
      });

      if (res.ok) {
        const newKey = await res.json();
        setCreatedPlainKey(newKey.apiKey);
        setApiKeys((prev) => [newKey, ...prev]);
      } else {
        alert('Could not generate API Key. Please try again.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setKeyGenerating(false);
    }
  };

  const handleRevokeApiKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to revoke this API key? Applications using it will lose access immediately.')) {
      return;
    }

    const authToken =
      token || (typeof window !== 'undefined' ? localStorage.getItem('pdfforge_token') : null);
    if (!authToken) return;

    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/api-keys/${keyId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        setApiKeys((prev) => prev.filter((k) => k.id !== keyId));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRetryJob = async (jobId: string) => {
    const authToken =
      token || (typeof window !== 'undefined' ? localStorage.getItem('pdfforge_token') : null);
    if (!authToken) return;

    try {
      const res = await fetch(`${API_BASE}/api/v1/pdf/jobs/${jobId}/retry`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        fetchDashboardData();
      }
    } catch (err) {
      console.error('Retry error:', err);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);
    const authToken =
      token || (typeof window !== 'undefined' ? localStorage.getItem('pdfforge_token') : null);
    if (!authToken) return;

    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ oldPassword, newPassword }),
      });

      const data = await res.json();
      if (res.ok) {
        setPasswordMsg({ type: 'success', text: data.message || 'Password changed successfully.' });
        setOldPassword('');
        setNewPassword('');
      } else {
        setPasswordMsg({ type: 'error', text: data.message || 'Could not change password.' });
      }
    } catch (err: any) {
      setPasswordMsg({ type: 'error', text: err.message || 'Network error' });
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    const authToken =
      token || (typeof window !== 'undefined' ? localStorage.getItem('pdfforge_token') : null);
    if (!authToken) return;

    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleApplyCoupon = async () => {
    if (!couponCode) return;
    setApplyingCoupon(true);
    setCouponResult(null);

    try {
      const res = await fetch(`${API_BASE}/api/v1/billing/coupons/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode.trim(), tier: 'PRO' }),
      });
      const data = await res.json();
      if (res.ok) {
        setCouponResult({ success: true, ...data });
      } else {
        setCouponResult({ success: false, message: data.message || 'Invalid coupon code' });
      }
    } catch (err: any) {
      setCouponResult({ success: false, message: err.message || 'Failed to apply coupon' });
    } finally {
      setApplyingCoupon(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel your recurring subscription? You will retain access until the end of the billing period.')) {
      return;
    }

    const authToken =
      token || (typeof window !== 'undefined' ? localStorage.getItem('pdfforge_token') : null);
    if (!authToken) return;

    try {
      const res = await fetch(`${API_BASE}/api/v1/billing/subscription/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      alert(data.message || 'Subscription cancellation scheduled.');
      fetchDashboardData();
    } catch (err) {
      console.error(err);
    }
  };

  const formatFileSize = (bytes?: number | string | null) => {
    if (!bytes) return '0 KB';
    const num = Number(bytes);
    if (num < 1024) return `${num} B`;
    if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
    return `${(num / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="min-h-screen bg-[#fbfbfd] py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header Profile Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-200">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">
              Welcome back, {user?.name || (isAuthenticated ? 'Enterprise User' : 'Guest')}
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              Enterprise Dashboard &bull; Production Workspace &bull; Zero-Retention Guarantee
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              {user?.plan || 'PRO'} Plan
            </span>
            <button
              onClick={fetchDashboardData}
              className="p-2 rounded-full border border-zinc-200 hover:bg-zinc-100 text-zinc-600 transition-colors"
              title="Refresh telemetry"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <Link
              href="/pricing"
              className="text-xs font-medium px-4 py-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Upgrade Plan</span>
            </Link>
          </div>
        </div>

        {/* Top Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="p-5 rounded-2xl bg-white border border-zinc-200 shadow-sm">
            <div className="flex items-center justify-between text-zinc-500 mb-3">
              <span className="text-xs font-medium">Cloud Storage Quota</span>
              <HardDrive className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-bold text-zinc-900 mb-2">
              1.8 GB <span className="text-xs text-zinc-400 font-normal">/ 10.0 GB</span>
            </div>
            <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden">
              <div className="bg-blue-600 h-full rounded-full" style={{ width: '18%' }} />
            </div>
            <div className="text-[10px] text-zinc-400 mt-2">18% utilized &bull; AWS KMS Encrypted</div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-zinc-200 shadow-sm">
            <div className="flex items-center justify-between text-zinc-500 mb-3">
              <span className="text-xs font-medium">Conversions Today</span>
              <Activity className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold text-zinc-900 mb-2">
              {jobs.length} <span className="text-xs text-emerald-600 font-normal">/ Unlimited ({user?.plan || 'PRO'})</span>
            </div>
            <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden">
              <div className="bg-emerald-600 h-full rounded-full" style={{ width: '100%' }} />
            </div>
            <div className="text-[10px] text-zinc-400 mt-2">High-speed priority queue active</div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-zinc-200 shadow-sm">
            <div className="flex items-center justify-between text-zinc-500 mb-3">
              <span className="text-xs font-medium">Enterprise Security</span>
              <ShieldCheck className="w-4 h-4 text-purple-600" />
            </div>
            <div className="text-2xl font-bold text-zinc-900 mb-2">
              Active <span className="text-xs text-purple-600 font-normal">&bull; DoD 5220.22-M</span>
            </div>
            <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden">
              <div className="bg-purple-600 h-full rounded-full" style={{ width: '100%' }} />
            </div>
            <div className="text-[10px] text-zinc-400 mt-2">Ephemeral 24h retention policy active</div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-zinc-200 flex items-center gap-6 text-sm">
          <button
            onClick={() => setActiveTab('jobs')}
            className={`pb-3 font-semibold transition-colors flex items-center gap-2 border-b-2 ${
              activeTab === 'jobs'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-zinc-500 hover:text-zinc-900'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Processing History ({jobs.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('subscription')}
            className={`pb-3 font-semibold transition-colors flex items-center gap-2 border-b-2 ${
              activeTab === 'subscription'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-zinc-500 hover:text-zinc-900'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Subscription & Billing</span>
          </button>

          <button
            onClick={() => setActiveTab('keys')}
            className={`pb-3 font-semibold transition-colors flex items-center gap-2 border-b-2 ${
              activeTab === 'keys'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-zinc-500 hover:text-zinc-900'
            }`}
          >
            <Key className="w-4 h-4" />
            <span>Developer API Keys ({apiKeys.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`pb-3 font-semibold transition-colors flex items-center gap-2 border-b-2 ${
              activeTab === 'security'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-zinc-500 hover:text-zinc-900'
            }`}
          >
            <Lock className="w-4 h-4" />
            <span>Security & Sessions</span>
          </button>
        </div>

        {/* TAB 1: Processing Jobs History */}
        {activeTab === 'jobs' && (
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-semibold text-zinc-900">Recent Processing Jobs</h3>
                <p className="text-xs text-zinc-500">
                  Ephemeral retention: files automatically purge 24 hours after completion
                </p>
              </div>
              <Link
                href="/#tools"
                className="text-xs font-semibold px-3.5 py-1.5 rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors flex items-center gap-1"
              >
                + New Document Job
              </Link>
            </div>

            <div className="border border-zinc-100 rounded-xl overflow-hidden overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 border-b border-zinc-100 text-zinc-500 font-medium">
                  <tr>
                    <th className="py-3 px-4">Document / Payload</th>
                    <th className="py-3 px-4">Tool</th>
                    <th className="py-3 px-4">Output Size</th>
                    <th className="py-3 px-4">Duration</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-zinc-700">
                  {jobs.length > 0 ? (
                    jobs.map((job) => {
                      const docName =
                        Array.isArray(job.inputFilesPayload) && job.inputFilesPayload[0]?.name
                          ? job.inputFilesPayload[0].name
                          : `Job_${job.id.slice(0, 8)}.pdf`;

                      return (
                        <tr key={job.id} className="hover:bg-zinc-50/50">
                          <td className="py-3 px-4 font-medium text-zinc-900 flex items-center gap-2">
                            <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                            <span className="truncate max-w-[200px]">{docName}</span>
                          </td>
                          <td className="py-3 px-4 text-zinc-600 uppercase font-mono text-[11px]">
                            {job.tool}
                          </td>
                          <td className="py-3 px-4 text-zinc-500 font-mono text-[11px]">
                            {formatFileSize(job.outputFileSizeBytes)}
                          </td>
                          <td className="py-3 px-4 text-zinc-500">
                            {job.durationMs ? `${job.durationMs}ms` : 'Instant'}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                job.status === 'COMPLETED'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : job.status === 'FAILED'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {job.status === 'COMPLETED' && <CheckCircle2 className="w-3 h-3" />}
                              {job.status === 'FAILED' && <AlertCircle className="w-3 h-3" />}
                              {job.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {job.status === 'COMPLETED' && (
                                <a
                                  href={`${API_BASE}/api/v1/pdf/jobs/${job.id}/download`}
                                  download
                                  className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                                  title="Download processed document"
                                >
                                  <Download className="w-3.5 h-3.5" /> Download
                                </a>
                              )}
                              {job.status === 'FAILED' && (
                                <button
                                  onClick={() => handleRetryJob(job.id)}
                                  className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-md bg-amber-50 text-amber-800 hover:bg-amber-100 transition-colors"
                                  title="Retry failed conversion"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" /> Retry
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-zinc-400">
                        No processing jobs yet. Upload a document from any tool to get started.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: Subscription & Billing */}
        {activeTab === 'subscription' && (
          <div className="space-y-6">
            {/* Active Subscription Details */}
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wide">
                  Active Subscription
                </span>
                <h3 className="text-xl font-bold text-zinc-900 mt-2">
                  PDFForge AI {user?.plan || 'PRO'} Tier
                </h3>
                <p className="text-xs text-zinc-500 mt-1">
                  Enjoy unlimited daily conversions, OCR, 500MB+ file uploads, and full document intelligence.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <a
                  href={`${API_BASE}/api/v1/billing/invoice/download`}
                  className="px-4 py-2 rounded-xl border border-zinc-200 text-zinc-700 text-xs font-semibold hover:bg-zinc-50 transition flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" /> Download Latest Tax Invoice
                </a>
                <button
                  onClick={handleCancelSubscription}
                  className="px-4 py-2 rounded-xl border border-rose-200 text-rose-600 text-xs font-semibold hover:bg-rose-50 transition"
                >
                  Cancel Plan
                </button>
              </div>
            </div>

            {/* Promo Code & Coupon Redemption */}
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6">
              <h3 className="text-base font-semibold text-zinc-900 mb-1 flex items-center gap-2">
                <Tag className="w-4 h-4 text-blue-600" /> Redeem Promotional Coupon
              </h3>
              <p className="text-xs text-zinc-500 mb-4">
                Have a coupon code? Enter it below to unlock instant discounts on your next billing cycle.
              </p>

              <div className="flex items-center gap-3 max-w-md">
                <input
                  type="text"
                  placeholder="e.g. WELCOME50 or PRO2026"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono"
                />
                <button
                  onClick={handleApplyCoupon}
                  disabled={applyingCoupon || !couponCode}
                  className="px-5 py-2.5 rounded-xl bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 transition disabled:opacity-50 whitespace-nowrap"
                >
                  {applyingCoupon ? 'Checking...' : 'Apply Code'}
                </button>
              </div>

              {couponResult && (
                <div
                  className={`mt-3 p-3 rounded-xl text-xs flex items-center gap-2 ${
                    couponResult.success
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {couponResult.success ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        {couponResult.message} &bull; Final price: ${couponResult.finalAmount} (was ${couponResult.originalAmount})
                      </span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{couponResult.message}</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Payment History */}
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6">
              <h3 className="text-base font-semibold text-zinc-900 mb-1">Payment Transactions & History</h3>
              <p className="text-xs text-zinc-500 mb-4">
                Transactions processed across Stripe, Razorpay, and PayPal
              </p>

              <div className="border border-zinc-100 rounded-xl overflow-hidden overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-50 border-b border-zinc-100 text-zinc-500 font-medium">
                    <tr>
                      <th className="py-3 px-4">Transaction ID</th>
                      <th className="py-3 px-4">Provider</th>
                      <th className="py-3 px-4">Amount</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 text-zinc-700">
                    {payments.length > 0 ? (
                      payments.map((p) => (
                        <tr key={p.id}>
                          <td className="py-3 px-4 font-mono text-[11px] text-zinc-900">{p.id.slice(0, 12)}...</td>
                          <td className="py-3 px-4 uppercase font-semibold text-zinc-600">{p.provider}</td>
                          <td className="py-3 px-4 font-semibold text-zinc-900">${p.amount} {p.currency}</td>
                          <td className="py-3 px-4">
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {p.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right text-zinc-500">
                            {new Date(p.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-zinc-400">
                          No previous payment records found on this account.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Developer API Keys */}
        {activeTab === 'keys' && (
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-semibold text-zinc-900">Developer API Keys</h3>
                <p className="text-xs text-zinc-500">
                  Authenticate your backend services and scripts with 120 RPM rate limits
                </p>
              </div>
              <button
                onClick={handleGenerateApiKey}
                disabled={keyGenerating}
                className="text-xs font-semibold px-3.5 py-1.5 rounded-full bg-zinc-900 text-white hover:bg-zinc-800 transition flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Generate New Key
              </button>
            </div>

            {createdPlainKey && (
              <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                <div className="font-semibold mb-1 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-600" /> Store Your API Key Now
                </div>
                <p className="mb-2 text-[11px] text-amber-800">
                  This key will never be shown again. Copy it to your environment variables:
                </p>
                <div className="flex items-center gap-2">
                  <code className="p-2 rounded bg-white border border-amber-200 font-mono text-[11px] flex-1 break-all">
                    {createdPlainKey}
                  </code>
                  <button
                    onClick={() => handleCopy(createdPlainKey, 'new')}
                    className="px-3 py-1.5 rounded bg-amber-600 text-white font-semibold hover:bg-amber-700 transition"
                  >
                    {copiedKey === 'new' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            )}

            <div className="border border-zinc-100 rounded-xl overflow-hidden overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 border-b border-zinc-100 text-zinc-500 font-medium">
                  <tr>
                    <th className="py-3 px-4">Name</th>
                    <th className="py-3 px-4">Prefix</th>
                    <th className="py-3 px-4">Rate Limit</th>
                    <th className="py-3 px-4">Created</th>
                    <th className="py-3 px-4 text-right">Revoke</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-zinc-700">
                  {apiKeys.length > 0 ? (
                    apiKeys.map((key) => (
                      <tr key={key.id}>
                        <td className="py-3 px-4 font-semibold text-zinc-900">{key.name}</td>
                        <td className="py-3 px-4 font-mono text-zinc-600">{key.keyPrefix}...</td>
                        <td className="py-3 px-4 text-zinc-500">{key.rateLimitRpm} req/min</td>
                        <td className="py-3 px-4 text-zinc-500">{new Date(key.createdAt).toLocaleDateString()}</td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleRevokeApiKey(key.id)}
                            className="text-rose-600 hover:text-rose-800 font-semibold p-1 hover:bg-rose-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-zinc-400">
                        No active developer keys. Click Generate New Key above to start.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: Security & Active Sessions */}
        {activeTab === 'security' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Change Password Form */}
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6">
              <h3 className="text-base font-semibold text-zinc-900 mb-1 flex items-center gap-2">
                <Lock className="w-4 h-4 text-blue-600" /> Change Account Password
              </h3>
              <p className="text-xs text-zinc-500 mb-4">
                Update your local authentication credentials with minimum 8 characters.
              </p>

              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Current Password</label>
                  <input
                    type="password"
                    required
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">New Password</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                {passwordMsg && (
                  <div
                    className={`p-3 rounded-xl text-xs ${
                      passwordMsg.type === 'success'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}
                  >
                    {passwordMsg.text}
                  </div>
                )}

                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 transition"
                >
                  Update Password
                </button>
              </form>
            </div>

            {/* Active Sessions List */}
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6">
              <h3 className="text-base font-semibold text-zinc-900 mb-1 flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-purple-600" /> Active Logged-in Sessions
              </h3>
              <p className="text-xs text-zinc-500 mb-4">
                Devices currently authenticated into this workspace.
              </p>

              <div className="space-y-3">
                {sessions.length > 0 ? (
                  sessions.map((sess) => (
                    <div
                      key={sess.id}
                      className="p-3.5 rounded-xl border border-zinc-100 bg-zinc-50 flex items-center justify-between"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="text-xs font-semibold text-zinc-900 truncate">
                          {sess.userAgent?.split(' ')[0] || 'Browser Session'}
                        </div>
                        <div className="text-[10px] text-zinc-500 mt-0.5">
                          IP: {sess.ipAddress || '127.0.0.1'} &bull; Active: {new Date(sess.lastActiveAt).toLocaleTimeString()}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRevokeSession(sess.id)}
                        className="text-xs font-semibold px-2.5 py-1 rounded bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 transition"
                      >
                        Revoke
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="py-6 text-center text-xs text-zinc-400">
                    Current active session is validated.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
