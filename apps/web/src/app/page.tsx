'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { PDF_TOOLS } from '@/lib/tools-registry';
import { Button } from '@/components/ui/Button';
import { Card, SectionHeading, Badge } from '@/components/ui/Card';
import { Reveal, Stagger, StaggerItem, HoverLift } from '@/components/ui/Motion';
import { cn } from '@/lib/cn';
import {
  Search,
  Sparkles,
  UploadCloud,
  ShieldCheck,
  ArrowRight,
  Layers,
  Scissors,
  Minimize2,
  FileText,
  Lock,
  BrainCircuit,
  ScanText,
  ChevronDown,
  Terminal,
  Workflow,
  Gauge,
  FileStack,
} from 'lucide-react';

const CATEGORY_LABELS: Record<string, string> = {
  all: 'All tools',
  basic: 'Core',
  convert: 'Convert',
  advanced: 'Advanced & OCR',
  ai: 'AI',
};

// Highlighted capabilities. Every entry maps to a tool that actually exists.
const FEATURES = [
  { icon: Minimize2, title: 'Compress', desc: 'Shrink large files while keeping text sharp and selectable.', slug: 'compress-pdf' },
  { icon: Layers, title: 'Merge', desc: 'Combine many documents into one, in the order you choose.', slug: 'merge-pdf' },
  { icon: Scissors, title: 'Split', desc: 'Break a document apart or pull out just the pages you need.', slug: 'split-pdf' },
  { icon: FileText, title: 'Convert', desc: 'Move between PDF, Word, Excel, PowerPoint and images.', slug: 'pdf-to-word' },
  { icon: ScanText, title: 'OCR', desc: 'Turn scans and photos into searchable, selectable text.', slug: 'ocr-pdf' },
  { icon: Lock, title: 'Protect', desc: 'Add passwords, encrypt, redact or sign before sharing.', slug: 'protect-pdf' },
  { icon: BrainCircuit, title: 'AI intelligence', desc: 'Summarise long documents and ask questions about them.', slug: 'ai-pdf-chat' },
  { icon: FileStack, title: 'Batch processing', desc: 'Queue many documents and let the workers handle them.', slug: 'batch-processing' },
];

const STEPS = [
  { icon: UploadCloud, title: 'Upload', desc: 'Drag a file in, or pick one from your device to start processing.' },
  { icon: Workflow, title: 'Choose a tool', desc: `Pick from ${PDF_TOOLS.length} tools. Each one has only the controls it actually needs.` },
  { icon: Gauge, title: 'Track progress', desc: 'Jobs run on a real worker queue. You see live status, never a fake bar.' },
  { icon: ShieldCheck, title: 'Download', desc: 'Grab your result from a signed, expiring link. Then it ages out.' },
];

// Mirrors PLAN_LIMITS in apps/api/src/common/effective-plan.ts.
const PLANS = [
  { name: 'Free', price: '$0', cadence: 'forever', features: ['Files up to 25 MB', 'Batches of 3', '5 AI requests / month'], cta: 'Start free', highlight: false },
  { name: 'Pro', price: '$12', cadence: '/ month', features: ['Files up to 250 MB', 'Batches of 50', '500 AI requests / month'], cta: 'Choose Pro', highlight: true },
  { name: 'Business', price: '$49', cadence: '/ month', features: ['Files up to 500 MB', 'Batches of 200', '2,500 AI requests / month'], cta: 'Choose Business', highlight: false },
];

