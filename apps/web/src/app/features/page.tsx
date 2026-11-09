'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { PDF_TOOLS } from '@/lib/tools-registry';
import {
  Sparkles,
  Search,
  CheckCircle2,
  ArrowRight,
  FileCheck2,
} from 'lucide-react';

export default function FeaturesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'basic' | 'convert' | 'advanced' | 'ai'>('all');

  const filteredTools = PDF_TOOLS.filter((t) => {
    const matchesCategory = selectedCategory === 'all' || t.category === selectedCategory;
    const matchesSearch =
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });


  return (
    <div className="min-h-screen bg-[#fbfbfd] py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-16">
        {/* Header Hero */}
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Tool catalog</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-semibold text-zinc-900 tracking-tight leading-tight mb-4">
            Every Doxera tool in one place
          </h1>
          <p className="text-zinc-600 text-sm sm:text-base mb-8">
            Browse {PDF_TOOLS.length} PDF, conversion and AI tools. Search by name or filter by category.
          </p>

          {/* Search bar */}
          <div className="relative max-w-lg mx-auto">
            <Search className="w-4 h-4 text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={`Search all ${PDF_TOOLS.length} tools (e.g. compress, ocr, invoice)...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-full border border-zinc-200 bg-white text-xs text-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {[
            { id: 'all', label: `All Tools (${PDF_TOOLS.length})` },
            { id: 'basic', label: 'Core PDF Tools' },
            { id: 'convert', label: 'Office & Image Conversions' },
            { id: 'ai', label: 'AI Document Intelligence' },
            { id: 'advanced', label: 'Security & Legal' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id as any)}
              className={`px-4 py-2 rounded-full text-xs font-medium transition-all ${
                selectedCategory === cat.id
                  ? 'bg-zinc-900 text-white shadow-sm'
                  : 'bg-white border border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Tool Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredTools.map((tool) => (
            <Link
              key={tool.id}
              href={`/tools/${tool.slug}`}
              className="p-5 rounded-2xl bg-white border border-zinc-200/80 hover:border-blue-500/40 hover:shadow-apple-hover transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div
                    className={`w-9 h-9 rounded-xl bg-gradient-to-tr ${tool.accentColor} text-white flex items-center justify-center font-bold text-xs shadow-sm group-hover:scale-105 transition-transform`}
                  >
                    <FileCheck2 className="w-5 h-5" />
                  </div>
                  {tool.badge && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                      {tool.badge}
                    </span>
                  )}
                </div>
                <h3 className="font-semibold text-zinc-900 text-sm mb-1 group-hover:text-blue-600 transition-colors">
                  {tool.name}
                </h3>
                <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed">
                  {tool.description}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-400 group-hover:text-blue-600 font-medium">
                <span>Launch Tool</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          ))}
        </div>

        {/* What is included: statements must match current behaviour. */}
        <div className="bg-white rounded-3xl border border-zinc-200 p-8 shadow-sm">
          <h2 className="text-2xl font-semibold text-zinc-900 tracking-tight text-center mb-6">What Doxera includes</h2>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-zinc-600 max-w-3xl mx-auto">
            {[
              'Uploads go directly to storage through short-lived signed URLs.',
              'Uploaded files expire 24 hours after upload and are then deleted by a cleanup job.',
              'Searchable OCR with Tesseract, and Office conversions with LibreOffice.',
              'AI summaries and document chat using OpenAI or a local Ollama model, when configured.',
              'Organizations for sharing work with other members.',
              'A REST API with personal API keys, plus Node.js and Python SDKs.',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden /><span>{item}</span></li>
            ))}
          </ul>
          <p className="mt-6 text-center text-[11px] text-zinc-400">Plan limits (file size, daily conversions, batch size, AI requests) are listed on the <Link href="/pricing" className="underline">pricing page</Link>.</p>
        </div>

        {/* Bottom CTA */}
        <div className="p-8 sm:p-12 rounded-3xl bg-zinc-900 text-white text-center max-w-4xl mx-auto space-y-4">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            Try the tools with a free account
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 max-w-xl mx-auto">
            The Free plan needs no payment details. Paid plans raise the usage limits.
          </p>
          <div className="pt-2 flex items-center justify-center gap-3">
            <Link
              href="/register"
              className="px-6 py-2.5 rounded-full bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors shadow-sm"
            >
              Create a free account
            </Link>
            <Link
              href="/contact"
              className="px-6 py-2.5 rounded-full border border-zinc-700 text-white text-xs font-semibold hover:bg-zinc-800 transition-colors"
            >
              Contact Sales
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
