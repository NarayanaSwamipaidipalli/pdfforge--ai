'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';
import {
  Sparkles,
  ChevronDown,
  LayoutDashboard,
  User,
  CreditCard,
  Key,
  Settings,
  LogOut,
  Menu,
  X,
  FileCheck2,
  Shield,
  ExternalLink,
} from 'lucide-react';

export const Navbar = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, isHydrated, logout, syncProfile } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    syncProfile();
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setUserDropdownOpen(false);
      }
    };

    if (userDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [userDropdownOpen]);

  // Close menus on route change
  useEffect(() => {
    setUserDropdownOpen(false);
    setMobileMenuOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    setUserDropdownOpen(false);
    setMobileMenuOpen(false);
    await logout();
    router.push('/');
  };

  const navLinks = [
    { label: 'Tools', href: '/#tools' },
    { label: 'Features', href: '/features' },
    { label: 'AI Studio', href: '/ai-studio', badge: 'GPT-4o' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'Developers', href: '/developers' },
    ...(mounted && (user?.role === 'ADMIN' || user?.role === 'SUPERADMIN')
      ? [{ label: 'Admin', href: '/admin' }]
      : []),
  ];

  const getPlanBadgeClass = (plan?: string) => {
    switch (plan) {
      case 'ENTERPRISE':
        return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800';
      case 'BUSINESS':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800';
      case 'PRO':
        return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800';
      default:
        return 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700';
    }
  };

  const isUserLoggedIn = mounted && isAuthenticated && user;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-black/[0.06] dark:border-white/[0.08] bg-white/80 dark:bg-black/80 backdrop-blur-xl transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform duration-200">
            <FileCheck2 className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-lg tracking-tight text-zinc-900 dark:text-white flex items-center gap-1.5">
              PDFForge <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-medium border border-blue-200 dark:border-blue-900">AI</span>
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3.5 py-1.5 text-sm font-medium rounded-full transition-all duration-150 flex items-center gap-1.5 ${
                  isActive
                    ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
                }`}
              >
                {link.label}
                {link.badge && (
                  <span className="text-[10px] uppercase font-semibold px-1.5 py-0.2 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 text-white leading-none">
                    {link.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Desktop Session / Auth Controls */}
        <div className="hidden md:flex items-center gap-3">
          {isUserLoggedIn ? (
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                aria-expanded={userDropdownOpen}
                aria-haspopup="true"
              >
                {/* User Avatar */}
                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white text-xs flex items-center justify-center font-bold overflow-hidden shadow-inner shrink-0">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.name || 'User'} className="w-full h-full object-cover" />
                  ) : (
                    <span>{(user.name?.[0] || user.email?.[0] || 'U').toUpperCase()}</span>
                  )}
                </div>

                {/* User Name & Plan */}
                <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200 max-w-[120px] truncate">
                  {user.name || user.email.split('@')[0]}
                </span>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${getPlanBadgeClass(user.plan)}`}>
                  {user.plan || 'FREE'}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-zinc-500 transition-transform duration-200 ${userDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* User Dropdown Menu */}
              {userDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  {/* Account Header */}
                  <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800/80">
                    <p className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
                      {user.name || 'Account'}
                    </p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                      {user.email}
                    </p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getPlanBadgeClass(user.plan)}`}>
                        {user.plan || 'FREE'} PLAN
                      </span>
                      {user.role === 'ADMIN' || user.role === 'SUPERADMIN' ? (
                        <span className="text-[10px] font-semibold text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-900">
                          {user.role}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Navigation Links */}
                  <div className="py-1 text-xs text-zinc-700 dark:text-zinc-300">
                    <Link
                      href="/account"
                      className="flex items-center gap-2.5 px-4 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors"
                    >
                      <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span>My Account</span>
                    </Link>

                    <Link
                      href="/dashboard"
                      className="flex items-center gap-2.5 px-4 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors"
                    >
                      <LayoutDashboard className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <span>Dashboard</span>
                    </Link>

                    <Link
                      href="/billing"
                      className="flex items-center gap-2.5 px-4 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors"
                    >
                      <CreditCard className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Billing & Subscriptions</span>
                    </Link>

                    <Link
                      href="/dashboard#keys"
                      className="flex items-center gap-2.5 px-4 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors"
                    >
                      <Key className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      <span>API Keys</span>
                    </Link>

                    <Link
                      href="/settings"
                      className="flex items-center gap-2.5 px-4 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors"
                    >
                      <Settings className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                      <span>Settings & Security</span>
                    </Link>
                  </div>

                  {/* Logout Action */}
                  <div className="pt-1 border-t border-zinc-100 dark:border-zinc-800/80">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full text-left flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white px-3 py-1.5 transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 px-4 py-2 rounded-full shadow-sm transition-all hover:shadow"
              >
                Get Started Free
              </Link>
            </>
          )}
        </div>

        {/* Mobile Hamburger Button */}
        <div className="md:hidden flex items-center">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white focus:outline-none"
            aria-label="Toggle mobile menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black px-4 pt-2 pb-6 space-y-3">
          {isUserLoggedIn && (
            <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.name || 'User'} className="w-full h-full object-cover rounded-full" />
                ) : (
                  <span>{(user.name?.[0] || user.email?.[0] || 'U').toUpperCase()}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
                  {user.name || 'User'}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                  {user.email}
                </div>
              </div>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getPlanBadgeClass(user.plan)}`}>
                {user.plan || 'FREE'}
              </span>
            </div>
          )}

          <div className="space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 text-base font-medium text-zinc-800 dark:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                {link.label}
              </Link>
            ))}
          </div>

          {isUserLoggedIn ? (
            <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 space-y-1 text-sm font-medium">
              <Link
                href="/account"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <User className="w-4 h-4 text-blue-600" /> My Account
              </Link>
              <Link
                href="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <LayoutDashboard className="w-4 h-4 text-indigo-600" /> Dashboard
              </Link>
              <Link
                href="/billing"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <CreditCard className="w-4 h-4 text-emerald-600" /> Billing
              </Link>
              <Link
                href="/settings"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <Settings className="w-4 h-4 text-zinc-600" /> Settings
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full text-left flex items-center gap-2 px-3 py-2 text-rose-600 dark:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40"
              >
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            </div>
          ) : (
            <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 flex flex-col gap-2">
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center py-2 px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 font-medium text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center py-2 px-4 rounded-xl bg-blue-600 text-white font-medium text-sm hover:bg-blue-700"
              >
                Get Started Free
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
};
