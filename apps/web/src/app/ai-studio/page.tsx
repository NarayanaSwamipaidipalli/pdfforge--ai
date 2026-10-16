'use client';

import React, { useState } from 'react';
import {
  BrainCircuit,
  MessageSquare,
  FileText,
  Receipt,
  ShieldAlert,
  Send,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  UploadCloud,
  Copy,
  Languages,
  Download,
  BookOpen,
  Lock,
  Cpu,
  Server,
  Cloud,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  modelBadge?: string;
  citations?: { page: number; text: string }[];
}

export default function AiStudioPage() {
  const [activeTab, setActiveTab] = useState<'chat' | 'summary' | 'invoice' | 'contract'>('chat');
  const [activeDocument, setActiveDocument] = useState<string>('Master_Services_Agreement_2026.pdf');
  const [inputQuery, setInputQuery] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Model Selection: Local On-Premise vs Cloud
  const [selectedModel, setSelectedModel] = useState<'llama3.1:8b' | 'mistral:7b' | 'phi3.5' | 'gpt-4o'>('llama3.1:8b');

  const isOnPremise = selectedModel !== 'gpt-4o';

  // Chat conversation
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      sender: 'assistant',
      modelBadge: 'Meta Llama 3.1 8B (On-Premise)',
      text: "Hello Alex! I've loaded and indexed **Master_Services_Agreement_2026.pdf** (18 pages).\n\n🔒 **100% On-Premise Air-Gapped Mode Active**: Your prompts and document vectors are processed on your local Ollama/vLLM sidecar. Zero bytes leave your private network.",
    },
  ]);

  const handleSendMessage = () => {
    if (!inputQuery.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: inputQuery,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setIsTyping(true);

    setTimeout(() => {
      setIsTyping(false);
      const aiReply: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'assistant',
        modelBadge: isOnPremise ? `Local ${selectedModel} (Private)` : 'OpenAI GPT-4o (Cloud)',
        text: `According to **Section 8.2 (Page 7)**, the aggregate liability of either party is strictly limited to the total fees paid or payable by Customer in the twelve (12) months preceding the incident.\n\nHowever, **Section 8.4** specifies that this limitation does NOT apply to indemnification obligations under Section 9 or breach of confidentiality covenants.\n\n${isOnPremise ? '🔒 *Inference executed on local GPU/CPU with Zero-Cloud Egress.*' : '☁️ *Inference processed via TLS 1.3 encrypted cloud channel.*'}`,
        citations: [
          { page: 7, text: 'Section 8.2 Limitation of Aggregate Liability' },
          { page: 8, text: 'Section 8.4 Exceptions to Liability Cap' },
        ],
      };
      setMessages((prev) => [...prev, aiReply]);
    }, 1100);
  };

  const invoiceData = {
    invoiceNumber: 'INV-2026-9941',
    vendor: 'Apex Cloud Systems Corp.',
    dueDate: '2026-11-15',
    subtotal: 12400.0,
    tax: 1054.0,
    total: 13454.0,
    items: [
      { desc: 'Dedicated GPU Worker Nodes (H100)', qty: 4, rate: 2500, amt: 10000 },
      { desc: 'High-Throughput Vector Storage (pgvector)', qty: 1, rate: 1400, amt: 1400 },
      { desc: 'Enterprise 24/7 SLA Support', qty: 1, rate: 1000, amt: 1000 },
    ],
  };

  const contractRiskData = {
    riskScore: 28, // 0-100 (low risk)
    level: 'LOW RISK',
    governingLaw: 'State of Delaware, USA',
    findings: [
      {
        title: 'Mutual Indemnification',
        status: 'FAVORABLE',
        desc: 'Standard reciprocal IP and negligence indemnification.',
        page: 9,
      },
      {
        title: 'Termination for Convenience',
        status: 'ATTENTION',
        desc: '60 days prior notice required for termination without cause.',
        page: 12,
      },
      {
        title: 'Data Ownership & Zero-Retention',
        status: 'FAVORABLE',
        desc: 'Explicit clause confirming customer retains 100% IP of prompts and embeddings.',
        page: 15,
      },
    ],
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col md:flex-row bg-[#fbfbfd] overflow-hidden">
      {/* --- LEFT PANEL: Document Navigation & Viewer Preview --- */}
      <div className="w-full md:w-96 border-r border-zinc-200 bg-white flex flex-col justify-between shrink-0">
        <div className="p-4 border-b border-zinc-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-zinc-900 truncate max-w-[180px]">
                {activeDocument}
              </div>
              <div className="text-[10px] text-zinc-500">18 Pages · 4.2 MB · Indexed</div>
            </div>
          </div>
          <button className="text-[10px] px-2 py-1 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-medium transition-colors">
            Change PDF
          </button>
        </div>

        {/* Page Thumbnails preview */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {[1, 2, 3, 4, 5, 6].map((p) => (
            <div
              key={p}
              className={`p-3 rounded-xl border transition-all cursor-pointer ${
                p === 1
                  ? 'border-blue-600 bg-blue-50/30'
                  : 'border-zinc-200 hover:border-zinc-300 bg-white'
              }`}
            >
              <div className="flex items-center justify-between text-[10px] text-zinc-500 mb-2">
                <span className="font-medium text-zinc-700">Page {p}</span>
                <span>{p === 1 ? 'Cover & Preamble' : p === 7 ? 'Liabilities' : 'Definitions'}</span>
              </div>
              <div className="h-20 bg-zinc-100 rounded-lg flex items-center justify-center text-zinc-400 text-xs border border-zinc-200/60 font-mono">
                [PDF Page {p} Vector Raster]
              </div>
            </div>
          ))}
        </div>

        {/* Privacy & Air-gap Notice */}
        <div className="p-3 border-t border-zinc-100 bg-zinc-50 text-[10px] text-zinc-600 flex items-center justify-between">
          <span className="flex items-center gap-1.5 font-medium">
            {isOnPremise ? (
              <>
                <Lock className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700">Air-Gapped Ollama Local</span>
              </>
            ) : (
              <>
                <Cloud className="w-3.5 h-3.5 text-blue-600" />
                <span className="text-blue-700">OpenAI Cloud (TLS 1.3)</span>
              </>
            )}
          </span>
          <span className="text-[10px] text-zinc-400 font-mono">Port 11434</span>
        </div>
      </div>

      {/* --- RIGHT PANEL: AI Document Intelligence Studio --- */}
      <div className="flex-1 flex flex-col bg-white overflow-hidden">
        {/* Navigation Tabs & Model Switcher Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border-b border-zinc-200 bg-zinc-50/50 gap-2">
          {/* Tabs */}
          <div className="flex items-center gap-1">
            {[
              { id: 'chat', label: 'Q&A Chat (RAG)', icon: MessageSquare },
              { id: 'summary', label: 'Executive Summary', icon: BookOpen },
              { id: 'invoice', label: 'Invoice Extractor', icon: Receipt },
              { id: 'contract', label: 'Contract Risk Radar', icon: ShieldAlert },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all ${
                    activeTab === tab.id
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-zinc-600 hover:bg-zinc-200/60 hover:text-zinc-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Model Selector Dropdown (Cloud vs Local On-Premise) */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-white border border-zinc-200 rounded-full px-2.5 py-1 text-xs shadow-sm">
              <Cpu className="w-3.5 h-3.5 text-violet-600" />
              <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                Model:
              </span>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value as any)}
                className="text-xs font-medium text-zinc-900 bg-transparent focus:outline-none cursor-pointer"
              >
                <option value="llama3.1:8b">🔒 Llama 3.1 8B (On-Premise Private)</option>
                <option value="mistral:7b">🔒 Mistral 7B Instruct (On-Premise)</option>
                <option value="phi3.5">🔒 Phi-3.5 Mini (Local Fast)</option>
                <option value="gpt-4o">☁️ OpenAI GPT-4o (Cloud API)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Air-Gapped Privacy Status Pill Banner */}
        {isOnPremise && (
          <div className="bg-emerald-50 border-b border-emerald-100 px-4 py-1.5 text-[11px] text-emerald-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="font-semibold">Zero-Cloud Egress Guarantee:</span>
              <span>All vector embeddings and prompts processed strictly inside private sidecar container.</span>
            </div>
            <span className="font-mono text-[10px] text-emerald-600 uppercase">DoD 5220.22-M Compliant</span>
          </div>
        )}

        {/* Tab 1: AI Chat & RAG Assistant */}
        {activeTab === 'chat' && (
          <div className="flex-1 flex flex-col justify-between overflow-hidden">
            {/* Conversation Log */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xl rounded-2xl p-4 text-xs leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-blue-600 text-white rounded-tr-none'
                        : 'bg-zinc-50 border border-zinc-200 text-zinc-800 rounded-tl-none space-y-2'
                    }`}
                  >
                    {msg.modelBadge && (
                      <div className="text-[10px] font-semibold text-zinc-400 flex items-center gap-1 mb-1">
                        <Lock className="w-3 h-3 text-emerald-600" />
                        <span>{msg.modelBadge}</span>
                      </div>
                    )}
                    <p className="whitespace-pre-line">{msg.text}</p>
                    {msg.citations && msg.citations.length > 0 && (
                      <div className="pt-2 border-t border-zinc-200 flex flex-wrap gap-1.5">
                        {msg.citations.map((c, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-medium"
                          >
                            <span>Page {c.page}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex items-center gap-2 text-xs text-zinc-400 p-2">
                  <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" />
                  <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce [animation-delay:0.2s]" />
                  <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce [animation-delay:0.4s]" />
                  <span className="text-[10px]">
                    {isOnPremise
                      ? `Computing on local Ollama sidecar (${selectedModel})...`
                      : 'Retrieving cloud vector embeddings...'}
                  </span>
                </div>
              )}
            </div>

            {/* Prompt suggestions & Input Box */}
            <div className="p-4 border-t border-zinc-200 bg-white space-y-3">
              <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                {[
                  'What is the liability cap under Section 8?',
                  'Summarize termination clauses',
                  'What are the payment milestones?',
                ].map((sug, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setInputQuery(sug);
                    }}
                    className="px-3 py-1 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-[11px] whitespace-nowrap transition-colors"
                  >
                    {sug}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder={
                    isOnPremise
                      ? `Ask questions privately via local ${selectedModel}...`
                      : 'Ask any question about this document...'
                  }
                  value={inputQuery}
                  onChange={(e) => setInputQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  className="flex-1 px-4 py-2.5 rounded-full border border-zinc-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
                <button
                  onClick={handleSendMessage}
                  className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 transition-colors shrink-0 shadow-sm"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Executive Summary */}
        {activeTab === 'summary' && (
          <div className="flex-1 overflow-y-auto p-6 max-w-3xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-zinc-900 text-base">
                  Executive Briefing & Key Objectives
                </h3>
                <span className="text-[10px] text-zinc-500">
                  Generated via {isOnPremise ? `Local ${selectedModel}` : 'OpenAI Cloud'}
                </span>
              </div>
              <button className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                <Copy className="w-3.5 h-3.5" /> Copy Summary
              </button>
            </div>

            <div className="space-y-4 text-xs text-zinc-700 leading-relaxed bg-zinc-50 border border-zinc-200 rounded-2xl p-6">
              <h4 className="font-semibold text-zinc-900 uppercase tracking-wider text-[11px]">
                1. Engagement Overview
              </h4>
              <p>
                This agreement establishes a 24-month multi-tier enterprise SaaS engagement between the Provider and Client, encompassing dedicated GPU compute instances, custom RAG vector storage, and 99.99% uptime guarantees.
              </p>

              <h4 className="font-semibold text-zinc-900 uppercase tracking-wider text-[11px] pt-2">
                2. Core Financial Commitments
              </h4>
              <ul className="list-disc pl-5 space-y-1">
                <li>Annual contract value of $161,448 billed semi-annually.</li>
                <li>Net-30 payment terms with 1.5% late accrual fee past 45 calendar days.</li>
              </ul>

              <h4 className="font-semibold text-zinc-900 uppercase tracking-wider text-[11px] pt-2">
                3. Key Risk Considerations
              </h4>
              <ul className="list-disc pl-5 space-y-1">
                <li>Mutual liability cap is strictly pegged to 12 months fees paid.</li>
                <li>Requires 60 calendar days prior written notice for convenience termination.</li>
              </ul>
            </div>
          </div>
        )}

        {/* Tab 3: Invoice Extractor */}
        {activeTab === 'invoice' && (
          <div className="flex-1 overflow-y-auto p-6 max-w-4xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-semibold text-zinc-900 text-base">
                  Extracted Financial Line Items
                </h3>
                <p className="text-xs text-zinc-500">
                  {isOnPremise ? 'Extracted via local Ollama JSON-mode grammar parser' : 'Extracted via OpenAI Structured Outputs'}
                </p>
              </div>
              <button className="px-3 py-1.5 rounded-full bg-zinc-900 text-white text-xs font-medium flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5" /> Export ERP JSON
              </button>
            </div>

            <div className="border border-zinc-200 rounded-2xl overflow-hidden bg-white shadow-sm mb-6">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-medium">
                  <tr>
                    <th className="py-2.5 px-4">Description</th>
                    <th className="py-2.5 px-4 text-center">Qty</th>
                    <th className="py-2.5 px-4 text-right">Unit Rate</th>
                    <th className="py-2.5 px-4 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-zinc-700">
                  {invoiceData.items.map((item, i) => (
                    <tr key={i}>
                      <td className="py-3 px-4 font-medium text-zinc-900">{item.desc}</td>
                      <td className="py-3 px-4 text-center">{item.qty}</td>
                      <td className="py-3 px-4 text-right">${item.rate.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right font-semibold">
                        ${item.amt.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="p-4 bg-zinc-50 border-t border-zinc-200 flex justify-end">
                <div className="w-64 space-y-1.5 text-xs">
                  <div className="flex justify-between text-zinc-600">
                    <span>Subtotal</span>
                    <span>${invoiceData.subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-zinc-600">
                    <span>Tax (8.5%)</span>
                    <span>${invoiceData.tax.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-zinc-900 text-sm pt-1 border-t border-zinc-200">
                    <span>Total Due</span>
                    <span>${invoiceData.total.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Contract Risk Radar */}
        {activeTab === 'contract' && (
          <div className="flex-1 overflow-y-auto p-6 max-w-4xl">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="p-5 rounded-2xl border border-zinc-200 bg-zinc-50">
                <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                  Overall Risk Score
                </div>
                <div className="text-3xl font-bold text-emerald-600">28 / 100</div>
                <div className="text-xs text-zinc-500 mt-1">Low Contractual Risk</div>
              </div>

              <div className="p-5 rounded-2xl border border-zinc-200 bg-zinc-50">
                <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                  Governing Jurisdiction
                </div>
                <div className="text-base font-semibold text-zinc-900">
                  {contractRiskData.governingLaw}
                </div>
                <div className="text-xs text-zinc-500 mt-1">Standard US Corporate Venue</div>
              </div>

              <div className="p-5 rounded-2xl border border-zinc-200 bg-zinc-50">
                <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                  GDPR & Security Audit
                </div>
                <div className="text-base font-semibold text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> PASS
                </div>
                <div className="text-xs text-zinc-500 mt-1">SCCs and DPA Included</div>
              </div>
            </div>

            <h4 className="font-semibold text-zinc-900 text-sm mb-4">
              Detailed Clause Audit Findings
            </h4>

            <div className="space-y-3">
              {contractRiskData.findings.map((finding, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl border border-zinc-200 bg-white flex items-start justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-xs text-zinc-900">{finding.title}</span>
                      <span
                        className={`text-[10px] px-2 py-0.2 rounded-full font-medium ${
                          finding.status === 'FAVORABLE'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {finding.status}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-600">{finding.desc}</p>
                  </div>
                  <span className="text-[10px] text-zinc-400 font-mono">Page {finding.page}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
