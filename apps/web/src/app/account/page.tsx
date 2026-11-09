'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { UserRound, ShieldCheck, HardDrive } from 'lucide-react';
import { ApiClient } from '@/lib/api-client';
import { useAuthStore, type AuthUser } from '@/lib/auth-store';
import { formatBytes } from '@/lib/workspace';
import { formatDate } from '@/lib/billing';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Reveal } from '@/components/ui/Motion';
import { useToast } from '@/components/ui/Toast';
import { WorkspaceShell, WorkspaceHeader, WorkspaceState } from '@/components/workspace/WorkspaceShell';
import { Field, Panel, inputClass, errorMessage, useWorkspaceResource } from '@/components/workspace/WorkspaceForms';

export default function AccountPage() {
  const router = useRouter();
  const { updateUser, logout, syncProfile } = useAuthStore();
  const { addToast } = useToast();
  const profile = useWorkspaceResource<AuthUser>('/auth/me');
  const [name, setName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState<'delete' | 'disconnect' | null>(null);
  const [deleteText, setDeleteText] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  useEffect(() => { if (profile.data) { setName(profile.data.name || ''); setAvatarUrl(profile.data.avatarUrl || ''); } }, [profile.data]);
  const user = profile.data;
  const local = user?.provider !== 'GOOGLE';
  const google = Boolean(user?.googleId || user?.provider?.includes('GOOGLE'));
  async function action(key: string, run: () => Promise<void>) {
    if (busy) return;
    setBusy(key); setError('');
    try { await run(); } catch (error) { setError(errorMessage(error)); } finally { setBusy(''); }
  }
  const save = (event: FormEvent) => {
    event.preventDefault();
    void action('profile', async () => {
      const updated = await ApiClient.request<AuthUser>('/auth/profile', { method: 'PATCH', body: JSON.stringify({ name: name.trim(), avatarUrl: avatarUrl.trim() }) });
      updateUser({ name: updated.name, avatarUrl: updated.avatarUrl }); profile.reload();
      addToast('Profile saved.', 'success');
    });
  };
  const password = (event: FormEvent) => {
    event.preventDefault();
    if (newPassword !== repeat) { setError('New passwords must match.'); return; }
    void action('password', async () => {
      await ApiClient.request('/auth/change-password', { method: 'POST', body: JSON.stringify({ oldPassword, newPassword }) });
      await logout(); router.replace('/login'); addToast('Password changed. Sign in with your new password.', 'success');
    });
  };
  const connect = () => void action('google', async () => {
    const data = await ApiClient.request<{ url: string }>('/auth/google/link-url', { method: 'POST', body: JSON.stringify({ redirectUri: window.location.origin + '/auth/callback' }) });
    const url = new URL(data.url);
    if (url.protocol !== 'https:' || url.hostname !== 'accounts.google.com') throw new Error('Google authorization URL unavailable.');
    sessionStorage.setItem('doxera_google_link_state', url.searchParams.get('state') || '');
    window.location.assign(url.href);
  });
  const confirm = (event: FormEvent) => {
    event.preventDefault();
    void action('confirm', async () => {
      if (confirmation === 'delete') {
        if (deleteText !== 'DELETE') throw new Error('Type DELETE to confirm.');
        await ApiClient.request('/auth/account', { method: 'DELETE', body: JSON.stringify({ confirmation: deleteText, password: deletePassword || undefined }) });
        await logout(); router.replace('/');
      } else {
        await ApiClient.request('/auth/google/disconnect', { method: 'POST' });
        await syncProfile(); profile.reload(); addToast('Google disconnected.', 'success');
      }
      setConfirmation(null);
    });
  };
  return <WorkspaceShell>
    <WorkspaceHeader eyebrow="Your identity" title="Account" description="A home for your profile, sign-in methods and personal account." actions={<Button variant="secondary" onClick={profile.reload} loading={profile.loading}>Refresh profile</Button>} />
    {error && !confirmation && <p role="alert" className="mb-5 rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-600 dark:text-rose-300">{error}</p>}
    {profile.error ? <WorkspaceState error={profile.error} onRetry={profile.reload} /> : !user ? <WorkspaceState loading title="Loading your account…" /> : <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-6">
        <Reveal><Panel title="Personal details" description="These details appear across your workspace.">
          <form onSubmit={save} className="space-y-5">
            <Field label="Full name"><input className={inputClass} value={name} maxLength={120} autoComplete="name" onChange={event => setName(event.target.value)} required /></Field>
            <Field label="Email address" hint="Your sign-in email is managed by your authentication method."><input className={inputClass} type="email" value={user.email} readOnly /></Field>
            <Field label="Avatar URL" hint="Optional. Use the HTTPS address of an image you want displayed."><input className={inputClass} type="url" pattern="https://.*" value={avatarUrl} placeholder="https://" onChange={event => setAvatarUrl(event.target.value)} /></Field>
            <Button type="submit" disabled={!!busy} loading={busy === 'profile'}>Save profile</Button>
          </form>
        </Panel></Reveal>
        <Reveal><Panel id="password" title="Password" description={local ? 'Changing your password signs you out of existing sessions.' : 'This account uses Google to sign in.'}>
          {local ? <form onSubmit={password} className="space-y-5">
            <Field label="Current password"><input className={inputClass} type="password" autoComplete="current-password" required value={oldPassword} onChange={event => setOldPassword(event.target.value)} /></Field>
            <div className="grid gap-4 sm:grid-cols-2"><Field label="New password" hint="At least 8 characters."><input className={inputClass} type="password" autoComplete="new-password" minLength={8} required value={newPassword} onChange={event => setNewPassword(event.target.value)} /></Field><Field label="Confirm new password"><input className={inputClass} type="password" autoComplete="new-password" minLength={8} required value={repeat} onChange={event => setRepeat(event.target.value)} /></Field></div>
            <Button type="submit" variant="secondary" disabled={!!busy} loading={busy === 'password'}>Change password</Button>
          </form> : <p className="text-sm text-[var(--muted)]">Manage your password through your Google account.</p>}
        </Panel></Reveal>
        <Reveal><Panel title="Connected sign-in" description="Manage the Google account used to access this workspace.">
          <div className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-brand-500" /><div><p className="text-sm font-semibold">Google</p><p className="mt-1 text-xs text-[var(--muted)]">{google ? 'Connected' : 'Not connected'}</p></div></div>
            <Button variant="secondary" disabled={!!busy || (google && !local)} loading={busy === 'google'} onClick={() => { if (google) { setError(''); setConfirmation('disconnect'); } else connect(); }}>{google ? 'Disconnect Google' : 'Connect Google'}</Button></div>
          {google && !local && <p className="text-xs text-[var(--muted)]">Google is your only sign-in method and cannot be disconnected.</p>}
        </Panel></Reveal>
        <Reveal><Panel title="Delete account" description="Permanently delete your account and its associated data. This cannot be undone."><Button variant="danger" onClick={() => { setError(''); setDeleteText(''); setDeletePassword(''); setConfirmation('delete'); }}>Delete my account</Button></Panel></Reveal>
      </div>
      <Reveal><Panel title="Your workspace">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/10 text-xl font-semibold text-brand-600 dark:text-brand-300"><UserRound className="h-6 w-6" /></div>
        <dl className="space-y-5 text-sm"><div><dt className="text-xs text-[var(--muted)]">Current plan</dt><dd className="mt-1 font-semibold">{user.plan || 'Unavailable'}</dd></div><div><dt className="text-xs text-[var(--muted)]">Member since</dt><dd className="mt-1">{user.createdAt ? formatDate(user.createdAt) : 'Unavailable'}</dd></div><div><dt className="text-xs text-[var(--muted)]">Email status</dt><dd className="mt-1">{user.isEmailVerified ? 'Verified' : 'Unverified'}</dd></div><div><dt className="flex items-center gap-2 text-xs text-[var(--muted)]"><HardDrive className="h-4 w-4" /> Storage used</dt><dd className="mt-1">{formatBytes(user.storageUsedBytes)}</dd><dd className="mt-1 text-xs text-[var(--muted)]">Allowance: {formatBytes(user.storageLimitBytes)}</dd></div></dl>
        <Button href="/billing" variant="secondary" className="w-full">Manage billing</Button><Button href="/settings#sessions" variant="ghost" className="w-full">Review sessions</Button>
      </Panel></Reveal>
    </div>}
    <Modal isOpen={!!confirmation} onClose={() => setConfirmation(null)} busy={!!busy} title={confirmation === 'delete' ? 'Delete your account?' : 'Disconnect Google?'}>
      <form onSubmit={confirm} className="space-y-5">
        <p className="text-sm text-[var(--muted)]">{confirmation === 'delete' ? 'This permanently removes your account. Type DELETE and enter your password to confirm.' : 'You will need your local password to sign in after disconnecting Google.'}</p>
        {confirmation === 'delete' && <><Field label="Confirmation"><input className={inputClass} value={deleteText} required autoComplete="off" onChange={event => setDeleteText(event.target.value)} /></Field>{local && <Field label="Password"><input className={inputClass} type="password" autoComplete="current-password" required value={deletePassword} onChange={event => setDeletePassword(event.target.value)} /></Field>}</>}
        {error && <p role="alert" className="text-sm text-rose-600 dark:text-rose-300">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="secondary" disabled={!!busy} onClick={() => setConfirmation(null)}>Keep account</Button><Button type="submit" variant="danger" loading={!!busy} disabled={confirmation === 'delete' && deleteText !== 'DELETE'}>{confirmation === 'delete' ? 'Permanently delete' : 'Disconnect'}</Button></div>
      </form>
    </Modal>
  </WorkspaceShell>;
}
