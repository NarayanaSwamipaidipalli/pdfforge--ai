'use client';

import React, { useState } from 'react';
import { Mail, MessageSquare, ShieldCheck, Clock, Building2, CheckCircle2, ArrowRight } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

export default function ContactPage() {
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [topic, setTopic] = useState('Enterprise Sales');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
      showToast('Your inquiry has been received. A solutions engineer will respond within 1 hour.', 'success');
    }, 600);
  };

  return (
    <div className="min-h-screen bg-[#fbfbfd] py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
            Contact & Solutions Engineering
          </span>
          <h1 className="text-3xl sm:text-4xl font-semibold text-zinc-900 tracking-tight mt-3 mb-2">
            Let's discuss your document infrastructure
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500">
            Our solutions architects and engineering support team are available 24/7. Guaranteed response time under 1 hour for enterprise inquiries.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Info Side */}
          <div className="space-y-4">
            <div className="p-6 rounded-3xl bg-white border border-zinc-200 shadow-sm space-y-4">
              <h3 className="font-semibold text-zinc-900 text-sm">Direct Channels</h3>

              <div className="space-y-3 text-xs text-zinc-600">
                <div className="flex items-start gap-3">
                  <Mail className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-medium text-zinc-900">Enterprise Sales</div>
                    <a href="mailto:sales@pdfforge.ai" className="text-zinc-500 hover:text-blue-600">
                      sales@pdfforge.ai
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-medium text-zinc-900">Security & Compliance</div>
                    <a href="mailto:security@pdfforge.ai" className="text-zinc-500 hover:text-blue-600">
                      security@pdfforge.ai
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Clock className="w-4 h-4 text-violet-600 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-medium text-zinc-900">SLA Response Guarantee</div>
                    <span className="text-zinc-500">&lt; 15 mins for Priority Enterprise</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-zinc-900 text-white space-y-2">
              <div className="font-semibold text-xs text-blue-400">Headquarters</div>
              <div className="text-xs text-zinc-300">
                PDFForge AI Technologies Inc.<br />
                500 Technology Square, Suite 800<br />
                San Francisco, CA 94107
              </div>
            </div>
          </div>

          {/* Form Side */}
          <div className="md:col-span-2">
            <div className="bg-white rounded-3xl border border-zinc-200 p-8 shadow-sm">
              {submitted ? (
                <div className="py-12 text-center space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto shadow-sm">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <h3 className="text-lg font-bold text-zinc-900">Message Dispatched!</h3>
                  <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                    Thank you, {name}. A dedicated solutions architect has received your inquiry and will reach out to <strong>{email}</strong> shortly.
                  </p>
                  <button
                    onClick={() => setSubmitted(false)}
                    className="text-xs font-semibold text-blue-600 hover:underline pt-2"
                  >
                    Send another inquiry
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Alex Morgan"
                        className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">
                        Work Email *
                      </label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="alex@enterprise.com"
                        className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">
                        Company Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                        placeholder="Global Enterprises Ltd"
                        className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">
                        Topic of Inquiry
                      </label>
                      <select
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
                      >
                        <option value="Enterprise Sales">Enterprise Volume Licensing</option>
                        <option value="Air-Gapped Deployment">Air-Gapped / Private VPC Deployment</option>
                        <option value="Security Audit">Security & Compliance Audit (SOC2/HIPAA)</option>
                        <option value="API Integration">High-Volume REST & GraphQL API</option>
                        <option value="Support">Technical Support</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      Project Scope & Requirements *
                    </label>
                    <textarea
                      required
                      rows={4}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Describe your document volume, required OCR accuracy, AI RAG models, or deployment constraints..."
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    <span>{submitting ? 'Dispatching Message...' : 'Submit Enterprise Inquiry'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <div className="text-[11px] text-zinc-400 text-center flex items-center justify-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Inquiries are protected by mutual non-disclosure and strict confidentiality.</span>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
