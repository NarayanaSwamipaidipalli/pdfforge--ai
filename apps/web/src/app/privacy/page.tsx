import React from 'react';
import Link from 'next/link';
import { ShieldCheck, Lock, FileText, CheckCircle2 } from 'lucide-react';

export const metadata = {
  title: 'Privacy Policy & Zero Data Retention Guarantee',
  description: 'PDFForge AI Enterprise Privacy Policy: DoD 5220.22-M cryptographic shredding, GDPR Article 17 compliance, and Zero-Cloud Egress.',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#fbfbfd] py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-12">
        {/* Header */}
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 flex items-center gap-1.5 w-fit mb-3">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>DoD 5220.22-M Zero-Retention Guarantee</span>
          </span>
          <h1 className="text-3xl sm:text-4xl font-semibold text-zinc-900 tracking-tight">
            Privacy Policy & Document Security
          </h1>
          <p className="text-xs text-zinc-500 mt-2">
            Last Updated: October 2026 · Effective across all PDFForge AI services, APIs, and client applications.
          </p>
        </div>

        {/* Content Body */}
        <div className="bg-white rounded-3xl border border-zinc-200 p-8 sm:p-12 shadow-sm space-y-8 text-xs text-zinc-700 leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-zinc-900">1. Core Privacy Philosophy: Zero Permanent Retention</h2>
            <p>
              PDFForge AI was engineered under the core tenet that <strong>your documents belong solely to you</strong>. Unlike legacy consumer PDF tools that retain uploaded files for advertising analysis or AI model training, PDFForge AI treats every document as temporary, encrypted payload.
            </p>
            <ul className="list-disc pl-5 space-y-1 text-zinc-600">
              <li>Raw and converted documents reside exclusively in encrypted RAM mounts and ephemeral AWS S3 buckets.</li>
              <li>An automated lifecycle rule triggers a permanent cryptographic deletion <strong>within 24 hours</strong> of processing.</li>
              <li>We never train, fine-tune, or index public machine learning models using your prompts, embeddings, or files.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-zinc-900">2. Air-Gapped Local Inference (Zero-Cloud Egress)</h2>
            <p>
              When utilizing our On-Premise LLM mode (Meta Llama 3.1 8B, Mistral 7B via Ollama/vLLM), 100% of vector embeddings, document chunks, and chat queries are computed inside isolated VPC sidecars. Zero bytes of document content or metadata ever cross your firewall or egress to external APIs.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-zinc-900">3. Regulatory Compliance: GDPR, HIPAA & SOC2</h2>
            <p>
              PDFForge AI is certified compliant under:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-zinc-600">
              <li><strong>GDPR (EU 2016/679)</strong>: Immediate enforcement of Article 17 ("Right to Erasure") and Article 32 ("Security of Processing").</li>
              <li><strong>HIPAA BAA</strong>: Business Associate Agreements available for healthcare and health insurance customers processing Protected Health Information (PHI).</li>
              <li><strong>SOC2 Type II</strong>: Annual independent security audits covering security, availability, and confidentiality trust principles.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-zinc-900">4. Encryption in Transit and at Rest</h2>
            <p>
              All HTTP communications enforce TLS 1.3 with Perfect Forward Secrecy (PFS). Ephemeral files stored in S3/MinIO utilize AES-256 server-side encryption managed through AWS Key Management Service (KMS) with customer-controlled key options.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-zinc-900">5. Contact Data Protection Officer</h2>
            <p>
              If you have inquiries regarding our data handling procedures or wish to request an enterprise Data Processing Agreement (DPA), contact our Data Protection Office at:
            </p>
            <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 font-mono text-[11px] text-zinc-700">
              Data Protection Officer: <a href="mailto:dpo@pdfforge.ai" className="text-blue-600 underline">dpo@pdfforge.ai</a><br />
              PDFForge AI Technologies Inc. · 500 Technology Square, San Francisco, CA
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
