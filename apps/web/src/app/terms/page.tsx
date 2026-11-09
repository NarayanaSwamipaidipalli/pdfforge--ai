import React from 'react';
import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service',
  description: 'Doxera Terms of Service.',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#fbfbfd] py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-12">
        {/* Header */}
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
            Legal Terms
          </span>
          <h1 className="text-3xl sm:text-4xl font-semibold text-zinc-900 tracking-tight mt-3">
            Terms of Service & Customer Agreement
          </h1>
          <p className="text-xs text-zinc-500 mt-2">
            Last Updated: October 2026 · Governing all access to Doxera Web, Mobile, and API services.
          </p>
        </div>

        {/*
          LEGAL REVIEW REQUIRED before launch. Flagged, not rewritten:
          - Section 3: the 99.99% uptime SLA and service-credit schedule were removed because no
            availability commitment is backed by the service. Legal must decide what, if anything, replaces it.
          - Section 1 refers to SDKs and mobile apps, and names no legal entity ("with Doxera If").
          - Section 2 intellectual-property wording and section 4 prohibited uses need counsel's review.
          - Section 5 says subscriptions renew automatically and mentions a Stripe Customer Portal;
            current Razorpay orders are one-time payments and Stripe is not enabled.
        */}
        <div role="note" className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900">
          These terms are a draft under legal review and may change before Doxera launches publicly.
        </div>

        {/* Content Body */}
        <div className="bg-white rounded-3xl border border-zinc-200 p-8 sm:p-12 shadow-sm space-y-8 text-xs text-zinc-700 leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-zinc-900">1. Acceptance of Terms</h2>
            <p>
              By accessing, browsing, or utilizing the Doxera platform, APIs, or software development kits (SDKs), you enter into a legally binding agreement with Doxera If you are accepting these terms on behalf of an enterprise or organization, you affirm that you possess full administrative authority to bind said entity.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-zinc-900">2. Customer Intellectual Property Guarantee</h2>
            <p>
              <strong>You retain 100% full, unencumbered ownership of all intellectual property</strong> contained within uploaded files, processed outputs, vector embeddings, and AI chat transcripts. Doxera acquires zero rights, title, or licenses to your documents beyond the strictly necessary computational permissions required to execute requested transformations.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-zinc-900">3. Service Availability</h2>
            <p>
              Doxera does not currently offer an uptime commitment or service credits. This section is pending legal review.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-zinc-900">4. Prohibited Uses</h2>
            <p>
              Users may not utilize Doxera to: (a) reverse-engineer, decompile, or extract the underlying Python worker or Celery scheduling pipelines; (b) upload or process malware, ransomware, or malicious PDF exploits; (c) attempt unauthorized penetration testing without prior written coordination; or (d) violate applicable export control or sanctions regulations.
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
