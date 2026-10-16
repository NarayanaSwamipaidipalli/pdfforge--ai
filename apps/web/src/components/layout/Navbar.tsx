'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';
import {
  Sparkles,
  Layers,
  ChevronDown,
  LayoutDashboard,
  Shield,
  CreditCard,
  Users,
  Menu,
  X,
  FileCheck2,
} from 'lucide-react';

export const Navbar = () => {
  const pathname = usePathname();
  const { user, isAuthenticated, logout } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { label: 'Tools', href: '/#tools' },
    { label: 'AI Studio', href: '/ai-studio', badge: 'GPT-4o' },
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Organizations', href: '/organizations' },
    { label: 'Pricing', href: '/pricing' },
    ...(user?.role === 'ADMIN' || user?.role === 'SUPERADMIN'
      ? [{ label: 'Admin', href: '/admin' }]
      : []),
  ];

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

        {/* Desktop Navigation */}
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

        {/* User Session & CTA */}
        <div className="hidden md:flex items-center gap-3">
          {isAuthenticated && user ? (
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard"
                className="flex items-center gap-2 pl-2 pr-3 py-1 rounded-full border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">
                  {user.name?.[0] || 'U'}
                </div>
                <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200">
                  {user.name}
                </span>
                <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-1.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                  {user.plan}
                </span>
              </Link>
            </div>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white px-3 py-1.5"
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

        {/* Mobile Hamburger */}
        <div className="md:hidden flex items-center">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 focus:outline-none"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black px-4 pt-2 pb-6 space-y-2">
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
          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 flex flex-col gap-2">
            <Link
              href="/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center py-2 px-4 rounded-xl bg-blue-600 text-white font-medium text-sm"
            >
              Open Dashboard
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};
