'use client';

import { useState, type FormEvent } from 'react';
import { KeyRound, Monitor, Palette, Copy, Trash2 } from 'lucide-react';
import { ApiClient } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';
import { formatDate } from '@/lib/billing';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Reveal } from '@/components/ui/Motion';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useToast } from '@/components/ui/Toast';
import { WorkspaceShell, WorkspaceHeader, WorkspaceState } from '@/components/workspace/WorkspaceShell';
import { Field, Panel, inputClass, errorMessage, useWorkspaceResource } from '@/components/workspace/WorkspaceForms';

interface AccessKey { id: string; name: string; permissions: string[]; createdAt: string; lastUsedAt?: string }
interface Session { id: string; userAgent?: string; ipAddress?: string; lastActiveAt: string; createdAt: string }
type Confirmation = { kind: 'key' | 'session' | 'sessions'; id?: string; name?: string };
export default function SettingsPage() {
  const keys = useWorkspaceResource<AccessKey[]>('/auth/api-keys');
  const sessions = useWorkspaceResource<Session[]>('/auth/sessions');
  const { logout } = useAuthStore();
  const { addToast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [plainKey, setPlainKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const createKey = async (event: FormEvent) => {
    event.preventDefault(); if (busy) return; setBusy(true); setError('');
    try {
      const result = await ApiClient.request<{ apiKey: string }>('/auth/api-keys', { method: 'POST', body: JSON.stringify({ name: name.trim() }) });
      if (!result.apiKey) throw new Error('The service did not return a key.');
      setPlainKey(result.apiKey); keys.reload();
    } catch (error) { setError(errorMessage(error)); } finally { setBusy(false); }
  };
  const revoke = async () => {
    if (!confirmation || busy) return; setBusy(true); setError('');
    try {
      const endpoint = confirmation.kind === 'key' ? '/auth/api-keys/' + encodeURIComponent(confirmation.id!) : confirmation.kind === 'session' ? '/auth/sessions/' + encodeURIComponent(confirmation.id!) : '/auth/sessions';
      await ApiClient.request(endpoint, { method: 'DELETE' });
      if (confirmation.kind === 'key') { keys.reload(); addToast('API key revoked.', 'success'); }
      else { await logout(); window.location.assign('/login'); }
      setConfirmation(null);
    } catch (error) { setError(errorMessage(error)); } finally { setBusy(false); }
  };
  return <WorkspaceShell>
    <WorkspaceHeader eyebrow="Make it yours" title="Settings" description="Appearance, developer access and the sessions connected to your account." />
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]"><div className="space-y-6">
      <Reveal><Panel title="Appearance" description="Your theme preference is saved in this browser."><div className="flex items-center justify-between gap-4"><div className="flex items-center gap-3"><Palette className="h-5 w-5 text-brand-500" /><p className="text-sm font-medium">Light & dark themes</p></div><ThemeToggle /></div></Panel></Reveal>
      <Reveal><Panel id="api-keys" title="API keys" description="Create named access keys and revoke them when no longer needed.">
        <div className="flex flex-wrap items-center justify-between gap-3"><span className="flex items-center gap-2 text-sm text-[var(--muted)]"><KeyRound className="h-4 w-4" />{keys.loading ? 'Loading keys…' : keys.data ? keys.data.length + ' active keys' : 'Keys unavailable'}</span><Button onClick={() => { setName(''); setPlainKey(''); setError(''); setCreateOpen(true); }}>Create API key</Button></div>
        {keys.error ? <WorkspaceState error={keys.error} onRetry={keys.reload} /> : keys.loading ? <WorkspaceState loading title="Loading access keys…" /> : !keys.data?.length ? <p className="rounded-xl border border-dashed border-[var(--card-border)] p-6 text-sm text-[var(--muted)]">No API keys yet. Create one when you need programmatic access.</p> : <ul className="divide-y divide-[var(--card-border)]">{keys.data.map(key => <li key={key.id} className="flex items-start justify-between gap-3 py-4"><div className="min-w-0"><p className="break-words text-sm font-semibold">{key.name}</p><p className="mt-1 break-words text-xs text-[var(--muted)]">{key.permissions.join(', ')}</p><p className="mt-2 text-xs text-[var(--muted)]">Created {formatDate(key.createdAt)} · Last used {key.lastUsedAt ? formatDate(key.lastUsedAt) : 'never'}</p></div><button className="focus-ring shrink-0 rounded-lg p-2 text-[var(--muted)] hover:text-rose-500" aria-label={'Revoke key ' + key.name} onClick={() => { setError(''); setConfirmation({ kind: 'key', id: key.id, name: key.name }); }}><Trash2 className="h-4 w-4" /></button></li>)}</ul>}
      </Panel></Reveal>
      <Reveal><Panel id="sessions" title="Sessions" description="Review the sign-ins recorded for your account. Revoking a session also invalidates account refresh credentials and signs you out here.">
        <div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={sessions.reload} loading={sessions.loading}>Refresh sessions</Button><Button variant="ghost" disabled={!sessions.data?.length} onClick={() => { setError(''); setConfirmation({ kind: 'sessions' }); }}>Revoke all sessions</Button></div>
        {sessions.error ? <WorkspaceState error={sessions.error} onRetry={sessions.reload} /> : sessions.loading ? <WorkspaceState loading title="Loading sessions…" /> : !sessions.data?.length ? <p className="text-sm text-[var(--muted)]">No active session records returned.</p> : <ul className="divide-y divide-[var(--card-border)]">{sessions.data.map(session => <li key={session.id} className="flex items-start gap-3 py-4"><Monitor className="mt-1 h-5 w-5 shrink-0 text-brand-500" /><div className="min-w-0 flex-1"><p className="break-all text-xs leading-relaxed">{session.userAgent || 'Device information unavailable'}</p><p className="mt-2 text-xs text-[var(--muted)]">IP: {session.ipAddress || 'Unavailable'}</p><p className="mt-1 text-xs text-[var(--muted)]">Last active {formatDate(session.lastActiveAt)}</p></div><button className="focus-ring shrink-0 rounded-lg p-2 text-[var(--muted)] hover:text-rose-500" aria-label={'Revoke session ' + session.id} onClick={() => { setError(''); setConfirmation({ kind: 'session', id: session.id }); }}><Trash2 className="h-4 w-4" /></button></li>)}</ul>}
      </Panel></Reveal>
    </div><div className="space-y-6">
      <Reveal><Panel title="Account security"><p className="text-sm leading-relaxed text-[var(--muted)]">Manage your password and connected Google sign-in from your account.</p><Button href="/account#password" variant="secondary" className="w-full">Account security</Button><div className="rounded-xl bg-brand-500/5 p-4"><p className="text-sm font-medium">Two-factor authentication</p><p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">Setup is currently unavailable. The service does not yet support verified TOTP enrollment.</p></div></Panel></Reveal>
      <Reveal><Panel title="Notifications"><p className="text-sm leading-relaxed text-[var(--muted)]">Email notification preferences are not available yet. Check your dashboard for document processing updates.</p><Button href="/dashboard" variant="ghost">View activity</Button></Panel></Reveal>
    </div></div>
    <Modal isOpen={createOpen} onClose={() => { setCreateOpen(false); setPlainKey(''); }} busy={busy} title={plainKey ? 'Save your API key' : 'Create API key'}>
      {plainKey ? <div className="space-y-5"><p className="text-sm text-[var(--muted)]">Copy this secret now and store it securely. It is only shown once.</p><code className="block break-all rounded-xl bg-[var(--background)] p-4 text-sm">{plainKey}</code><Button variant="secondary" onClick={async () => { try { await navigator.clipboard.writeText(plainKey); addToast('API key copied.', 'success'); } catch { setError('Clipboard access failed. Select and copy the key manually.'); } }}><Copy className="h-4 w-4" /> Copy key</Button><Button onClick={() => { setCreateOpen(false); setPlainKey(''); }}>Done</Button>{error && <p role="alert" className="text-sm text-rose-500">{error}</p>}</div> : <form onSubmit={createKey} className="space-y-5"><Field label="Key name"><input className={inputClass} required maxLength={120} value={name} onChange={event => setName(event.target.value)} placeholder="Document automation" /></Field><p className="text-xs text-[var(--muted)]">Uses the service’s default PDF read and write permissions.</p>{error && <p role="alert" className="text-sm text-rose-500">{error}</p>}<Button type="submit" loading={busy} disabled={!name.trim()}>Create key</Button></form>}
    </Modal>
    <Modal isOpen={!!confirmation} onClose={() => setConfirmation(null)} busy={busy} title={confirmation?.kind === 'key' ? 'Revoke this API key?' : 'Revoke sessions?'}>
      <div className="space-y-5"><p className="break-words text-sm text-[var(--muted)]">{confirmation?.kind === 'key' ? 'Applications using ' + confirmation.name + ' will lose access. This cannot be undone.' : 'This invalidates account refresh credentials. You will need to sign in again.'}</p>{error && <p role="alert" className="text-sm text-rose-500">{error}</p>}<div className="flex flex-wrap justify-end gap-2"><Button variant="secondary" disabled={busy} onClick={() => setConfirmation(null)}>Cancel</Button><Button variant="danger" loading={busy} onClick={revoke}>Revoke access</Button></div></div>
    </Modal>
  </WorkspaceShell>;
}
