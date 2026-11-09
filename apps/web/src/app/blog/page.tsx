import Link from 'next/link';
import { BookOpen } from 'lucide-react';

export const metadata = {
  title: 'Blog – Doxera',
  description: 'Articles from the Doxera team.',
};

// No articles have been published yet. Add real posts here only once they exist;
// do not list placeholder titles, dates or benchmark figures.
export default function BlogPage() {
  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-24 text-ink-900 dark:bg-ink-950 dark:text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-xl text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-300">
          <BookOpen className="h-6 w-6" aria-hidden />
        </div>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">Blog</h1>
        <p className="mt-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          We haven&apos;t published any articles yet. In the meantime, the help centre and developer docs cover how Doxera works.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/help" className="rounded-full bg-brand-600 px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-brand-500">Help centre</Link>
          <Link href="/developers" className="rounded-full border border-black/10 px-5 py-2.5 text-xs font-semibold transition-colors hover:bg-black/[0.04] dark:border-white/15 dark:hover:bg-white/[0.06]">Developer docs</Link>
        </div>
      </div>
    </div>
  );
}
