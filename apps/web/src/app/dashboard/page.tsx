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
}

interface ApiKeyItem {
  id: string;
  name: string;
  keyPrefix: string;
  rateLimitRpm: number;
  lastUsedAt: string | null;
  createdAt: string;
}

export default function DashboardPage() {
  const { user, token, isAuthenticated, syncProfile } = useAuthStore();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [createdPlainKey, setCreatedPlainKey] = useState<string | null>(null);

  const [jobs, setJobs] = useState<UserJob[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyGenerating, setKeyGenerating] = useState(false);

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

      // 2. Fetch User API Keys
      const keysRes = await fetch(`${API_BASE}/api/v1/auth/api-keys`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (keysRes.ok) {
        const keysData = await keysRes.json();
        setApiKeys(keysData || []);
      }

      // 3. Sync User Profile details
      await syncProfile();
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
        body: JSON.stringify({ name: keyName }),
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
              Enterprise Dashboard · Personal & Team Workspace
            </p>
          </div>

          <div className="flex items-center gap-3">
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
              className="text-xs font-medium px-4 py-2 rounded-full bg-zinc-900 text-white hover:bg-zinc-800 transition-colors shadow-sm"
            >
              Upgrade Subscription
            </Link>
          </div>
        </div>

        {/* Top Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {/* Storage Quota */}
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
            <div className="text-[10px] text-zinc-400 mt-2">18% utilized · AWS KMS Encrypted</div>
          </div>

          {/* Daily Conversions */}
          <div className="p-5 rounded-2xl bg-white border border-zinc-200 shadow-sm">
            <div className="flex items-center justify-between text-zinc-500 mb-3">
              <span className="text-xs font-medium">Conversions Today</span>
              <Activity className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold text-zinc-900 mb-2">
              {jobs.length > 0 ? jobs.length : 24} <span className="text-xs text-emerald-600 font-normal">/ Unlimited ({user?.plan || 'PRO'})</span>
            </div>
            <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden">
              <div className="bg-emerald-600 h-full rounded-full" style={{ width: '100%' }} />
            </div>
            <div className="text-[10px] text-zinc-400 mt-2">High-speed priority queue active</div>
          </div>

          {/* AI Tokens & RAG Queries */}
          <div className="p-5 rounded-2xl bg-white border border-zinc-200 shadow-sm">
            <div className="flex items-center justify-between text-zinc-500 mb-3">
              <span className="text-xs font-medium">AI Document Intelligence</span>
              <ShieldCheck className="w-4 h-4 text-violet-600" />
            </div>
            <div className="text-2xl font-bold text-zinc-900 mb-2">
              348 <span className="text-xs text-zinc-400 font-normal">/ 500 Queries</span>
            </div>
            <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden">
              <div className="bg-violet-600 h-full rounded-full" style={{ width: '69%' }} />
            </div>
            <div className="text-[10px] text-zinc-400 mt-2">Resets on 1st of next month</div>
          </div>
        </div>

        {/* Real Processing History Table */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-base font-semibold text-zinc-900">
                Recent Processing Jobs
              </h3>
              <p className="text-xs text-zinc-500">
                Ephemeral retention: files automatically purge 24 hours after completion
              </p>
            </div>
            <Link
              href="/#tools"
              className="text-xs font-medium text-blue-600 hover:underline flex items-center gap-1"
            >
              + New Job
            </Link>
          </div>

          <div className="border border-zinc-100 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 border-b border-zinc-100 text-zinc-500 font-medium">
                <tr>
                  <th className="py-3 px-4">Document / Payload</th>
                  <th className="py-3 px-4">Operation</th>
                  <th className="py-3 px-4">Output Size</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Download</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-zinc-700">
                {jobs.length > 0 ? (
                  jobs.map((job) => {
                    const docName =
                      Array.isArray(job.inputFilesPayload) && job.inputFilesPayload[0]?.originalName
                        ? job.inputFilesPayload[0].originalName
                        : `Job_${job.id.slice(0, 8)}.pdf`;

                    return (
                      <tr key={job.id} className="hover:bg-zinc-50/50">
                        <td className="py-3 px-4 font-medium text-zinc-900 flex items-center gap-2">
                          <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                          <span className="truncate max-w-[220px]">{docName}</span>
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
                                ? 'bg-emerald-50 text-emerald-700'
                                : job.status === 'FAILED'
                                ? 'bg-rose-50 text-rose-700'
                                : 'bg-amber-50 text-amber-700'
                            }`}
                          >
                            <CheckCircle2 className="w-3 h-3" /> {job.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <a
                            href={`${API_BASE}/api/v1/pdf/jobs/${job.id}/download`}
                            download
                            className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium p-1 hover:bg-blue-50 rounded"
                            title="Download processed document"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-zinc-400">
                      No jobs recorded yet. Process your first document in the{' '}
                      <Link href="/#tools" className="text-blue-600 underline">
                        Tools Catalog
                      </Link>
                      .
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Developer API Keys Management */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-zinc-900">
                Developer API Access Keys
              </h3>
              <p className="text-xs text-zinc-500">
                Use these tokens for programmatic REST and microservice automation
              </p>
            </div>
            <button
              onClick={handleGenerateApiKey}
              disabled={keyGenerating}
              className="px-3 py-1.5 rounded-full bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-800 transition-colors flex items-center gap-1 disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" /> {keyGenerating ? 'Generating...' : 'Generate New API Key'}
            </button>
          </div>

          {/* Alert displaying newly created plain API key */}
          {createdPlainKey && (
            <div className="mb-4 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
              <div className="font-semibold flex items-center gap-1.5 mb-1 text-amber-900">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span>Save your API Key now!</span>
              </div>
              <p className="text-[11px] mb-2">
                This secret will not be displayed again. Store it securely in your secret manager or environment variables.
              </p>
              <div className="flex items-center gap-2">
                <code className="bg-white px-2 py-1 rounded border border-amber-300 font-mono text-[11px] select-all flex-1">
                  {createdPlainKey}
                </code>
                <button
                  onClick={() => handleCopy(createdPlainKey, 'new_created')}
                  className="px-2 py-1 rounded bg-amber-200 hover:bg-amber-300 font-semibold text-[11px] transition-colors"
                >
                  {copiedKey === 'new_created' ? 'Copied!' : 'Copy Key'}
                </button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {apiKeys.length > 0 ? (
              apiKeys.map((k) => (
                <div
                  key={k.id}
                  className="flex items-center justify-between p-4 rounded-xl border border-zinc-200 bg-zinc-50/50 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-zinc-200 flex items-center justify-center text-zinc-700">
                      <Key className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-semibold text-zinc-900">{k.name}</div>
                      <div className="text-[11px] font-mono text-zinc-500">
                        {k.keyPrefix}••••••••••••••••••••••••
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-zinc-400">
                      Rate limit: {k.rateLimitRpm || 120} req/min
                    </span>
                    <button
                      onClick={() => handleCopy(`${k.keyPrefix}_************************`, k.id)}
                      className="p-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-100 text-zinc-600 transition-colors"
                      title="Copy Key Prefix"
                    >
                      {copiedKey === k.id ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleRevokeApiKey(k.id)}
                      className="p-1.5 rounded-lg border border-zinc-200 hover:bg-rose-50 text-rose-600 transition-colors"
                      title="Revoke API Key"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-6 text-center text-zinc-400 text-xs border border-dashed border-zinc-200 rounded-xl">
                No active API keys found. Click "Generate New API Key" above to integrate PDFForge with your CI/CD pipelines.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
