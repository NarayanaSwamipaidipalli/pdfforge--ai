'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ChevronDown, CreditCard, FileText, Layers, RefreshCw, Sparkles } from 'lucide-react';
import { useAuthStore } from '@/lib/auth-store';
import { useBillingCatalog, PLAN_ORDER, type BillingInterval, type BillingPlan } from '@/lib/billing';
import { BillingToggle, PlanCards } from '@/components/billing/PlanCards';
import { CheckoutModal } from '@/components/billing/CheckoutModal';
import { Badge, Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Reveal } from '@/components/ui/Motion';

const faqs = [
  { question: 'Can I use Doxera for free?', answer: 'Yes. The FREE plan needs no payment. Its current upload, batch, daily conversion and AI request limits are shown above and come from the server.' },
  { question: 'Why are the USD and Razorpay prices different?', answer: 'The USD plan catalog and Razorpay INR prices are configured separately. They are not an exchange-rate estimate. The payment review shows the configured currency and total for your selected provider.' },
  { question: 'Does my plan renew automatically?', answer: 'Stripe subscriptions renew automatically until canceled. Razorpay and PayPal purchases cover one prepaid monthly or yearly period and do not renew automatically.' },
  { question: 'How do I change or cancel my plan?', answer: 'Open Billing to review your current paid period and available plans. Cancellation is scheduled for the end of that period. New paid purchases do not automatically cancel an existing subscription, and paid-tier downgrades and proration are not currently supported.' },
  { question: 'Why is checkout unavailable for some plans?', answer: 'A payment provider and a price for the chosen plan and period must be configured on the server. Unconfigured options cannot start a payment. You can try another billing period or contact support.' },
  { question: 'Where can I find my payment history and invoice?', answer: 'Your Billing page lists the payment and invoice records returned by the backend. You can download the latest paid invoice when one is available.' },
];

