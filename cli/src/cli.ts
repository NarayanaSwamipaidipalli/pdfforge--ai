#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const program = new Command();

const CONFIG_DIR = path.join(os.homedir(), '.pdfforge');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

function loadConfig(): { apiKey?: string; accessToken?: string; apiUrl?: string } {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    }
  } catch {}
  return {};
}

function saveConfig(config: Record<string, any>) {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  const existing = loadConfig();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify({ ...existing, ...config }, null, 2), 'utf-8');
}

function getBaseUrl(cmdOptions: any): string {
  const cfg = loadConfig();
  return (cmdOptions.endpoint || process.env.PDFFORGE_API_URL || cfg.apiUrl || 'http://localhost:4000/api/v1').replace(/\/+$/, '');
}

function getAuthHeaders(cmdOptions: any): Record<string, string> {
  const cfg = loadConfig();
  const apiKey = cmdOptions.apiKey || process.env.PDFFORGE_API_KEY || cfg.apiKey;
  const token = cfg.accessToken;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'PDFForge-CLI/1.0.0',
  };

  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  } else if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

async function uploadFile(baseUrl: string, headers: Record<string, string>, filePath: string): Promise<string> {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Error: File not found: ${filePath}`);
    process.exit(1);
  }

  const fileBytes = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);

  // 1. Presign
  const presignRes = await fetch(`${baseUrl}/files/presign-upload`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      fileName,
      fileSizeBytes: fileBytes.byteLength,
      mimeType: 'application/pdf',
    }),
  });

  if (!presignRes.ok) {
    throw new Error(`Failed to initialize upload: ${await presignRes.text()}`);
  }

  const presign = (await presignRes.json()) as any;

  // 2. Put to S3/MinIO
  const putRes = await fetch(presign.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/pdf' },
    body: fileBytes,
  });

  if (!putRes.ok) {
    throw new Error(`Direct upload failed: ${putRes.status}`);
  }

  // 3. Confirm
  const confirmRes = await fetch(`${baseUrl}/files/confirm-upload`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ fileId: presign.fileId }),
  });

  if (!confirmRes.ok) {
    throw new Error(`Confirm upload failed: ${await confirmRes.text()}`);
  }

  return presign.fileId;
}

async function dispatchAndPollJob(
  baseUrl: string,
  headers: Record<string, string>,
  tool: string,
  fileIds: string[],
  parameters: Record<string, any> = {},
): Promise<any> {
  const createRes = await fetch(`${baseUrl}/pdf/jobs`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ tool, fileIds, parameters }),
  });

  if (!createRes.ok) {
    throw new Error(`Job creation failed: ${await createRes.text()}`);
  }

  const job = (await createRes.json()) as any;
  console.log(`🚀 Job dispatched [ID: ${job.id} | Tool: ${tool}]. Processing...`);

  // Poll
  const startTime = Date.now();
  while (Date.now() - startTime < 120000) {
    const statusRes = await fetch(`${baseUrl}/pdf/jobs/${job.id}`, { headers });
    if (statusRes.ok) {
      const current = (await statusRes.json()) as any;
      if (current.status === 'COMPLETED') {
        return current;
      }
      if (current.status === 'FAILED') {
        throw new Error(current.errorMessage || 'Job execution failed');
      }
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  throw new Error('Job execution timed out after 120 seconds');
}

program
  .name('pdfforge')
  .description('PDFForge AI – Enterprise PDF Intelligence Platform Command Line Interface')
  .version('1.0.0');

// ==========================================
// AUTH COMMANDS
// ==========================================

program
  .command('login')
  .description('Authenticate with PDFForge AI API using email and password')
  .requiredOption('-e, --email <email>', 'User account email')
  .requiredOption('-p, --password <password>', 'User account password')
  .option('--endpoint <url>', 'API Endpoint URL')
  .action(async (opts) => {
    const baseUrl = getBaseUrl(opts);
    try {
      console.log(`Connecting to ${baseUrl}...`);
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: opts.email, password: opts.password }),
      });

      if (!res.ok) {
        console.error(`❌ Authentication failed: ${await res.text()}`);
        process.exit(1);
      }

      const data = (await res.json()) as any;
      saveConfig({
        accessToken: data.tokens.accessToken,
        apiUrl: baseUrl,
        user: data.user,
      });

      console.log(`✅ Successfully logged in as ${data.user.email} (${data.user.role} | ${data.user.plan})`);
    } catch (err: any) {
      console.error(`❌ Login error: ${err.message}`);
      process.exit(1);
    }
  });

// ==========================================
// PDF PROCESSING COMMANDS
// ==========================================

program
  .command('merge <files...>')
  .description('Consolidate multiple PDF documents into a single master PDF')
  .option('-o, --output <path>', 'Destination output path', 'merged.pdf')
  .action(async (files: string[], opts) => {
    const baseUrl = getBaseUrl(opts);
    const headers = getAuthHeaders(opts);

    try {
      console.log(`Uploading ${files.length} documents...`);
      const fileIds: string[] = [];
      for (const f of files) {
        const id = await uploadFile(baseUrl, headers, f);
        fileIds.push(id);
      }

      const job = await dispatchAndPollJob(baseUrl, headers, 'merge', fileIds);
      console.log(`✅ Merge complete! Output key: ${job.outputFileKey}`);
      console.log(`Saved destination: ${opts.output}`);
    } catch (err: any) {
      console.error(`❌ Merge failed: ${err.message}`);
      process.exit(1);
    }
  });

program
  .command('compress <file>')
  .description('Optimize and compress a PDF document')
  .option('-l, --level <level>', 'Compression level: low | medium | extreme', 'medium')
  .option('-o, --output <path>', 'Destination output path', 'compressed.pdf')
  .action(async (file: string, opts) => {
    const baseUrl = getBaseUrl(opts);
    const headers = getAuthHeaders(opts);

    try {
      console.log(`Uploading ${file}...`);
      const fileId = await uploadFile(baseUrl, headers, file);
      const job = await dispatchAndPollJob(baseUrl, headers, 'compress', [fileId], {
        compressionLevel: opts.level,
      });
      console.log(`✅ Compression complete! Output key: ${job.outputFileKey}`);
    } catch (err: any) {
      console.error(`❌ Compression failed: ${err.message}`);
      process.exit(1);
    }
  });

program
  .command('watermark <file>')
  .description('Apply an enterprise diagonal security watermark to a PDF')
  .requiredOption('-t, --text <text>', 'Watermark text stamp')
  .option('-o, --output <path>', 'Destination output path', 'watermarked.pdf')
  .action(async (file: string, opts) => {
    const baseUrl = getBaseUrl(opts);
    const headers = getAuthHeaders(opts);

    try {
      console.log(`Uploading ${file}...`);
      const fileId = await uploadFile(baseUrl, headers, file);
      const job = await dispatchAndPollJob(baseUrl, headers, 'watermark', [fileId], {
        watermarkText: opts.text,
      });
      console.log(`✅ Watermark stamped! Output key: ${job.outputFileKey}`);
    } catch (err: any) {
      console.error(`❌ Watermarking failed: ${err.message}`);
      process.exit(1);
    }
  });

program
  .command('ocr <file>')
  .description('Execute optical character recognition on scanned PDF')
  .option('-l, --lang <lang>', 'Language code: eng | fra | spa | deu', 'eng')
  .option('-o, --output <path>', 'Destination output path', 'ocr_searchable.pdf')
  .action(async (file: string, opts) => {
    const baseUrl = getBaseUrl(opts);
    const headers = getAuthHeaders(opts);

    try {
      console.log(`Uploading ${file}...`);
      const fileId = await uploadFile(baseUrl, headers, file);
      const job = await dispatchAndPollJob(baseUrl, headers, 'ocr', [fileId], {
        language: opts.lang,
      });
      console.log(`✅ OCR Complete! Output key: ${job.outputFileKey}`);
    } catch (err: any) {
      console.error(`❌ OCR failed: ${err.message}`);
      process.exit(1);
    }
  });

// ==========================================
// AI DOCUMENT INTELLIGENCE
// ==========================================

const ai = program.command('ai').description('AI Document Intelligence commands');

ai.command('summarize <file>')
  .description('Generate AI executive summary and bullet points')
  .option('-m, --mode <mode>', 'Summary mode: concise | detailed | bullet_points', 'bullet_points')
  .action(async (file: string, opts) => {
    const baseUrl = getBaseUrl(opts);
    const headers = getAuthHeaders(opts);

    try {
      console.log(`Uploading ${file}...`);
      const fileId = await uploadFile(baseUrl, headers, file);

      console.log(`Analyzing document with AI...`);
      const res = await fetch(`${baseUrl}/ai/summarize`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ fileId, mode: opts.mode }),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const summary = (await res.json()) as any;
      console.log(`\n================ EXECUTIVE SUMMARY ================\n`);
      console.log(summary.summary);
      console.log(`\n================ KEY ACTION POINTS ================\n`);
      summary.keyPoints?.forEach((p: string, i: number) => console.log(`${i + 1}. ${p}`));
      console.log(`\nAnalyzed ${summary.pageCount} pages using ${summary.modelUsed} in ${summary.executionTimeMs}ms.\n`);
    } catch (err: any) {
      console.error(`❌ AI Summarize failed: ${err.message}`);
      process.exit(1);
    }
  });

ai.command('ask <file>')
  .description('Interactive RAG Q&A about a PDF document')
  .requiredOption('-q, --question <question>', 'Prompt / query to answer based on PDF text')
  .action(async (file: string, opts) => {
    const baseUrl = getBaseUrl(opts);
    const headers = getAuthHeaders(opts);

    try {
      console.log(`Uploading ${file}...`);
      const fileId = await uploadFile(baseUrl, headers, file);

      console.log(`Querying RAG vectors...`);
      const res = await fetch(`${baseUrl}/ai/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ fileId, message: opts.question }),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const answer = (await res.json()) as any;
      console.log(`\n💡 ANSWER:\n`);
      console.log(answer.answer);
      if (answer.citations?.length) {
        console.log(`\n📚 CITATIONS:`);
        answer.citations.forEach((c: any) => {
          console.log(`- Page ${c.pageNumber}: "${c.textSnippet}" (Score: ${c.similarityScore})`);
        });
      }
    } catch (err: any) {
      console.error(`❌ AI Q&A failed: ${err.message}`);
      process.exit(1);
    }
  });

