import React from 'react';
import Link from 'next/link';
import { Calendar, Clock, ArrowRight, Sparkles, BookOpen } from 'lucide-react';

export const metadata = {
  title: 'Engineering Blog – PDFForge AI Systems & RAG Architecture',
  description: 'Technical articles, architecture deep-dives, and performance benchmarks from the PDFForge AI engineering team.',
};

export default function BlogPage() {
  const posts = [
    {
      slug: 'high-throughput-pdf-engine-architecture',
      title: 'Architecting a 100,000 Concurrent PDF Engine with PyMuPDF & Celery',
      excerpt: 'How we achieved sub-150ms queue latency by decoupling SigV4 presigned client uploads from asynchronous worker clusters using RAMFS mounts and Redis.',
      date: 'October 20, 2026',
      readTime: '6 min read',
      tag: 'Systems Architecture',
    },
    {
      slug: 'pgvector-vs-dedicated-vector-databases',
      title: 'PostgreSQL pgvector vs Dedicated Vector DBs for Document RAG',
      excerpt: 'Why consolidating semantic embeddings, multi-tenant RBAC permissions, and processing job audit trails into PostgreSQL 16 beats decoupled vector architectures.',
      date: 'October 15, 2026',
      readTime: '8 min read',
      tag: 'AI & Vectors',
    },
    {
      slug: 'air-gapped-document-intelligence',
      title: 'Zero-Cloud Egress: Running Air-Gapped Llama 3.1 for Legal & Healthcare Contracts',
      excerpt: 'Deep-dive into our private Ollama/vLLM sidecar setup, achieving strict DoD 5220.22-M zero-retention compliance without external LLM API dependencies.',
      date: 'October 08, 2026',
      readTime: '5 min read',
      tag: 'Security & Privacy',
    },
    {
      slug: 'lossless-compression-benchmarks',
      title: 'Vector Lossless Compression: Shrinking PDF Sizes by 82% without Artifacts',
      excerpt: 'An analysis of font subsetting, stream deduplication, and JBIG2 image encoding routines benchmarked against Adobe Acrobat Online and Ghostscript.',
      date: 'September 28, 2026',
      readTime: '7 min read',
      tag: 'Performance',
    },
  ];

  return (
    <div className="min-h-screen bg-[#fbfbfd] py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
            PDFForge Engineering & AI Research
          </span>
          <h1 className="text-3xl sm:text-5xl font-semibold text-zinc-900 tracking-tight mt-3 mb-4">
            Systems, AI & Infrastructure Blog
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500">
            Deep-dives into cloud distributed architectures, pgvector indexing, and document intelligence from our engineering team.
          </p>
        </div>

        {/* Featured Post */}
        <div className="p-8 sm:p-10 rounded-3xl bg-zinc-900 text-white space-y-4 shadow-xl">
          <div className="flex items-center gap-3 text-xs text-blue-400 font-semibold">
            <span className="bg-blue-600/30 px-2.5 py-0.5 rounded-full border border-blue-500/30">
              Featured Architecture Deep-Dive
            </span>
            <span>{posts[0].readTime}</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight leading-tight">
            {posts[0].title}
          </h2>

          <p className="text-xs sm:text-sm text-zinc-400 max-w-2xl leading-relaxed">
            {posts[0].excerpt}
          </p>

          <div className="pt-2 flex items-center justify-between text-xs text-zinc-400">
            <span>By PDFForge Architecture Team · {posts[0].date}</span>
            <span className="text-blue-400 font-semibold hover:underline flex items-center gap-1">
              Read Article <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>

        {/* Posts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {posts.slice(1).map((p, i) => (
            <div
              key={i}
              className="p-6 rounded-3xl bg-white border border-zinc-200 shadow-sm flex flex-col justify-between hover:border-blue-500/40 hover:shadow-apple-hover transition-all group"
            >
              <div className="space-y-3">
                <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                  {p.tag}
                </span>

                <h3 className="font-semibold text-zinc-900 text-sm group-hover:text-blue-600 transition-colors leading-snug">
                  {p.title}
                </h3>

                <p className="text-xs text-zinc-500 line-clamp-3 leading-relaxed">
                  {p.excerpt}
                </p>
              </div>

              <div className="pt-4 mt-4 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-400">
                <span>{p.date}</span>
                <span className="text-blue-600 font-medium group-hover:translate-x-1 transition-transform flex items-center gap-1">
                  Read <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
