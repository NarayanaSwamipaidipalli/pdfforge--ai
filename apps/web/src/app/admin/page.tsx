'use client';

import React, { useState } from 'react';
import {
  Activity,
  Users,
  DollarSign,
  HardDrive,
  ShieldAlert,
  Server,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  FileCheck2,
  Search,
  Filter,
} from 'lucide-react';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'queues' | 'audit'>('overview');

  const systemMetrics = {
    totalUsers: '24,891',
    mrr: '$48,920',
    filesToday: '184,290',
    avgQueueLatencyMs: 142,
    clusterHealth: '100% OPERATIONAL',
    activeWorkerNodes: 12,
  };

  const usersList = [
    {
      id: 'u1',
      name: 'David K. Vance',
      email: 'd.vance@venturelaw.com',
      plan: 'BUSINESS',
      conversions: 1429,
      status: 'ACTIVE',
      joined: '2026-06-12',
    },
    {
      id: 'u2',
      name: 'Sarah Jenkins',
      email: 'sjenkins@globaltech.io',
      plan: 'PRO',
      conversions: 890,
      status: 'ACTIVE',
      joined: '2026-07-04',
    },
    {
      id: 'u3',
      name: 'Anon Bot Crawler',
      email: 'crawler_99@tempmail.org',
      plan: 'FREE',
      conversions: 10,
      status: 'FLAGGED_ABUSE',
      joined: 'Today',
    },
  ];

  const queues = [
    { name: 'queue_enterprise', active: 18, waiting: 0, failed: 0, latency: '22ms', sla: '100%' },
    { name: 'queue_pro', active: 64, waiting: 3, failed: 1, latency: '85ms', sla: '99.9%' },
    { name: 'queue_free', active: 140, waiting: 22, failed: 4, latency: '340ms', sla: '98.5%' },
  ];

  const auditLogs = [
    {
      id: 'log_1',
      action: 'API_KEY_REVOKED',
      user: 'alex.morgan@enterprise.com',
      ip: '198.51.100.4',
      time: '14 mins ago',
    },
    {
      id: 'log_2',
      action: 'SUSPICIOUS_RATE_LIMIT_TRIGGERED',
      user: 'crawler_99@tempmail.org',
      ip: '203.0.113.88',
      time: '32 mins ago',
    },
    {
      id: 'log_3',
      action: 'SUBSCRIPTION_UPGRADED_BUSINESS',
      user: 'd.vance@venturelaw.com',
      ip: '192.0.2.14',
      time: '2 hours ago',
    },
  ];

  return (
    <div className="min-h-screen bg-[#fbfbfd] py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-200">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">
                Enterprise Admin Observatory
              </h1>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Live Telemetry
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              Real-time multi-tenant health, Celery cluster metrics, revenue telemetry, and audit logs
            </p>
          </div>

          <div className="flex items-center gap-2 bg-zinc-100 p-1 rounded-full border border-zinc-200">
            {['overview', 'users', 'queues', 'audit'].map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t as any)}
                className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-all ${
                  activeTab === t
                    ? 'bg-white text-zinc-900 shadow-sm'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Tab 1: Overview Telemetry */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* 4 Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="p-5 rounded-2xl bg-white border border-zinc-200 shadow-sm">
                <div className="flex items-center justify-between text-zinc-500 mb-2">
                  <span className="text-xs font-medium">Monthly Recurring Revenue</span>
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-bold text-zinc-900">{systemMetrics.mrr}</div>
                <div className="text-[10px] text-emerald-600 font-medium mt-1">
                  +18.4% from last month
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-white border border-zinc-200 shadow-sm">
                <div className="flex items-center justify-between text-zinc-500 mb-2">
                  <span className="text-xs font-medium">Total Registered Users</span>
                  <Users className="w-4 h-4 text-blue-600" />
                </div>
                <div className="text-2xl font-bold text-zinc-900">{systemMetrics.totalUsers}</div>
                <div className="text-[10px] text-zinc-500 mt-1">Across 3,420 organizations</div>
              </div>

              <div className="p-5 rounded-2xl bg-white border border-zinc-200 shadow-sm">
                <div className="flex items-center justify-between text-zinc-500 mb-2">
                  <span className="text-xs font-medium">Queue Latency (P95)</span>
                  <Activity className="w-4 h-4 text-violet-600" />
                </div>
                <div className="text-2xl font-bold text-zinc-900">
                  {systemMetrics.avgQueueLatencyMs} ms
                </div>
                <div className="text-[10px] text-zinc-500 mt-1">SLA target &lt; 200 ms</div>
              </div>

              <div className="p-5 rounded-2xl bg-white border border-zinc-200 shadow-sm">
                <div className="flex items-center justify-between text-zinc-500 mb-2">
                  <span className="text-xs font-medium">Active Worker Nodes</span>
                  <Server className="w-4 h-4 text-cyan-600" />
                </div>
                <div className="text-2xl font-bold text-zinc-900">
                  {systemMetrics.activeWorkerNodes}
                </div>
                <div className="text-[10px] text-emerald-600 mt-1">EKS Auto-scaler standing by</div>
              </div>
            </div>

            {/* Worker Queues Summary */}
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6">
              <h3 className="text-sm font-semibold text-zinc-900 mb-4">
                Celery Distributed Queue Backlogs
              </h3>

              <div className="border border-zinc-100 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-50 border-b border-zinc-100 text-zinc-500 font-medium">
                    <tr>
                      <th className="py-2.5 px-4">Queue Name</th>
                      <th className="py-2.5 px-4 text-center">Active Jobs</th>
                      <th className="py-2.5 px-4 text-center">Waiting</th>
                      <th className="py-2.5 px-4 text-center">Failed (24h)</th>
                      <th className="py-2.5 px-4 text-center">P95 Latency</th>
                      <th className="py-2.5 px-4 text-right">SLA Uptime</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 text-zinc-700">
                    {queues.map((q, i) => (
                      <tr key={i}>
                        <td className="py-3 px-4 font-mono font-medium text-zinc-900">{q.name}</td>
                        <td className="py-3 px-4 text-center font-semibold text-blue-600">
                          {q.active}
                        </td>
                        <td className="py-3 px-4 text-center text-zinc-600">{q.waiting}</td>
                        <td className="py-3 px-4 text-center text-rose-600">{q.failed}</td>
                        <td className="py-3 px-4 text-center text-zinc-600 font-mono">
                          {q.latency}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-emerald-600">
                          {q.sla}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: User Moderation & Quota Override */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-zinc-900 mb-4">
              User Accounts & Quotas
            </h3>

            <div className="border border-zinc-100 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 border-b border-zinc-100 text-zinc-500 font-medium">
                  <tr>
                    <th className="py-2.5 px-4">User</th>
                    <th className="py-2.5 px-4">Plan Tier</th>
                    <th className="py-2.5 px-4">Conversions</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4 text-right">Moderation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-zinc-700">
                  {usersList.map((u) => (
                    <tr key={u.id}>
                      <td className="py-3 px-4">
                        <div className="font-medium text-zinc-900">{u.name}</div>
                        <div className="text-[11px] text-zinc-400">{u.email}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700">
                          {u.plan}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono">{u.conversions}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            u.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {u.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button className="text-zinc-600 hover:text-zinc-900 text-[11px] font-medium mr-3">
                          Reset Quota
                        </button>
                        <button className="text-rose-600 hover:text-rose-800 text-[11px] font-medium">
                          Ban
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Security & Audit Trail */}
        {activeTab === 'audit' && (
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-zinc-900 mb-4">
              Platform Security Audit Trail
            </h3>

            <div className="space-y-3">
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3.5 rounded-xl border border-zinc-200 bg-zinc-50/50 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-3">
                    <ShieldAlert
                      className={`w-4 h-4 ${
                        log.action.includes('SUSPICIOUS')
                          ? 'text-rose-600'
                          : 'text-blue-600'
                      }`}
                    />
                    <div>
                      <span className="font-mono font-semibold text-zinc-900">
                        {log.action}
                      </span>{' '}
                      – <span className="text-zinc-600">{log.user}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-zinc-400 text-[11px]">
                    <span className="font-mono">{log.ip}</span>
                    <span>{log.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
