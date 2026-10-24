'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { FileCheck2, ArrowRight, ShieldCheck, AlertCircle, CheckCircle2, KeyRound } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [devToken, setDevToken] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Request could not be processed');

      setSuccessMessage(data.message || 'Password reset link has been dispatched to your email.');
      if (data.resetToken) {
        setDevToken(data.resetToken);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to request password reset');
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
          Reset your password
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Remember your password?{' '}
          <Link href="/login" className="text-blue-600 font-medium hover:underline">
            Back to sign in
          </Link>
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

          {successMessage && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs space-y-2">
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Verification Link Dispatched</span>
              </div>
              <p className="text-[11px] leading-relaxed">{successMessage}</p>

              {devToken && (
                <div className="mt-3 pt-3 border-t border-emerald-200/60">
                  <div className="text-[10px] uppercase font-bold text-emerald-900 mb-1">
                    Direct Reset Link:
                  </div>
                  <Link
                    href={`/reset-password?token=${encodeURIComponent(devToken)}`}
                    className="text-blue-600 underline font-semibold text-[11px] break-all"
                  >
                    Click here to proceed to Set New Password
                  </Link>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Your account email address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@pdfforge.ai"
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
            >
              <span>{loading ? 'Dispatched Request...' : 'Send Reset Link'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          <div className="pt-1 text-center text-[10px] text-zinc-400 flex items-center justify-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Encrypted One-Time Cryptographic Token</span>
          </div>
        </div>
      </div>
    </div>
  );
}
