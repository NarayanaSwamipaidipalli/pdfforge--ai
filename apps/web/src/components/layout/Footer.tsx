import Link from 'next/link';
import { FileCheck2 } from 'lucide-react';

const COLUMNS: { heading: string; links: { label: string; href: string }[] }[] = [
  {
    heading: 'Tools',
    links: [
      { label: 'Compress PDF', href: '/tools/compress-pdf' },
      { label: 'Merge PDF', href: '/tools/merge-pdf' },
      { label: 'Split PDF', href: '/tools/split-pdf' },
      { label: 'OCR PDF', href: '/tools/ocr-pdf' },
      { label: 'Watermark PDF', href: '/tools/pdf-watermark' },
      { label: 'Encrypt PDF', href: '/tools/pdf-encryption' },
    ],
  },
  {
    heading: 'Product',
    links: [
      { label: 'AI Studio', href: '/ai-studio' },
      { label: 'Organizations', href: '/organizations' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'Developers', href: '/developers' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Blog', href: '/blog' },
      { label: 'Contact', href: '/contact' },
      { label: 'Help centre', href: '/help' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
      { label: 'Cookies', href: '/cookies' },
    ],
  },
];

export const Footer = () => (
  <footer className="border-t border-black/[0.07] bg-[var(--background-subtle)] dark:border-white/[0.07]">
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="grid grid-cols-2 gap-10 md:grid-cols-6">
        <div className="col-span-2">
          <Link href="/" className="focus-ring inline-flex items-center gap-2.5 rounded-lg">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
              <FileCheck2 className="h-4 w-4" aria-hidden />
            </span>
            <span className="text-lg font-semibold tracking-tight text-ink-900 dark:text-white">Doxera</span>
          </Link>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-500 dark:text-zinc-400">
            A single workspace for compressing, converting, securing and understanding your documents.
          </p>
        </div>

        {COLUMNS.map((column) => (
          <div key={column.heading}>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-900 dark:text-white">
              {column.heading}
            </h2>
            <ul className="mt-4 space-y-2.5">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="focus-ring rounded text-sm text-ink-500 transition-colors hover:text-ink-900 dark:text-zinc-400 dark:hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-black/[0.07] pt-7 dark:border-white/[0.07] sm:flex-row">
        <p className="text-xs text-ink-500 dark:text-zinc-500">
          &copy; {new Date().getFullYear()} Doxera. All rights reserved.
        </p>
        <p className="text-xs text-ink-400 dark:text-zinc-600">Built for document-heavy teams.</p>
      </div>
    </div>
  </footer>
);
