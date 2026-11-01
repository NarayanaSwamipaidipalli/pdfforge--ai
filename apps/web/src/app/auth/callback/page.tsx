'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';
import { FileCheck2, Loader2, AlertCircle } from 'lucide-react';
import Link from 'next/link';

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth, syncProfile } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const processCallback = async () => {
      const errorParam = searchParams.get('error');
      if (errorParam) {
        setError(decodeURIComponent(errorParam));
        return;
      }

      const token = searchParams.get('token');
      const userId = searchParams.get('userId');
      const plan = (searchParams.get('plan') as any) || 'FREE';
      const role = (searchParams.get('role') as any) || 'USER';

      if (!token) {
        setError('No authentication token received from identity provider.');
        return;
      }

      try {
        setAuth(
          {
            id: userId || 'google_user',
            email: 'Authenticated via Google',
            name: null,
            role,
            plan,
          },
          token,
        );

        // Fetch full verified user profile from /auth/me
        await syncProfile();
        const isLinking = searchParams.get('link') === 'true';
        router.push(isLinking ? '/account' : '/dashboard');
      } catch (err: any) {
        setError(err.message || 'Failed to initialize authenticated session.');
      }
    };

    processCallback();
  }, [searchParams, router, setAuth, syncProfile]);

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
            Verifying Google OAuth credentials and redirecting to your dashboard.
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
