'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AlertCircle, ArrowUpRight, Building2, ChevronLeft, ChevronRight, CreditCard, FileText, LayoutDashboard, Loader2, Menu, Settings2, ShieldCheck, Sparkles, UserRound, X } from 'lucide-react';
import { useAuthStore } from '@/lib/auth-store';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';

const links = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/ai-studio', label: 'AI Studio', icon: Sparkles },
  { href: '/organizations', label: 'Organizations', icon: Building2 },
  { href: '/billing', label: 'Billing', icon: CreditCard },
  { href: '/account', label: 'Account', icon: UserRound },
  { href: '/settings', label: 'Settings', icon: Settings2 },
];

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, isHydrated } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const drawer = useRef<HTMLDialogElement>(null);
  useEffect(() => { try { setCollapsed(localStorage.getItem('doxera_sidebar_collapsed') === 'true'); } catch {} }, []);
  useEffect(() => {
    if (isHydrated && !isAuthenticated) router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
  }, [isHydrated, isAuthenticated, pathname, router]);
  useEffect(() => { setMobileOpen(false); }, [pathname]);
  useEffect(() => {
    if (!mobileOpen) { drawer.current?.close(); return; }
    drawer.current?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const controls = drawer.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], [tabindex="0"]');
      if (!controls?.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    const dialog = drawer.current;
    dialog?.addEventListener('keydown', trapFocus);
    const resize = () => { if (window.innerWidth >= 1024) setMobileOpen(false); };
    window.addEventListener('resize', resize);
    return () => { document.body.style.overflow = overflow; window.removeEventListener('resize', resize); dialog?.removeEventListener('keydown', trapFocus); };
  }, [mobileOpen]);
  const toggleCollapse = () => {
    setCollapsed(previous => { const next = !previous; try { localStorage.setItem('doxera_sidebar_collapsed', String(next)); } catch {} return next; });
  };
  if (!isHydrated || !isAuthenticated) return <div role="status" aria-label="Checking your workspace" className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-brand-500" /></div>;
  const admin = user?.role === 'ADMIN' || user?.role === 'SUPERADMIN';
  const navigation = (compact: boolean) => <nav aria-label="Workspace" className="space-y-1.5">
    {[...links, ...(admin ? [{ href: '/admin', label: 'Admin', icon: ShieldCheck }] : [])].map(item => <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} title={compact ? item.label : undefined} aria-label={compact ? item.label : undefined} aria-current={pathname === item.href ? 'page' : undefined} className={cn('focus-ring group relative flex min-h-11 items-center gap-3 overflow-hidden rounded-xl px-3 text-sm font-medium transition-[background-color,color,transform] duration-200 hover:translate-x-0.5', compact && 'justify-center', pathname === item.href ? 'bg-brand-500/10 text-brand-700 dark:text-brand-200' : 'text-[var(--muted)] hover:bg-black/[0.035] hover:text-[var(--foreground)] dark:hover:bg-white/[0.05]')}>
      {pathname === item.href && <span aria-hidden className="absolute inset-y-3 left-0 w-0.5 rounded-full bg-brand-500" />}<item.icon className="h-[18px] w-[18px] shrink-0" aria-hidden />{!compact && item.label}
    </Link>)}
  </nav>;
  return <div className="bg-[var(--background-subtle)]">
    <div className="mx-auto grid max-w-[1680px] transition-[grid-template-columns] duration-300 motion-reduce:transition-none lg:grid-cols-[var(--sidebar-width)_minmax(0,1fr)]" style={{ '--sidebar-width': collapsed ? '88px' : '244px' } as CSSProperties}>
      <aside aria-label="Workspace sidebar" className="hidden border-r border-[var(--card-border)] bg-[var(--background)] lg:block">
        <div className="sticky top-20 flex h-[calc(100dvh-5rem)] min-h-[550px] flex-col px-4 py-6">
          <div className={cn('mb-6 flex items-center px-2', collapsed ? 'justify-center' : 'justify-between')}>
            {!collapsed && <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">Your workspace</span>}
            <button type="button" onClick={toggleCollapse} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed} className="focus-ring rounded-lg p-1.5 text-[var(--muted)] hover:bg-black/5 dark:hover:bg-white/5">{collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}</button>
          </div>
          {navigation(collapsed)}
          <Link href="/#tools" title={collapsed ? 'All PDF tools' : undefined} className={cn('focus-ring mt-7 flex items-center gap-3 rounded-xl border border-[var(--card-border)] px-3 py-3 text-sm font-medium transition-colors hover:border-brand-500/40', collapsed && 'justify-center')}><FileText className="h-[18px] w-[18px] shrink-0 text-brand-500" />{!collapsed && <><span className="flex-1">All PDF tools</span><ArrowUpRight className="h-3.5 w-3.5" /></>}</Link>
          <div className="mt-auto border-t border-[var(--card-border)] pt-5">
            <Link href="/account" aria-label={collapsed ? 'Your account' : undefined} className={cn('focus-ring flex items-center gap-3 rounded-xl p-2', collapsed && 'justify-center')}><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-xs font-bold text-brand-700 dark:text-brand-200">{(user?.name || user?.email || 'U').slice(0, 1).toUpperCase()}</span>{!collapsed && <div className="min-w-0"><p className="truncate text-xs font-semibold">{user?.name || user?.email || 'Your account'}</p><p className="mt-1 text-[10px] text-[var(--muted)]">{user?.plan ? `${user.plan} workspace` : 'Account'}</p></div>}</Link>
          </div>
        </div>
      </aside>
      <div className="min-w-0 px-4 pb-14 pt-5 sm:px-6 lg:px-8 lg:pt-9 xl:px-10">
        <div className="mb-6 flex items-center justify-between border-b border-[var(--card-border)] pb-4 lg:hidden"><button type="button" onClick={() => setMobileOpen(true)} aria-haspopup="dialog" aria-expanded={mobileOpen} aria-label="Open workspace navigation" className="focus-ring flex items-center gap-2 rounded-lg p-2 text-sm font-semibold"><Menu className="h-4 w-4" />Workspace</button><span className="rounded-full bg-brand-500/10 px-3 py-1 text-[10px] font-semibold text-brand-700 dark:text-brand-200">{user?.plan || 'Account'}</span></div>
        {children}
      </div>
    </div>
    <dialog ref={drawer} onCancel={() => setMobileOpen(false)} onClose={() => setMobileOpen(false)} aria-labelledby="workspace-navigation-title" className="fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-[300px] max-w-[calc(100vw-3rem)] border-r border-[var(--card-border)] bg-[var(--elevated)] p-5 text-[var(--foreground)] shadow-2xl backdrop:bg-ink-950/60 backdrop:backdrop-blur-sm" onClick={event => { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX > rect.right) setMobileOpen(false); }}>
      <div className="mb-8 flex items-center justify-between"><h2 id="workspace-navigation-title" className="text-sm font-semibold">Your workspace</h2><button type="button" onClick={() => setMobileOpen(false)} aria-label="Close workspace navigation" className="focus-ring rounded-full p-2 text-[var(--muted)]"><X className="h-5 w-5" /></button></div>
      {navigation(false)}
      <Button href="/#tools" variant="secondary" className="mt-8 w-full">All PDF tools <ArrowUpRight className="h-4 w-4" /></Button>
    </dialog>
  </div>;
}

