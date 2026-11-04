'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';
import { safeLocalRedirect } from '@/lib/safe-redirect.mjs';
import {
  FileCheck2,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Sparkles,
  Loader2,
  Eye,
  EyeOff,
  Lock,
  Mail,
} from 'lucide-react';

const rawApiUrl = '/api/v1';
const API_BASE = rawApiUrl.replace(/\/api\/v1\/?$/, '');
const API_V1 = `${API_BASE}/api/v1`;

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth, isAuthenticated, isHydrated } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already authenticated, redirect
  useEffect(() => {
    if (isHydrated && isAuthenticated) {
      const redirectTarget = safeLocalRedirect(searchParams.get('redirect'));
      router.push(redirectTarget);
    }
  }, [isHydrated, isAuthenticated, router, searchParams]);

  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam) {
      setError(decodeURIComponent(errorParam));
    }
  }, [searchParams]);

  // Initialize Google Identity Services (GSI) for One Tap if configured
  useEffect(() => {
    let isMounted = true;
    const initGoogleGsi = async () => {
      try {
        const res = await fetch(`${API_V1}/auth/google/url`, { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || data.clientId;
        const isRealClientId =
          clientId &&
          clientId.includes('.apps.googleusercontent.com') &&
          !clientId.startsWith('pdfforge-google-client-id');
        if (!isRealClientId || typeof window === 'undefined' || !isMounted) return;

        if (!document.getElementById('google-gsi-script')) {
          const script = document.createElement('script');
          script.id = 'google-gsi-script';
          script.src = 'https://accounts.google.com/gsi/client';
          script.async = true;
          script.defer = true;
          script.onload = () => {
            if ((window as any).google?.accounts?.id && isMounted) {
              (window as any).google.accounts.id.initialize({
                client_id: clientId,
                callback: async (response: any) => {
                  if (response.credential) {
                    setGoogleLoading(true);
                    setError(null);
                    try {
                      const authRes = await fetch(`${API_V1}/auth/google`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ idToken: response.credential }),
                        credentials: 'include',
                      });
                      const authData = await authRes.json();
                      if (!authRes.ok) throw new Error(authData.message || 'Google login failed');

                      setAuth(
                        {
                          id: authData.user.id,
                          email: authData.user.email,
                          name: authData.user.name,
                          role: authData.user.role || authData.user.globalRole || 'USER',
                          plan: authData.user.plan || 'FREE',
                          avatarUrl: authData.user.avatarUrl || null,
                          provider: authData.user.provider || 'GOOGLE',
                          googleId: authData.user.googleId || null,
                          isEmailVerified: authData.user.isEmailVerified ?? true,
                          storageUsedBytes: authData.user.storageUsedBytes || 0,
                          storageLimitBytes: authData.user.storageLimitBytes || (1024 * 1024 * 1024),
                          createdAt: authData.user.createdAt,
                        },
                        authData.tokens.accessToken,
                      );

                      const redirectTarget = safeLocalRedirect(searchParams.get('redirect'));
                      router.push(redirectTarget);
                    } catch (err: any) {
                      setError(err.message || 'Google authentication failed');
                    } finally {
                      setGoogleLoading(false);
                    }
                  }
                },
              });
              (window as any).google.accounts.id.prompt();
            }
          };
          document.body.appendChild(script);
        }
      } catch {
        // Fallback gracefully to redirect flow
      }
    };

    initGoogleGsi();
    return () => {
      isMounted = false;
    };
  }, [router, searchParams, setAuth]);

  const performLogin = async (loginEmail: string, loginPass: string) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_V1}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPass }),
        credentials: 'include',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Authentication failed. Please verify credentials.');
      }

      setAuth(
        {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
          role: data.user.role || data.user.globalRole || 'USER',
          plan: data.user.plan || 'FREE',
          avatarUrl: data.user.avatarUrl || null,
          provider: data.user.provider || 'LOCAL',
          googleId: data.user.googleId || null,
          isEmailVerified: data.user.isEmailVerified ?? false,
          storageUsedBytes: data.user.storageUsedBytes || 0,
          storageLimitBytes: data.user.storageLimitBytes || (1024 * 1024 * 1024),
          createdAt: data.user.createdAt,
        },
        data.tokens.accessToken,
      );

      const redirectTarget = safeLocalRedirect(searchParams.get('redirect'));
      router.push(redirectTarget);
    } catch (err: any) {
      setError(err.message || 'Network connection failed. Please ensure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performLogin(email, password);
  };

  const handleGoogleAuth = async () => {
    setGoogleLoading(true);
    setError(null);
    try {
      const callbackTarget = `${window.location.origin}/auth/callback`;
      const res = await fetch(`${API_V1}/auth/google/url?redirect_uri=${encodeURIComponent(callbackTarget)}`, { credentials: 'include' });
      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('Could not generate Google authorization link');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to initialize Google authentication');
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fbfbfd] dark:bg-black flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link href="/" className="inline-flex items-center gap-2 mb-6 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
            <FileCheck2 className="w-6 h-6" />
          </div>
          <span className="font-semibold text-xl tracking-tight text-zinc-900 dark:text-white flex items-center gap-1.5">
            Doxera
          </span>
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white">
          Sign in to your account
        </h1>
        <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          Don&apos;t have an account?{' '}
          <Link
            href="/signup"
            className="text-blue-600 dark:text-blue-400 font-semibold hover:underline"
          >
            Create Account
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white dark:bg-zinc-900 py-8 px-6 sm:px-10 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* REAL GOOGLE OAUTH 2.0 BUTTON */}
          <button
            type="button"
            onClick={handleGoogleAuth}
            disabled={googleLoading}
            className="w-full py-2.5 px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-semibold shadow-sm transition-all duration-200 flex items-center justify-center gap-2.5 disabled:opacity-60"
          >
            {googleLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
            ) : (
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            )}
            <span>{googleLoading ? 'Connecting to Google...' : 'Continue with Google'}</span>
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-200 dark:border-zinc-800" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-white dark:bg-zinc-900 text-zinc-400">
                or sign in with email
              </span>
            </div>
          </div>

          {/* Traditional Email / Password Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  required
                />
                <Mail className="w-3.5 h-3.5 text-zinc-400 absolute right-3 top-2.5" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-[11px] text-blue-600 dark:text-blue-400 font-medium hover:underline"
                >
                  Forgot Password?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all pr-9"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1 text-zinc-400 hover:text-zinc-600 absolute right-2.5 top-2 focus:outline-none"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign in with Password</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Create Account Link Footer */}
          <div className="pt-2 text-center text-xs text-zinc-500 dark:text-zinc-400 border-t border-zinc-100 dark:border-zinc-800">
            <span>New to Doxera? </span>
            <Link
              href="/signup"
              className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              Create Account
            </Link>
          </div>

          {/* Security Assurance Badge */}
          <div className="pt-2 text-center text-[10px] text-zinc-400 flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>256-Bit TLS Encryption & Zero-Retention Security</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#fbfbfd] dark:bg-black">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
