'use client';

import { ArrowRight, Check, FileText, Layers, Sparkles, Building2 } from 'lucide-react';
import { Badge, Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { HoverLift } from '@/components/ui/Motion';
import { cn } from '@/lib/cn';
import { availableProviders, formatMoney, razorpayPrice, type BillingInterval, type BillingPlan, type BillingProviders, type PlanTier } from '@/lib/billing';

export function BillingToggle({ value, onChange }: { value: BillingInterval; onChange: (value: BillingInterval) => void }) {
  return <div role="group" aria-label="Billing period" className="inline-flex rounded-full border border-black/10 bg-black/[0.035] p-1 dark:border-white/10 dark:bg-white/[0.04]">
    {(['monthly', 'yearly'] as const).map(interval => <button key={interval} type="button" aria-pressed={value === interval} onClick={() => onChange(interval)} className={cn('focus-ring rounded-full px-5 py-2.5 text-sm font-semibold transition-colors', value === interval ? 'bg-white text-ink-900 shadow-sm dark:bg-ink-700 dark:text-white' : 'text-[var(--muted)] hover:text-[var(--foreground)]')}>
      {interval === 'monthly' ? 'Monthly' : 'Yearly'}
    </button>)}
  </div>;
}
const details = {
  FREE: { icon: FileText, description: 'For the everyday document task.' },
  PRO: { icon: Sparkles, description: 'More room for your best work.' },
  BUSINESS: { icon: Layers, description: 'For a busier document workflow.' },
  ENTERPRISE: { icon: Building2, description: 'Our highest processing limits.' },
};
export function PlanCards({ plans, providers, interval, currentPlan, onSelect }: {
  plans: BillingPlan[]; providers: BillingProviders; interval: BillingInterval; currentPlan?: PlanTier; onSelect: (plan: BillingPlan) => void;
}) {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{plans.map(plan => {
    const Icon = details[plan.tier].icon;
    const current = currentPlan === plan.tier;
    const paise = razorpayPrice(providers, plan.tier, interval);
    const purchasable = plan.tier === 'FREE' || availableProviders(providers, plan.tier, interval).length > 0;
    const amount = interval === 'yearly' ? plan.priceYearly : plan.priceMonthly;
    const features = [
      plan.limits.dailyConversions < 0 ? 'Unlimited daily conversions' : `${plan.limits.dailyConversions.toLocaleString()} conversions per day`,
      `${plan.limits.maxFileSizeMb.toLocaleString()} MB maximum file size`,
      `${plan.limits.batchLimit.toLocaleString()} files per batch`,
      plan.limits.aiQueries < 0 ? 'Unlimited monthly AI requests' : `${plan.limits.aiQueries.toLocaleString()} AI requests per month`,
    ];
    return <HoverLift key={plan.tier} className="h-full"><Card gradientRing={plan.popular} className={cn('relative flex h-full flex-col p-6 pt-7', plan.popular && 'bg-brand-50/70 dark:bg-brand-500/[0.07]')}>
      <div data-testid={`plan-${plan.tier}`} className="flex h-full flex-col">
        <div className="flex min-h-8 items-center justify-between gap-2"><Icon className="h-5 w-5 text-brand-600 dark:text-brand-300" aria-hidden />{current ? <Badge tone="success">Your plan</Badge> : plan.popular ? <Badge>More possibilities</Badge> : null}</div>
        <h2 className="mt-5 text-sm font-bold tracking-[0.14em]">{plan.tier}</h2>
        <p className="mt-2 min-h-10 text-sm leading-relaxed text-[var(--muted)]">{details[plan.tier].description}</p>
        <div className="mt-5 flex flex-wrap items-baseline gap-1.5"><span className="text-4xl font-semibold tracking-tight">{formatMoney(amount)}</span><span className="text-xs text-[var(--muted)]">USD / {interval === 'yearly' ? 'year' : 'month'}</span></div>
        <div className="mt-2 min-h-[3.25rem] text-xs leading-5 text-[var(--muted)]">{plan.tier === 'FREE' ? 'No payment needed.' : <><p>{interval === 'yearly' ? 'Total for one year.' : 'Price for one month.'}</p>{paise !== undefined ? <p className="font-medium text-brand-700 dark:text-brand-200">Razorpay: {formatMoney(paise / 100, 'INR')} / {interval === 'yearly' ? 'year' : 'month'}</p> : !purchasable ? <p>Checkout unavailable for this period.</p> : null}</>}</div>
        <Button variant={plan.popular ? 'primary' : 'secondary'} className="mt-5 w-full" onClick={() => onSelect(plan)} disabled={current}>{current ? 'Current plan' : plan.tier === 'FREE' ? (currentPlan ? 'Switch to Free' : 'Start for free') : purchasable ? `Choose ${plan.tier.charAt(0)}${plan.tier.slice(1).toLowerCase()}` : 'View plan details'}{!current && <ArrowRight className="h-3.5 w-3.5" aria-hidden />}</Button>
        <div className="my-6 h-px bg-black/[0.07] dark:bg-white/[0.08]" /><p className="mb-4 text-xs font-semibold">Your processing allowance</p>
        <ul className="space-y-3 text-sm text-[var(--muted)]">{features.map(feature => <li key={feature} className="flex items-start gap-2.5"><Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-300" aria-hidden /><span>{feature}</span></li>)}</ul>
      </div>
    </Card></HoverLift>;
  })}</div>;
}
