'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const base =
  'relative inline-flex items-center justify-center gap-2 font-semibold rounded-full focus-ring ' +
  'transition-[transform,box-shadow,background-color,color] duration-200 ' +
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none ' +
  'active:translate-y-px select-none whitespace-nowrap';

const variants: Record<Variant, string> = {
  primary:
    'text-white bg-brand-600 hover:bg-brand-500 shadow-glow hover:shadow-glow-lg ' +
    'dark:bg-brand-500 dark:hover:bg-brand-400',
  secondary:
    'text-ink-900 dark:text-white bg-black/[0.04] hover:bg-black/[0.07] ' +
    'dark:bg-white/[0.06] dark:hover:bg-white/[0.11] border border-black/10 dark:border-white/10',
  ghost:
    'text-ink-700 dark:text-zinc-300 hover:text-ink-900 dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.07]',
  danger: 'text-white bg-rose-600 hover:bg-rose-500',
};

const sizes: Record<Size, string> = {
  sm: 'text-xs px-4 h-9',
  md: 'text-sm px-5 h-11',
  lg: 'text-sm px-7 h-13 md:h-14',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  href?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, href, className, children, disabled, ...rest },
  ref,
) {
  const classes = cn(base, variants[variant], sizes[size], className);
  const content = (
    <>
      {loading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />}
      {children}
    </>
  );

  if (href && !disabled && !loading) {
    return (
      <Link href={href} className={classes}>
        {content}
      </Link>
    );
  }

  return (
    <button ref={ref} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {content}
    </button>
  );
});
