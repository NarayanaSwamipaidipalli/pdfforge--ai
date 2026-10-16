'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/auth-store';
import {
  FileText,
  Download,
  Trash2,
  Key,
  CreditCard,
  HardDrive,
  Activity,
  Plus,
  Copy,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [copiedKey, setCopiedKey] = useState(false);
  const [apiKeys, setApiKeys] = useState([
    {
      id: 'key_1',
      name: 'Production Worker Key',
      prefix: 'pdf_live_9a',
      created: '2026-10-01',
      lastUsed: '12 mins ago',
    },
  ]);

  const recentJobs = [
    {
      id: 'job_88192a',
      name: 'Quarterly_Financial_Report_Q3.pdf',
      tool: 'Compress PDF',
      status: 'COMPLETED',
      sizeOriginal: '18.4 MB',
      sizeProcessed: '3.9 MB',
      date: 'Today at 4:15 PM',
    },
    {
      id: 'job_88192b',
      name: 'Merger_Acquisition_Contract.pdf',
      tool: 'AI Contract Audit',
      status: 'COMPLETED',
      sizeOriginal: '4.2 MB',
      sizeProcessed: 'Report Generated',
      date: 'Today at 2:30 PM',
    },
    {
      id: 'job_88192c',
      name: 'Supplier_Invoices_Batch.zip',
      tool: 'Merge & OCR',
      status: 'COMPLETED',
      sizeOriginal: '45.1 MB',
      sizeProcessed: '12.8 MB',
      date: 'Yesterday',
    },
  ];

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#fbfbfd] py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header Profile Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-200">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">
              Welcome back, {user?.name || 'Alex'}
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              Enterprise Dashboard · Personal & Team Workspace
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              {user?.plan || 'PRO'} Plan
            </span>
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
              42 <span className="text-xs text-emerald-600 font-normal">/ Unlimited (Pro)</span>
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

        {/* Recent Processing History Table */}
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
                  <th className="py-3 px-4">Document</th>
                  <th className="py-3 px-4">Operation</th>
                  <th className="py-3 px-4">Original → Processed</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-zinc-700">
                {recentJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-zinc-50/50">
                    <td className="py-3 px-4 font-medium text-zinc-900 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-zinc-400" />
                      <span>{job.name}</span>
                    </td>
                    <td className="py-3 px-4 text-zinc-600">{job.tool}</td>
                    <td className="py-3 px-4 text-zinc-500 font-mono text-[11px]">
                      {job.sizeOriginal} → {job.sizeProcessed}
                    </td>
                    <td className="py-3 px-4 text-zinc-500">{job.date}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                        <CheckCircle2 className="w-3 h-3" /> {job.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button className="text-blue-600 hover:text-blue-800 font-medium p-1">
                        <Download className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
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
                Use these tokens for programmatic REST and GraphQL microservice automation
              </p>
            </div>
            <button className="px-3 py-1.5 rounded-full bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-800 transition-colors flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Generate New API Key
            </button>
          </div>

          <div className="space-y-3">
            {apiKeys.map((k) => (
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
                      {k.prefix}••••••••••••••••••••••••
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-zinc-400">Last used: {k.lastUsed}</span>
                  <button
                    onClick={() => handleCopyKey('pdf_live_9a87f10b83e4499d91f2e1320491a0c8')}
                    className="p-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-100 text-zinc-600 transition-colors"
                  >
                    {copiedKey ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                  <button className="p-1.5 rounded-lg border border-zinc-200 hover:bg-rose-50 text-rose-600 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
