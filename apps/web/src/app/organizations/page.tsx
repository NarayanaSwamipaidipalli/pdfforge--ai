'use client';

import { useState, type FormEvent } from 'react';
import { Building2, Users, HardDrive, Plus, Trash2 } from 'lucide-react';
import { ApiClient } from '@/lib/api-client';
import { formatBytes } from '@/lib/workspace';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Reveal } from '@/components/ui/Motion';
import { useToast } from '@/components/ui/Toast';
import { WorkspaceShell, WorkspaceHeader, WorkspaceState } from '@/components/workspace/WorkspaceShell';
import { Field, Panel, inputClass, errorMessage, useWorkspaceResource } from '@/components/workspace/WorkspaceForms';
import { isOrganizationList } from '@/lib/workspace';

import type { OrganizationMember as Member, Organization } from '@/lib/workspace';
export default function OrganizationsPage() {
  const resource = useWorkspaceResource<Organization[]>('/organizations', true, isOrganizationList);
  const [selected, setSelected] = useState('');
  const [modal, setModal] = useState<'create' | 'member' | 'remove' | null>(null);
  const [target, setTarget] = useState<Member | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('MEMBER');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { addToast } = useToast();
  const active = resource.data?.find(org => org.id === selected) || resource.data?.[0];
  const canManage = active && ['OWNER', 'ADMIN'].includes(active.myRole);
  function open(kind: typeof modal) { setError(''); setName(''); setEmail(''); setRole('MEMBER'); setModal(kind); }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setError('');
    try {
      if (modal === 'create') {
        const created = await ApiClient.request<Organization>('/organizations', { method: 'POST', body: JSON.stringify({ name: name.trim() }) });
        setSelected(created.id); addToast('Organization created.', 'success');
      } else if (active && modal === 'member') {
        await ApiClient.request('/organizations/' + encodeURIComponent(active.id) + '/invite', { method: 'POST', body: JSON.stringify({ email: email.trim(), role }) });
        addToast('Member added.', 'success');
      } else if (active && target && modal === 'remove') {
        await ApiClient.request('/organizations/' + encodeURIComponent(active.id) + '/members/' + encodeURIComponent(target.userId), { method: 'DELETE' });
        addToast('Member removed.', 'success');
      }
      setModal(null); resource.reload();
    } catch (error) { setError(errorMessage(error)); } finally { setBusy(false); }
  }
  return <WorkspaceShell>
    <WorkspaceHeader eyebrow="Work together" title="Organizations" description="Your teams, members and shared workspace details." actions={<><Button variant="secondary" onClick={resource.reload} loading={resource.loading}>Refresh</Button><Button onClick={() => open('create')}><Plus className="h-4 w-4" />New organization</Button></>} />
    {resource.error ? <WorkspaceState error={resource.error} onRetry={resource.reload} /> : resource.loading ? <WorkspaceState loading title="Loading organizations…" /> : !active ? <WorkspaceState title="A place for your team" description="Create your first organization to bring your members together."><Button className="mt-5" onClick={() => open('create')}>Create organization</Button></WorkspaceState> : <div className="grid items-start gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
      <Reveal><Panel title="Your organizations"><div className="space-y-2">{resource.data?.map(org => <button key={org.id} aria-pressed={active.id === org.id} onClick={() => setSelected(org.id)} className={'focus-ring flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors ' + (active.id === org.id ? 'border-brand-500/40 bg-brand-500/10' : 'border-transparent hover:bg-brand-500/5')}><Building2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" /><span className="min-w-0"><span className="block break-words text-sm font-semibold">{org.name}</span><span className="mt-1 block text-xs text-[var(--muted)]">{org.myRole}</span></span></button>)}</div></Panel></Reveal>
      <div className="min-w-0 space-y-6"><Reveal><Panel title={active.name} description="Details returned by your organization service."><div className="grid gap-4 sm:grid-cols-3">{[{ label: 'Members', value: active.members.length, icon: Users }, { label: 'Storage used', value: formatBytes(active.storageUsedBytes), icon: HardDrive }, { label: 'Storage allowance', value: formatBytes(active.storageLimitBytes), icon: Building2 }].map(item => <div key={item.label} className="rounded-xl bg-brand-500/5 p-4"><item.icon className="mb-3 h-4 w-4 text-brand-500" /><p className="text-xs text-[var(--muted)]">{item.label}</p><p className="mt-2 text-lg font-semibold">{item.value}</p></div>)}</div><p className="text-xs text-[var(--muted)]">Organization tier: {active.plan || 'Unavailable'}. Personal subscriptions and payments are managed in Billing.</p></Panel></Reveal>
      <Reveal><Panel title="Members" description={canManage ? 'Add people and manage access to this organization.' : 'Your role allows you to view this member list.'}>
        {canManage && <Button onClick={() => open('member')}><Plus className="h-4 w-4" />Add member</Button>}
        <ul className="divide-y divide-[var(--card-border)]">{active.members.map(member => <li key={member.id} className="flex flex-wrap items-center gap-3 py-4"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-sm font-semibold text-brand-600 dark:text-brand-300">{(member.user.name || member.user.email).slice(0, 1).toUpperCase()}</span><div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold">{member.user.name || member.user.email}</p><p className="mt-1 break-all text-xs text-[var(--muted)]">{member.user.email}</p></div><span className="rounded-full bg-brand-500/10 px-2 py-1 text-[10px] font-semibold">{member.role}</span>{canManage && member.role !== 'OWNER' && <button className="focus-ring rounded-lg p-2 text-[var(--muted)] hover:text-rose-500" aria-label={'Remove member ' + member.user.email} onClick={() => { setTarget(member); open('remove'); }}><Trash2 className="h-4 w-4" /></button>}</li>)}</ul>
      </Panel></Reveal></div>
    </div>}
    <Modal isOpen={!!modal} onClose={() => setModal(null)} busy={busy} title={modal === 'create' ? 'Create organization' : modal === 'member' ? 'Add member' : 'Remove member?'}>
      <form onSubmit={submit} className="space-y-5">
        {modal === 'create' && <Field label="Organization name"><input className={inputClass} value={name} onChange={event => setName(event.target.value)} required maxLength={120} /></Field>}
        {modal === 'member' && <><p className="text-sm leading-relaxed text-[var(--muted)]">This grants membership immediately. No invitation email is sent. If this email has no account, the service creates a placeholder account.</p><Field label="Member email"><input className={inputClass} type="email" required value={email} onChange={event => setEmail(event.target.value)} /></Field><Field label="Role"><select className={inputClass} value={role} onChange={event => setRole(event.target.value)}><option value="MEMBER">Member</option><option value="VIEWER">Viewer</option><option value="ADMIN">Admin</option></select></Field></>}
        {modal === 'remove' && <p className="break-words text-sm text-[var(--muted)]">Remove {target?.user.email} from {active?.name}? Their organization access will be removed.</p>}
        {error && <p role="alert" className="text-sm text-rose-500">{error}</p>}<div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="secondary" disabled={busy} onClick={() => setModal(null)}>Cancel</Button><Button type="submit" variant={modal === 'remove' ? 'danger' : 'primary'} loading={busy}>{modal === 'create' ? 'Create organization' : modal === 'member' ? 'Add member' : 'Remove member'}</Button></div>
      </form>
    </Modal>
  </WorkspaceShell>;
}
