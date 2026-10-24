'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { HelpCircle, Search, ChevronRight, FileText, Cpu, Key, ShieldCheck, Mail } from 'lucide-react';

export default function HelpCenterPage() {
  const [search, setSearch] = useState('');

  const articles = [
    {
      category: 'Getting Started',
      icon: FileText,
      items: [
        { title: 'How does the 24-hour automatic cryptographic purge work?', snippet: 'All documents in S3 utilize AWS S3 lifecycle rules and ephemeral RAM mounts.' },
        { title: 'What is the maximum file size limit for PDF processing?', snippet: 'Free users can upload up to 25 MB, Pro up to 250 MB, and Business up to 500 MB.' },
        { title: 'Can I reorder pages before merging multiple PDF files?', snippet: 'Yes, our drag-and-drop studio preserves your exact sequence.' },
      ],
    },
    {
      category: 'AI Document Intelligence',
      icon: Cpu,
      items: [
        { title: 'How to switch between Cloud GPT-4o and On-Premise Air-Gapped Llama 3.1?', snippet: 'Use the model dropdown in AI Studio to enforce 100% Zero-Cloud Egress.' },
        { title: 'How are citations calculated in document Q&A?', snippet: 'Our vector chunker maps semantic embeddings directly to PDF physical page coordinates.' },
        { title: 'Exporting structured invoice data to ERP systems', snippet: 'Invoice Extractor outputs standardized RFC 8259 JSON compatible with SAP and QuickBooks.' },
      ],
    },
    {
      category: 'Developer API & Integration',
      icon: Key,
      items: [
        { title: 'How to generate and authenticate with Developer API keys', snippet: 'Generate your pdf_live key in Dashboard > API Keys and send via X-API-Key or Bearer header.' },
        { title: 'Handling Celery worker webhooks asynchronously', snippet: 'Subscribe your microservice to callbackUrl to receive instant job completion notifications.' },
      ],
    },
  ];

  const filtered = articles
    .map((cat) => ({
      ...cat,
      items: cat.items.filter(
        (i) =>
          i.title.toLowerCase().includes(search.toLowerCase()) ||
          i.snippet.toLowerCase().includes(search.toLowerCase()),
      ),
    }))
    .filter((cat) => cat.items.length > 0);

  return (
    <div className="min-h-screen bg-[#fbfbfd] py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-12">
        {/* Header Hero */}
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
            Help Center & Knowledge Base
          </span>
          <h1 className="text-3xl sm:text-4xl font-semibold text-zinc-900 tracking-tight mt-3 mb-4">
            How can our engineering team help you?
          </h1>

          <div className="relative max-w-lg mx-auto">
            <Search className="w-4 h-4 text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search help articles, troubleshooting guides, and API questions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-full border border-zinc-200 bg-white text-xs text-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Categories List */}
        <div className="space-y-8">
          {filtered.map((category, idx) => {
            const Icon = category.icon;
            return (
              <div key={idx} className="bg-white rounded-3xl border border-zinc-200 p-6 sm:p-8 shadow-sm">
                <div className="flex items-center gap-2.5 mb-4 text-zinc-900 font-semibold text-sm">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Icon className="w-4 h-4" />
                  </div>
                  <h3>{category.category}</h3>
                </div>

                <div className="divide-y divide-zinc-100">
                  {category.items.map((item, i) => (
                    <div key={i} className="py-3.5 group cursor-pointer">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-semibold text-zinc-800 group-hover:text-blue-600 transition-colors">
                          {item.title}
                        </h4>
                        <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:translate-x-1 transition-transform" />
                      </div>
                      <p className="text-xs text-zinc-500 mt-1">{item.snippet}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Support Callout */}
        <div className="p-8 rounded-3xl bg-white border border-zinc-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-zinc-900 text-sm">Still have questions?</h3>
            <p className="text-xs text-zinc-500">
              Our 24/7 solutions engineering support team is ready to assist.
            </p>
          </div>
          <Link
            href="/contact"
            className="px-5 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors"
          >
            Open Support Ticket
          </Link>
        </div>
      </div>
    </div>
  );
}
