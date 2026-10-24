import React from 'react';
import Link from 'next/link';
import { FileText, Shield, CheckCircle2 } from 'lucide-react';

export const metadata = {
  title: 'Terms of Service & Enterprise SLA',
  description: 'PDFForge AI Terms of Service, 99.99% Uptime Service Level Agreement, and Intellectual Property guarantees.',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#fbfbfd] py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-12">
        {/* Header */}
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
            Legal Terms & SLA
          </span>
          <h1 className="text-3xl sm:text-4xl font-semibold text-zinc-900 tracking-tight mt-3">
            Terms of Service & Customer Agreement
          </h1>
          <p className="text-xs text-zinc-500 mt-2">
            Last Updated: October 2026 · Governing all access to PDFForge AI Web, Mobile, and API services.
          </p>
        </div>

        {/* Content Body */}
        <div className="bg-white rounded-3xl border border-zinc-200 p-8 sm:p-12 shadow-sm space-y-8 text-xs text-zinc-700 leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-zinc-900">1. Acceptance of Terms</h2>
            <p>
              By accessing, browsing, or utilizing the PDFForge AI platform, APIs, or software development kits (SDKs), you enter into a legally binding agreement with PDFForge AI Technologies Inc. If you are accepting these terms on behalf of an enterprise or organization, you affirm that you possess full administrative authority to bind said entity.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-zinc-900">2. Customer Intellectual Property Guarantee</h2>
            <p>
              <strong>You retain 100% full, unencumbered ownership of all intellectual property</strong> contained within uploaded files, processed outputs, vector embeddings, and AI chat transcripts. PDFForge AI acquires zero rights, title, or licenses to your documents beyond the strictly necessary computational permissions required to execute requested transformations.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-zinc-900">3. Enterprise Service Level Agreement (99.99% Uptime SLA)</h2>
            <p>
              PDFForge AI commits to delivering <strong>99.99% monthly service availability</strong> for all Professional, Business, and Enterprise tiers:
            </p>
            <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 space-y-2">
              <div className="font-semibold text-zinc-900">SLA Remedy Schedule:</div>
              <ul className="list-disc pl-5 space-y-1 text-zinc-600">
                <li>&lt; 99.99% to 99.00% Availability: 10% Service Credit towards next billing cycle.</li>
                <li>&lt; 99.00% to 95.00% Availability: 25% Service Credit.</li>
                <li>&lt; 95.00% Availability: 50% Service Credit.</li>
              </ul>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-zinc-900">4. Prohibited Uses</h2>
            <p>
              Users may not utilize PDFForge AI to: (a) reverse-engineer, decompile, or extract the underlying Python worker or Celery scheduling pipelines; (b) upload or process malware, ransomware, or malicious PDF exploits; (c) attempt unauthorized penetration testing without prior written coordination; or (d) violate applicable export control or sanctions regulations.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-zinc-900">5. Subscription, Billing & Cancellation</h2>
            <p>
              Paid subscriptions renew automatically on a monthly or annual cadence. You may cancel your subscription at any time directly through the <Link href="/billing" className="text-blue-600 underline">Billing Dashboard</Link> or Stripe Customer Portal. Access continues through the conclusion of your active billing period.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
