'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';
import { FileCheck2, ArrowRight, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
const API_BASE = rawApiUrl.replace(/\/api\/v1\/?$/, '');
const API_V1 = `${API_BASE}/api/v1`;

export default function RegisterPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize Google Identity Services (GSI) for One Tap if configured
  useEffect(() => {
    let isMounted = true;
    const initGoogleGsi = async () => {
      try {
        const res = await fetch(`${API_V1}/auth/google/url`);
        if (!res.ok) return;
        const data = await res.json();
        const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || data.clientId;
        if (!clientId || typeof window === 'undefined' || !isMounted) return;

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
                      });
                      const authData = await authRes.json();
                      if (!authRes.ok) throw new Error(authData.message || 'Google registration failed');

                      setAuth(
                        {
                          id: authData.user.id,
                          email: authData.user.email,
                          name: authData.user.name,
                          role: authData.user.role || authData.user.globalRole || 'USER',
                          plan: authData.user.plan || 'FREE',
                        },
                        authData.tokens.accessToken,
                      );

                      router.push('/dashboard');
                    } catch (err: any) {
                      setError(err.message || 'Google registration failed');
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
  }, [router, setAuth]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_V1}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Registration failed. Please try a different email address.');
      }

      setAuth(
        {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
          role: data.user.role || 'USER',
          plan: data.user.plan || 'FREE',
        },
        data.tokens.accessToken,
      );

      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Registration request could not be processed.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setGoogleLoading(true);
    setError(null);
    try {
      const callbackTarget = `${window.location.origin}/auth/callback`;
      const res = await fetch(`${API_V1}/auth/google/url?redirect_uri=${encodeURIComponent(callbackTarget)}`);
      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('Google OAuth is not configured on the server. Please set GOOGLE_CLIENT_ID.');
      }
    } catch (err: any) {
      setError(err.message || 'Could not initiate Google sign up');
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fbfbfd] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link href="/" className="inline-flex items-center gap-2 mb-6 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
            <FileCheck2 className="w-6 h-6" />
          </div>
          <span className="font-semibold text-xl tracking-tight text-zinc-900">
            PDFForge AI
          </span>
        </Link>
        <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Create your free account
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Already have an account?{' '}
          <Link href="/login" className="text-blue-600 font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 sm:px-10 rounded-3xl border border-zinc-200 shadow-apple space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Official Google Sign-Up Button */}
          <button
            type="button"
            onClick={handleGoogleAuth}
            disabled={loading || googleLoading}
            className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-xs font-semibold text-zinc-700 transition-colors shadow-sm disabled:opacity-60"
          >
            {googleLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24">
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
            <span>{googleLoading ? 'Connecting to Google...' : 'Sign up with Google'}</span>
          </button>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-zinc-200 w-full" />
            <span className="bg-white px-3 text-[10px] text-zinc-400 uppercase tracking-wider">
              Or with work email
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Full name
              </label>
              <input
                type="text"
                placeholder="Sarah Connor"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Work email address
              </label>
              <input
                type="email"
                placeholder="sarah@corp.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Password
              </label>
              <input
                type="password"
                placeholder="Minimum 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                minLength={8}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
            >
              <span>{loading ? 'Creating account...' : 'Start 14-Day Free Trial'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          <div className="pt-2 text-center text-[10px] text-zinc-400 flex items-center justify-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>GDPR, HIPAA & SOC2 Compliant · No Credit Card Required</span>
          </div>
        </div>
      </div>
    </div>
  );
}
