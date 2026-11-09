'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import { Users, FileText, CreditCard, ShieldCheck, RefreshCw, Search } from 'lucide-react';
import { ApiClient } from '@/lib/api-client';
import { formatDate, formatMoney } from '@/lib/billing';
import { formatBytes } from '@/lib/workspace';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Reveal } from '@/components/ui/Motion';
import { useToast } from '@/components/ui/Toast';
import { WorkspaceShell, WorkspaceHeader, WorkspaceState } from '@/components/workspace/WorkspaceShell';
import { Field, Panel, inputClass, errorMessage, isListOf, useWorkspaceResource } from '@/components/workspace/WorkspaceForms';

type Tab = 'overview' | 'users' | 'jobs' | 'billing' | 'audit';
interface Account { id: string; name?: string; email: string; globalRole: string; role?: string; plan: string; isBanned: boolean; storageUsedBytes?: string }
interface Job { id: string; tool: string; status: string; progress: number; createdAt: string; errorMessage?: string; userId: string; user?: { email: string } }
interface Payment { id: string; amount: number; currency: string; status: string; provider: string; createdAt: string; user?: { email: string } }
interface Coupon { id: string; code: string; discountPercent?: number; discountAmount?: number; usedCount: number; maxUses: number; isActive: boolean }
interface Audit { id: string; action: string; resource?: string; ipAddress?: string; createdAt: string; user?: { email: string } }
interface Telemetry { metrics: { totalUsers: number; totalJobs: number; filesProcessed: number; failedJobsCount: number; activeSubscriptions: number; revenueByCurrency: Record<string, number>; revenuePeriodStart?: string }; topTools: { tool: string; count: number }[] }
type Action = { kind: 'ban' | 'unban' | 'role'; account: Account } | { kind: 'retry'; job: Job } | { kind: 'coupon' };
function DataTable({ headers, children }: { headers: string[]; children: ReactNode }) {
  return <div className="overflow-x-auto rounded-xl border border-[var(--card-border)]"><table className="w-full text-left text-xs"><thead className="bg-brand-500/5"><tr>{headers.map(header => <th scope="col" key={header} className="whitespace-nowrap px-4 py-3 font-semibold text-[var(--muted)]">{header}</th>)}</tr></thead><tbody className="divide-y divide-[var(--card-border)] [&_td]:px-4 [&_td]:py-4">{children}</tbody></table></div>;
}
export default function AdminPage() {
  const me = useWorkspaceResource<Account>('/auth/me');
  const myRole = me.data?.globalRole || me.data?.role;
  const allowed = myRole === 'ADMIN' || myRole === 'SUPERADMIN';
  const [tab, setTab] = useState<Tab>('overview');
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const telemetry = useWorkspaceResource<Telemetry>('/admin/telemetry', allowed && tab === 'overview');
  const users = useWorkspaceResource<{ users: Account[]; total: number }>('/admin/users?limit=25&offset=' + offset + '&search=' + encodeURIComponent(search), allowed && tab === 'users');
  const jobs = useWorkspaceResource<{ jobs: Job[]; total: number }>('/admin/jobs?limit=25&offset=' + offset, allowed && tab === 'jobs');
  const payments = useWorkspaceResource<Payment[]>('/admin/transactions?limit=50', allowed && tab === 'billing', isListOf<Payment>);
  const coupons = useWorkspaceResource<Coupon[]>('/admin/coupons', allowed && tab === 'billing', isListOf<Coupon>);
  const audit = useWorkspaceResource<Audit[]>('/admin/audit-logs?limit=50', allowed && tab === 'audit', isListOf<Audit>);
  const [action, setAction] = useState<Action | null>(null);
  const [reason, setReason] = useState('');
  const [role, setRole] = useState('USER');
  const [code, setCode] = useState('');
  const [discount, setDiscount] = useState('');
  const [maxUses, setMaxUses] = useState('100');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { addToast } = useToast();
  const current = tab === 'overview' ? telemetry : tab === 'users' ? users : tab === 'jobs' ? jobs : tab === 'billing' ? payments : audit;
  const refresh = () => { current.reload(); if (tab === 'billing') coupons.reload(); };
  function open(next: Action) { setError(''); setReason(''); setRole('account' in next ? next.account.globalRole : 'USER'); setCode(''); setDiscount(''); setMaxUses('100'); setAction(next); }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!action || busy) return; setBusy(true); setError('');
    try {
      if (action.kind === 'coupon') await ApiClient.request('/admin/coupons', { method: 'POST', body: JSON.stringify({ code: code.trim().toUpperCase(), discountPercent: Number(discount), maxUses: Number(maxUses) }) });
      else if (action.kind === 'retry') {
        const result = await ApiClient.request<{ success: boolean }>('/pdf/jobs/' + encodeURIComponent(action.job.id) + '/retry', { method: 'POST' });
        if (result.success !== true) throw new Error('The retry was not accepted.');
      } else await ApiClient.request('/admin/users/' + encodeURIComponent(action.account.id) + '/' + action.kind, { method: action.kind === 'role' ? 'PATCH' : 'POST', body: JSON.stringify(action.kind === 'role' ? { role } : action.kind === 'ban' ? { reason: reason.trim() } : {}) });
      setAction(null); refresh(); addToast('Change confirmed by the service.', 'success');
    } catch (error) { setError(errorMessage(error)); } finally { setBusy(false); }
  }
  const pagination = (total: number) => <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--muted)]"><span>{total ? offset + 1 : 0}–{Math.min(offset + 25, total)} of {total}</span><div className="flex gap-2"><Button size="sm" variant="secondary" disabled={offset === 0 || current.loading} onClick={() => setOffset(value => Math.max(0, value - 25))}>Previous</Button><Button size="sm" variant="secondary" disabled={offset + 25 >= total || current.loading} onClick={() => setOffset(value => value + 25)}>Next</Button></div></div>;
  return <WorkspaceShell>
    <WorkspaceHeader eyebrow="Administration" title="Admin" description="Account management, processing records and billing activity." actions={allowed && <Button variant="secondary" loading={current.loading} onClick={refresh}><RefreshCw className="h-4 w-4" />Refresh</Button>} />
    {me.error ? <WorkspaceState error={me.error} onRetry={me.reload} /> : me.loading ? <WorkspaceState loading title="Checking administrative access…" /> : !allowed ? <WorkspaceState title="Administrative access required" description="This account does not have permission to open the admin workspace."><Button href="/dashboard" variant="secondary" className="mt-5">Return to dashboard</Button></WorkspaceState> : <>
      <div role="tablist" aria-label="Administration" className="mb-6 flex flex-wrap gap-2">{(['overview', 'users', 'jobs', 'billing', 'audit'] as Tab[]).map(item => <button role="tab" aria-selected={tab === item} key={item} onClick={() => { setTab(item); setOffset(0); }} className={'focus-ring rounded-full px-5 py-2.5 text-sm font-semibold capitalize transition-colors ' + (tab === item ? 'bg-brand-500 text-white shadow-glow' : 'surface text-[var(--muted)] hover:text-[var(--foreground)]')}>{item}</button>)}</div>
      {tab === 'users' && <form className="mb-5 flex max-w-xl gap-2" onSubmit={event => { event.preventDefault(); setOffset(0); setSearch(searchDraft.trim()); }}><input aria-label="Search accounts" className={inputClass} value={searchDraft} onChange={event => setSearchDraft(event.target.value)} placeholder="Search name or email" /><Button type="submit" variant="secondary"><Search className="h-4 w-4" />Search</Button></form>}
      {current.error ? <WorkspaceState error={current.error} onRetry={refresh} /> : current.loading ? <WorkspaceState loading title="Loading administrative records…" /> : <div role="tabpanel" className="space-y-6">
        {tab === 'overview' && telemetry.data && <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[{ label: 'Registered accounts', value: telemetry.data.metrics.totalUsers, icon: Users }, { label: 'Processing jobs', value: telemetry.data.metrics.totalJobs, icon: FileText }, { label: 'File records', value: telemetry.data.metrics.filesProcessed, icon: FileText }, { label: 'Failed jobs', value: telemetry.data.metrics.failedJobsCount, icon: ShieldCheck }].map(item => <Reveal key={item.label}><div className="surface rounded-2xl p-6"><div className="flex items-center justify-between text-xs text-[var(--muted)]">{item.label}<item.icon className="h-4 w-4 text-brand-500" /></div><p className="mt-5 text-3xl font-semibold">{typeof item.value === 'number' ? item.value.toLocaleString() : 'Unavailable'}</p></div></Reveal>)}</div>
          <div className="grid gap-6 lg:grid-cols-2"><Panel title="Settled revenue" description="Completed payments in the current UTC calendar month, separated by currency.">{Object.entries(telemetry.data.metrics.revenueByCurrency || {}).length ? Object.entries(telemetry.data.metrics.revenueByCurrency).map(([currency, amount]) => <p key={currency} className="text-2xl font-semibold">{formatMoney(amount, currency)}</p>) : <p className="text-sm text-[var(--muted)]">No completed payment totals returned for this period.</p>}<p className="text-xs text-[var(--muted)]">Subscription records marked ACTIVE: {telemetry.data.metrics.activeSubscriptions}. This count does not check expiration dates.</p></Panel><Panel title="Most-used tools" description="Job counts across the platform.">{telemetry.data.topTools.length ? telemetry.data.topTools.map(tool => <div key={tool.tool} className="flex items-center justify-between gap-4 text-sm"><span className="break-words">{tool.tool.replace(/_/g, ' ')}</span><span className="font-semibold">{tool.count}</span></div>) : <p className="text-sm text-[var(--muted)]">No tool activity yet.</p>}</Panel></div>
        </>}
        {tab === 'users' && users.data && <><DataTable headers={['Account', 'Role', 'Stored plan', 'Storage', 'Access', 'Actions']}>{users.data.users.map(account => <tr key={account.id}><td><p className="font-semibold">{account.name || 'Unnamed account'}</p><p className="mt-1 max-w-60 break-all text-[var(--muted)]">{account.email}</p></td><td>{account.globalRole}</td><td>{account.plan}</td><td className="whitespace-nowrap">{formatBytes(account.storageUsedBytes)}</td><td>{account.isBanned ? 'Suspended' : 'Enabled'}</td><td><div className="flex gap-2">{account.id !== me.data?.id && (myRole === 'SUPERADMIN' || !['ADMIN', 'SUPERADMIN'].includes(account.globalRole)) && <Button size="sm" variant="secondary" onClick={() => open({ kind: account.isBanned ? 'unban' : 'ban', account })}>{account.isBanned ? 'Restore' : 'Suspend'}</Button>}{account.id !== me.data?.id && myRole === 'SUPERADMIN' && <Button size="sm" variant="ghost" onClick={() => open({ kind: 'role', account })}>Change role</Button>}</div></td></tr>)}</DataTable>{!users.data.users.length && <p className="text-sm text-[var(--muted)]">No accounts match this search.</p>}{pagination(users.data.total)}<p className="text-xs text-[var(--muted)]">Stored plan values are account records. Effective access is determined by the billing service.</p></>}
        {tab === 'jobs' && jobs.data && <><DataTable headers={['Tool & reference', 'Account', 'Status', 'Created', 'Action']}>{jobs.data.jobs.map(job => <tr key={job.id}><td><p className="font-semibold">{job.tool.replace(/_/g, ' ')}</p><p className="mt-1 max-w-64 break-all text-[var(--muted)]">{job.id}</p>{job.errorMessage && <p className="mt-2 max-w-64 text-rose-600 dark:text-rose-300">{job.errorMessage}</p>}</td><td className="max-w-56 break-all">{job.user?.email || 'Unavailable'}</td><td>{job.status}</td><td className="whitespace-nowrap">{formatDate(job.createdAt)}</td><td>{job.status === 'FAILED' && job.userId === me.data?.id ? <Button size="sm" variant="secondary" onClick={() => open({ kind: 'retry', job })}>Retry</Button> : job.status === 'FAILED' ? <span className="text-[var(--muted)]">Owner can retry</span> : '—'}</td></tr>)}</DataTable>{!jobs.data.jobs.length && <p className="text-sm text-[var(--muted)]">No processing jobs returned.</p>}{pagination(jobs.data.total)}</>}
        {tab === 'billing' && <><Panel title="Payment records" description="Latest 50 payment records, with their stored status and currency."><DataTable headers={['Account', 'Amount', 'Provider', 'Status', 'Date']}>{payments.data?.map(payment => <tr key={payment.id}><td className="max-w-56 break-all">{payment.user?.email || 'Unavailable'}</td><td className="whitespace-nowrap">{formatMoney(payment.amount, payment.currency)}</td><td>{payment.provider}</td><td>{payment.status}</td><td className="whitespace-nowrap">{formatDate(payment.createdAt)}</td></tr>)}</DataTable>{!payments.data?.length && <p className="text-sm text-[var(--muted)]">No payment records returned.</p>}</Panel><Panel title="Coupons" description="Promotional codes recorded by the billing service."><Button onClick={() => open({ kind: 'coupon' })}>Create coupon</Button>{coupons.error ? <WorkspaceState error={coupons.error} onRetry={coupons.reload} /> : coupons.loading ? <WorkspaceState loading /> : <><DataTable headers={['Code', 'Discount', 'Uses', 'Status']}>{coupons.data?.map(coupon => <tr key={coupon.id}><td className="font-mono">{coupon.code}</td><td>{coupon.discountPercent != null ? coupon.discountPercent + '%' : coupon.discountAmount != null ? formatMoney(coupon.discountAmount, 'USD') : 'Unavailable'}</td><td>{coupon.usedCount} / {coupon.maxUses}</td><td>{coupon.isActive ? 'Enabled' : 'Disabled'}</td></tr>)}</DataTable>{!coupons.data?.length && <p className="text-sm text-[var(--muted)]">No coupons returned.</p>}</>}</Panel></>}
        {tab === 'audit' && <Panel title="Audit trail" description="Latest 50 audit records returned by the service."><DataTable headers={['Action', 'Actor', 'Resource', 'IP address', 'Date']}>{audit.data?.map(log => <tr key={log.id}><td>{log.action}</td><td className="max-w-56 break-all">{log.user?.email || 'Unavailable'}</td><td className="max-w-56 break-all">{log.resource || 'Unavailable'}</td><td>{log.ipAddress || 'Unavailable'}</td><td className="whitespace-nowrap">{formatDate(log.createdAt)}</td></tr>)}</DataTable>{!audit.data?.length && <p className="text-sm text-[var(--muted)]">No audit records returned.</p>}</Panel>}
      </div>}
    </>}
    <Modal isOpen={!!action} onClose={() => setAction(null)} busy={busy} title={action?.kind === 'coupon' ? 'Create coupon' : action?.kind === 'retry' ? 'Retry this job?' : action?.kind === 'role' ? 'Change account role?' : action?.kind === 'ban' ? 'Suspend account?' : 'Restore account?'}>
      <form onSubmit={submit} className="space-y-5">
        {action && 'account' in action && <p className="break-all text-sm text-[var(--muted)]">{action.account.email}. This changes account access and invalidates existing sign-in credentials.</p>}
        {action?.kind === 'ban' && <Field label="Reason for suspension"><textarea className={inputClass} required maxLength={500} value={reason} onChange={event => setReason(event.target.value)} /></Field>}
        {action?.kind === 'role' && <Field label="New role"><select className={inputClass} value={role} onChange={event => setRole(event.target.value)}>{['USER', 'SUPPORT', 'ADMIN', 'SUPERADMIN'].map(role => <option key={role}>{role}</option>)}</select></Field>}
        {action?.kind === 'retry' && <p className="text-sm text-[var(--muted)]">The service will attempt this failed job again if the source files are still available.</p>}
        {action?.kind === 'coupon' && <><Field label="Coupon code"><input className={inputClass} required value={code} onChange={event => setCode(event.target.value)} /></Field><Field label="Percentage discount"><input className={inputClass} type="number" min={1} max={100} required value={discount} onChange={event => setDiscount(event.target.value)} /></Field><Field label="Maximum uses"><input className={inputClass} type="number" min={1} step={1} required value={maxUses} onChange={event => setMaxUses(event.target.value)} /></Field></>}
        {error && <p role="alert" className="text-sm text-rose-600 dark:text-rose-300">{error}</p>}<div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="secondary" disabled={busy} onClick={() => setAction(null)}>Cancel</Button><Button type="submit" variant={action?.kind === 'ban' ? 'danger' : 'primary'} loading={busy}>Confirm {action?.kind === 'coupon' ? 'coupon' : action?.kind === 'retry' ? 'retry' : 'change'}</Button></div>
      </form>
    </Modal>
  </WorkspaceShell>;
}
