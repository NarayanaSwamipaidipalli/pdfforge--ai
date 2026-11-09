'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Captured by Doxera Error Boundary:', error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center bg-zinc-50 p-6 text-center text-ink-900 dark:bg-ink-950 dark:text-white">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-300">
        <AlertTriangle className="h-7 w-7" aria-hidden />
      </div>

      <h1 className="mb-2 text-2xl font-bold tracking-tight">Something went wrong</h1>

      <p className="mb-6 max-w-md text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        This page hit an unexpected error. Try again, and if it keeps happening, contact support with the reference below.
      </p>

      {error.digest && (
        <div className="mb-6 rounded-lg border border-black/10 bg-black/[0.03] px-3 py-1.5 font-mono text-[11px] text-zinc-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-400">
          Reference: {error.digest}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="focus-ring flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-brand-500"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          <span>Try again</span>
        </button>

        <Link
          href="/"
          className="focus-ring flex items-center gap-1.5 rounded-xl border border-black/10 px-4 py-2 text-xs font-semibold transition-colors hover:bg-black/[0.04] dark:border-white/15 dark:hover:bg-white/[0.06]"
        >
          <Home className="h-3.5 w-3.5" aria-hidden />
          <span>Return home</span>
        </Link>
      </div>
    </div>
  );
}
