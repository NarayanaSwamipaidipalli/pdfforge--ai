'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { FileCheck2, ArrowRight, ShieldCheck, AlertCircle, CheckCircle2, MailCheck, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { addToast } = useToast();

  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    const urlToken = searchParams.get('token');
    if (urlToken) {
      setToken(urlToken);
      // Auto-verify if token is provided via email link
      handleVerify(urlToken);
    }
  }, [searchParams]);

  const handleVerify = async (tokenToUse?: string) => {
    const activeToken = (tokenToUse || token).trim();
    if (!activeToken) {
      setError('Please provide a valid verification token.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: activeToken }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Email verification failed. The link may have expired.');
      }

      setVerified(true);
      addToast('Email verified successfully! Welcome to PDFForge AI.', 'success');
    } catch (err: any) {
      setError(err.message || 'Email verification failed.');
      addToast(err.message || 'Verification error', 'error');
    } finally {
      setLoading(false);
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
          Verify Your Email
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Activate your high-throughput document intelligence account
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 sm:px-10 rounded-3xl border border-zinc-200 shadow-apple space-y-6">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {verified ? (
            <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-emerald-950">Email Successfully Verified</h3>
                <p className="text-xs text-emerald-700 mt-1 leading-relaxed">
                  Your identity has been confirmed. You now have full access to PDFForge AI tools, batch processing, and API keys.
                </p>
              </div>
              <div className="pt-2 flex flex-col gap-2">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center justify-center w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition"
                >
                  Enter Platform Dashboard
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center w-full py-2 px-4 rounded-xl text-xs font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 transition"
                >
                  Sign In with Credentials
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-center py-2">
                <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                  <MailCheck className="w-6 h-6" />
                </div>
                <p className="text-xs text-zinc-600 leading-relaxed">
                  Click the button below to confirm your token or paste your verification code manually.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Verification Token
                </label>
                <input
                  type="text"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Paste verification token"
                  className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono"
                />
              </div>

              <button
                type="button"
                onClick={() => handleVerify()}
                disabled={loading || !token.trim()}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition shadow-sm flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <span>Confirm Verification</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <p className="text-[11px] text-zinc-400">
                  Need a new verification token?{' '}
                  <Link href="/contact" className="text-blue-600 hover:underline">
                    Contact Security Support
                  </Link>
                </p>
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-zinc-100 flex items-center justify-center gap-2 text-[11px] text-zinc-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Zero-trust cryptographic validation</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#fbfbfd] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
