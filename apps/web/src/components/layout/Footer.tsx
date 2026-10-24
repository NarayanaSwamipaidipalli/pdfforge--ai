import React from 'react';
import Link from 'next/link';
import { ShieldCheck, Heart, Terminal, Globe2, FileLock2 } from 'lucide-react';

export const Footer = () => {
  return (
    <footer className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          {/* Brand Col */}
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xs">
                PF
              </div>
              <span className="font-semibold text-zinc-900 dark:text-white tracking-tight">
                PDFForge AI
              </span>
            </div>
            <p className="text-xs text-zinc-500 max-w-sm mb-4 leading-relaxed">
              Enterprise document intelligence & high-throughput cloud PDF processing engine.
              Trusted by Fortune 500 legal teams, finance departments, and engineering leaders worldwide.
            </p>
            <div className="flex items-center gap-3 text-xs text-zinc-500">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-4 h-4 text-emerald-500" /> SOC2 Type II Certified
              </span>
              <span className="flex items-center gap-1">
                <FileLock2 className="w-4 h-4 text-blue-500" /> GDPR & HIPAA Compliant
              </span>
            </div>
          </div>

          {/* Col 1 */}
          <div>
            <h4 className="font-semibold text-zinc-900 dark:text-white text-xs uppercase tracking-wider mb-4">
              Core PDF Tools
            </h4>
            <ul className="space-y-2 text-xs">
              <li><Link href="/tools/merge-pdf" className="hover:text-blue-600">Merge PDF</Link></li>
              <li><Link href="/tools/split-pdf" className="hover:text-blue-600">Split PDF</Link></li>
              <li><Link href="/tools/compress-pdf" className="hover:text-blue-600">Compress PDF</Link></li>
              <li><Link href="/tools/pdf-watermark" className="hover:text-blue-600">Add Watermark</Link></li>
              <li><Link href="/tools/pdf-encryption" className="hover:text-blue-600">Protect & Encrypt</Link></li>
            </ul>
          </div>

          {/* Col 2 */}
          <div>
            <h4 className="font-semibold text-zinc-900 dark:text-white text-xs uppercase tracking-wider mb-4">
              AI Intelligence
            </h4>
            <ul className="space-y-2 text-xs">
              <li><Link href="/ai-studio" className="hover:text-blue-600">Document Chat (RAG)</Link></li>
              <li><Link href="/ai-studio" className="hover:text-blue-600">Invoice Extraction</Link></li>
              <li><Link href="/ai-studio" className="hover:text-blue-600">Contract Risk Audit</Link></li>
              <li><Link href="/tools/ocr-pdf" className="hover:text-blue-600">Searchable OCR</Link></li>
              <li><Link href="/tools/ai-document-translator" className="hover:text-blue-600">Document Translator</Link></li>
            </ul>
          </div>

          {/* Col 3 */}
          <div>
            <h4 className="font-semibold text-zinc-900 dark:text-white text-xs uppercase tracking-wider mb-4">
              Enterprise & Devs
            </h4>
            <ul className="space-y-2 text-xs">
              <li><Link href="/pricing" className="hover:text-blue-600">Pricing Plans</Link></li>
              <li><Link href="/organizations" className="hover:text-blue-600">Team Workspaces</Link></li>
              <li><Link href="/developers" className="hover:text-blue-600">Developer API & SDKs</Link></li>
              <li><Link href="/blog" className="hover:text-blue-600">Engineering Blog</Link></li>
              <li><Link href="/help" className="hover:text-blue-600">Help & Knowledge Base</Link></li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-zinc-100 dark:border-zinc-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-400">
          <p>© 2026 PDFForge AI Technologies Inc. All rights reserved. Zero-permanent file retention policy.</p>
          <div className="flex items-center gap-6">
            <Link href="/about" className="hover:text-zinc-600 dark:hover:text-zinc-300">About</Link>
            <Link href="/contact" className="hover:text-zinc-600 dark:hover:text-zinc-300">Contact</Link>
            <Link href="/privacy" className="hover:text-zinc-600 dark:hover:text-zinc-300">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-zinc-600 dark:hover:text-zinc-300">Terms of Service</Link>
            <Link href="/cookies" className="hover:text-zinc-600 dark:hover:text-zinc-300">Cookie Preferences</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
