'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { PDF_TOOLS } from '@/lib/tools-registry';
import {
  Layers,
  Sparkles,
  ShieldCheck,
  Zap,
  Cpu,
  Search,
  CheckCircle2,
  ArrowRight,
  HardDrive,
  Lock,
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

  const comparisonRows = [
    { feature: 'Core Conversion Tools (Merge, Split, Compress)', pdfforge: 'Unlimited (Pro)', adobe: 'Limited/Subscription', ilovepdf: 'Capped', smallpdf: 'Capped' },
    { feature: 'AI RAG Document Chat & Exact Citations', pdfforge: 'Yes (On-Premise & Cloud)', adobe: 'Acrobat AI Add-on', ilovepdf: 'No', smallpdf: 'Basic' },
    { feature: '100% Air-Gapped Zero-Cloud Egress Mode', pdfforge: 'Yes (Ollama / vLLM)', adobe: 'No', ilovepdf: 'No', smallpdf: 'No' },
    { feature: 'DoD 5220.22-M 24h Cryptographic File Purge', pdfforge: 'Yes (Automatic)', adobe: 'Variable', ilovepdf: '2h Retained', smallpdf: '1h Retained' },
    { feature: 'High-Throughput REST & GraphQL API', pdfforge: 'Yes (Dedicated Keys)', adobe: 'Adobe PDF Services API', ilovepdf: 'Limited', smallpdf: 'Limited' },
    { feature: 'Searchable OCR (Multi-Language)', pdfforge: 'Tesseract & Ghostscript', adobe: 'Yes', ilovepdf: 'OCR Tier', smallpdf: 'Pro Only' },
    { feature: 'Multi-Tenant Team Workspaces & RBAC', pdfforge: 'Included in Business', adobe: 'Enterprise Admin Console', ilovepdf: 'Team Plan', smallpdf: 'Team Plan' },
  ];

  return (
    <div className="min-h-screen bg-[#fbfbfd] py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-16">
        {/* Header Hero */}
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Complete Feature Architecture & Tool Catalog</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-semibold text-zinc-900 tracking-tight leading-tight mb-4">
            Enterprise Document Intelligence built for modern workloads
          </h1>
          <p className="text-zinc-600 text-sm sm:text-base mb-8">
            Explore our comprehensive suite of 34+ high-throughput PDF processing engines, air-gapped AI models, and automated conversion pipelines.
          </p>

          {/* Search bar */}
          <div className="relative max-w-lg mx-auto">
            <Search className="w-4 h-4 text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search across all 34 PDF & AI tools (e.g. compress, ocr, invoice)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-full border border-zinc-200 bg-white text-xs text-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {[
            { id: 'all', label: 'All Tools (34)' },
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

        {/* Competitive Benchmark Comparison Table */}
        <div className="bg-white rounded-3xl border border-zinc-200 p-8 shadow-sm">
          <div className="text-center max-w-2xl mx-auto mb-8">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
              Enterprise Benchmark
            </span>
            <h2 className="text-2xl font-semibold text-zinc-900 tracking-tight mt-2">
              How PDFForge AI compares to legacy platforms
            </h2>
          </div>

          <div className="border border-zinc-100 rounded-2xl overflow-hidden overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-medium">
                <tr>
                  <th className="py-3 px-4 min-w-[220px]">Capability</th>
                  <th className="py-3 px-4 font-bold text-blue-600 bg-blue-50/50">PDFForge AI</th>
                  <th className="py-3 px-4">Adobe Acrobat Web</th>
                  <th className="py-3 px-4">iLovePDF</th>
                  <th className="py-3 px-4">Smallpdf</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-zinc-700">
                {comparisonRows.map((row, i) => (
                  <tr key={i} className="hover:bg-zinc-50/50">
                    <td className="py-3 px-4 font-medium text-zinc-900">{row.feature}</td>
                    <td className="py-3 px-4 font-semibold text-blue-600 bg-blue-50/30">
                      {row.pdfforge}
                    </td>
                    <td className="py-3 px-4 text-zinc-500">{row.adobe}</td>
                    <td className="py-3 px-4 text-zinc-500">{row.ilovepdf}</td>
                    <td className="py-3 px-4 text-zinc-500">{row.smallpdf}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="p-8 sm:p-12 rounded-3xl bg-zinc-900 text-white text-center max-w-4xl mx-auto space-y-4">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            Ready to streamline your enterprise document workflows?
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 max-w-xl mx-auto">
            Process documents in high-speed priority queues with zero retention and dedicated API keys.
          </p>
          <div className="pt-2 flex items-center justify-center gap-3">
            <Link
              href="/register"
              className="px-6 py-2.5 rounded-full bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors shadow-sm"
            >
              Start Free Trial
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
