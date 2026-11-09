import Link from 'next/link';
import { Clock, Cpu, Layers3, ShieldCheck } from 'lucide-react';
import { PDF_TOOLS } from '@/lib/tools-registry';

export const metadata = {
  title: 'About Doxera',
  description: 'What Doxera is, how it handles your files, and how its AI features work.',
};

// Every statement here must match current behaviour in the API and worker.
const pillars = [
  {
    icon: Clock,
    title: 'Files expire after 24 hours',
    body: 'Each uploaded file is given a 24-hour expiry when it is uploaded. A cleanup job runs every 15 minutes and deletes expired files from storage. Job records (tool, status, file names and sizes) stay in your history.',
  },
  {
    icon: Cpu,
    title: 'Choose where AI runs',
    body: 'AI features use a local Ollama model when one is running on the server, so document text stays on that server. OpenAI is used only when an API key is configured. With neither, summaries come from a built-in extractive engine.',
  },
  {
    icon: Layers3,
    title: 'Built from open components',
    body: 'Next.js web app, NestJS API, and Python workers (PyMuPDF, LibreOffice, Tesseract) running jobs through Celery queues. Uploads go straight to object storage through short-lived signed URLs.',
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-16 text-ink-900 dark:bg-ink-950 dark:text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-14">
        <header className="mx-auto max-w-3xl text-center">
          <span className="rounded-full border border-brand-500/20 bg-brand-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-300">
            About Doxera
          </span>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-5xl">PDF tools and document AI in one workspace</h1>
          <p className="mt-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 sm:text-base">
            Doxera offers {PDF_TOOLS.length} PDF and document tools, AI summaries and document chat, team organizations and a REST API, with clear limits on how long your files are kept.
          </p>
        </header>

        <div className="grid gap-5 md:grid-cols-3">
          {pillars.map(({ icon: Icon, title, body }) => (
            <section key={title} className="space-y-3 rounded-3xl border border-black/[0.06] bg-white p-6 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03]">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-300">
                <Icon className="h-5 w-5" aria-hidden />
              </div>
              <h2 className="text-base font-semibold">{title}</h2>
              <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{body}</p>
            </section>
          ))}
        </div>

        <section className="space-y-5 rounded-3xl bg-ink-900 p-8 text-white sm:p-10">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-300">
            <ShieldCheck className="h-4 w-4" aria-hidden /> Security
          </div>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">What we do and do not claim</h2>
          <p className="max-w-2xl text-sm leading-relaxed text-zinc-300">
            Processing workers accept requests only from the Doxera API, which authenticates with a shared secret, and downloads use short-lived signed links. Hosting, encryption, backups and regulatory requirements must be reviewed for each deployment. Doxera holds no independent security certification and does not offer HIPAA agreements or uptime guarantees.
          </p>
          <div className="flex flex-wrap items-center gap-4 pt-1">
            <Link href="/contact" className="rounded-full bg-brand-600 px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-brand-500">Contact us</Link>
            <Link href="/privacy" className="text-xs text-zinc-300 underline hover:text-white">Read the privacy policy</Link>
          </div>
        </section>
      </div>
    </div>
  );
}
