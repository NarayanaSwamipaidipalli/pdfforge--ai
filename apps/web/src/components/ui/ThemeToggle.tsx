'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/cn';

export function ThemeToggle({ className }: { className?: string }) {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const sync = () => setDark(document.documentElement.classList.contains('dark'));
    try {
      const saved = localStorage.getItem('doxera_theme');
      document.documentElement.classList.toggle('dark', saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches);
    } catch {}
    sync();
    window.addEventListener('doxera-theme-change', sync);
    return () => window.removeEventListener('doxera-theme-change', sync);
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    window.dispatchEvent(new Event('doxera-theme-change'));
    try {
      localStorage.setItem('doxera_theme', next ? 'dark' : 'light');
    } catch {
      // Private browsing: the choice simply will not persist.
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={mounted ? `Switch to ${dark ? 'light' : 'dark'} theme` : 'Switch theme'}
      className={cn(
        'focus-ring inline-flex h-9 w-9 items-center justify-center rounded-full',
        'text-ink-600 transition-colors hover:bg-black/[0.05] dark:text-zinc-400 dark:hover:bg-white/[0.08]',
        className,
      )}
    >
      {/* Render both and swap with CSS so server and client markup always match. */}
      <Sun className="hidden h-4 w-4 dark:block" aria-hidden />
      <Moon className="h-4 w-4 dark:hidden" aria-hidden />
    </button>
  );
}