export default function PricingPage() {
  const router = useRouter();
  const { user, isAuthenticated, isHydrated } = useAuthStore();
  const { plans, providers, loading, error, reload } = useBillingCatalog();
  const [interval, setInterval] = useState<BillingInterval>('monthly');
  const [selected, setSelected] = useState<BillingPlan | null>(null);
  const selectPlan = (plan: BillingPlan) => {
    if (!isHydrated) return;
    if (plan.tier === 'FREE') { router.push(isAuthenticated ? '/billing' : '/register?redirect=/dashboard'); return; }
    if (!isAuthenticated) { router.push('/register?redirect=/pricing'); return; }
    if (user && PLAN_ORDER.indexOf(plan.tier) < PLAN_ORDER.indexOf(user.plan)) { router.push('/billing#plans'); return; }
    setSelected(plan);
  };
  const comparisons = [
    { label: 'Daily conversions', value: (plan: BillingPlan) => plan.limits.dailyConversions < 0 ? 'Unlimited' : plan.limits.dailyConversions.toLocaleString() },
    { label: 'Maximum file size', value: (plan: BillingPlan) => `${plan.limits.maxFileSizeMb.toLocaleString()} MB` },
    { label: 'Files in one batch', value: (plan: BillingPlan) => plan.limits.batchLimit.toLocaleString() },
    { label: 'AI requests per month', value: (plan: BillingPlan) => plan.limits.aiQueries < 0 ? 'Unlimited' : plan.limits.aiQueries.toLocaleString() },
  ];
  return <div className="relative isolate overflow-hidden pb-20 sm:pb-28">
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[620px] bg-[radial-gradient(ellipse_at_50%_0%,rgba(89,142,255,0.12),transparent_65%)]" />
    <div aria-hidden className="bg-grid mask-fade pointer-events-none absolute inset-x-0 top-0 -z-10 h-[500px] opacity-50" />
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <Reveal className="mx-auto max-w-3xl pt-14 text-center sm:pt-20">
        <Badge><Sparkles className="h-3.5 w-3.5" aria-hidden />Plans for your next chapter</Badge>
        <h1 className="mt-6 text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">Less busywork.<br /><span className="text-gradient">More possibility.</span></h1>
        <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-[var(--muted)]">From a quick PDF fix to a full document workflow. Choose the processing limits that fit your day.</p>
        <div className="mt-8"><BillingToggle value={interval} onChange={value => { setInterval(value); setSelected(null); }} /></div>
        <p className="mt-3 text-xs text-[var(--muted)]">Yearly prices show the full annual total. Provider availability varies by plan.</p>
      </Reveal>
      <section aria-label="Pricing plans" className="mt-12">
        {loading ? <div role="status" aria-label="Loading pricing" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map(item => <div key={item} className="surface h-[525px] rounded-2xl p-6"><div className="skeleton h-8 w-24 rounded-lg" /><div className="skeleton mt-12 h-12 w-36 rounded-lg" /><div className="skeleton mt-8 h-11 rounded-full" /><div className="skeleton mt-12 h-36 rounded-xl" /></div>)}</div> : error ? <Card className="p-8 text-center"><p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p><Button variant="secondary" onClick={reload} className="mt-4"><RefreshCw className="h-4 w-4" />Retry pricing</Button></Card> : <PlanCards plans={plans} providers={providers} interval={interval} currentPlan={isHydrated && isAuthenticated ? user?.plan : undefined} onSelect={selectPlan} />}
      </section>
      <div className="mt-6 flex flex-wrap justify-center gap-x-8 gap-y-3 text-xs text-[var(--muted)]"><span className="flex items-center gap-2"><FileText className="h-4 w-4 text-brand-500" />Free plan available</span><span className="flex items-center gap-2"><Layers className="h-4 w-4 text-brand-500" />Limits from the plan catalog</span><span className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-brand-500" />Review before payment</span></div>
      {!loading && !error && <section id="compare" className="scroll-mt-24"><Reveal className="mt-20 sm:mt-28">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600 dark:text-brand-300">The details, at a glance</p><h2 className="mt-3 text-3xl font-semibold tracking-tight">Find your fit.</h2></div><p className="max-w-md text-sm leading-relaxed text-[var(--muted)]">These allowances are supplied by the server. AI processing also depends on available model providers.</p></div>
        <Card className="overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><caption className="sr-only">Plan processing limits comparison</caption><thead><tr className="border-b border-[var(--card-border)] bg-black/[0.02] dark:bg-white/[0.02]"><th scope="col" className="p-5 font-medium text-[var(--muted)]">Processing allowance</th>{plans.map(plan => <th scope="col" key={plan.tier} className="p-5 text-center text-xs tracking-wider">{plan.tier}</th>)}</tr></thead><tbody>{comparisons.map(row => <tr key={row.label} className="border-b border-[var(--card-border)] last:border-b-0"><th scope="row" className="p-5 font-medium text-[var(--muted)]">{row.label}</th>{plans.map(plan => <td key={plan.tier} className={`p-5 text-center ${plan.popular ? 'bg-brand-500/[0.04] font-medium' : ''}`}>{row.value(plan)}</td>)}</tr>)}</tbody></table></div></Card>
      </Reveal></section>}
      <Reveal className="mx-auto mt-20 max-w-3xl sm:mt-28">
        <div className="mb-9 text-center"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600 dark:text-brand-300">Good to know</p><h2 className="mt-3 text-3xl font-semibold tracking-tight">A few clear answers.</h2></div>
        <div className="divide-y divide-[var(--card-border)] border-y border-[var(--card-border)]">{faqs.map(faq => <details key={faq.question} className="group py-1"><summary className="focus-ring flex cursor-pointer list-none items-center justify-between gap-5 rounded-lg py-5 text-sm font-semibold [&::-webkit-details-marker]:hidden">{faq.question}<ChevronDown className="h-4 w-4 shrink-0 text-[var(--muted)] transition-transform group-open:rotate-180" aria-hidden /></summary><p className="pb-5 pr-7 text-sm leading-7 text-[var(--muted)]">{faq.answer}</p></details>)}</div>
      </Reveal>
      <Reveal className="mt-16"><Card gradientRing className="flex flex-col items-start justify-between gap-6 bg-brand-500/[0.04] p-7 sm:flex-row sm:items-center sm:p-10"><div><h2 className="text-xl font-semibold tracking-tight">Have a bigger workflow in mind?</h2><p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">Tell us what you need. We can help you understand the available plans.</p></div><Button href="/contact" variant="secondary">Talk to us <ArrowRight className="h-4 w-4" /></Button></Card></Reveal>
    </div>
    <CheckoutModal plan={selected} interval={interval} providers={providers} onClose={() => setSelected(null)} onVerified={() => { router.push('/billing?payment=verified'); }} />
  </div>;
}
