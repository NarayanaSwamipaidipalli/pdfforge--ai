'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  Activity, AlertCircle, ArrowDownToLine, ArrowRight, ArrowUpRight, CheckCircle2,
  Clock3, FileText, HardDrive, KeyRound, Layers, Minimize2, Plus, RefreshCw,
  RotateCcw, ScanText, Scissors, Search, ShieldCheck, Smartphone, Sparkles,
  UserRound, XCircle, type LucideIcon,
} from 'lucide-react';
import { ApiClient } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';
import { PDF_TOOLS } from '@/lib/tools-registry';
import { formatDate, selectCurrentSubscription, type BillingHistory } from '@/lib/billing';
import { downloadAuthenticated, formatBytes } from '@/lib/workspace';
import { WorkspaceHeader, WorkspaceShell, WorkspaceState } from '@/components/workspace/WorkspaceShell';
import { Badge, Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Reveal } from '@/components/ui/Motion';

interface UserJob {
  id: string;
  tool: string;
  status: string;
  progress: number;
  outputFileKey: string | null;
  outputFileSizeBytes: number | string | null;
  durationMs: number | null;
  createdAt: string;
  inputFilesPayload: unknown;
  errorMessage?: string | null;
}

interface Profile {
  id: string;
  email: string;
  name?: string | null;
  isEmailVerified?: boolean;
  storageUsedBytes?: number | string | null;
  storageLimitBytes?: number | string | null;
  createdAt?: string;
}

interface Resource<T> { data: T | null; loading: boolean; error: string }
const initialResource = <T,>(): Resource<T> => ({ data: null, loading: true, error: '' });
const ongoingStatuses = new Set(['QUEUED', 'PROCESSING', 'PENDING']);
const quickTools: { id: string; icon: LucideIcon; description: string }[] = [
  { id: 'compress', icon: Minimize2, description: 'Make a smaller PDF' },
  { id: 'merge', icon: Layers, description: 'Bring documents together' },
  { id: 'split', icon: Scissors, description: 'Keep the pages you need' },
  { id: 'pdf-to-word', icon: FileText, description: 'Continue editing in Word' },
  { id: 'ocr', icon: ScanText, description: 'Recognize scanned text' },
  { id: 'protect', icon: ShieldCheck, description: 'Add PDF password protection' },
];

function errorText(error: unknown) {
  return error instanceof Error ? error.message : 'This information could not be loaded.';
}

