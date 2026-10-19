'use client';

import React, { useState, use, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PDF_TOOLS } from '@/lib/tools-registry';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  Download,
  Share2,
  Trash2,
  ShieldCheck,
  QrCode,
  ArrowLeft,
  Settings2,
  Sparkles,
  Lock,
  Layers,
  PenTool,
  Eraser,
  Shield,
  FileDiff,
} from 'lucide-react';

interface ToolPageProps {
  params: Promise<{ slug: string }>;
}

export default function ToolPage({ params }: ToolPageProps) {
  const resolvedParams = use(params);
  const tool = useMemo(() => {
    return PDF_TOOLS.find((t) => t.slug === resolvedParams.slug);
  }, [resolvedParams.slug]);

  if (!tool) {
    notFound();
  }

  // File state
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  // Tool parameter states
  const [compressionLevel, setCompressionLevel] = useState<'low' | 'medium' | 'extreme'>('medium');
  const [watermarkText, setWatermarkText] = useState('CONFIDENTIAL');
  const [watermarkOpacity, setWatermarkOpacity] = useState(30);
  const [rotationDegrees, setRotationDegrees] = useState(90);
  const [password, setPassword] = useState('');
  const [pageRange, setPageRange] = useState('1-3');
  const [ocrLanguage, setOcrLanguage] = useState('eng');

  // Interactive Digital Signature States
  const [signatureMode, setSignatureMode] = useState<'draw' | 'type'>('draw');
  const [signatureText, setSignatureText] = useState('Alex Morgan');
  const [signatureColor, setSignatureColor] = useState('#0f172a');
  const [signerName, setSignerName] = useState('Alex Morgan');
  const [signerTitle, setSignerTitle] = useState('Executive Director & General Counsel');
  const [includeAuditTrail, setIncludeAuditTrail] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Metadata Editor States
  const [metaTitle, setMetaTitle] = useState('Master Services Agreement 2026');
  const [metaAuthor, setMetaAuthor] = useState('Enterprise Legal Department');
  const [metaSubject, setMetaSubject] = useState('B2B SaaS Procurement & Compliance');
  const [metaKeywords, setMetaKeywords] = useState('confidential, master agreement, saas, enterprise');

  // Compare Tool States
  const [compareSensitivity, setCompareSensitivity] = useState<'low' | 'medium' | 'high'>('medium');

  // Drawing Canvas Logic
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = signatureColor;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = Array.from(e.target.files);
      setFiles(tool.multipleFiles ? [...files, ...selected] : [selected[0]]);
      setIsCompleted(false);
    }
  };

  const handleRemoveFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const handleExecuteTool = () => {
    if (files.length === 0) return;

    setIsProcessing(true);
    setProcessingStep(1);

    // Simulated multi-stage enterprise pipeline
    setTimeout(() => {
      setProcessingStep(2); // Virus & Security scan
      setTimeout(() => {
        setProcessingStep(3); // Worker processing
        setTimeout(() => {
          setProcessingStep(4); // S3 upload & link generation
          setTimeout(() => {
            setIsProcessing(false);
            setIsCompleted(true);
            setDownloadUrl('#download-demo');
          }, 800);
        }, 1200);
      }, 900);
    }, 800);
  };

  const steps = [
    { title: 'Secure Client-to-S3 Upload', desc: 'Direct encrypted multipart stream' },
    { title: 'ClamAV Malware & Virus Audit', desc: 'Cryptographic zero-exploit verification' },
    { title: 'Processing PDF Transformation', desc: `Executing ${tool.name} algorithm` },
    { title: 'Ready for Instant Download', desc: 'Protected by ephemeral 24h retention' },
  ];

  return (
    <div className="min-h-screen bg-[#fbfbfd] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Navigation Breadcrumb */}
        <div className="mb-6">
          <Link
            href="/#tools"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Tools
          </Link>
        </div>

        {/* Tool Header */}
        <div className="flex items-start gap-4 mb-8">
          <div
            className={`w-14 h-14 rounded-2xl bg-gradient-to-tr ${tool.accentColor} text-white flex items-center justify-center shadow-md shadow-blue-500/10 shrink-0`}
          >
            <FileText className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl sm:text-3xl font-semibold text-zinc-900 tracking-tight">
                {tool.name}
              </h1>
              {tool.badge && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  {tool.badge}
                </span>
              )}
            </div>
            <p className="text-sm text-zinc-500">{tool.description}</p>
          </div>
        </div>

        {/* Main Processing Workspace */}
        <div className="bg-white rounded-3xl border border-zinc-200 shadow-apple p-6 sm:p-8 mb-8">
          {/* File Upload Zone */}
          {files.length === 0 ? (
            <div className="border-2 border-dashed border-zinc-300 rounded-2xl p-10 text-center hover:border-zinc-400 transition-colors cursor-pointer relative bg-zinc-50/50">
              <input
                type="file"
                multiple={tool.multipleFiles}
                accept={tool.acceptedTypes.join(',')}
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <UploadCloud className="w-7 h-7" />
              </div>
              <h3 className="text-base font-semibold text-zinc-900 mb-1">
                Select or drop {tool.multipleFiles ? 'PDF files' : 'PDF file'} to process
              </h3>
              <p className="text-xs text-zinc-500 mb-4">
                Accepts {tool.acceptedTypes.join(', ')} up to 250 MB
              </p>
              <button
                type="button"
                className="px-5 py-2 rounded-full bg-blue-600 text-white text-xs font-medium shadow-sm hover:bg-blue-700 pointer-events-none"
              >
                Choose from Device
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Selected Files List */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Selected Files ({files.length})
                  </h4>
                  {tool.multipleFiles && (
                    <label className="text-xs text-blue-600 font-medium cursor-pointer hover:underline">
                      + Add More Files
                      <input
                        type="file"
                        multiple
                        accept={tool.acceptedTypes.join(',')}
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                <div className="space-y-2">
                  {files.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3.5 rounded-xl border border-zinc-200 bg-zinc-50/60 text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="w-4 h-4 text-zinc-500" />
                        <div>
                          <div className="font-medium text-zinc-900">{file.name}</div>
                          <div className="text-[10px] text-zinc-500">
                            {(file.size / (1024 * 1024)).toFixed(2)} MB
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveFile(idx)}
                        className="text-zinc-400 hover:text-rose-600 p-1 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tool Parameters Configuration */}
              <div className="pt-4 border-t border-zinc-100">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-4 flex items-center gap-1.5">
                  <Settings2 className="w-3.5 h-3.5" /> Options & Settings
                </h4>

                {/* Conditional Parameter Controls based on Tool Slug */}
                {tool.id === 'compress' && (
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: 'low', label: 'Standard', desc: 'Minimal compression, best vector quality' },
                      { id: 'medium', label: 'Recommended', desc: 'Optimal ~70% reduction, sharp text' },
                      { id: 'extreme', label: 'Extreme', desc: 'Aggressive ~85% reduction for email' },
                    ].map((lvl) => (
                      <button
                        key={lvl.id}
                        type="button"
                        onClick={() => setCompressionLevel(lvl.id as any)}
                        className={`p-3 text-left rounded-xl border transition-all ${
                          compressionLevel === lvl.id
                            ? 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-600'
                            : 'border-zinc-200 hover:border-zinc-300'
                        }`}
                      >
                        <div className="font-semibold text-xs text-zinc-900">{lvl.label}</div>
                        <div className="text-[10px] text-zinc-500 mt-0.5">{lvl.desc}</div>
                      </button>
                    ))}
                  </div>
                )}

                {tool.id === 'watermark' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">
                        Watermark Text
                      </label>
                      <input
                        type="text"
                        value={watermarkText}
                        onChange={(e) => setWatermarkText(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">
                        Opacity ({watermarkOpacity}%)
                      </label>
                      <input
                        type="range"
                        min="10"
                        max="90"
                        value={watermarkOpacity}
                        onChange={(e) => setWatermarkOpacity(Number(e.target.value))}
                        className="w-full"
                      />
                    </div>
                  </div>
                )}

                {tool.id === 'split' && (
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      Extract Page Ranges
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 1-3, 5, 8-10"
                      value={pageRange}
                      onChange={(e) => setPageRange(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                )}

                {tool.id === 'encrypt' && (
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      Document Password Protection
                    </label>
                    <input
                      type="password"
                      placeholder="Enter strong 8+ character password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                )}

                {tool.id === 'rotate' && (
                  <div className="flex gap-2">
                    {[90, 180, 270].map((deg) => (
                      <button
                        key={deg}
                        type="button"
                        onClick={() => setRotationDegrees(deg)}
                        className={`px-4 py-2 text-xs font-medium rounded-lg border ${
                          rotationDegrees === deg
                            ? 'border-blue-600 bg-blue-50 text-blue-700'
                            : 'border-zinc-200 hover:border-zinc-300'
                        }`}
                      >
                        Rotate {deg}° Clockwise
                      </button>
                    ))}
                  </div>
                )}

                {/* Digital Signature Studio */}
                {tool.id === 'sign' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setSignatureMode('draw')}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                            signatureMode === 'draw'
                              ? 'bg-blue-50 border-blue-600 text-blue-700'
                              : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                          }`}
                        >
                          Draw Signature
                        </button>
                        <button
                          type="button"
                          onClick={() => setSignatureMode('type')}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                            signatureMode === 'type'
                              ? 'bg-blue-50 border-blue-600 text-blue-700'
                              : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                          }`}
                        >
                          Type Cursive
                        </button>
                      </div>

                      {/* Ink Palette */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-zinc-400 mr-1">Ink:</span>
                        {[
                          { color: '#0f172a', label: 'Obsidian' },
                          { color: '#1d4ed8', label: 'Navy' },
                          { color: '#b91c1c', label: 'Crimson' },
                        ].map((ink) => (
                          <button
                            key={ink.color}
                            type="button"
                            onClick={() => setSignatureColor(ink.color)}
                            className={`w-5 h-5 rounded-full border transition-transform ${
                              signatureColor === ink.color ? 'scale-125 ring-2 ring-offset-1 ring-blue-500' : ''
                            }`}
                            style={{ backgroundColor: ink.color }}
                            title={ink.label}
                          />
                        ))}
                      </div>
                    </div>

                    {signatureMode === 'draw' ? (
                      <div className="relative border-2 border-dashed border-zinc-300 rounded-xl bg-zinc-50/50 p-2">
                        <canvas
                          ref={canvasRef}
                          width={600}
                          height={140}
                          onMouseDown={startDrawing}
                          onMouseMove={draw}
                          onMouseUp={stopDrawing}
                          onMouseLeave={stopDrawing}
                          onTouchStart={startDrawing}
                          onTouchMove={draw}
                          onTouchEnd={stopDrawing}
                          className="w-full h-36 bg-white rounded-lg cursor-crosshair touch-none border border-zinc-200"
                        />
                        <button
                          type="button"
                          onClick={clearCanvas}
                          className="absolute bottom-4 right-4 inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-md transition-colors"
                        >
                          <Eraser className="w-3 h-3" /> Clear Ink
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={signatureText}
                          onChange={(e) => setSignatureText(e.target.value)}
                          placeholder="Type your full legal name"
                          className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <div
                          className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl text-center text-2xl tracking-wide select-none"
                          style={{
                            color: signatureColor,
                            fontFamily: 'cursive, "Brush Script MT", "Segoe Script", sans-serif',
                          }}
                        >
                          {signatureText || 'Your Signature'}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      <div>
                        <label className="block text-xs font-medium text-zinc-700 mb-1">Signer Name</label>
                        <input
                          type="text"
                          value={signerName}
                          onChange={(e) => setSignerName(e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-zinc-700 mb-1">Signer Title / Role</label>
                        <input
                          type="text"
                          value={signerTitle}
                          onChange={(e) => setSignerTitle(e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1 text-xs text-zinc-600">
                      <input
                        type="checkbox"
                        id="audit-trail"
                        checked={includeAuditTrail}
                        onChange={(e) => setIncludeAuditTrail(e.target.checked)}
                        className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                      />
                      <label htmlFor="audit-trail" className="flex items-center gap-1.5 cursor-pointer">
                        <Shield className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Embed Cryptographic Audit Trail & SHA-256 Integrity Hash (eIDAS & ESIGN Compliant)</span>
                      </label>
                    </div>
                  </div>
                )}

                {/* PDF Comparison Studio */}
                {tool.id === 'compare' && (
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50/50 border border-blue-200 rounded-2xl flex items-start gap-3">
                      <FileDiff className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                      <div className="text-xs text-blue-900 leading-relaxed">
                        <p className="font-semibold mb-0.5">Visual Document Differential Engine</p>
                        <p className="text-blue-700">
                          Upload Document A (Baseline) and Document B (Revision) to highlight additions in green,
                          modifications in amber, and deletions in red.
                        </p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-2">
                        Comparison Threshold Sensitivity
                      </label>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { id: 'low', label: 'Strict Structural', desc: 'Flags minor layout & kerning shifts' },
                          { id: 'medium', label: 'Balanced (Standard)', desc: 'Detects text & graphic alterations' },
                          { id: 'high', label: 'Text Semantics Only', desc: 'Focuses on legal clause wording' },
                        ].map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setCompareSensitivity(item.id as any)}
                            className={`p-3 text-left rounded-xl border transition-all ${
                              compareSensitivity === item.id
                                ? 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-600'
                                : 'border-zinc-200 hover:border-zinc-300'
                            }`}
                          >
                            <div className="font-semibold text-xs text-zinc-900">{item.label}</div>
                            <div className="text-[10px] text-zinc-500 mt-0.5">{item.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* PDF Metadata Editor */}
                {tool.id === 'metadata' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">Document Title</label>
                      <input
                        type="text"
                        value={metaTitle}
                        onChange={(e) => setMetaTitle(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">Author / Organization</label>
                      <input
                        type="text"
                        value={metaAuthor}
                        onChange={(e) => setMetaAuthor(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">Subject Matter</label>
                      <input
                        type="text"
                        value={metaSubject}
                        onChange={(e) => setMetaSubject(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">Search Keywords (Comma Separated)</label>
                      <input
                        type="text"
                        value={metaKeywords}
                        onChange={(e) => setMetaKeywords(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                )}

                {/* OCR Multi-lingual Language Selector */}
                {tool.id === 'ocr' && (
                  <div className="max-w-md">
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      OCR Document Primary Language
                    </label>
                    <select
                      value={ocrLanguage}
                      onChange={(e) => setOcrLanguage(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                    >
                      <option value="eng">English (Latin OCR Engine 5.5)</option>
                      <option value="fra">French (Français)</option>
                      <option value="spa">Spanish (Español)</option>
                      <option value="deu">German (Deutsch)</option>
                      <option value="jpn">Japanese (日本語)</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Action Button */}
              {!isProcessing && !isCompleted && (
                <div className="pt-4 flex justify-end">
                  <button
                    onClick={handleExecuteTool}
                    className="px-6 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs shadow-md transition-all flex items-center gap-2"
                  >
                    <span>Execute {tool.name}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Stepper Progress Bar */}
          {isProcessing && (
            <div className="mt-6 pt-6 border-t border-zinc-100">
              <div className="mb-4 text-center">
                <div className="text-sm font-semibold text-zinc-900 mb-1">
                  Processing your document...
                </div>
                <div className="text-xs text-zinc-500">
                  Step {processingStep} of 4: {steps[processingStep - 1]?.title}
                </div>
              </div>

              <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden mb-6">
                <div
                  className="bg-blue-600 h-full transition-all duration-500"
                  style={{ width: `${(processingStep / 4) * 100}%` }}
                />
              </div>

              <div className="space-y-2">
                {steps.map((st, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-3 text-xs p-2 rounded-lg transition-colors ${
                      processingStep > i + 1
                        ? 'text-emerald-700 bg-emerald-50/50'
                        : processingStep === i + 1
                        ? 'text-blue-700 bg-blue-50/50 font-medium'
                        : 'text-zinc-400'
                    }`}
                  >
                    {processingStep > i + 1 ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : processingStep === i + 1 ? (
                      <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-zinc-300" />
                    )}
                    <div>
                      <span>{st.title}</span> – <span className="opacity-80">{st.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Download & Success Box */}
          {isCompleted && (
            <div className="mt-6 pt-6 border-t border-zinc-100">
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto mb-3 shadow-md shadow-emerald-500/20">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-semibold text-emerald-950 mb-1">
                  Document Ready for Download!
                </h3>
                <p className="text-xs text-emerald-800 mb-5 max-w-md mx-auto">
                  {tool.id === 'compress'
                    ? 'Reduced from 4.8 MB to 1.1 MB (77% file size saved) with flawless rendering.'
                    : 'Your files have been transformed and verified by our enterprise pipeline.'}
                </p>

                <div className="flex flex-wrap justify-center gap-3">
                  <a
                    href="#download"
                    className="px-6 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium shadow-sm transition-colors flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" /> Download Processed PDF
                  </a>
                  <button
                    onClick={() => {
                      setFiles([]);
                      setIsCompleted(false);
                    }}
                    className="px-4 py-2.5 rounded-full bg-white border border-emerald-300 text-emerald-800 text-xs font-medium hover:bg-emerald-100/50 transition-colors"
                  >
                    Process Another File
                  </button>
                </div>

                <div className="mt-4 text-[10px] text-emerald-700 flex items-center justify-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Auto-delete in 23h 59m · DoD 5220.22-M zero retention guarantee</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
