import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Card({
  children,
  className,
  glass = false,
  gradientRing = false,
}: {
  children: ReactNode;
  className?: string;
  glass?: boolean;
  gradientRing?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-2xl',
        glass ? 'glass-panel' : 'surface',
        gradientRing && 'ring-gradient',
        'shadow-card dark:shadow-card-dark',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Section heading with an optional eyebrow label, centred by default. */
export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'center',
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  align?: 'center' | 'left';
  className?: string;
}) {
  return (
    <div className={cn(align === 'center' ? 'text-center mx-auto max-w-2xl' : 'max-w-2xl', className)}>
      {eyebrow && (
        <span className="inline-block text-xs font-semibold uppercase tracking-[0.18em] text-brand-600 dark:text-brand-300 mb-3">
          {eyebrow}
        </span>
      )}
      <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-ink-900 dark:text-white text-balance">
        {title}
      </h2>
      {description && (
        <p className="mt-4 text-base md:text-lg leading-relaxed text-ink-600 dark:text-zinc-400">{description}</p>
      )}
    </div>
  );
}

export function Badge({
  children,
  className,
  tone = 'brand',
}: {
  children: ReactNode;
  className?: string;
  tone?: 'brand' | 'neutral' | 'success' | 'warning';
}) {
  const tones = {
    brand: 'text-brand-700 dark:text-brand-200 bg-brand-500/10 border-brand-500/25',
    neutral: 'text-ink-600 dark:text-zinc-300 bg-black/[0.04] dark:bg-white/[0.06] border-black/10 dark:border-white/10',
    success: 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/25',
    warning: 'text-amber-700 dark:text-amber-300 bg-amber-500/10 border-amber-500/25',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