function numericBytes(value: Profile['storageUsedBytes']) {
  if (value === null || value === undefined || value === '') return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

function inputNames(job: UserJob) {
  if (!Array.isArray(job.inputFilesPayload)) return [];
  return job.inputFilesPayload.flatMap((file) =>
    file && typeof file === 'object' && typeof file.name === 'string' ? [file.name as string] : []);
}

function toolName(value: string) {
  const normalized = value.toLowerCase().replaceAll('_', '-');
  return PDF_TOOLS.find((tool) => tool.id === normalized || tool.slug === normalized)?.name
    || value.replaceAll('_', ' ').replaceAll('-', ' ');
}

function durationLabel(value: number | null) {
  if (value === null || !Number.isFinite(value) || value < 0) return 'Not recorded';
  return value < 1000 ? `${value.toLocaleString()} ms` : `${(value / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} s`;
}

function JobStatus({ status }: { status: string }) {
  const normalized = status.toUpperCase();
  const Icon = normalized === 'COMPLETED' ? CheckCircle2 : normalized === 'FAILED' ? XCircle : ongoingStatuses.has(normalized) ? Clock3 : FileText;
  const color = normalized === 'COMPLETED'
    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
    : normalized === 'FAILED'
      ? 'border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300'
      : ongoingStatuses.has(normalized)
        ? 'border-brand-500/20 bg-brand-500/10 text-brand-700 dark:text-brand-200'
        : 'border-[var(--card-border)] bg-black/[0.03] text-[var(--muted)] dark:bg-white/[0.04]';
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize ${color}`}><Icon className="h-3 w-3" aria-hidden />{status.toLowerCase().replaceAll('_', ' ')}</span>;
}

function Metric({ title, icon: Icon, value, note, loading, testId }: {
  title: string; icon: LucideIcon; value: ReactNode; note: string; loading: boolean; testId: string;
}) {
  return <Card className="p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><p className="text-xs font-medium text-[var(--muted)]">{title}</p><Icon className="h-4 w-4 text-brand-500" aria-hidden /></div><div data-testid={testId} className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">{loading ? <span className="skeleton inline-block h-8 w-20 rounded-lg" aria-label={`Loading ${title.toLowerCase()}`} /> : value}</div><p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">{note}</p></Card>;
}

function ResourceError({ label, resource, onRetry }: { label: string; resource: Resource<unknown>; onRetry: () => void }) {
  if (!resource.error) return null;
  return <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/[0.06] px-4 py-3 text-sm"><p className="flex min-w-0 flex-1 items-start gap-2 text-rose-700 dark:text-rose-300"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /><span className="break-words"><strong>{label}:</strong> {resource.error}{resource.data !== null ? ' Previously loaded information is shown.' : ''}</span></p><Button size="sm" variant="ghost" onClick={onRetry}>Try again</Button></div>;
}

export default function DashboardPage() {
  const { user, isHydrated, isAuthenticated } = useAuthStore();
  const [jobs, setJobs] = useState<Resource<UserJob[]>>(initialResource);
  const [billing, setBilling] = useState<Resource<BillingHistory>>(initialResource);
  const [profile, setProfile] = useState<Resource<Profile>>(initialResource);
  const [refreshing, setRefreshing] = useState(false);
  const [busyJob, setBusyJob] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [actionNotice, setActionNotice] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const requestGeneration = useRef(0);
  const jobGeneration = useRef(0);

  const getJobs = useCallback(async () => {
    const data = await ApiClient.request<UserJob[]>('/pdf/jobs/user/history');
    if (!Array.isArray(data) || data.some((job) => typeof job.id !== 'string' || typeof job.tool !== 'string' || typeof job.status !== 'string')) throw new Error('The processing service returned incomplete job information.');
    return data;
  }, []);

  const refreshJobs = useCallback(async () => {
    const generation = ++jobGeneration.current;
    try {
      const data = await getJobs();
      if (generation === jobGeneration.current) setJobs({ data, loading: false, error: '' });
    } catch (error) {
      if (generation === jobGeneration.current) setJobs((previous) => ({ ...previous, loading: false, error: errorText(error) }));
    }
  }, [getJobs]);

  const loadDashboard = useCallback(async () => {
    const generation = ++requestGeneration.current;
    const jobsGeneration = ++jobGeneration.current;
    setRefreshing(true);
    setJobs((previous) => ({ ...previous, loading: previous.data === null, error: '' }));
    setBilling((previous) => ({ ...previous, loading: previous.data === null, error: '' }));
    setProfile((previous) => ({ ...previous, loading: previous.data === null, error: '' }));
    const [jobResult, billingResult, profileResult] = await Promise.allSettled([
      getJobs(),
      ApiClient.request<BillingHistory>('/billing/history').then((data) => {
        if (!data || !['FREE', 'PRO', 'BUSINESS', 'ENTERPRISE'].includes(data.currentPlan) || !Array.isArray(data.subscriptions)) throw new Error('The billing service returned incomplete subscription information.');
        return data;
      }),
      ApiClient.request<Profile>('/auth/me').then((data) => {
        if (!data || typeof data.id !== 'string' || typeof data.email !== 'string') throw new Error('Your account information is incomplete.');
        return data;
      }),
    ]);
    if (generation !== requestGeneration.current) return;
    if (jobsGeneration === jobGeneration.current) {
      if (jobResult.status === 'fulfilled') setJobs({ data: jobResult.value, loading: false, error: '' });
      else setJobs((previous) => ({ ...previous, loading: false, error: errorText(jobResult.reason) }));
    }
    if (billingResult.status === 'fulfilled') setBilling({ data: billingResult.value, loading: false, error: '' });
    else setBilling((previous) => ({ ...previous, loading: false, error: errorText(billingResult.reason) }));
    if (profileResult.status === 'fulfilled') setProfile({ data: profileResult.value, loading: false, error: '' });
    else setProfile((previous) => ({ ...previous, loading: false, error: errorText(profileResult.reason) }));
    setRefreshing(false);
  }, [getJobs]);

  useEffect(() => {
    if (!isHydrated || !isAuthenticated) return;
    void loadDashboard();
    return () => { requestGeneration.current += 1; jobGeneration.current += 1; };
  }, [isHydrated, isAuthenticated, loadDashboard]);

  const activeJobs = jobs.data?.filter((job) => ongoingStatuses.has(job.status.toUpperCase())) || [];
  useEffect(() => {
    if (!activeJobs.length || !isAuthenticated) return;
    let pending = false;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible' || pending) return;
      pending = true;
      void refreshJobs().finally(() => { pending = false; });
    }, 8000);
    return () => window.clearInterval(timer);
  }, [activeJobs.length, isAuthenticated, refreshJobs]);

  const performJobAction = async (job: UserJob, action: 'retry' | 'download') => {
    if (busyJob) return;
    setBusyJob(`${job.id}:${action}`); setActionError(''); setActionNotice('');
    try {
      if (action === 'retry') {
        const result = await ApiClient.request<{ success: boolean; message?: string }>(`/pdf/jobs/${encodeURIComponent(job.id)}/retry`, { method: 'POST' });
        if (result.success !== true) throw new Error('The processing service did not confirm this retry. Refresh your job history before trying again.');
        setActionNotice(result.message || 'Your job was re-queued by the processing service.');
        await refreshJobs();
      } else {
        const extension = job.outputFileKey?.split('.').pop();
        const suffix = extension && /^[a-z0-9]{1,8}$/i.test(extension) ? extension : 'pdf';
        await downloadAuthenticated(`/pdf/jobs/${encodeURIComponent(job.id)}/download`, `Doxera_${job.tool.replace(/[^a-z0-9-]/gi, '_')}.${suffix}`);
      }
    } catch (error) { setActionError(errorText(error)); }
    finally { setBusyJob(null); }
  };

  const completed = jobs.data?.filter((job) => job.status.toUpperCase() === 'COMPLETED').length;
  const failed = jobs.data?.filter((job) => job.status.toUpperCase() === 'FAILED').length;
  const other = jobs.data ? jobs.data.length - (completed || 0) - activeJobs.length - (failed || 0) : null;
  const used = numericBytes(profile.data?.storageUsedBytes);
  const limit = numericBytes(profile.data?.storageLimitBytes);
  const storagePercent = used !== null && limit !== null && limit > 0 ? used / limit * 100 : null;
  const subscription = billing.data ? selectCurrentSubscription(billing.data) : null;
  const filteredJobs = jobs.data?.filter((job) => {
    const matchesStatus = statusFilter === 'ALL' || job.status.toUpperCase() === statusFilter;
    return matchesStatus && `${inputNames(job).join(' ')} ${toolName(job.tool)}`.toLowerCase().includes(query.trim().toLowerCase());
  }) || [];
  const firstName = (profile.data?.name || user?.name)?.trim().split(/\s+/)[0];

  return <WorkspaceShell>
    <WorkspaceHeader eyebrow="Your document workspace" title={firstName ? `Welcome back, ${firstName}.` : 'Make room for good work.'} description="Your recent documents, processing activity, and account at a glance." actions={<><Button size="sm" variant="secondary" loading={refreshing} onClick={() => void loadDashboard()}><RefreshCw className="h-3.5 w-3.5" aria-hidden />Refresh overview</Button><Button size="sm" href="/#tools"><Plus className="h-4 w-4" aria-hidden />New document job</Button></>} />
    <div className="space-y-7">
      <div className="space-y-3"><ResourceError label="Processing history" resource={jobs} onRetry={() => void loadDashboard()} /><ResourceError label="Subscription" resource={billing} onRetry={() => void loadDashboard()} /><ResourceError label="Account" resource={profile} onRetry={() => void loadDashboard()} /></div>

      <Reveal><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric title="Recent jobs" icon={FileText} value={jobs.data?.length ?? 'Unavailable'} note="Latest 20 jobs returned by the service" loading={jobs.loading} testId="dashboard-recent-count" />
        <Metric title="Completed" icon={CheckCircle2} value={completed ?? 'Unavailable'} note="Finished within your recent history" loading={jobs.loading} testId="dashboard-completed-count" />
        <Metric title="In progress" icon={Activity} value={jobs.data ? activeJobs.length : 'Unavailable'} note="Queued or processing in recent jobs" loading={jobs.loading} testId="dashboard-active-count" />
        <Metric title="Storage used" icon={HardDrive} value={used === null ? 'Unavailable' : formatBytes(used)} note={limit === null ? 'Storage allowance is unavailable' : `Of ${formatBytes(limit)} account storage`} loading={profile.loading} testId="dashboard-storage-used" />
      </div></Reveal>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
          <Reveal><Card className="p-6 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold tracking-tight">A little less on your plate.</h2><p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">Processing activity across your latest 20 jobs.</p></div><Activity className="h-5 w-5 text-brand-500" aria-hidden /></div>
            {jobs.loading ? <div className="skeleton mt-7 h-20 rounded-xl" aria-label="Loading activity" /> : jobs.data === null ? <p className="mt-7 rounded-xl bg-black/[0.025] p-4 text-sm text-[var(--muted)] dark:bg-white/[0.03]">Activity is unavailable while processing history cannot be loaded.</p> : jobs.data.length === 0 ? <div className="mt-6 rounded-xl border border-dashed border-[var(--card-border)] p-5"><p className="text-sm font-medium">Your next document is a good place to start.</p><p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">Run any PDF tool and its progress will appear here.</p></div> : <>
              <div className="mt-7 flex h-3 overflow-hidden rounded-full bg-black/[0.04] dark:bg-white/[0.05]" aria-hidden>{[{ count: completed || 0, color: 'bg-emerald-500' }, { count: activeJobs.length, color: 'bg-brand-500' }, { count: failed || 0, color: 'bg-rose-500' }, { count: other || 0, color: 'bg-zinc-400' }].map((segment, index) => <div key={index} className={segment.color} style={{ width: `${segment.count / jobs.data!.length * 100}%` }} />)}</div>
              <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-4 text-xs sm:grid-cols-4">{[{ label: 'Completed', count: completed, color: 'bg-emerald-500' }, { label: 'In progress', count: activeJobs.length, color: 'bg-brand-500' }, { label: 'Failed', count: failed, color: 'bg-rose-500' }, { label: 'Other', count: other, color: 'bg-zinc-400' }].map((item) => <div key={item.label}><p className="flex items-center gap-2 text-[var(--muted)]"><span className={`h-2 w-2 rounded-full ${item.color}`} aria-hidden />{item.label}</p><p className="mt-2 pl-4 text-base font-semibold">{item.count}</p></div>)}</div>
              {activeJobs.length > 0 && <p className="mt-5 flex items-center gap-2 text-xs text-brand-700 dark:text-brand-200"><RefreshCw className="h-3 w-3 animate-spin" aria-hidden />Active job statuses refresh while this page is visible.</p>}
            </>}
          </Card></Reveal>

          <Reveal><Card className="p-6 sm:p-7"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold tracking-tight">Start something useful.</h2><p className="mt-2 text-sm text-[var(--muted)]">A few shortcuts to your PDF tools.</p></div><Link href="/#tools" className="focus-ring inline-flex items-center gap-1 rounded-md text-xs font-semibold text-brand-600 dark:text-brand-300">All {PDF_TOOLS.length} tools<ArrowUpRight className="h-3.5 w-3.5" aria-hidden /></Link></div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">{quickTools.map(({ id, icon: Icon, description }) => {
              const tool = PDF_TOOLS.find((item) => item.id === id);
              return tool ? <Link key={id} href={tool.route} className="focus-ring group flex items-start gap-3 rounded-2xl border border-[var(--card-border)] p-4 transition-[border-color,background-color] hover:border-brand-500/30 hover:bg-brand-500/[0.04]"><span className="rounded-xl bg-brand-500/10 p-2.5 text-brand-600 dark:text-brand-300"><Icon className="h-4 w-4" aria-hidden /></span><span className="min-w-0"><span className="block text-xs font-semibold">{tool.name}</span><span className="mt-1.5 block text-xs leading-relaxed text-[var(--muted)]">{description}</span></span><ArrowUpRight className="ml-auto h-3.5 w-3.5 shrink-0 text-[var(--muted)] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden /></Link> : null;
            })}</div>
          </Card></Reveal>
        </div>

        <div className="min-w-0 space-y-6">
          <Reveal><Card gradientRing className="overflow-hidden p-6 sm:p-7"><div className="flex items-center justify-between"><span className="text-xs font-semibold text-[var(--muted)]">Your plan</span><Sparkles className="h-4 w-4 text-brand-500" aria-hidden /></div>
            {billing.loading ? <div className="skeleton mt-6 h-28 rounded-xl" aria-label="Loading plan" /> : billing.data ? <><div className="mt-5 flex flex-wrap items-center gap-3"><h2 className="text-3xl font-semibold tracking-tight">{billing.data.currentPlan}</h2>{subscription && <Badge tone={subscription.cancelAtPeriodEnd ? 'warning' : 'success'}>{subscription.cancelAtPeriodEnd ? 'Cancellation scheduled' : subscription.status.toLowerCase()}</Badge>}</div><p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">{subscription ? `${subscription.cancelAtPeriodEnd ? 'Paid access through' : 'Current period ends'} ${formatDate(subscription.currentPeriodEnd)}.` : billing.data.currentPlan === 'FREE' ? 'For the everyday document task. Explore more room when you need it.' : 'Your account entitlement is provided by the billing service.'}</p><div className="mt-6 border-t border-[var(--card-border)] pt-5"><Button size="sm" href="/billing" variant="secondary" className="w-full">Manage plan & billing<ArrowRight className="h-3.5 w-3.5" aria-hidden /></Button></div></> : <p className="mt-5 text-sm leading-relaxed text-[var(--muted)]">Your subscription details are unavailable. Try refreshing your overview or open Billing.</p>}
          </Card></Reveal>

          <Reveal><Card className="p-6 sm:p-7"><h2 className="flex items-center gap-2 text-sm font-semibold"><HardDrive className="h-4 w-4 text-brand-500" aria-hidden />Space for your work</h2>{profile.loading ? <div className="skeleton mt-6 h-16 rounded-xl" aria-label="Loading storage" /> : <><p className="mt-5 text-lg font-semibold">{used === null ? 'Unavailable' : formatBytes(used)}<span className="text-xs font-normal text-[var(--muted)]">{limit === null ? ' · Allowance unavailable' : ` / ${formatBytes(limit)}`}</span></p>{storagePercent !== null && <><div className="mt-4 h-2 overflow-hidden rounded-full bg-black/[0.05] dark:bg-white/[0.06]" aria-hidden><div className="h-full rounded-full bg-gradient-to-r from-brand-600 to-brand-400" style={{ width: `${Math.min(100, storagePercent)}%` }} /></div><p className="mt-3 text-xs text-[var(--muted)]">{storagePercent.toLocaleString(undefined, { maximumFractionDigits: 1 })}% of your account storage used.</p></>}{(used === null || limit === null) && <p className="mt-3 text-xs leading-relaxed text-[var(--muted)]">A storage meter appears when the account service supplies usage and an allowance.</p>}</>}</Card></Reveal>

          <Reveal><Card className="p-6 sm:p-7"><h2 className="flex items-center gap-2 text-sm font-semibold"><UserRound className="h-4 w-4 text-brand-500" aria-hidden />Your account</h2>{profile.loading ? <div className="skeleton mt-5 h-20 rounded-xl" aria-label="Loading account" /> : profile.data ? <><p className="mt-5 break-all text-sm font-medium">{profile.data.email}</p><div className="mt-3"><Badge tone={profile.data.isEmailVerified ? 'success' : 'neutral'}>{profile.data.isEmailVerified ? 'Email verified' : 'Email unverified'}</Badge></div><p className="mt-4 text-xs text-[var(--muted)]">Member since {formatDate(profile.data.createdAt)}</p><Link href="/account" className="focus-ring mt-5 inline-flex items-center gap-1 rounded-md text-xs font-semibold text-brand-600 dark:text-brand-300">Manage account<ArrowRight className="h-3.5 w-3.5" aria-hidden /></Link></> : <p className="mt-5 text-sm text-[var(--muted)]">Account details are currently unavailable.</p>}</Card></Reveal>
        </div>
      </div>

      <Reveal><Card className="overflow-hidden"><div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--card-border)] p-6 sm:p-7"><div><h2 className="text-lg font-semibold tracking-tight">Recent jobs & documents</h2><p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">Your latest 20 processing jobs. Downloads depend on file availability.</p></div><Badge tone="neutral">{jobs.data ? `${jobs.data.length} recent` : 'History'}</Badge></div>
        {actionError && <div role="alert" className="mx-6 mt-5 flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-300"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{actionError}</div>}
        {actionNotice && <p role="status" className="mx-6 mt-5 rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">{actionNotice}</p>}
        {jobs.loading ? <div role="status" aria-label="Loading recent jobs" className="space-y-4 p-6">{[0, 1, 2].map((item) => <div key={item} className="skeleton h-14 rounded-xl" />)}</div> : jobs.data === null ? <div className="p-6"><WorkspaceState title="Your job history is unavailable" description="Your other workspace information is still available above." error={jobs.error} onRetry={() => void loadDashboard()} /></div> : jobs.data.length === 0 ? <div className="px-6 py-14 text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-500"><FileText className="h-6 w-6" aria-hidden /></span><h3 className="mt-5 text-base font-semibold">Your documents, soon to be here.</h3><p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[var(--muted)]">No processing jobs yet. Choose a PDF tool and upload your first document to get started.</p><Button className="mt-6" href="/#tools" size="sm">Explore PDF tools<ArrowRight className="h-3.5 w-3.5" aria-hidden /></Button></div> : <>
          <div className="flex flex-wrap gap-3 border-b border-[var(--card-border)] px-6 py-4"><div className="relative min-w-0 flex-1 basis-48"><label htmlFor="job-search" className="sr-only">Search recent documents or tools</label><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[var(--muted)]" aria-hidden /><input id="job-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a document or tool" className="focus-ring h-10 w-full rounded-xl border border-[var(--card-border)] bg-[var(--background)] pl-9 pr-3 text-sm placeholder:text-[var(--muted)]" /></div><label className="sr-only" htmlFor="job-status">Filter jobs by status</label><select id="job-status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="focus-ring h-10 max-w-full rounded-xl border border-[var(--card-border)] bg-[var(--background)] px-3 text-xs"><option value="ALL">All statuses</option>{['COMPLETED', 'PROCESSING', 'QUEUED', 'FAILED', 'CANCELED'].map((status) => <option key={status} value={status}>{status.charAt(0) + status.slice(1).toLowerCase()}</option>)}</select></div>
          {filteredJobs.length === 0 ? <div className="p-10 text-center"><p className="text-sm text-[var(--muted)]">No recent jobs match this search.</p><Button variant="ghost" size="sm" className="mt-3" onClick={() => { setQuery(''); setStatusFilter('ALL'); }}>Clear filters</Button></div> : <div className="overflow-x-auto"><table className="w-full min-w-[690px] text-left text-xs"><caption className="sr-only">Recent document processing jobs and their status</caption><thead className="border-b border-[var(--card-border)] bg-black/[0.02] text-[var(--muted)] dark:bg-white/[0.02]"><tr><th scope="col" className="px-6 py-4 font-medium">Document / tool</th><th scope="col" className="px-4 py-4 font-medium">Output</th><th scope="col" className="px-4 py-4 font-medium">Status</th><th scope="col" className="px-4 py-4 font-medium">Created</th><th scope="col" className="px-6 py-4 text-right font-medium">Actions</th></tr></thead><tbody className="divide-y divide-[var(--card-border)]">{filteredJobs.map((job) => {
            const names = inputNames(job);
            const ongoing = ongoingStatuses.has(job.status.toUpperCase());
            return <tr key={job.id} className="transition-colors hover:bg-black/[0.015] dark:hover:bg-white/[0.02]"><td className="max-w-[290px] px-6 py-5"><div className="flex items-start gap-3"><span className="mt-0.5 rounded-lg bg-brand-500/10 p-2 text-brand-500"><FileText className="h-4 w-4" aria-hidden /></span><div className="min-w-0"><p className="break-all font-medium leading-relaxed">{names[0] || 'Input filename unavailable'}{names.length > 1 && <span className="ml-1 text-[var(--muted)]">+{names.length - 1} more</span>}</p><p className="mt-1.5 text-[var(--muted)]">{toolName(job.tool)}</p>{job.status.toUpperCase() === 'FAILED' && job.errorMessage && <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-rose-700 dark:text-rose-300" title={job.errorMessage}>{job.errorMessage}</p>}</div></div></td><td className="px-4 py-5"><p className="font-medium">{job.outputFileSizeBytes === null || job.outputFileSizeBytes === undefined ? 'Not available' : formatBytes(job.outputFileSizeBytes)}</p><p className="mt-1.5 text-[11px] text-[var(--muted)]">{durationLabel(job.durationMs)}</p></td><td className="px-4 py-5"><JobStatus status={job.status} />{ongoing && Number.isFinite(job.progress) && <p className="mt-2 text-[11px] text-[var(--muted)]">{Math.min(100, Math.max(0, job.progress))}% reported</p>}</td><td className="whitespace-nowrap px-4 py-5 text-[var(--muted)]">{formatDate(job.createdAt)}</td><td className="px-6 py-5 text-right">{job.status.toUpperCase() === 'COMPLETED' && job.outputFileKey ? <Button size="sm" variant="secondary" disabled={Boolean(busyJob)} loading={busyJob === `${job.id}:download`} onClick={() => void performJobAction(job, 'download')} aria-label={`Download ${names[0] || 'processed document'}`}><ArrowDownToLine className="h-3.5 w-3.5" aria-hidden />Download</Button> : job.status.toUpperCase() === 'FAILED' ? <Button size="sm" variant="secondary" disabled={Boolean(busyJob)} loading={busyJob === `${job.id}:retry`} onClick={() => void performJobAction(job, 'retry')} aria-label={`Retry ${names[0] || 'failed job'}`}><RotateCcw className="h-3.5 w-3.5" aria-hidden />Retry</Button> : <span className="text-[var(--muted)]">—</span>}</td></tr>;
          })}</tbody></table></div>}
        </>}
      </Card></Reveal>

      <Reveal><div className="grid gap-4 md:grid-cols-3">{[{ href: '/settings#api-keys', icon: KeyRound, title: 'Developer access', description: 'Create and revoke your API keys.' }, { href: '/settings#sessions', icon: Smartphone, title: 'Signed-in devices', description: 'Review and manage active sessions.' }, { href: '/account#password', icon: ShieldCheck, title: 'Account security', description: 'Manage your sign-in credentials.' }].map(({ href, icon: Icon, title, description }) => <Link key={href} href={href} className="focus-ring surface group flex items-start gap-3 rounded-2xl p-5 transition-colors hover:border-brand-500/30"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" aria-hidden /><div className="min-w-0"><h2 className="text-xs font-semibold">{title}</h2><p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">{description}</p></div><ArrowUpRight className="ml-auto h-3.5 w-3.5 shrink-0 text-[var(--muted)]" aria-hidden /></Link>)}</div></Reveal>
    </div>
  </WorkspaceShell>;
}
