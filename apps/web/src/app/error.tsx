'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, Home, ShieldCheck } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Captured by PDFForge Error Boundary:', error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center bg-[#fbfbfd]">
      <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mb-5 shadow-sm">
        <AlertTriangle className="w-7 h-7" />
      </div>

      <h1 className="text-2xl font-bold text-zinc-900 tracking-tight mb-2">
        Something unexpected occurred
      </h1>

      <p className="text-xs text-zinc-500 max-w-md mb-6 leading-relaxed">
        Our automated telemetry has logged this incident. Your session and encrypted documents remain completely secure.
      </p>

      {error.digest && (
        <div className="mb-6 px-3 py-1.5 rounded-lg bg-zinc-100 font-mono text-[11px] text-zinc-600 border border-zinc-200">
          Trace ID: {error.digest}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={() => reset()}
          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Try Again</span>
        </button>

        <Link
          href="/"
          className="px-4 py-2 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5"
        >
          <Home className="w-3.5 h-3.5" />
          <span>Return Home</span>
        </Link>
      </div>

      <div className="mt-8 text-[11px] text-zinc-400 flex items-center gap-1">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
        <span>DoD 5220.22-M Zero Data Retention Guard Active</span>
      </div>
    </div>
  );
}
