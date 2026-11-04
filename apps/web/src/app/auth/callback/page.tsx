'use client';

import React, { useEffect, useRef, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';
import { FileCheck2, Loader2, AlertCircle } from 'lucide-react';
import Link from 'next/link';

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || '/api/v1';
const API_BASE = rawApiUrl.replace(/\/api\/v1\/?$/, '');
const API_V1 = `${API_BASE}/api/v1`;

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth, syncProfile, refreshTokens } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const operation = useRef<Promise<string> | null>(null);

  useEffect(() => {
    let active = true;
    if (!operation.current) {
      operation.current = (async () => {
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        // Remove credentials and one-time codes before any fetch can attach them as a referrer.
        window.history.replaceState({}, '', '/auth/callback');
        if (searchParams.get('error')) throw new Error('Google authentication failed. Please try again.');
        const linking = !!state && sessionStorage.getItem('doxera_google_link_state') === state;
        if (code) {
          const existingToken = useAuthStore.getState().token;
          if (!state || (linking && !existingToken)) throw new Error('Your sign-in session expired. Please try again.');
          const res = await fetch(API_V1 + (linking ? '/auth/google/connect' : '/auth/google'), {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json', ...(linking ? { Authorization: 'Bearer ' + existingToken } : {}) },
            body: JSON.stringify({ code, state, redirectUri: window.location.origin + '/auth/callback' }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || 'Google authentication failed');
          sessionStorage.removeItem('doxera_google_link_state');
          if (linking) {
            await syncProfile();
            return '/account';
          }
          setAuth({ ...data.user, name: data.user.name || null }, data.tokens.accessToken);
          await syncProfile();
          return '/dashboard';
        }
        if (searchParams.get('oauth') !== 'success') throw new Error('No authorization response received. Please sign in again.');
        const accessToken = await refreshTokens();
        if (!accessToken) throw new Error('Your sign-in session expired. Please try again.');
        await syncProfile();
        if (!useAuthStore.getState().user) throw new Error('Could not load your signed-in account');
        return '/dashboard';
      })();
    }
    operation.current.then((target) => { if (active) router.replace(target); })
      .catch((err) => { if (active) setError(err.message || 'Google authentication failed'); });
    return () => { active = false; };
  }, [searchParams, router, setAuth, syncProfile, refreshTokens]);

  if (error) {
    return (
      <div className="min-h-screen bg-[#fbfbfd] flex flex-col justify-center items-center p-4">
        <div className="bg-white p-8 rounded-3xl border border-zinc-200 shadow-apple max-w-md w-full text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-zinc-900">Authentication Failed</h2>
          <p className="text-xs text-zinc-500 leading-relaxed">{error}</p>
          <div className="pt-2">
            <Link
              href="/login"
              className="inline-block w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition"
            >
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fbfbfd] flex flex-col justify-center items-center p-4">
      <div className="bg-white p-8 rounded-3xl border border-zinc-200 shadow-apple max-w-sm w-full text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 mx-auto">
          <FileCheck2 className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Securing your session...</h2>
          <p className="text-xs text-zinc-500 mt-1">
            Verifying Google OAuth credentials and redirecting to your workspace.
          </p>
        </div>
        <div className="flex justify-center pt-2">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        </div>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#fbfbfd] flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
