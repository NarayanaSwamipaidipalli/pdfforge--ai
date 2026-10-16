'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PDF_TOOLS, PdfTool } from '@/lib/tools-registry';
import {
  Search,
  Sparkles,
  UploadCloud,
  FileCheck2,
  ShieldCheck,
  Zap,
  ArrowRight,
  Layers,
  Scissors,
  Minimize2,
  FileText,
  Lock,
  BrainCircuit,
  MessageSquareCode,
  Receipt,
  ScanText,
  CheckCircle2,
  ChevronDown,
  Building2,
  Globe2,
} from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isDragging, setIsDragging] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const filteredTools = useMemo(() => {
    return PDF_TOOLS.filter((tool) => {
      const matchesSearch =
        tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tool.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        selectedCategory === 'all' || tool.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      // Direct user to default merge or compress tool with the file
      router.push('/tools/compress-pdf');
    }
  };

  const categories = [
    { id: 'all', label: 'All Tools', count: PDF_TOOLS.length },
    { id: 'basic', label: 'Core Tools', count: PDF_TOOLS.filter((t) => t.category === 'basic').length },
    { id: 'convert', label: 'Conversions', count: PDF_TOOLS.filter((t) => t.category === 'convert').length },
    { id: 'advanced', label: 'Advanced & OCR', count: PDF_TOOLS.filter((t) => t.category === 'advanced').length },
    { id: 'ai', label: 'AI Intelligence', count: PDF_TOOLS.filter((t) => t.category === 'ai').length },
  ];

  const faqs = [
    {
      q: 'How does PDFForge AI guarantee document confidentiality and privacy?',
      a: 'We enforce a Zero-Permanent-Storage policy. All uploaded and processed files are encrypted in-transit (TLS 1.3) and at-rest (AWS KMS AES-256). Files are held in ephemeral memory buffers and automatically purged via DoD 5220.22-M compliant shredding routines within 24 hours (or instantly upon user request).',
    },
    {
      q: 'What AI models power the document intelligence and RAG chat?',
      a: 'Our AI pipeline utilizes dense semantic embeddings (OpenAI text-embedding-3) paired with pgvector HNSW indexing, alongside OpenAI GPT-4o for document synthesis, table extraction, and zero-shot invoice parsing.',
    },
    {
      q: 'Can I integrate PDFForge AI into my own software or enterprise backend?',
      a: 'Yes. PDFForge AI provides high-performance REST and GraphQL APIs with SDKs in Node.js, Python, Kotlin, and Swift. API keys can be provisioned in seconds from the User Dashboard.',
    },
    {
      q: 'What are the file size and batch limitations?',
      a: 'Free tier users can process files up to 25 MB with 10 daily conversions. Pro accounts enjoy up to 250 MB per file with unlimited conversions and high-speed priority queues. Business & Enterprise plans support files up to 2 GB with custom dedicated worker clusters.',
    },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      {/* --- HERO SECTION --- */}
      <section className="relative overflow-hidden pt-16 pb-20 md:pt-24 md:pb-28 border-b border-zinc-200/60 bg-gradient-to-b from-white via-zinc-50/50 to-white">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(45rem_50rem_at_top,theme(colors.blue.100),white)] opacity-60" />
        
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          {/* Release Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/80 text-blue-700 text-xs font-medium mb-6 animate-pulse">
            <Sparkles className="w-3.5 h-3.5" />
            <span>PDFForge AI 2.0 Live – Powered by GPT-4o Document Intelligence</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-semibold tracking-tight text-zinc-900 leading-[1.1] mb-6">
            Enterprise PDF Intelligence & Cloud Processing
          </h1>
          <p className="text-lg sm:text-xl text-zinc-600 max-w-2xl mx-auto mb-10 leading-relaxed font-normal">
            Merge, compress, convert, OCR, and converse with documents at cloud scale.
            Designed for millions of users with zero-data-retention security.
          </p>

          {/* Drag & Drop Hero Box */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`max-w-2xl mx-auto rounded-3xl border-2 border-dashed p-8 sm:p-10 transition-all duration-200 backdrop-blur-xl ${
              isDragging
                ? 'border-blue-600 bg-blue-50/70 scale-[1.02]'
                : 'border-zinc-300 bg-white/80 hover:border-zinc-400 shadow-apple'
            }`}
          >
            <div className="flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center mb-4 shadow-lg shadow-blue-500/25">
                <UploadCloud className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-900 mb-1">
                Drop your PDF or document here to start
              </h3>
              <p className="text-xs text-zinc-500 mb-5">
                Supports PDF, DOCX, XLSX, PPTX, JPG, PNG up to 250 MB
              </p>

              <div className="flex flex-wrap justify-center gap-2">
                <Link
                  href="/tools/compress-pdf"
                  className="px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium shadow-sm transition-colors flex items-center gap-1.5"
                >
                  <Minimize2 className="w-3.5 h-3.5" /> Compress PDF
                </Link>
                <Link
                  href="/tools/merge-pdf"
                  className="px-4 py-2 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium shadow-sm transition-colors flex items-center gap-1.5"
                >
                  <Layers className="w-3.5 h-3.5" /> Merge PDFs
                </Link>
                <Link
                  href="/ai-studio"
                  className="px-4 py-2 rounded-full bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium shadow-sm transition-colors flex items-center gap-1.5"
                >
                  <BrainCircuit className="w-3.5 h-3.5" /> AI Chat with PDF
                </Link>
              </div>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto mt-14 pt-10 border-t border-zinc-200/80 text-center">
            <div>
              <div className="text-2xl font-bold text-zinc-900 tracking-tight">100M+</div>
              <div className="text-xs text-zinc-500 mt-0.5">Documents Processed</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-zinc-900 tracking-tight">&lt; 150ms</div>
              <div className="text-xs text-zinc-500 mt-0.5">Processing Latency</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-zinc-900 tracking-tight">99.99%</div>
              <div className="text-xs text-zinc-500 mt-0.5">Cloud Uptime SLA</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-zinc-900 tracking-tight">Zero</div>
              <div className="text-xs text-zinc-500 mt-0.5">Permanent Retention</div>
            </div>
          </div>
        </div>
      </section>

      {/* --- TOOLS CATALOG SECTION --- */}
      <section id="tools" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <h2 className="text-3xl font-semibold text-zinc-900 tracking-tight mb-2">
              Every PDF tool you need, unified in one cloud suite
            </h2>
            <p className="text-sm text-zinc-500 max-w-xl">
              From instantaneous lossless compression to multi-lingual OCR and AI semantic search.
            </p>
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search 30+ PDF tools..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm rounded-full bg-white border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
            />
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-8 no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 text-xs font-medium rounded-full whitespace-nowrap transition-all duration-150 flex items-center gap-1.5 ${
                selectedCategory === cat.id
                  ? 'bg-zinc-900 text-white shadow-sm'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200/80 hover:text-zinc-900'
              }`}
            >
              <span>{cat.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  selectedCategory === cat.id ? 'bg-zinc-700 text-white' : 'bg-zinc-200 text-zinc-600'
                }`}
              >
                {cat.count}
              </span>
            </button>
          ))}
        </div>

        {/* Tools Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredTools.map((tool) => (
            <Link
              key={tool.id}
              href={tool.category === 'ai' ? '/ai-studio' : `/tools/${tool.slug}`}
              className="group p-5 rounded-2xl bg-white border border-zinc-200/80 hover:border-zinc-300 hover:shadow-apple-hover transition-all duration-200 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div
                    className={`w-11 h-11 rounded-xl bg-gradient-to-tr ${tool.accentColor} text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform duration-200`}
                  >
                    <FileText className="w-5 h-5" />
                  </div>
                  {tool.badge && (
                    <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 border border-zinc-200">
                      {tool.badge}
                    </span>
                  )}
                </div>

                <h3 className="font-semibold text-zinc-900 text-base mb-1.5 group-hover:text-blue-600 transition-colors">
                  {tool.name}
                </h3>
                <p className="text-xs text-zinc-500 leading-relaxed mb-4">
                  {tool.description}
                </p>
              </div>

              <div className="flex items-center text-xs font-medium text-blue-600 pt-2 border-t border-zinc-100 group-hover:translate-x-0.5 transition-transform">
                <span>Launch Tool</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* --- AI DOCUMENT INTELLIGENCE SHOWCASE --- */}
      <section className="py-20 bg-zinc-900 text-white overflow-hidden relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-950/80 border border-violet-700/60 text-violet-300 text-xs font-medium mb-4">
                <BrainCircuit className="w-3.5 h-3.5 text-violet-400" />
                <span>Next-Gen RAG Architecture</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight leading-tight mb-4">
                Converse with documents. Extract facts with verifiable citations.
              </h2>
              <p className="text-zinc-400 text-sm leading-relaxed mb-8">
                PDFForge AI turns static PDFs into active knowledge graphs. Ask multi-page legal or financial questions and receive accurate answers with instant page-level bounding box citations.
              </p>

              <div className="space-y-3.5">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5" />
                  <span className="text-sm text-zinc-300">
                    <strong>Invoice & Receipt Extraction</strong>: Parses totals, line items, and tax numbers into structured ERP JSON.
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5" />
                  <span className="text-sm text-zinc-300">
                    <strong>Contract Risk Radar</strong>: Automatically scans indemnity caps, termination clauses, and non-compete risks.
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5" />
                  <span className="text-sm text-zinc-300">
                    <strong>50+ Language Neural Translation</strong>: Preserves exact PDF typography, tables, and column alignments.
                  </span>
                </div>
              </div>

              <div className="mt-8">
                <Link
                  href="/ai-studio"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-zinc-950 hover:bg-zinc-100 font-medium text-sm transition-all shadow-lg"
                >
                  <Sparkles className="w-4 h-4 text-violet-600" />
                  Try AI Document Studio
                </Link>
              </div>
            </div>

            {/* Interactive Preview Card */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-6 shadow-2xl">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                  <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                  <span className="text-xs text-zinc-400 ml-2 font-mono">
                    Commercial_Lease_Agreement_2026.pdf
                  </span>
                </div>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
                  Live RAG Demo
                </span>
              </div>

              <div className="space-y-4 text-xs font-sans">
                {/* User Message */}
                <div className="flex justify-end">
                  <div className="bg-blue-600 text-white px-3.5 py-2 rounded-2xl rounded-tr-none max-w-sm">
                    What are the tenant maintenance obligations under Section 7?
                  </div>
                </div>

                {/* AI Response */}
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-violet-600 text-white flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="bg-zinc-800/80 text-zinc-200 p-3.5 rounded-2xl rounded-tl-none space-y-2 border border-zinc-700/50">
                    <p>
                      Under <strong>Section 7.2 (Page 4)</strong>, the Tenant is strictly responsible for routine HVAC filter replacements and interior non-structural repairs up to $2,500 per incident.
                    </p>
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-violet-300 font-mono text-[10px]">
                      <span>Page 4 · Paragraph 2 · 98.4% Confidence</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- FAQ SECTION --- */}
      <section className="py-20 max-w-4xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-semibold text-zinc-900 tracking-tight mb-3">
            Frequently Asked Questions
          </h2>
          <p className="text-sm text-zinc-500">
            Everything you need to know about security, processing speed, and enterprise limits.
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              className="border border-zinc-200/80 rounded-2xl overflow-hidden bg-white shadow-sm"
            >
              <button
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                className="w-full text-left px-6 py-4 flex items-center justify-between font-medium text-sm text-zinc-900 hover:bg-zinc-50 transition-colors"
              >
                <span>{faq.q}</span>
                <ChevronDown
                  className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${
                    openFaq === idx ? 'rotate-180 text-blue-600' : ''
                  }`}
                />
              </button>
              {openFaq === idx && (
                <div className="px-6 pb-5 pt-1 text-xs text-zinc-600 leading-relaxed border-t border-zinc-100">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
