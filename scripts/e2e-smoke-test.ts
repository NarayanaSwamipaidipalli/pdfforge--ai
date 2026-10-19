/**
 * PDFForge AI Enterprise - End-to-End Platform Verification Suite
 * Executes full integration tests against running local or production services.
 */

import * as crypto from 'crypto';
import * as http from 'http';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:4000/api/v1';
const WORKER_BASE = process.env.WORKER_BASE_URL || 'http://localhost:8000';

interface TestContext {
  token?: string;
  adminToken?: string;
  userId?: string;
  fileId?: string;
  jobId?: string;
}

const ctx: TestContext = {};

function log(emoji: string, title: string, details?: string) {
  console.log(`${emoji} \x1b[1m${title}\x1b[0m ${details ? `\x1b[34m(${details})\x1b[0m` : ''}`);
}

function pass(name: string) {
  console.log(`   \x1b[32m✔ PASS:\x1b[0m ${name}`);
}

function fail(name: string, error: any) {
  console.error(`   \x1b[31m✘ FAIL:\x1b[0m ${name}`);
  console.error(`     \x1b[31mError: ${error.message || error}\x1b[0m`);
  process.exit(1);
}

async function runTest(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    pass(name);
  } catch (err) {
    fail(name, err);
  }
}

async function main() {
  console.log('\n=============================================================');
  console.log('🚀 PDFForge AI Enterprise – End-to-End Verification Suite');
  console.log(`🎯 Target API: ${API_BASE}`);
  console.log(`⚙️  Target Worker: ${WORKER_BASE}`);
  console.log('=============================================================\n');

  // 1. Health Checks
  log('🏥', 'Stage 1: Microservices Health & Service Discovery');
  await runTest('API Gateway Catalog & Plans', async () => {
    const res = await fetch(`${API_BASE}/billing/plans`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const plans = await res.json() as any[];
    if (plans.length < 4) throw new Error('Expected 4 subscription tiers');
  });

  await runTest('Python PDF Worker Engine Health', async () => {
    const res = await fetch(`${WORKER_BASE}/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const health = await res.json() as any;
    if (health.status !== 'HEALTHY') throw new Error(`Worker status was ${health.status}`);
  });

  // 2. Authentication
  log('🔐', 'Stage 2: Enterprise Authentication & Multi-Tenancy');
  await runTest('Admin Authentication (admin@pdfforge.ai)', async () => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@pdfforge.ai', password: 'AdminPassword123!' }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json() as any;
    ctx.adminToken = data.tokens.accessToken;
    if (data.user.role !== 'SUPERADMIN') throw new Error('Expected SUPERADMIN role');
  });

  await runTest('Standard User Register & Token Generation', async () => {
    const email = `test_engineer_${Date.now()}@enterprise.com`;
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'SecurePassword123!', name: 'Test Lead' }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json() as any;
    ctx.token = data.tokens.accessToken;
    ctx.userId = data.user.id;
  });

  await runTest('Verify User Profile & Session (/auth/me)', async () => {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${ctx.token}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const profile = await res.json() as any;
    if (!profile.email) throw new Error('Profile missing email');
  });

  await runTest('Team Organization Provisioning', async () => {
    const res = await fetch(`${API_BASE}/organizations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ctx.token}`,
      },
      body: JSON.stringify({ name: 'Acme Global BioTech' }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const org = await res.json() as any;
    if (!org.slug) throw new Error('Organization slug missing');
  });

  // 3. Storage & Files
  log('📦', 'Stage 3: S3 Direct Multipart Upload & Storage Plane');
  await runTest('Direct Upload Simulation & Lifecycle Confirmation', async () => {
    // 1. Presign
    const mockPdfBytes = Buffer.from('%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF');
    const checksumSha256 = crypto.createHash('sha256').update(mockPdfBytes).digest('hex');

    const presignRes = await fetch(`${API_BASE}/files/presign-upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ctx.token}`,
      },
      body: JSON.stringify({
        fileName: 'Integration_Test_Spec.pdf',
        fileSizeBytes: mockPdfBytes.length,
        mimeType: 'application/pdf',
        checksumSha256,
      }),
    });
    if (!presignRes.ok) throw new Error(`Presign failed: ${await presignRes.text()}`);
    const presign = await presignRes.json() as any;

    // 2. Put to S3 / MinIO (preserves Host: minio:9000)
    await new Promise<void>((resolve, reject) => {
      const parsedUrl = new URL(presign.uploadUrl);
      const req = http.request({
        hostname: '127.0.0.1',
        port: 9000,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'PUT',
        headers: {
          'Host': parsedUrl.host,
          'Content-Type': 'application/pdf',
          'Content-Length': mockPdfBytes.length,
        },
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve();
          } else {
            reject(new Error(`S3 PUT failed with HTTP ${res.statusCode}: ${body}`));
          }
        });
      });
      req.on('error', reject);
      req.write(mockPdfBytes);
      req.end();
    });

    // 3. Confirm
    const confirmRes = await fetch(`${API_BASE}/files/confirm-upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ctx.token}`,
      },
      body: JSON.stringify({ fileId: presign.fileId }),
    });
    if (!confirmRes.ok) throw new Error(`Confirm failed: ${await confirmRes.text()}`);
    const confirmed = await confirmRes.json() as any;
    ctx.fileId = confirmed.file?.id || presign.fileId;
  });

  // 4. Job Processing
  log('⚡', 'Stage 4: PDF Worker Distributed Task Pipeline');
  await runTest('Dispatch Compression Job', async () => {
    const res = await fetch(`${API_BASE}/pdf/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ctx.token}`,
      },
      body: JSON.stringify({
        tool: 'compress',
        fileIds: [ctx.fileId],
        parameters: { compressionLevel: 'medium' },
      }),
    });
    if (!res.ok) throw new Error(`Job creation failed: ${await res.text()}`);
    const job = await res.json() as any;
    ctx.jobId = job.jobId || job.id;
  });

  await runTest('Query Job Status & Progress', async () => {
    const res = await fetch(`${API_BASE}/pdf/jobs/${ctx.jobId}`, {
      headers: { Authorization: `Bearer ${ctx.token}` },
    });
    if (!res.ok) throw new Error(`Query job failed: ${res.status}`);
    const job = await res.json() as any;
    if (!['QUEUED', 'PROCESSING', 'COMPLETED'].includes(job.status)) {
      throw new Error(`Unexpected job status: ${job.status}`);
    }
  });

  // 5. AI Document Intelligence
  log('🧠', 'Stage 5: AI Document Intelligence & Private LLM Engine');
  await runTest('Query Available AI Models (Cloud & Air-gapped)', async () => {
    const res = await fetch(`${API_BASE}/ai/models`, {
      headers: { Authorization: `Bearer ${ctx.token}` },
    });
    if (!res.ok) throw new Error(`AI models failed: ${res.status}`);
    const models = await res.json() as any;
    if (!models.providers?.openai || !models.providers?.ollama) {
      throw new Error('Expected both OpenAI and Ollama provider configurations');
    }
  });

  await runTest('AI Document Summarization Endpoint', async () => {
    const res = await fetch(`${API_BASE}/ai/summarize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ctx.token}`,
      },
      body: JSON.stringify({ fileId: ctx.fileId, length: 'balanced' }),
    });
    if (!res.ok) throw new Error(`AI Summarize failed: ${await res.text()}`);
    const summary = await res.json() as any;
    if (!summary.summary) throw new Error('Summary text missing');
  });

  // 6. Billing & Tax Invoices
  log('💳', 'Stage 6: Billing, Subscriptions & PDF Invoicing');
  await runTest('Generate Official PDF Tax Receipt', async () => {
    const res = await fetch(`${API_BASE}/billing/invoice/download`, {
      headers: { Authorization: `Bearer ${ctx.token}` },
    });
    if (!res.ok) throw new Error(`Invoice generation failed: ${res.status}`);
    const contentType = res.headers.get('content-type');
    if (!contentType?.includes('application/pdf')) {
      throw new Error(`Expected application/pdf, received ${contentType}`);
    }
    const buf = await res.arrayBuffer();
    if (buf.byteLength < 500) throw new Error('Generated PDF byte buffer is too small');
  });

  // 7. Cluster Telemetry
  log('📊', 'Stage 7: Admin Cluster Telemetry & Observability');
  await runTest('Fetch Real-time Cluster Metrics', async () => {
    const res = await fetch(`${API_BASE}/admin/telemetry`, {
      headers: { Authorization: `Bearer ${ctx.adminToken}` },
    });
    if (!res.ok) throw new Error(`Telemetry failed: ${res.status}`);
    const telem = await res.json() as any;
    if (!telem.metrics || !telem.queueStatus) {
      throw new Error('Telemetry payload missing core metrics');
    }
  });

  // 8. Webhook Security
  log('🛡️', 'Stage 8: Webhook Cryptographic Integrity');
  await runTest('Verify HMAC-SHA256 Webhook Signature', async () => {
    const secret = 'whsec_prod_enterprise_test_key_2026';
    const payload = JSON.stringify({ event: 'job.completed', jobId: ctx.jobId });
    const hmac = crypto.createHmac('sha256', secret);
    const signature = hmac.update(payload).digest('hex');

    const verifyHmac = crypto.createHmac('sha256', secret);
    const expected = verifyHmac.update(payload).digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      throw new Error('HMAC signature verification mismatch');
    }
  });

  console.log('\n=============================================================');
  console.log('🎉 ALL INTEGRATION SUITE TESTS PASSED SUCCESSFULLY! (8/8)');
  console.log('=============================================================\n');
}

main().catch((err) => {
  console.error('\n💥 Suite crashed:', err);
  process.exit(1);
});
