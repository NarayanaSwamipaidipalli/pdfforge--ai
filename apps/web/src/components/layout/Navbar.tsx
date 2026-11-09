'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useAuthStore } from '@/lib/auth-store';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import {
  FileCheck2,
  ChevronDown,
  LayoutDashboard,
  User,
  CreditCard,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react';

const UNAUTH_LINKS = [
  { label: 'Home', href: '/' },
  { label: 'Tools', href: '/#tools' },
  { label: 'Pricing', href: '/pricing' },
];

const AUTH_LINKS = [
  { label: 'Home', href: '/' },
  { label: 'Tools', href: '/#tools' },
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Billing', href: '/billing' },
];

const ACCOUNT_MENU = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Account', href: '/account', icon: User },
  { label: 'Billing', href: '/billing', icon: CreditCard },
  { label: 'Settings', href: '/settings', icon: Settings },
];

export const Navbar = () => {
  const pathname = usePathname();
  const router = useRouter();
  const reduce = useReducedMotion();
  const { user, isAuthenticated, logout, syncProfile } = useAuthStore();

  const [mounted, setMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    syncProfile();
    // syncProfile is a stable store action, so this still runs once on mount.
  }, [syncProfile]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setUserDropdownOpen(false);
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    setUserDropdownOpen(false);
    setMobileMenuOpen(false);
  }, [pathname]);

  // Prevent background scroll while the mobile drawer is open.
  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const handleLogout = async () => {
    setUserDropdownOpen(false);
    setMobileMenuOpen(false);
    await logout();
    router.push('/');
  };

  const loggedIn = mounted && isAuthenticated && user;
  const links = loggedIn ? AUTH_LINKS : UNAUTH_LINKS;
  // Hash links (e.g. "/#tools") point at a section of another page, never a route of their own.
  const isActive = (href: string) => {
    if (href.includes('#')) return false;
    return href === '/' ? pathname === '/' : pathname.startsWith(href);
  };

  return (
    <>
      <header
        className={cn(
          'sticky top-0 z-50 w-full transition-all duration-300',
          scrolled
            ? 'border-b border-black/[0.07] bg-white/80 backdrop-blur-xl dark:border-white/[0.07] dark:bg-ink-950/80'
            : 'border-b border-transparent bg-transparent',
        )}
      >
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          {/* Brand */}
          <Link href="/" className="focus-ring group flex shrink-0 items-center gap-2.5 rounded-lg">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white shadow-glow transition-transform duration-200 group-hover:scale-105">
              <FileCheck2 className="h-4 w-4" aria-hidden />
            </span>
            <span className="text-lg font-semibold tracking-tight text-ink-900 dark:text-white">Doxera</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden items-center gap-1 md:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'focus-ring relative rounded-full px-3.5 py-2 text-sm font-medium transition-colors duration-200',
                  isActive(link.href)
                    ? 'text-ink-900 dark:text-white'
                    : 'text-ink-600 hover:text-ink-900 dark:text-zinc-400 dark:hover:text-white',
                )}
              >
                {isActive(link.href) && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 -z-10 rounded-full bg-black/[0.05] dark:bg-white/[0.08]"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                {link.label}
              </Link>
            ))}
          </div>

          {/* Right cluster */}
          <div className="flex items-center gap-2">
            <ThemeToggle />

            {!mounted ? (
              <div className="h-9 w-24 rounded-full skeleton" aria-hidden />
            ) : loggedIn ? (
              <div className="relative hidden md:block" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setUserDropdownOpen((v) => !v)}
                  aria-expanded={userDropdownOpen}
                  aria-haspopup="menu"
                  className="focus-ring flex items-center gap-2 rounded-full border border-black/10 py-1.5 pl-1.5 pr-3 transition-colors hover:bg-black/[0.04] dark:border-white/10 dark:hover:bg-white/[0.06]"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                    {(user.name || user.email || '?').charAt(0).toUpperCase()}
                  </span>
                  <span className="max-w-[9rem] truncate text-sm font-medium text-ink-800 dark:text-zinc-200">
                    {user.name || user.email}
                  </span>
                  <ChevronDown
                    className={cn('h-4 w-4 text-ink-400 transition-transform duration-200', userDropdownOpen && 'rotate-180')}
                    aria-hidden
                  />
                </button>

                <AnimatePresence>
                  {userDropdownOpen && (
                    <motion.div
                      role="menu"
                      initial={{ opacity: 0, y: reduce ? 0 : -6, scale: reduce ? 1 : 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: reduce ? 0 : -6, scale: reduce ? 1 : 0.97 }}
                      transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                      className="glass-panel absolute right-0 mt-2 w-60 overflow-hidden rounded-2xl p-1.5 shadow-card dark:shadow-card-dark"
                    >
                      <div className="border-b border-black/5 px-3 py-2.5 dark:border-white/5">
                        <p className="truncate text-sm font-semibold text-ink-900 dark:text-white">
                          {user.name || 'Account'}
                        </p>
                        <p className="truncate text-xs text-ink-500 dark:text-zinc-400">{user.email}</p>
                      </div>
                      <div className="py-1">
                        {ACCOUNT_MENU.map(({ label, href, icon: Icon }) => (
                          <Link
                            key={href}
                            href={href}
                            role="menuitem"
                            className="focus-ring flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink-700 transition-colors hover:bg-black/[0.05] dark:text-zinc-300 dark:hover:bg-white/[0.07]"
                          >
                            <Icon className="h-4 w-4 text-ink-400" aria-hidden />
                            {label}
                          </Link>
                        ))}
                      </div>
                      <div className="border-t border-black/5 pt-1 dark:border-white/5">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={handleLogout}
                          className="focus-ring flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-rose-600 transition-colors hover:bg-rose-500/10 dark:text-rose-400"
                        >
                          <LogOut className="h-4 w-4" aria-hidden />
                          Sign out
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <div className="hidden items-center gap-2 md:flex">
                <Button href="/login" variant="ghost" size="sm">
                  Sign in
                </Button>
                <Button href="/signup" size="sm">
                  Get started
                </Button>
              </div>
            )}

            {/* Mobile trigger */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
              aria-expanded={mobileMenuOpen}
              className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-700 hover:bg-black/[0.05] dark:text-zinc-300 dark:hover:bg-white/[0.08] md:hidden"
            >
              <Menu className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </nav>
      </header>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-[60] md:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setMobileMenuOpen(false)}
              className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm"
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
              initial={{ x: reduce ? 0 : '100%', opacity: reduce ? 0 : 1 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: reduce ? 0 : '100%', opacity: reduce ? 0 : 1 }}
              transition={{ type: 'spring', stiffness: 320, damping: 34 }}
              className="absolute right-0 top-0 flex h-full w-[84%] max-w-sm flex-col bg-[var(--background)] shadow-2xl"
            >
              <div className="flex h-16 items-center justify-between border-b border-black/[0.07] px-5 dark:border-white/[0.07]">
                <span className="text-base font-semibold text-ink-900 dark:text-white">Menu</span>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close menu"
                  className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-600 hover:bg-black/[0.05] dark:text-zinc-400 dark:hover:bg-white/[0.08]"
                >
                  <X className="h-5 w-5" aria-hidden />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5">
                <div className="space-y-1">
                  {links.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="focus-ring block rounded-xl px-4 py-3 text-base font-medium text-ink-800 transition-colors hover:bg-black/[0.05] dark:text-zinc-200 dark:hover:bg-white/[0.07]"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>

                {loggedIn && (
                  <div className="mt-6 border-t border-black/[0.07] pt-5 dark:border-white/[0.07]">
                    <p className="px-4 pb-2 text-xs font-semibold uppercase tracking-wider text-ink-400">Account</p>
                    {ACCOUNT_MENU.map(({ label, href, icon: Icon }) => (
                      <Link
                        key={href}
                        href={href}
                        className="focus-ring flex items-center gap-3 rounded-xl px-4 py-3 text-base text-ink-700 transition-colors hover:bg-black/[0.05] dark:text-zinc-300 dark:hover:bg-white/[0.07]"
                      >
                        <Icon className="h-4 w-4 text-ink-400" aria-hidden />
                        {label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-black/[0.07] p-5 dark:border-white/[0.07]">
                {loggedIn ? (
                  <Button variant="secondary" className="w-full" onClick={handleLogout}>
                    <LogOut className="h-4 w-4" aria-hidden />
                    Sign out
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <Button href="/signup" className="w-full">
                      Get started
                    </Button>
                    <Button href="/login" variant="secondary" className="w-full">
                      Sign in
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
