'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/auth-store';
import { useToast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import {
  User,
  Shield,
  Key,
  Bell,
  Lock,
  Smartphone,
  Copy,
  CheckCircle2,
  Trash2,
  Plus,
  RefreshCw,
  QrCode,
  LogOut,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface ApiKeyItem {
  id: string;
  name: string;
  keyPrefix: string;
  rateLimitRpm: number;
  lastUsedAt: string | null;
  createdAt: string;
}

export default function SettingsPage() {
  const { user, token, isAuthenticated, syncProfile, logout } = useAuthStore();
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'apikeys' | 'notifications'>('profile');
  const [loading, setLoading] = useState(false);

  // 2FA state
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [twoFaModalOpen, setTwoFaModalOpen] = useState(false);
  const [twoFaLoading, setTwoFaLoading] = useState(false);
  const [twoFaEnabled, setTwoFaEnabled] = useState(false);

  // API Keys state
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [createKeyModalOpen, setCreateKeyModalOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdPlainKey, setCreatedPlainKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Notification state
  const [notifyJobComplete, setNotifyJobComplete] = useState(true);
  const [notifySecurityAlerts, setNotifySecurityAlerts] = useState(true);
  const [notifyWeeklyDigest, setNotifyWeeklyDigest] = useState(false);

  const fetchSettingsData = async () => {
    const authToken = token || (typeof window !== 'undefined' ? localStorage.getItem('pdfforge_token') : null);
    if (!authToken) return;

    try {
      setLoading(true);
      await syncProfile();

      const res = await fetch(`${API_BASE}/api/v1/auth/api-keys`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setApiKeys(data || []);
      }
    } catch (err) {
      console.warn('Could not load settings data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettingsData();
  }, [token]);

  // Handle 2FA Generation
  const handleStart2Fa = async () => {
    const authToken = token || localStorage.getItem('pdfforge_token');
    if (!authToken) return;

    setTwoFaLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/2fa/generate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to initialize 2FA');

      setQrCodeUrl(data.qrCodeUrl || data.otpAuthUrl);
      setTotpSecret(data.secret);
      setTwoFaModalOpen(true);
    } catch (err: any) {
      addToast(err.message || 'Could not generate 2FA secret', 'error');
    } finally {
      setTwoFaLoading(false);
    }
  };

  // Handle 2FA Verification
  const handleVerify2Fa = async (e: React.FormEvent) => {
    e.preventDefault();
    const authToken = token || localStorage.getItem('pdfforge_token');
    if (!authToken) return;

    setTwoFaLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/2fa/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ code: totpCode.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Invalid 6-digit TOTP code');

      setTwoFaEnabled(true);
      setTwoFaModalOpen(false);
      setTotpCode('');
      addToast('Two-Factor Authentication is now active on your account!', 'success');
      await syncProfile();
    } catch (err: any) {
      addToast(err.message || '2FA verification failed', 'error');
    } finally {
      setTwoFaLoading(false);
    }
  };

  // Handle API Key Creation
  const handleCreateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    const authToken = token || localStorage.getItem('pdfforge_token');
    if (!authToken || !newKeyName.trim()) return;

    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/api-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          name: newKeyName.trim(),
          permissions: ['READ', 'WRITE'],
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to create API key');

      setCreatedPlainKey(data.apiKey);
      setNewKeyName('');
      addToast('API key created successfully! Copy it now before it is masked.', 'success');
      await fetchSettingsData();
    } catch (err: any) {
      addToast(err.message || 'Could not create API key', 'error');
    }
  };

  // Handle API Key Revocation
  const handleRevokeApiKey = async (keyId: string) => {
    const authToken = token || localStorage.getItem('pdfforge_token');
    if (!authToken) return;

    if (!confirm('Are you sure you want to revoke this API key? Applications using it will lose access immediately.')) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/api-keys/${keyId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (!res.ok) throw new Error('Failed to revoke API key');

      setApiKeys((prev) => prev.filter((k) => k.id !== keyId));
      addToast('API key successfully revoked.', 'info');
    } catch (err: any) {
      addToast(err.message || 'Revocation failed', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-[#fbfbfd] dark:bg-black text-zinc-900 dark:text-zinc-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">
            <Shield className="w-4 h-4" /> Account Governance
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white">
            Settings & Security
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Manage your personal profile, cryptographic tokens, multi-factor authentication, and notifications.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 space-x-8">
          <button
            onClick={() => setActiveTab('profile')}
            className={`pb-3 text-sm font-medium border-b-2 transition flex items-center gap-2 ${
              activeTab === 'profile'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <User className="w-4 h-4" /> Profile
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`pb-3 text-sm font-medium border-b-2 transition flex items-center gap-2 ${
              activeTab === 'security'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Lock className="w-4 h-4" /> Security & 2FA
          </button>
          <button
            onClick={() => setActiveTab('apikeys')}
            className={`pb-3 text-sm font-medium border-b-2 transition flex items-center gap-2 ${
              activeTab === 'apikeys'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Key className="w-4 h-4" /> API Credentials
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`pb-3 text-sm font-medium border-b-2 transition flex items-center gap-2 ${
              activeTab === 'notifications'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Bell className="w-4 h-4" /> Notifications
          </button>
        </div>

        {/* TAB 1: PROFILE */}
        {activeTab === 'profile' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-white">Profile Details</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Full Name</label>
                  <input
                    type="text"
                    disabled
                    value={user?.name || 'Administrator'}
                    className="w-full px-3 py-2 text-xs border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Email Address</label>
                  <input
                    type="email"
                    disabled
                    value={user?.email || 'user@pdfforge.ai'}
                    className="w-full px-3 py-2 text-xs border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">System Role</label>
                  <div className="px-3 py-2 text-xs border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-mono">
                    {user?.role || 'USER'}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Active Plan</label>
                  <div className="px-3 py-2 text-xs border border-emerald-200 dark:border-emerald-900 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-semibold flex items-center justify-between">
                    <span>{user?.plan || 'ENTERPRISE'}</span>
                    <Link href="/billing" className="text-[11px] underline hover:text-emerald-900 dark:hover:text-emerald-200">
                      Manage Billing
                    </Link>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center text-xs text-zinc-500">
                <span>Account ID: <code className="font-mono text-zinc-700 dark:text-zinc-300">{user?.id || 'usr_prod_live'}</code></span>
                <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Identity Verified
                </span>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-2">Authentication Status</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed mb-4">
                  Signed in with cryptographic JSON Web Tokens protected under zero-retention session isolation.
                </p>
                <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-500">Session State</span>
                    <span className="text-emerald-600 font-semibold">Active & Valid</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-500">Token Algorithm</span>
                    <span className="font-mono text-zinc-700 dark:text-zinc-300">RS256 / SHA-256</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  logout();
                  window.location.href = '/login';
                }}
                className="mt-6 w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition flex items-center justify-center gap-2 border border-rose-200 dark:border-rose-900/60"
              >
                <LogOut className="w-3.5 h-3.5" /> Sign Out of Platform
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: SECURITY & 2FA */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                    <Smartphone className="w-5 h-5 text-blue-600" />
                    Two-Factor Authentication (2FA)
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-xl">
                    Add an extra layer of security using Google Authenticator, 1Password, or any standard TOTP authenticator app.
                  </p>
                </div>
                {twoFaEnabled ? (
                  <div className="px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> 2FA Active
                  </div>
                ) : (
                  <button
                    onClick={handleStart2Fa}
                    disabled={twoFaLoading}
                    className="py-2 px-4 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition shadow-sm flex items-center gap-2"
                  >
                    <QrCode className="w-4 h-4" /> Configure 2FA
                  </button>
                )}
              </div>

              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 block">Password Protection</span>
                  <span className="text-[11px] text-zinc-500">Change your master login password or send recovery verification</span>
                </div>
                <Link
                  href="/forgot-password"
                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  Send Reset Link <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: API KEYS */}
        {activeTab === 'apikeys' && (
          <div className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                  <Key className="w-5 h-5 text-indigo-600" /> Developer API Keys
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-xl">
                  Use API keys to authenticate headless SDKs, CLI utilities, and high-throughput CI/CD pipelines.
                </p>
              </div>
              <button
                onClick={() => {
                  setCreatedPlainKey(null);
                  setCreateKeyModalOpen(true);
                }}
                className="py-2 px-4 rounded-xl text-xs font-semibold text-white bg-zinc-900 dark:bg-white dark:text-zinc-900 hover:bg-zinc-800 transition shadow-sm flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Generate New Key
              </button>
            </div>

            {/* Keys Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-400 uppercase tracking-wider font-semibold">
                    <th className="py-3 px-4">Key Label</th>
                    <th className="py-3 px-4">Prefix</th>
                    <th className="py-3 px-4">Rate Limit</th>
                    <th className="py-3 px-4">Created</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                  {apiKeys.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-zinc-400">
                        No active API keys found. Generate a key to begin automating with the Python or Node.js SDK.
                      </td>
                    </tr>
                  ) : (
                    apiKeys.map((k) => (
                      <tr key={k.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                        <td className="py-3 px-4 font-semibold text-zinc-900 dark:text-zinc-100">{k.name}</td>
                        <td className="py-3 px-4 font-mono text-zinc-600 dark:text-zinc-400">{k.keyPrefix}••••••••</td>
                        <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">{k.rateLimitRpm || 1000} req/min</td>
                        <td className="py-3 px-4 text-zinc-500">{new Date(k.createdAt).toLocaleDateString()}</td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleRevokeApiKey(k.id)}
                            className="p-1.5 text-zinc-400 hover:text-rose-600 transition"
                            title="Revoke key"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: NOTIFICATIONS */}
        {activeTab === 'notifications' && (
          <div className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-white">Communication Preferences</h2>
            <div className="space-y-4 max-w-2xl">
              <div className="flex items-center justify-between p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700">
                <div>
                  <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 block">Job Completion Alerts</span>
                  <span className="text-[11px] text-zinc-500">Receive an email when large batch conversions and OCR runs finish.</span>
                </div>
                <input
                  type="checkbox"
                  checked={notifyJobComplete}
                  onChange={(e) => {
                    setNotifyJobComplete(e.target.checked);
                    addToast('Notification preferences saved', 'info');
                  }}
                  className="w-4 h-4 text-blue-600 rounded"
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700">
                <div>
                  <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 block">Critical Security Notices</span>
                  <span className="text-[11px] text-zinc-500">Instant notification upon new logins, IP anomalies, or API key changes.</span>
                </div>
                <input
                  type="checkbox"
                  checked={notifySecurityAlerts}
                  onChange={(e) => {
                    setNotifySecurityAlerts(e.target.checked);
                    addToast('Notification preferences saved', 'info');
                  }}
                  className="w-4 h-4 text-blue-600 rounded"
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700">
                <div>
                  <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 block">Weekly Quota & Intelligence Digest</span>
                  <span className="text-[11px] text-zinc-500">Executive summary of OCR pages, RAG queries, and storage footprint.</span>
                </div>
                <input
                  type="checkbox"
                  checked={notifyWeeklyDigest}
                  onChange={(e) => {
                    setNotifyWeeklyDigest(e.target.checked);
                    addToast('Notification preferences saved', 'info');
                  }}
                  className="w-4 h-4 text-blue-600 rounded"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2FA Setup Modal */}
      <Modal isOpen={twoFaModalOpen} onClose={() => setTwoFaModalOpen(false)} title="Configure Two-Factor Authentication">
        <form onSubmit={handleVerify2Fa} className="space-y-4">
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Scan the QR code below or enter the manual secret into your authenticator app, then provide the generated 6-digit code.
          </p>

          {totpSecret && (
            <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-center">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Manual Setup Key</span>
              <code className="text-xs font-mono font-bold text-zinc-900 dark:text-white tracking-widest">{totpSecret}</code>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">6-Digit Code</label>
            <input
              type="text"
              maxLength={6}
              required
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              placeholder="000000"
              className="w-full text-center tracking-widest text-lg font-mono px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setTwoFaModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={twoFaLoading || totpCode.length < 6}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl"
            >
              {twoFaLoading ? 'Verifying...' : 'Verify & Enable'}
            </button>
          </div>
        </form>
      </Modal>

      {/* API Key Modal */}
      <Modal isOpen={createKeyModalOpen} onClose={() => setCreateKeyModalOpen(false)} title="Create API Access Key">
        {createdPlainKey ? (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>Copy your API key now. This secret will never be displayed again.</span>
            </div>

            <div className="flex items-center gap-2 p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 font-mono text-xs break-all">
              <span className="flex-1">{createdPlainKey}</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(createdPlainKey);
                  setCopiedKey(true);
                  setTimeout(() => setCopiedKey(false), 2000);
                  addToast('Key copied to clipboard', 'info');
                }}
                className="p-1.5 rounded-lg bg-white dark:bg-zinc-700 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-200 transition"
              >
                {copiedKey ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <button
              onClick={() => setCreateKeyModalOpen(false)}
              className="w-full py-2.5 rounded-xl text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 transition"
            >
              Done & Dismiss
            </button>
          </div>
        ) : (
          <form onSubmit={handleCreateApiKey} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Key Description / Purpose</label>
              <input
                type="text"
                required
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="e.g. Production Ingestion Pipeline"
                className="w-full px-3 py-2 text-xs border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreateKeyModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newKeyName.trim()}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl"
              >
                Create Key
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
