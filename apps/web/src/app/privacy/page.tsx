import React from 'react';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';

export const metadata = {
  title: 'Privacy & Document Security',
  description: 'Doxera document processing, account security, and deployment privacy information.',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#fbfbfd] py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <ShieldCheck className="w-6 h-6 text-blue-600 mb-3" />
          <h1 className="text-3xl font-semibold text-zinc-900">Privacy & Document Security</h1>
          <p className="text-xs text-zinc-500 mt-2">Doxera · Updated November 4, 2026</p>
        </div>
        <div className="bg-white rounded-3xl border border-zinc-200 p-8 sm:p-12 space-y-8 text-sm text-zinc-700 leading-relaxed">
          <section className="space-y-3">
            <h2 className="font-semibold text-zinc-900">Document processing and storage</h2>
            <p>Uploaded documents and processing results use the storage configured for this service. Account information, file metadata, processing history, and billing records are stored separately. Access to documents requires authentication and ownership checks.</p>
            <p>Retention and deletion depend on the service configuration and backup policies. A fixed deletion deadline or secure erasure guarantee has not been established for this deployment.</p>
          </section>
          <section className="space-y-3">
            <h2 className="font-semibold text-zinc-900">AI and external providers</h2>
            <p>AI features can send document content to the configured AI provider. Local inference is available for deployments configured to use a local model. Review the provider and hosting settings before submitting confidential documents.</p>
          </section>
          <section className="space-y-3">
            <h2 className="font-semibold text-zinc-900">Account security and email</h2>
            <p>Passwords are hashed. Password recovery uses an expiring, single-use link delivered through Resend when email delivery is configured. Payment processing uses the enabled payment provider; access is granted after server verification.</p>
          </section>
          <section className="space-y-3">
            <h2 className="font-semibold text-zinc-900">Hosting and compliance</h2>
            <p>HTTPS, storage encryption, backups, and access policies must be verified for the deployed service. Independent SOC 2 or ISO certification and HIPAA agreements have not been established by this project. Regulated use requires a separate review.</p>
          </section>
          <section className="space-y-3">
            <h2 className="font-semibold text-zinc-900">Privacy requests</h2>
            <p>Contact the service operator through <Link href="/contact" className="text-blue-600 underline">the contact page</Link> to ask about data access, deletion, retention, or applicable agreements. A verified production privacy contact must be published before launch.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
