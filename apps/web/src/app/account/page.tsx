'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';
import { useToast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import {
  User,
  Mail,
  Shield,
  Key,
  CreditCard,
  HardDrive,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Trash2,
  Save,
  Link2,
  Unlink2,
  ExternalLink,
  Loader2,
  Camera,
  RefreshCw,
  LogOut,
} from 'lucide-react';

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || '/api/v1';
const API_BASE = rawApiUrl.replace(/\/api\/v1\/?$/, '');
const API_V1 = `${API_BASE}/api/v1`;

const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
];

export default function AccountPage() {
  const router = useRouter();
  const { user, token, isAuthenticated, isHydrated, syncProfile, updateUser, logout } = useAuthStore();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [googleActionLoading, setGoogleActionLoading] = useState(false);

  // Edit Profile fields
  const [name, setName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  // Password fields
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Delete modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Hydration & Authentication check
  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      router.push('/login?redirect=/account');
    }
  }, [isHydrated, isAuthenticated, router]);

  // Sync profile details
  useEffect(() => {
    if (isAuthenticated) {
      syncProfile();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setAvatarUrl(user.avatarUrl || '');
    }
  }, [user]);

  const formatBytes = (bytes: number | string | undefined | null) => {
    const num = Number(bytes) || 0;
    if (num < 1024) return `${num} B`;
    if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
    if (num < 1024 * 1024 * 1024) return `${(num / (1024 * 1024)).toFixed(1)} MB`;
    return `${(num / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const getStoragePercentage = () => {
    const used = Number(user?.storageUsedBytes) || 0;
    const limit = Number(user?.storageLimitBytes) || (1024 * 1024 * 1024); // 1 GB default
    const pct = Math.min(100, Math.round((used / limit) * 100));
    return isNaN(pct) ? 0 : pct;
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const authToken = token || localStorage.getItem('pdfforge_token');
    if (!authToken) return;

    setProfileSaving(true);
    try {
      const res = await fetch(`${API_V1}/auth/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          avatarUrl: avatarUrl.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update profile');

      updateUser({
        name: data.name,
        avatarUrl: data.avatarUrl,
      });

      addToast('Profile updated successfully!', 'success');
    } catch (err: any) {
      addToast(err.message || 'Failed to save changes', 'error');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      addToast('New password must be at least 8 characters long', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      addToast('New passwords do not match', 'error');
      return;
    }

    const authToken = token || localStorage.getItem('pdfforge_token');
    if (!authToken) return;

    setPasswordSaving(true);
    try {
      const res = await fetch(`${API_V1}/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ oldPassword, newPassword }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to change password');

      addToast('Password updated! Please log in with your new credentials.', 'success');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      await logout();
      router.push('/login');
    } catch (err: any) {
      addToast(err.message || 'Could not change password', 'error');
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    if (!confirm('Are you sure you want to disconnect your Google account? You will need your password to log in.')) {
      return;
    }

    const authToken = token || localStorage.getItem('pdfforge_token');
    if (!authToken) return;

    setGoogleActionLoading(true);
    try {
      const res = await fetch(`${API_V1}/auth/google/disconnect`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to disconnect Google account');

      addToast('Google account disconnected successfully', 'success');
      await syncProfile();
    } catch (err: any) {
      addToast(err.message || 'Could not disconnect Google', 'error');
    } finally {
      setGoogleActionLoading(false);
    }
  };

  const handleConnectGoogle = async () => {
    setGoogleActionLoading(true);
    try {
      const callbackTarget = `${window.location.origin}/auth/callback`;
      const res = await fetch(`${API_V1}/auth/google/link-url`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ redirectUri: callbackTarget }),
      });
      const data = await res.json();

      if (res.ok && data.url) {
        sessionStorage.setItem('pdfforge_google_link_state', new URL(data.url).searchParams.get('state') || '');
        window.location.href = data.url;
      } else {
        throw new Error('Google authorization URL unavailable');
      }
    } catch (err: any) {
      addToast(err.message || 'Failed to initiate Google link', 'error');
      setGoogleActionLoading(false);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (deleteConfirmation !== 'DELETE') {
      addToast('Please type "DELETE" exactly to confirm account deletion', 'error');
      return;
    }

    const authToken = token || localStorage.getItem('pdfforge_token');
    if (!authToken) return;

    setDeleteLoading(true);
    try {
      const res = await fetch(`${API_V1}/auth/account`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          confirmation: 'DELETE',
          password: deletePassword || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not delete account');

      addToast('Your account and files have been permanently deleted', 'info');
      setDeleteModalOpen(false);
      await logout();
      router.push('/');
    } catch (err: any) {
      addToast(err.message || 'Account deletion failed', 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  const isGoogleConnected = Boolean(user?.googleId || user?.provider?.includes('GOOGLE'));
  const isLocalAccount = user?.provider === 'LOCAL' || user?.provider === 'GOOGLE_AND_LOCAL' || !user?.provider;

  return (
    <div className="min-h-screen bg-[#fbfbfd] dark:bg-black text-zinc-900 dark:text-zinc-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header Breadcrumbs & Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">
              <User className="w-4 h-4" /> Account Governance
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white">
              My Account
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Manage your personal identity, login methods, security credentials, and storage quota.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => syncProfile()}
              className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 text-zinc-600 dark:text-zinc-300 transition-colors"
              title="Refresh Profile"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <Link
              href="/billing"
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors flex items-center gap-1.5"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Subscription & Invoices</span>
            </Link>
          </div>
        </div>

        {/* TOP OVERVIEW CARD */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pb-6 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-4">
              {/* Profile Avatar */}
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-500 text-white flex items-center justify-center font-bold text-2xl shadow-md overflow-hidden shrink-0">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={name || 'Avatar'} className="w-full h-full object-cover" />
                ) : (
                  <span>{(name?.[0] || user?.email?.[0] || 'U').toUpperCase()}</span>
                )}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                    {name || 'Registered User'}
                  </h2>
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Verified
                  </span>
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-zinc-400" />
                  <span>{user?.email}</span>
                </div>
              </div>
            </div>

            {/* Plan Tier Badge */}
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-[10px] uppercase font-bold text-zinc-400">Current Plan</div>
                <div className="text-sm font-bold text-blue-600 dark:text-blue-400">
                  {user?.plan || 'FREE'} TIER
                </div>
              </div>
              <Link
                href="/pricing"
                className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
              >
                Change Plan
              </Link>
            </div>
          </div>

          {/* TELEMETRY & ATTRIBUTES GRID */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6 text-xs">
            {/* 1. Auth Provider */}
            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-800 space-y-1">
              <span className="text-zinc-500 font-medium">Authentication Method</span>
              <div className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-1.5">
                {isGoogleConnected ? (
                  <>
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    <span>Google Identity</span>
                  </>
                ) : (
                  <>
                    <Key className="w-4 h-4 text-zinc-500" />
                    <span>Email & Password</span>
                  </>
                )}
              </div>
              <p className="text-[11px] text-zinc-400">
                {user?.provider === 'GOOGLE_AND_LOCAL'
                  ? 'Dual sign-in enabled'
                  : 'Single sign-on provider'}
              </p>
            </div>

            {/* 2. Storage Quota */}
            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-800 space-y-2">
              <div className="flex items-center justify-between font-medium">
                <span className="text-zinc-500 flex items-center gap-1">
                  <HardDrive className="w-3.5 h-3.5" /> Storage Quota
                </span>
                <span className="font-semibold text-zinc-900 dark:text-white">
                  {getStoragePercentage()}%
                </span>
              </div>
              <div className="w-full bg-zinc-200 dark:bg-zinc-700 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-blue-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${getStoragePercentage()}%` }}
                />
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {formatBytes(user?.storageUsedBytes)} of {formatBytes(user?.storageLimitBytes)} used
              </p>
            </div>

            {/* 3. Account Member Since */}
            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-800 space-y-1">
              <span className="text-zinc-500 font-medium flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> Member Since
              </span>
              <div className="text-sm font-semibold text-zinc-900 dark:text-white">
                {user?.createdAt
                  ? new Date(user.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })
                  : 'Active SaaS Member'}
              </div>
              <p className="text-[11px] text-zinc-400">
                User ID: <code className="font-mono text-zinc-600 dark:text-zinc-300">{user?.id?.substring(0, 12)}...</code>
              </p>
            </div>
          </div>
        </div>

        {/* PROFILE EDIT & PHOTO SECTION */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Form: Profile Information */}
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-6 sm:p-8 space-y-6">
            <div>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                <User className="w-4 h-4 text-blue-600" />
                Personal Information
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Update your public name and profile picture.
              </p>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Sarah Connor"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800/50 text-zinc-500 cursor-not-allowed"
                />
                <span className="text-[10px] text-zinc-400 mt-1 block">
                  Email is bound to your cryptographic subscription identity and cannot be altered directly.
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Avatar Image URL
                </label>
                <input
                  type="url"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://example.com/avatar.jpg"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              {/* Preset Avatar Selection */}
              <div>
                <span className="block text-[11px] font-medium text-zinc-500 mb-2">
                  Or pick a preset avatar:
                </span>
                <div className="flex items-center gap-3">
                  {AVATAR_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setAvatarUrl(preset)}
                      className={`w-10 h-10 rounded-xl overflow-hidden border-2 transition-transform hover:scale-105 ${
                        avatarUrl === preset ? 'border-blue-600 ring-2 ring-blue-500/20' : 'border-transparent'
                      }`}
                    >
                      <img src={preset} alt={`Preset ${idx + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={() => setAvatarUrl('')}
                      className="text-[11px] text-rose-500 hover:underline ml-2"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={profileSaving}
                  className="w-full sm:w-auto px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {profileSaving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" /> Save Changes
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Form: Password Change */}
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-6 sm:p-8 space-y-6">
            <div>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-indigo-600" />
                Change Password
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                {isLocalAccount
                  ? 'Update your secret passphrase for password-based logins.'
                  : 'You are signed in exclusively via Google Identity SSO.'}
              </p>
            </div>

            {isLocalAccount ? (
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    New Passphrase
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="•••••••• (Min 8 characters)"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Confirm New Passphrase
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    required
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={passwordSaving}
                    className="w-full sm:w-auto px-5 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 text-xs font-semibold shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {passwordSaving ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Updating...
                      </>
                    ) : (
                      <>
                        <Key className="w-3.5 h-3.5" /> Update Password
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-800 space-y-2 text-xs text-zinc-600 dark:text-zinc-400">
                <p>
                  This account was created via <strong>Google Sign-In</strong>. You don't have a traditional password stored on our servers.
                </p>
                <p>
                  Your identity is protected by Google OAuth 2.0 with cryptographic verification.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* GOOGLE INTEGRATION & DANGER ZONE */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card: Google OAuth Linking */}
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-6 sm:p-8 space-y-6 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <h2 className="text-base font-semibold text-zinc-900 dark:text-white">
                  Google Account Integration
                </h2>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Link your Google identity for instant 1-click authentication and automated profile synchronizations.
              </p>

              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-800 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">Google Status</span>
                  {isGoogleConnected ? (
                    <span className="text-emerald-600 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Connected
                    </span>
                  ) : (
                    <span className="text-zinc-400 font-semibold">Not Linked</span>
                  )}
                </div>
                {user?.googleId && (
                  <p className="text-[10px] text-zinc-400 font-mono truncate">
                    Subject ID: {user.googleId}
                  </p>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
              {isGoogleConnected ? (
                <button
                  type="button"
                  onClick={handleDisconnectGoogle}
                  disabled={googleActionLoading}
                  className="w-full py-2.5 px-4 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 text-xs font-semibold transition flex items-center justify-center gap-2"
                >
                  {googleActionLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Unlink2 className="w-3.5 h-3.5" />
                  )}
                  <span>Disconnect Google Account</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleConnectGoogle}
                  disabled={googleActionLoading}
                  className="w-full py-2.5 px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-semibold shadow-sm transition flex items-center justify-center gap-2"
                >
                  {googleActionLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Link2 className="w-3.5 h-3.5 text-blue-600" />
                  )}
                  <span>Connect with Google</span>
                </button>
              )}
            </div>
          </div>

          {/* Card: Danger Zone / Delete Account */}
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-rose-200 dark:border-rose-950 shadow-sm p-6 sm:p-8 space-y-6 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-rose-600">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <h2 className="text-base font-semibold">Danger Zone</h2>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Permanently purge your account, processing history, developer API tokens, and all uploaded files from our storage infrastructure.
              </p>
              <div className="p-3.5 rounded-2xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40 text-[11px] text-rose-700 dark:text-rose-300">
                This action is irreversible. All subscription benefits and conversion quotas will be terminated immediately.
              </div>
            </div>

            <div className="pt-4 border-t border-rose-100 dark:border-rose-900/40">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(true)}
                className="w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm transition flex items-center justify-center gap-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Account Permanently</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: DELETE ACCOUNT CONFIRMATION */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Confirm Account Deletion"
      >
        <form onSubmit={handleDeleteAccount} className="space-y-4 pt-2">
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
            To prevent accidental deletion, please type <strong className="text-rose-600 font-mono">DELETE</strong> in the box below to proceed with the permanent removal of your account.
          </p>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Confirmation Phrase
            </label>
            <input
              type="text"
              placeholder="DELETE"
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white font-mono uppercase focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              required
            />
          </div>

          {isLocalAccount && (
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Current Password (Verification)
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                required
              />
            </div>
          )}

          <div className="pt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setDeleteModalOpen(false)}
              className="px-4 py-2 text-xs font-medium rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={deleteConfirmation !== 'DELETE' || deleteLoading}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition disabled:opacity-50 flex items-center gap-1.5"
            >
              {deleteLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" /> Purge Account
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
