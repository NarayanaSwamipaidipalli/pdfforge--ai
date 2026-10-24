import React from 'react';
import Link from 'next/link';
import { ShieldCheck, Cpu, Terminal, Users, Lock, HeartHandshake, ArrowRight, Building2 } from 'lucide-react';

export const metadata = {
  title: 'About Us – PDFForge AI Architecture & Mission',
  description: 'Learn about PDFForge AI, our mission to build the world fastest, most private enterprise document intelligence platform.',
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#fbfbfd] py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-16">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
            Our Mission & Architecture
          </span>
          <h1 className="text-3xl sm:text-5xl font-semibold text-zinc-900 tracking-tight leading-tight mt-4 mb-4">
            Re-engineering document processing for the AI era
          </h1>
          <p className="text-zinc-600 text-sm sm:text-base leading-relaxed">
            PDFForge AI was founded to solve a critical enterprise problem: legacy PDF tools are slow, insecure, hold customer documents hostage on third-party servers, and lack private AI capabilities.
          </p>
        </div>

        {/* 3 Core Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-3xl bg-white border border-zinc-200 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-zinc-900 text-base">Zero Permanent Retention</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              We operate on DoD 5220.22-M standards. Uploaded documents are processed in ephemeral RAM mounts and automatically deleted within 24 hours. No document is ever stored permanently.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-white border border-zinc-200 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Cpu className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-zinc-900 text-base">Air-Gapped AI (Ollama / vLLM)</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Unlike cloud-only alternatives that leak confidential contracts to commercial LLMs, PDFForge supports 100% on-premise private AI with Zero-Cloud Egress guarantees.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-white border border-zinc-200 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
              <Terminal className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-zinc-900 text-base">High-Throughput Microservices</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Engineered with Next.js 15, NestJS 10, Python PyMuPDF, and Celery distributed task queues. Capable of processing millions of concurrent document operations with sub-second latencies.
            </p>
          </div>
        </div>

        {/* Statistics Band */}
        <div className="p-8 sm:p-10 rounded-3xl bg-white border border-zinc-200 shadow-sm">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <div className="text-3xl sm:text-4xl font-bold text-blue-600 mb-1">100M+</div>
              <div className="text-xs text-zinc-500 font-medium">Pages Processed</div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-bold text-emerald-600 mb-1">99.99%</div>
              <div className="text-xs text-zinc-500 font-medium">Uptime SLA</div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-bold text-violet-600 mb-1">&lt;150ms</div>
              <div className="text-xs text-zinc-500 font-medium">P95 Queue Latency</div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-bold text-zinc-900 mb-1">0 Bytes</div>
              <div className="text-xs text-zinc-500 font-medium">Permanent Retention</div>
            </div>
          </div>
        </div>

        {/* Security & Global Operations */}
        <div className="p-8 sm:p-10 rounded-3xl bg-zinc-900 text-white space-y-6">
          <div className="flex items-center gap-2 text-blue-400 text-xs font-semibold uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" /> Enterprise Security
          </div>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            Certified for healthcare, finance, and legal compliance
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 max-w-2xl leading-relaxed">
            Our platform adheres to SOC2 Type II, HIPAA BAA agreements, GDPR Article 17 ("Right to Erasure"), and ISO/IEC 27001 data processing requirements. All data in transit is encrypted using TLS 1.3 and stored with AWS KMS SSE-256.
          </p>

          <div className="pt-2 flex items-center gap-4">
            <Link
              href="/contact"
              className="px-5 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
            >
              Talk to Our Security Team
            </Link>
            <Link
              href="/privacy"
              className="text-xs text-zinc-400 hover:text-white underline"
            >
              Read Privacy Policy
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