const FAQS = [
  {
    q: 'What happens to my documents after processing?',
    a: 'Uploads use temporary signed storage links. Processing results are tied to your account, and downloading a result requires authentication. File availability depends on the service’s retention settings.',
  },
  {
    q: 'What are the file size and batch limits?',
    a: 'Free covers files up to 25 MB, batches of 3 and 5 AI requests a month. Pro raises that to 250 MB, batches of 50 and 500 AI requests. Business allows 500 MB, batches of 200 and 2,500 AI requests. Enterprise goes to 2 GB with batches of 1,000.',
  },
  {
    q: 'Can I use Doxera from my own code?',
    a: 'Yes. There is a REST API plus Node.js and Python SDKs, and a command line tool. You can create an API key from your account settings and call the same endpoints the web app uses.',
  },
  {
    q: 'Which tools are available?',
    a: `There are ${PDF_TOOLS.length} tools covering core editing, conversion between office formats and images, OCR, redaction, signing, encryption, comparison and repair, plus AI summarising and document chat.`,
  },
];

export default function HomePage() {
  const router = useRouter();
  const reduce = useReducedMotion();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isDragging, setIsDragging] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const filteredTools = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return PDF_TOOLS.filter((tool) => {
      const matchesSearch =
        !q || tool.name.toLowerCase().includes(q) || tool.description.toLowerCase().includes(q);
      const matchesCategory = selectedCategory === 'all' || tool.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory]);

  const categories = useMemo(
    () => [
      { id: 'all', count: PDF_TOOLS.length },
      { id: 'basic', count: PDF_TOOLS.filter((t) => t.category === 'basic').length },
      { id: 'convert', count: PDF_TOOLS.filter((t) => t.category === 'convert').length },
      { id: 'advanced', count: PDF_TOOLS.filter((t) => t.category === 'advanced').length },
      { id: 'ai', count: PDF_TOOLS.filter((t) => t.category === 'ai').length },
    ],
    [],
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) router.push('/tools/compress-pdf');
  };

  return (
    <div className="flex flex-col">
      {/* ================= HERO ================= */}
      <section className="relative overflow-hidden pt-20 pb-24 md:pt-28 md:pb-32">
        {/* Decorative background: grid + aurora. Hidden from assistive tech. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-grid mask-fade opacity-70" />
          <div className="absolute left-1/2 top-[-18%] h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-brand-500/20 blur-[130px] dark:bg-brand-500/25" />
          <div className="absolute right-[6%] top-[22%] h-[340px] w-[340px] rounded-full bg-violet-500/15 blur-[110px]" />
          <div className="absolute left-[6%] top-[38%] h-[280px] w-[280px] rounded-full bg-cyan-400/10 blur-[100px]" />
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            <Reveal>
              <Badge className="mb-6">
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                {PDF_TOOLS.length} tools, one workspace
              </Badge>
            </Reveal>

            <Reveal delay={0.06}>
              <h1 className="text-balance text-4xl font-bold leading-[1.08] tracking-tight text-ink-900 dark:text-white sm:text-5xl md:text-6xl lg:text-7xl">
                Every document.
                <br />
                <span className={cn('text-gradient', !reduce && 'animate-gradient-pan')}>
                  One powerful workspace.
                </span>
              </h1>
            </Reveal>

            <Reveal delay={0.12}>
              <p className="mx-auto mt-6 max-w-xl text-pretty text-base leading-relaxed text-ink-600 dark:text-zinc-400 md:text-lg">
                Compress, convert, sign and understand your PDFs in one place — with real
                processing on a real queue, not a progress bar that lies to you.
              </p>
            </Reveal>

            <Reveal delay={0.18}>
              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button href="/register" size="lg" className="w-full sm:w-auto">
                  Get started free
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Button>
                <Button href="#tools" variant="secondary" size="lg" className="w-full sm:w-auto">
                  Browse all tools
                </Button>
              </div>
              <p className="mt-4 text-xs text-ink-500 dark:text-zinc-500">
                No credit card required. Free tier available.
              </p>
            </Reveal>
          </div>

          {/* Interactive upload preview */}
          <Reveal delay={0.26} y={24}>
            <div className="mx-auto mt-14 max-w-3xl">
              <Card
                glass
                gradientRing
                className={cn(
                  'relative overflow-hidden p-1 transition-shadow duration-300',
                  isDragging && 'shadow-glow-lg',
                )}
              >
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  className={cn(
                    'rounded-[1.1rem] border-2 border-dashed p-10 text-center transition-colors duration-200 md:p-14',
                    isDragging
                      ? 'border-brand-500 bg-brand-500/[0.07]'
                      : 'border-black/10 dark:border-white/10',
                  )}
                >
                  <motion.div
                    animate={reduce || isDragging ? {} : { y: [0, -8, 0] }}
                    transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                    className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-300"
                  >
                    <UploadCloud className="h-8 w-8" aria-hidden />
                  </motion.div>
                  <p className="text-lg font-semibold text-ink-900 dark:text-white">
                    {isDragging ? 'Drop to get started' : 'Drag a PDF here'}
                  </p>
                  <p className="mt-1.5 text-sm text-ink-500 dark:text-zinc-400">
                    or{' '}
                    <Link
                      href="/tools/compress-pdf"
                      className="font-medium text-brand-600 underline-offset-4 hover:underline dark:text-brand-300"
                    >
                      pick a tool
                    </Link>{' '}
                    to begin
                  </p>
                </div>
              </Card>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ================= FEATURES ================= */}
      <section className="border-t border-black/5 py-20 dark:border-white/5 md:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <SectionHeading
              eyebrow="Capabilities"
              title="Everything you need for document work"
              description="Each capability is a real tool in the product, running on the same processing engine."
            />
          </Reveal>

          <Stagger className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ icon: Icon, title, desc, slug }) => (
              <StaggerItem key={title}>
                <HoverLift className="h-full">
                  <Link href={`/tools/${slug}`} className="group block h-full focus-ring rounded-2xl">
                    <Card className="h-full p-6 transition-colors duration-200 hover:border-brand-500/40">
                      <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 transition-transform duration-200 group-hover:scale-105 dark:text-brand-300">
                        <Icon className="h-5 w-5" aria-hidden />
                      </div>
                      <h3 className="text-base font-semibold text-ink-900 dark:text-white">{title}</h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-ink-600 dark:text-zinc-400">{desc}</p>
                    </Card>
                  </Link>
                </HoverLift>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ================= HOW IT WORKS ================= */}
      <section className="relative overflow-hidden border-t border-black/5 py-20 dark:border-white/5 md:py-28">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[var(--background-subtle)]" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <SectionHeading eyebrow="How it works" title="Four steps, no surprises" />
          </Reveal>

          <Stagger className="relative mt-14 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ icon: Icon, title, desc }, i) => (
              <StaggerItem key={title}>
                <div className="relative">
                  <div className="mb-4 flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-900 text-sm font-bold text-white dark:bg-white dark:text-ink-900">
                      {i + 1}
                    </span>
                    <Icon className="h-5 w-5 text-brand-600 dark:text-brand-300" aria-hidden />
                  </div>
                  <h3 className="text-base font-semibold text-ink-900 dark:text-white">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-600 dark:text-zinc-400">{desc}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ================= TOOLS CATALOG ================= */}
      <section id="tools" className="scroll-mt-24 border-t border-black/5 py-20 dark:border-white/5 md:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <SectionHeading
              eyebrow="Full catalogue"
              title={`All ${PDF_TOOLS.length} tools`}
              description="Search or filter to find the one you need."
            />
          </Reveal>

          <Reveal delay={0.08}>
            <div className="mx-auto mt-10 max-w-xl">
              <label htmlFor="tool-search" className="sr-only">
                Search tools
              </label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400 dark:text-zinc-500"
                  aria-hidden
                />
                <input
                  id="tool-search"
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search tools…"
                  className="focus-ring h-12 w-full rounded-full border border-black/10 bg-white/70 pl-11 pr-4 text-sm text-ink-900 placeholder:text-ink-400 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-zinc-500"
                />
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.12}>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedCategory(c.id)}
                  aria-pressed={selectedCategory === c.id}
                  className={cn(
                    'focus-ring rounded-full border px-4 py-2 text-xs font-semibold transition-colors duration-200',
                    selectedCategory === c.id
                      ? 'border-transparent bg-ink-900 text-white dark:bg-white dark:text-ink-900'
                      : 'border-black/10 text-ink-600 hover:bg-black/[0.04] dark:border-white/10 dark:text-zinc-400 dark:hover:bg-white/[0.06]',
                  )}
                >
                  {CATEGORY_LABELS[c.id]}
                  <span className="ml-1.5 opacity-60">{c.count}</span>
                </button>
              ))}
            </div>
          </Reveal>

          {filteredTools.length === 0 ? (
            <Reveal>
              <div className="mt-14 text-center">
                <p className="text-sm text-ink-500 dark:text-zinc-400">
                  No tools match “{searchQuery}”.
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('all');
                  }}
                >
                  Clear filters
                </Button>
              </div>
            </Reveal>
          ) : (
            <Stagger
              gap={0.03}
              className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            >
              {filteredTools.map((tool) => (
                <StaggerItem key={tool.slug}>
                  <Link
                    href={`/tools/${tool.slug}`}
                    className="focus-ring group flex h-full items-start gap-3 rounded-xl border border-black/[0.07] bg-white/60 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-500/40 hover:shadow-card dark:border-white/[0.07] dark:bg-white/[0.03] dark:hover:shadow-card-dark"
                  >
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-300">
                      <FileText className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-ink-900 dark:text-white">
                        {tool.name}
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-ink-500 dark:text-zinc-400">
                        {tool.description}
                      </span>
                    </span>
                  </Link>
                </StaggerItem>
              ))}
            </Stagger>
          )}
        </div>
      </section>

      {/* ================= DEVELOPERS ================= */}
      <section className="border-t border-black/5 py-20 dark:border-white/5 md:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <Reveal>
              <SectionHeading
                align="left"
                eyebrow="For developers"
                title="The same engine, from your own code"
                description="Everything the web app does is available over the REST API, with official Node.js and Python SDKs and a command line tool."
              />
              <div className="mt-7 flex flex-wrap gap-3">
                <Button href="/developers" variant="secondary">
                  <Terminal className="h-4 w-4" aria-hidden />
                  Read the docs
                </Button>
                <Button href="/register" variant="ghost">
                  Get an API key
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            </Reveal>

            <Reveal delay={0.1} y={24}>
              <Card gradientRing className="overflow-hidden">
                <div className="flex items-center gap-2 border-b border-black/5 px-4 py-3 dark:border-white/5">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
                  <span className="ml-2 text-xs text-ink-500 dark:text-zinc-500">compress.py</span>
                </div>
                <pre className="overflow-x-auto p-5 text-[13px] leading-relaxed">
                  <code className="font-mono text-ink-700 dark:text-zinc-300">
                    <span className="text-violet-500 dark:text-violet-400">from</span> doxera{' '}
                    <span className="text-violet-500 dark:text-violet-400">import</span> Client
                    {'\n\n'}
                    client = Client(api_key=<span className="text-emerald-600 dark:text-emerald-400">&quot;...&quot;</span>)
                    {'\n'}
                    job = client.compress(
                    {'\n'}
                    {'  '}<span className="text-emerald-600 dark:text-emerald-400">&quot;report.pdf&quot;</span>,
                    {'\n'}
                    {'  '}level=<span className="text-emerald-600 dark:text-emerald-400">&quot;high&quot;</span>,
                    {'\n'}
                    )
                    {'\n'}
                    job.wait().download(<span className="text-emerald-600 dark:text-emerald-400">&quot;out.pdf&quot;</span>)
                  </code>
                </pre>
              </Card>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ================= PRICING PREVIEW ================= */}
      <section className="relative border-t border-black/5 py-20 dark:border-white/5 md:py-28">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[var(--background-subtle)]" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <SectionHeading
              eyebrow="Pricing"
              title="Start free, upgrade when you need more"
              description="Limits below reflect what the platform actually enforces."
            />
          </Reveal>

          <Stagger className="mx-auto mt-14 grid max-w-5xl grid-cols-1 gap-5 md:grid-cols-3">
            {PLANS.map((plan) => (
              <StaggerItem key={plan.name}>
                <Card
                  gradientRing={plan.highlight}
                  className={cn('relative flex h-full flex-col p-7', plan.highlight && 'shadow-glow')}
                >
                  {plan.highlight && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">Most popular</Badge>
                  )}
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-500 dark:text-zinc-400">
                    {plan.name}
                  </h3>
                  <div className="mt-3 flex items-baseline gap-1.5">
                    <span className="text-4xl font-bold tracking-tight text-ink-900 dark:text-white">
                      {plan.price}
                    </span>
                    <span className="text-sm text-ink-500 dark:text-zinc-400">{plan.cadence}</span>
                  </div>
                  <ul className="mt-6 flex-1 space-y-3">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-ink-600 dark:text-zinc-300">
                        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-300" aria-hidden />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    href="/pricing"
                    variant={plan.highlight ? 'primary' : 'secondary'}
                    className="mt-7 w-full"
                  >
                    {plan.cta}
                  </Button>
                </Card>
              </StaggerItem>
            ))}
          </Stagger>

          <Reveal delay={0.1}>
            <p className="mt-8 text-center text-sm text-ink-500 dark:text-zinc-400">
              Need more?{' '}
              <Link href="/pricing" className="font-medium text-brand-600 underline-offset-4 hover:underline dark:text-brand-300">
                See Enterprise
              </Link>
            </p>
          </Reveal>
        </div>
      </section>

      {/* ================= FAQ ================= */}
      <section className="border-t border-black/5 py-20 dark:border-white/5 md:py-28">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <Reveal>
            <SectionHeading eyebrow="FAQ" title="Questions, answered" />
          </Reveal>

          <div className="mt-12 divide-y divide-black/[0.07] dark:divide-white/[0.07]">
            {FAQS.map((faq, i) => {
              const open = openFaq === i;
              return (
                <Reveal key={faq.q} delay={i * 0.04}>
                  <div>
                    <h3>
                      <button
                        type="button"
                        onClick={() => setOpenFaq(open ? null : i)}
                        aria-expanded={open}
                        aria-controls={`faq-panel-${i}`}
                        className="focus-ring flex w-full items-center justify-between gap-4 rounded-lg py-5 text-left"
                      >
                        <span className="text-base font-semibold text-ink-900 dark:text-white">{faq.q}</span>
                        <ChevronDown
                          className={cn(
                            'h-5 w-5 shrink-0 text-ink-400 transition-transform duration-200 dark:text-zinc-500',
                            open && 'rotate-180',
                          )}
                          aria-hidden
                        />
                      </button>
                    </h3>
                    <div
                      id={`faq-panel-${i}`}
                      hidden={!open}
                      className="pb-5 text-sm leading-relaxed text-ink-600 dark:text-zinc-400"
                    >
                      {faq.a}
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================= FINAL CTA ================= */}
      <section className="border-t border-black/5 py-20 dark:border-white/5 md:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal y={24}>
            <Card
              gradientRing
              className="relative overflow-hidden px-6 py-16 text-center md:px-16 md:py-20"
            >
              <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
                <div className="absolute left-1/2 top-1/2 h-[420px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-500/15 blur-[120px]" />
              </div>
              <h2 className="text-balance text-3xl font-bold tracking-tight text-ink-900 dark:text-white md:text-5xl">
                Ready when you are
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-pretty text-base text-ink-600 dark:text-zinc-400 md:text-lg">
                Create an account and process your first document in under a minute.
              </p>
              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button href="/register" size="lg" className="w-full sm:w-auto">
                  Get started free
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Button>
                <Button href="/pricing" variant="secondary" size="lg" className="w-full sm:w-auto">
                  Compare plans
                </Button>
              </div>
            </Card>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