ai.command('invoice <file>')
  .description('Extract structured JSON fields from an invoice or receipt')
  .action(async (file: string, opts) => {
    const baseUrl = getBaseUrl(opts);
    const headers = getAuthHeaders(opts);

    try {
      console.log(`Uploading ${file}...`);
      const fileId = await uploadFile(baseUrl, headers, file);

      console.log(`Extracting structured financial fields...`);
      const res = await fetch(`${baseUrl}/ai/extract/invoice`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ fileId }),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const invoice = await res.json();
      console.log(JSON.stringify(invoice, null, 2));
    } catch (err: any) {
      console.error(`❌ Invoice extraction failed: ${err.message}`);
      process.exit(1);
    }
  });

// ==========================================
// SYSTEM TELEMETRY
// ==========================================

program
  .command('telemetry')
  .description('Display real-time cluster telemetry and processing queues')
  .action(async (opts) => {
    const baseUrl = getBaseUrl(opts);
    const headers = getAuthHeaders(opts);

    try {
      const res = await fetch(`${baseUrl}/admin/telemetry`, { headers });
      if (!res.ok) {
        throw new Error(`Telemetry request failed: ${await res.text()}`);
      }

      const telemetry = await res.json();
      console.log(JSON.stringify(telemetry, null, 2));
    } catch (err: any) {
      console.error(`❌ Telemetry failed: ${err.message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
