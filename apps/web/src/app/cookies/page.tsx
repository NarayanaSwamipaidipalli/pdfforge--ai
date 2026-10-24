'use client';

import React, { useState } from 'react';
import { Cookie, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

export default function CookiesPage() {
  const { showToast } = useToast();
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);
  const [functionalEnabled, setFunctionalEnabled] = useState(true);

  const handleSave = () => {
    showToast('Your privacy and cookie preferences have been updated.', 'success');
  };

  return (
    <div className="min-h-screen bg-[#fbfbfd] py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-12">
        {/* Header */}
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
            Cookie Policy & Consent
          </span>
          <h1 className="text-3xl sm:text-4xl font-semibold text-zinc-900 tracking-tight mt-3">
            Cookie Policy & Tracking Preferences
          </h1>
          <p className="text-xs text-zinc-500 mt-2">
            Control which cookies and local storage tokens are active during your PDFForge AI sessions.
          </p>
        </div>

        {/* Interactive Preferences Card */}
        <div className="bg-white rounded-3xl border border-zinc-200 p-8 shadow-sm space-y-6">
          <h2 className="text-base font-semibold text-zinc-900">Manage Consent Preferences</h2>

          <div className="space-y-4">
            {/* Essential */}
            <div className="p-4 rounded-2xl border border-zinc-200 bg-zinc-50/50 flex items-center justify-between">
              <div>
                <div className="font-semibold text-xs text-zinc-900">
                  Strictly Necessary / Authentication Cookies
                </div>
                <div className="text-[11px] text-zinc-500 mt-0.5">
                  Required for secure JWT session tokens, CSRF protection, and file upload authorizations.
                </div>
              </div>
              <span className="text-[11px] font-semibold text-zinc-400 bg-zinc-200 px-2.5 py-1 rounded-full">
                Always Active
              </span>
            </div>

            {/* Functional */}
            <div className="p-4 rounded-2xl border border-zinc-200 flex items-center justify-between">
              <div>
                <div className="font-semibold text-xs text-zinc-900">
                  Functional & UI Preference Cookies
                </div>
                <div className="text-[11px] text-zinc-500 mt-0.5">
                  Remembers your selected AI models, theme choices, and recently utilized PDF tools.
                </div>
              </div>
              <input
                type="checkbox"
                checked={functionalEnabled}
                onChange={(e) => setFunctionalEnabled(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
            </div>

            {/* Analytics */}
            <div className="p-4 rounded-2xl border border-zinc-200 flex items-center justify-between">
              <div>
                <div className="font-semibold text-xs text-zinc-900">
                  Anonymized Telemetry & Performance
                </div>
                <div className="text-[11px] text-zinc-500 mt-0.5">
                  Assists our engineering team in detecting worker latency spikes and queue backlogs. Zero personal data collected.
                </div>
              </div>
              <input
                type="checkbox"
                checked={analyticsEnabled}
                onChange={(e) => setAnalyticsEnabled(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              onClick={handleSave}
              className="px-5 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors"
            >
              Save Cookie Preferences
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
