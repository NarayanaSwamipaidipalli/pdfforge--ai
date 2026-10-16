'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';
import { FileCheck2, ArrowRight, ShieldCheck } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    setTimeout(() => {
      setAuth(
        {
          id: 'usr_new',
          email,
          name: name || email.split('@')[0],
          role: 'USER',
          plan: 'FREE',
        },
        'mock_jwt_token_new',
      );
      setLoading(false);
      router.push('/dashboard');
    }, 600);
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
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold shadow-sm transition-colors flex items-center justify-center gap-1.5"
            >
              <span>{loading ? 'Creating Account...' : 'Get Started Free'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          <p className="text-[10px] text-zinc-400 text-center leading-relaxed">
            By signing up, you agree to our Terms of Service and Privacy Policy. All uploaded files adhere to our Zero-Permanent-Retention policy.
          </p>
        </div>
      </div>
    </div>
  );
}