export function WorkspaceHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode }) {
  return <div className="mb-8 flex flex-wrap items-end justify-between gap-5"><div className="min-w-0">{eyebrow && <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-brand-600 dark:text-brand-300">{eyebrow}</p>}<h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>{description && <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">{description}</p>}</div>{actions && <div className="flex flex-wrap gap-2">{actions}</div>}</div>;
}

export function WorkspaceState({ loading, title, description, error, onRetry, children }: { loading?: boolean; title?: string; description?: string; error?: string; onRetry?: () => void; children?: ReactNode }) {
  return <div className="surface rounded-2xl p-8 text-center sm:p-12" role={error ? 'alert' : 'status'}>{loading ? <Loader2 className="mx-auto mb-4 h-6 w-6 animate-spin text-brand-500" aria-hidden /> : error ? <AlertCircle className="mx-auto mb-4 h-6 w-6 text-rose-500" aria-hidden /> : <FileText className="mx-auto mb-4 h-7 w-7 text-brand-500" aria-hidden />}<h2 className="text-base font-semibold">{loading ? title || 'Loading your workspace…' : title || (error ? 'Something needs another try' : 'Ready when you are')}</h2>{(error || description) && <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-[var(--muted)]">{error || description}</p>}{onRetry && <Button onClick={onRetry} variant="secondary" className="mt-5">Try again</Button>}{children}</div>;
}
