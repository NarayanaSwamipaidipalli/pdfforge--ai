'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Terminal, Copy, CheckCircle2, Key, ExternalLink, Code2, ShieldCheck, Zap } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

export default function DevelopersPage() {
  const { showToast } = useToast();
  const [activeLang, setActiveLang] = useState<'curl' | 'typescript' | 'python'>('curl');
  const [copied, setCopied] = useState(false);

  const codeSnippets = {
    curl: `curl -X POST https://api.pdfforge.ai/api/v1/pdf/jobs \\
  -H "Authorization: Bearer pdf_live_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "tool": "compress",
    "fileIds": ["d44813f5-c3ef-4376-b435-099c25ef1e83"],
    "parameters": { "compressionLevel": "extreme" }
  }'`,

    typescript: `import axios from 'axios';

const client = axios.create({
  baseURL: 'https://api.pdfforge.ai/api/v1',
  headers: { Authorization: \`Bearer \${process.env.PDFFORGE_API_KEY}\` }
});

// 1. Dispatch PDF compression job
const { data: job } = await client.post('/pdf/jobs', {
  tool: 'compress',
  fileIds: ['d44813f5-c3ef-4376-b435-099c25ef1e83'],
  parameters: { compressionLevel: 'medium' }
});

console.log(\`Job dispatched: \${job.id}, Status: \${job.status}\`);`,

    python: `import requests

API_KEY = "pdf_live_YOUR_API_KEY"
headers = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}

# Query AI Document Intelligence Q&A with Page Citations
payload = {
    "fileId": "d44813f5-c3ef-4376-b435-099c25ef1e83",
    "question": "What is the liability cap under Section 8?",
    "model": "llama3.1:8b",
    "provider": "OLLAMA"
}

res = requests.post("https://api.pdfforge.ai/api/v1/ai/chat", json=payload, headers=headers)
print("Answer:", res.json()["answer"])
print("Citations:", res.json()["citations"])`,
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(codeSnippets[activeLang]);
    setCopied(true);
    showToast('Code snippet copied to clipboard', 'info');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#fbfbfd] py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
            Developer Ecosystem & Microservice API
          </span>
          <h1 className="text-3xl sm:text-5xl font-semibold text-zinc-900 tracking-tight mt-3 mb-4">
            Build with PDFForge AI REST & GraphQL API
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500">
            Automate PDF transformations, OCR pipelines, and AI document intelligence directly from your microservices and CI/CD workflows.
          </p>

          <div className="pt-6 flex items-center justify-center gap-3">
            <a
              href="http://localhost:4000/api/docs"
              target="_blank"
              rel="noreferrer"
              className="px-5 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5"
            >
              <span>Explore Swagger OpenAPI Spec</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <Link
              href="/dashboard"
              className="px-5 py-2.5 rounded-full border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5"
            >
              <Key className="w-3.5 h-3.5 text-zinc-500" />
              <span>Generate API Key</span>
            </Link>
          </div>
        </div>

        {/* Code Sample Box */}
        <div className="bg-zinc-950 rounded-3xl p-6 sm:p-8 shadow-2xl border border-zinc-800 text-white">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-blue-400" />
              <span className="font-mono text-xs font-semibold text-zinc-200">
                Quick Start Integration
              </span>
            </div>

            <div className="flex items-center gap-2">
              {(['curl', 'typescript', 'python'] as const).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setActiveLang(lang)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium uppercase font-mono transition-all ${
                    activeLang === lang
                      ? 'bg-blue-600 text-white'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                  }`}
                >
                  {lang}
                </button>
              ))}

              <button
                onClick={handleCopyCode}
                className="p-1.5 rounded-lg border border-zinc-700 hover:bg-zinc-800 text-zinc-300 transition-colors ml-2"
                title="Copy Code"
              >
                {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <pre className="mt-4 overflow-x-auto text-xs font-mono text-zinc-300 leading-relaxed p-2">
            <code>{codeSnippets[activeLang]}</code>
          </pre>
        </div>

        {/* API Architecture Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="p-6 rounded-3xl bg-white border border-zinc-200 shadow-sm space-y-2">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-zinc-900 text-sm">Dual-Endpoint SigV4 Presigning</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Upload multi-gigabyte documents directly from browser or client to S3 using AWS SigV4 presigned URLs. Zero gateway CPU overhead.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-white border border-zinc-200 shadow-sm space-y-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-zinc-900 text-sm">Asynchronous Webhook Callbacks</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Pass a callbackUrl parameter when initiating jobs. Receive instantaneous HMAC-SHA256 authenticated payloads on job completion.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-white border border-zinc-200 shadow-sm space-y-2">
            <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold">
              <Code2 className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-zinc-900 text-sm">GraphQL & REST Parity</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Every operation is exposed via standard REST endpoints and full Apollo GraphQL schemas with real-time subscription support.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
