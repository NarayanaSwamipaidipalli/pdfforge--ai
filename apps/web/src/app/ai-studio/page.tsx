'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { FileText, UploadCloud, Sparkles, Send, Download, Copy } from 'lucide-react';
import { ApiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { Reveal } from '@/components/ui/Motion';
import { useToast } from '@/components/ui/Toast';
import { WorkspaceShell, WorkspaceHeader, WorkspaceState } from '@/components/workspace/WorkspaceShell';
import { Field, Panel, inputClass, errorMessage, useWorkspaceResource } from '@/components/workspace/WorkspaceForms';

type Mode = 'chat' | 'summary' | 'invoice' | 'contract';
interface Models { providers: Record<string, { enabled: boolean; models: { id: string; name: string }[] }>; currentDefaultProvider: string }
interface Message { role: 'user' | 'assistant'; text: string; provider?: string; citations?: { pageNumber?: number; page?: number; snippetText?: string; text?: string }[] }
interface Analysis { summary?: string; extractedData?: unknown; provider?: string; [key: string]: unknown }
const modes: { id: Mode; label: string; description: string }[] = [
  { id: 'chat', label: 'Ask your PDF', description: 'Ask a question and review the answer alongside any source citations.' },
  { id: 'summary', label: 'Summary', description: 'Get an overview drawn from the document’s contents.' },
  { id: 'invoice', label: 'Invoice extraction', description: 'Extract invoice fields for review against the original document.' },
  { id: 'contract', label: 'Contract analysis', description: 'Review extracted clauses and risk signals. Check the source before relying on the result.' },
];
function DocumentText({ text }: { text: string }) {
  const inline = (value: string) => value.split(/(\*\*[^*]+\*\*|\*[^*\n]+\*)/g).map((part, index) => part.startsWith('**') && part.endsWith('**') ? <strong key={index}>{part.slice(2, -2)}</strong> : part.startsWith('*') && part.endsWith('*') ? <em key={index}>{part.slice(1, -1)}</em> : part);
  return <div className="space-y-3 break-words text-sm leading-relaxed">{text.split(/\n{2,}/).filter(Boolean).map((paragraph, index) => paragraph.startsWith('> ') ? <blockquote key={index} className="border-l-2 border-brand-500/40 pl-3 text-[var(--muted)]">{inline(paragraph.replace(/^>\s?/gm, ''))}</blockquote> : <p key={index} className="whitespace-pre-wrap">{inline(paragraph.replace(/^#{1,4}\s+/gm, ''))}</p>)}</div>;
}
function ResultValue({ value }: { value: unknown }) {
  if (value == null) return <span className="text-[var(--muted)]">Not provided</span>;
  if (Array.isArray(value)) return value.length ? <ul className="space-y-3">{value.map((item, index) => <li key={index} className="rounded-xl border border-[var(--card-border)] p-3"><ResultValue value={item} /></li>)}</ul> : <span className="text-[var(--muted)]">None returned</span>;
  if (typeof value === 'object') return <dl className="space-y-4">{Object.entries(value).map(([key, entry]) => <div key={key}><dt className="mb-1 text-xs font-semibold capitalize text-[var(--muted)]">{key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}</dt><dd className="break-words text-sm"><ResultValue value={entry} /></dd></div>)}</dl>;
  return <DocumentText text={String(value)} />;
}
export default function AiStudioPage() {
  const models = useWorkspaceResource<Models>('/ai/models');
  const { addToast } = useToast();
  const [selected, setSelected] = useState('');
  const [mode, setMode] = useState<Mode>('chat');
  const [document, setDocument] = useState<{ id: string; name: string } | null>(null);
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string>();
  const [results, setResults] = useState<Partial<Record<Mode, Analysis>>>({});
  const [busy, setBusy] = useState<'upload' | 'analysis' | ''>('');
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  const locked = useRef(false);
  useEffect(() => () => request.current?.abort(), []);
  const options = Object.entries(models.data?.providers || {}).flatMap(([provider, details]) => details.enabled ? details.models.map(model => ({ value: provider + ':' + model.id, provider, ...model })) : []);
  const selectedOption = options.find(option => option.value === selected);
  const resetResults = () => { setResults({}); setMessages([]); setConversationId(undefined); setError(''); };
  async function upload(file?: File) {
    if (!file || locked.current) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) { setError('Choose a PDF document.'); return; }
    locked.current = true; setBusy('upload'); setError(''); setDocument(null); resetResults();
    const controller = new AbortController(); request.current = controller;
    try {
      const bytes = await file.arrayBuffer();
      const checksumSha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
      const presign = await ApiClient.request<{ fileId: string; uploadUrl: string }>('/files/presign-upload', { method: 'POST', signal: controller.signal, body: JSON.stringify({ fileName: file.name, mimeType: 'application/pdf', fileSizeBytes: file.size, checksumSha256 }) });
      const uploaded = await fetch(presign.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'application/pdf' }, body: file, signal: controller.signal });
      if (!uploaded.ok) throw new Error('Document storage upload failed.');
      const confirmed = await ApiClient.request<{ file: { id: string } }>('/files/confirm-upload', { method: 'POST', signal: controller.signal, body: JSON.stringify({ fileId: presign.fileId }) });
      if (!confirmed.file?.id || confirmed.file.id !== presign.fileId) throw new Error('The upload was not confirmed. Please try again.');
      if (!controller.signal.aborted) { setDocument({ id: confirmed.file.id, name: file.name }); addToast('Document uploaded and confirmed.', 'success'); }
    } catch (error) { if (!controller.signal.aborted) setError(errorMessage(error)); }
    finally { locked.current = false; if (!controller.signal.aborted) setBusy(''); }
  }
  async function analyze(event?: FormEvent) {
    event?.preventDefault();
    if (!document || locked.current || (mode === 'chat' && !query.trim())) return;
    locked.current = true; setBusy('analysis'); setError('');
    const controller = new AbortController(); request.current = controller;
    const question = query.trim();
    const payload = { fileId: document.id, ...(selectedOption ? { provider: selectedOption.provider, model: selectedOption.id } : {}), ...(mode === 'chat' ? { question, conversationId } : {}) };
    const endpoints = { chat: '/ai/chat', summary: '/ai/summarize', invoice: '/ai/extract/invoice', contract: '/ai/analyze/contract' };
    try {
      const result = await ApiClient.request<Analysis & { answer?: string; conversationId?: string; citations?: Message['citations'] }>(endpoints[mode], { method: 'POST', signal: controller.signal, body: JSON.stringify(payload) });
      if (controller.signal.aborted) return;
      if (mode === 'chat') {
        if (typeof result.answer !== 'string' || !result.answer.trim()) throw new Error('No answer was returned.');
        setMessages(previous => [...previous, { role: 'user', text: question }, { role: 'assistant', text: result.answer!, provider: result.provider, citations: result.citations }]);
        setConversationId(result.conversationId); setQuery('');
      } else {
        if (mode === 'summary' && !result.summary || mode === 'invoice' && !result.extractedData || mode === 'contract' && !result.keyClauses) throw new Error('No analysis was returned.');
        setResults(previous => ({ ...previous, [mode]: result }));
      }
    } catch (error) { if (!controller.signal.aborted) setError(errorMessage(error)); }
    finally { locked.current = false; if (!controller.signal.aborted) setBusy(''); }
  }
  const result = results[mode];
  const resultText = result ? (mode === 'summary' ? result.summary || '' : JSON.stringify(mode === 'invoice' ? result.extractedData : result, null, 2)) : '';
  return <WorkspaceShell>
    <WorkspaceHeader eyebrow="Document intelligence" title="AI Studio" description="Bring a PDF. Ask questions, extract details and explore its contents." />
    <div className="grid items-start gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
      <div className="space-y-6"><Reveal><Panel title="Your document" description="Upload a PDF to start a new analysis session.">
        <label className={'relative flex cursor-pointer flex-col items-center rounded-2xl border border-dashed border-brand-500/40 bg-brand-500/5 p-6 text-center focus-within:ring-2 focus-within:ring-brand-500 ' + (busy ? 'opacity-60' : 'hover:bg-brand-500/10')}>
          <UploadCloud className="mb-3 h-7 w-7 text-brand-500" /><span className="text-sm font-semibold">{busy === 'upload' ? 'Uploading…' : document ? 'Replace document' : 'Choose a PDF'}</span><span className="mt-2 text-xs text-[var(--muted)]">Select a file from your device</span>
          <input aria-label="Upload PDF for analysis" className="absolute inset-0 h-full w-full cursor-pointer opacity-0" type="file" accept=".pdf,application/pdf" disabled={!!busy} onChange={event => { void upload(event.target.files?.[0]); event.target.value = ''; }} />
        </label>
        {document && <div className="rounded-xl border border-[var(--card-border)] p-4"><FileText className="mb-2 h-5 w-5 text-brand-500" /><p className="break-all text-sm font-medium">{document.name}</p><p className="mt-2 text-xs text-[var(--muted)]">Upload confirmed. Ready for analysis.</p></div>}
        {models.error ? <div role="alert" className="space-y-3 text-xs text-[var(--muted)]"><p>Model list unavailable: {models.error}</p><Button size="sm" variant="secondary" onClick={models.reload}>Retry models</Button></div> : <Field label="Processing model" hint={options.length ? 'The service may fall back to extractive processing if a model is unavailable.' : 'No language model is currently enabled. Automatic processing can use the document extraction service.'}><select className={inputClass} disabled={!!busy || models.loading} value={selected} onChange={event => { setSelected(event.target.value); resetResults(); }}><option value="">Automatic · service default</option>{options.map(option => <option key={option.value} value={option.value}>{option.name}</option>)}</select></Field>}
        <p className="text-xs leading-relaxed text-[var(--muted)]">Analysis uses your account’s AI allowance. Review generated results against the original PDF.</p>
      </Panel></Reveal></div>
      <Reveal className="min-w-0"><div className="surface overflow-hidden rounded-2xl">
        <div role="tablist" aria-label="Document analysis" className="flex flex-wrap gap-2 border-b border-[var(--card-border)] p-4">{modes.map(item => <button role="tab" id={'tab-' + item.id} aria-controls={'panel-' + item.id} aria-selected={mode === item.id} key={item.id} disabled={!!busy} onClick={() => { setMode(item.id); setError(''); }} className={'focus-ring rounded-full px-4 py-2 text-xs font-semibold transition-colors disabled:opacity-50 ' + (mode === item.id ? 'bg-brand-500 text-white' : 'text-[var(--muted)] hover:bg-brand-500/10')}>{item.label}</button>)}</div>
        <div role="tabpanel" id={'panel-' + mode} aria-labelledby={'tab-' + mode} className="min-h-[480px] p-5 sm:p-7">
          <p className="mb-6 text-sm leading-relaxed text-[var(--muted)]">{modes.find(item => item.id === mode)?.description}</p>
          {error && <p role="alert" className="mb-5 rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-600 dark:text-rose-300">{error}</p>}
          {!document ? <WorkspaceState loading={busy === 'upload'} title={busy === 'upload' ? 'Uploading your document…' : 'Start with your document'} description="Your results will appear here after a confirmed upload and analysis." /> : mode === 'chat' ? <>
            <div aria-live="polite" className="mb-6 space-y-5">{!messages.length && <div className="rounded-xl bg-brand-500/5 p-6"><Sparkles className="mb-3 h-6 w-6 text-brand-500" /><h2 className="font-semibold">What would you like to know?</h2><p className="mt-2 text-sm text-[var(--muted)]">Ask a specific question about {document.name}.</p></div>}{messages.map((message, index) => <article key={index} className={'rounded-xl p-4 ' + (message.role === 'user' ? 'ml-4 bg-brand-500/10' : 'border border-[var(--card-border)]')}><p className="mb-2 text-xs font-semibold text-[var(--muted)]">{message.role === 'user' ? 'You' : 'Document answer'}</p><DocumentText text={message.text} />{message.provider && <p className="mt-3 text-[10px] text-[var(--muted)]">Returned provider: {message.provider}</p>}{!!message.citations?.length && <details className="mt-4"><summary className="focus-ring cursor-pointer text-xs font-semibold">Source citations ({message.citations.length})</summary><ul className="mt-3 space-y-3">{message.citations.map((citation, index) => <li key={index} className="border-l-2 border-brand-500/40 pl-3 text-xs leading-relaxed text-[var(--muted)]">Page {citation.pageNumber ?? citation.page ?? 'not specified'}: {citation.snippetText || citation.text || 'No excerpt provided'}</li>)}</ul></details>}</article>)}</div>
            <form onSubmit={analyze} className="space-y-3"><Field label="Your question"><textarea className={inputClass} rows={3} value={query} onChange={event => setQuery(event.target.value)} disabled={!!busy} required placeholder="What are the key points in this document?" /></Field><Button type="submit" disabled={!!busy || !query.trim()} loading={busy === 'analysis'}><Send className="h-4 w-4" />Ask document</Button></form>
          </> : <><Button onClick={() => void analyze()} loading={busy === 'analysis'} disabled={!!busy}><Sparkles className="h-4 w-4" />{result ? 'Run again' : 'Analyze document'}</Button>{result ? <div className="mt-6 space-y-5"><div className="flex flex-wrap gap-2"><Button size="sm" variant="secondary" onClick={async () => { try { await navigator.clipboard.writeText(resultText); addToast('Result copied.', 'success'); } catch { setError('Could not copy the result.'); } }}><Copy className="h-4 w-4" />Copy result</Button><Button size="sm" variant="secondary" onClick={() => { const url = URL.createObjectURL(new Blob([resultText], { type: mode === 'summary' ? 'text/plain' : 'application/json' })); const anchor = window.document.createElement('a'); anchor.href = url; anchor.download = mode + (mode === 'summary' ? '.txt' : '.json'); anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }}><Download className="h-4 w-4" />Download result</Button></div><ResultValue value={mode === 'summary' ? result.summary : mode === 'invoice' ? result.extractedData : Object.fromEntries(Object.entries(result).filter(([key]) => !['fileId', 'provider', 'documentType'].includes(key)))} /><p className="text-xs text-[var(--muted)]">Returned provider: {result.provider || 'Not specified'}</p></div> : <p className="mt-6 text-sm text-[var(--muted)]">No result yet. Run analysis when you’re ready.</p>}</>}
        </div>
      </div></Reveal>
    </div>
  </WorkspaceShell>;
}
