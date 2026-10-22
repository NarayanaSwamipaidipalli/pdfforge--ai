import * as crypto from 'crypto';
import * as http from 'http';

const API_BASE = 'http://localhost:4000/api/v1';

// Helper to create a valid 1-page PDF
function createMockPdf(title: string, text: string): Buffer {
  return Buffer.from(
    '%PDF-1.4\n' +
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n' +
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n' +
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >> endobj\n' +
    `4 0 obj << /Length ${text.length + 50} >> stream\n` +
    `BT /F1 12 Tf 72 712 Td (${text}) Tj ET\n` +
    'endstream endobj\n' +
    'xref\n' +
    '0 5\n' +
    '0000000000 65535 f \n' +
    '0000000009 00000 n \n' +
    '0000000058 00000 n \n' +
    '0000000115 00000 n \n' +
    '0000000206 00000 n \n' +
    'trailer << /Size 5 /Root 1 0 R >>\n' +
    'startxref\n' +
    '300\n' +
    '%%EOF'
  );
}

async function uploadPdfFile(token: string, name: string, content: string): Promise<string> {
  const buf = createMockPdf(name, content);
  const checksum = crypto.createHash('sha256').update(buf).digest('hex');

  // Presign
  const presignRes = await fetch(`${API_BASE}/files/presign-upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      fileName: name,
      fileSizeBytes: buf.length,
      mimeType: 'application/pdf',
      checksumSha256: checksum,
    }),
  });
  if (!presignRes.ok) throw new Error(`Presign failed: ${await presignRes.text()}`);
  const presign = await presignRes.json() as any;

  // Direct S3 PUT
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
        'Content-Length': buf.length,
      },
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) resolve();
        else reject(new Error(`S3 PUT failed with HTTP ${res.statusCode}: ${body}`));
      });
    });
    req.on('error', reject);
    req.write(buf);
    req.end();
  });

  // Confirm
  const confirmRes = await fetch(`${API_BASE}/files/confirm-upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ fileId: presign.fileId }),
  });
  if (!confirmRes.ok) throw new Error(`Confirm failed: ${await confirmRes.text()}`);
  const confirmed = await confirmRes.json() as any;
  return confirmed.file?.id || presign.fileId;
}

async function runJobAndDownload(
  token: string,
  tool: string,
  fileIds: string[],
  parameters: Record<string, any>,
  expectedHeader: string,
  expectedContentTypeSub: string
) {
  // 1. Dispatch
  const res = await fetch(`${API_BASE}/pdf/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ tool, fileIds, parameters }),
  });
  if (!res.ok) throw new Error(`Dispatch ${tool} failed: ${await res.text()}`);
  const job = await res.json() as any;
  const jobId = job.jobId || job.id;

  // 2. Poll until COMPLETED
  let status = job.status;
  for (let i = 0; i < 20; i++) {
    const sRes = await fetch(`${API_BASE}/pdf/jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const sJob = await sRes.json() as any;
    status = sJob.status;
    if (status === 'COMPLETED' || status === 'FAILED') break;
    await new Promise(r => setTimeout(r, 600));
  }

  if (status !== 'COMPLETED') {
    throw new Error(`Job ${tool} (${jobId}) ended with status: ${status}`);
  }

  // 3. Download
  const dlRes = await fetch(`${API_BASE}/pdf/jobs/${jobId}/download`);
  if (!dlRes.ok) throw new Error(`Download ${tool} failed: HTTP ${dlRes.status}`);

  const contentType = dlRes.headers.get('content-type') || '';
  if (!contentType.includes(expectedContentTypeSub)) {
    throw new Error(`Content-Type mismatch: expected '${expectedContentTypeSub}', got '${contentType}'`);
  }

  const disp = dlRes.headers.get('content-disposition') || '';
  if (!disp.includes('attachment;')) {
    throw new Error(`Expected Content-Disposition: attachment, got: '${disp}'`);
  }

  const arrayBuf = await dlRes.arrayBuffer();
  if (arrayBuf.byteLength === 0) {
    throw new Error(`Downloaded file for ${tool} is empty`);
  }

  const headBuf = Buffer.from(arrayBuf).subarray(0, 10).toString();
  if (expectedHeader && !headBuf.startsWith(expectedHeader)) {
    throw new Error(`Header mismatch: expected starts with '${expectedHeader}', got '${headBuf}'`);
  }

  console.log(`   ✔ ${tool.toUpperCase()}: completed, streamed ${arrayBuf.byteLength} bytes (${contentType}, disposition: ${disp})`);
}

async function testSuite() {
  console.log('\n=============================================================');
  console.log('🧪 Comprehensive Multi-Tool Backend Verification');
  console.log('=============================================================\n');

  // Register user
  const email = `multitool_${Date.now()}@test.com`;
  const regRes = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'SecurePassword123!', name: 'Multi Tester' }),
  });
  const regData = await regRes.json() as any;
  const token = regData.tokens.accessToken;

  // Upload test files
  console.log('1. Uploading test documents to MinIO S3...');
  const file1 = await uploadPdfFile(token, 'Contract_Section_A.pdf', 'CONFIDENTIAL SECTION A: TERMS AND CONDITIONS');
  const file2 = await uploadPdfFile(token, 'Contract_Section_B.pdf', 'CONFIDENTIAL SECTION B: PRICING AND SLAS');
  console.log(`   Uploaded file 1: ${file1}`);
  console.log(`   Uploaded file 2: ${file2}`);

  console.log('\n2. Testing Tools:');

  // Test 1: Compress PDF
  await runJobAndDownload(token, 'compress', [file1], { compressionLevel: 'medium' }, '%PDF-', 'application/pdf');

  // Test 2: Merge PDF (2 files)
  await runJobAndDownload(token, 'merge', [file1, file2], {}, '%PDF-', 'application/pdf');

  // Test 3: Rotate PDF
  await runJobAndDownload(token, 'rotate', [file1], { rotationDegrees: 90 }, '%PDF-', 'application/pdf');

  // Test 4: Watermark PDF
  await runJobAndDownload(token, 'watermark', [file1], { watermarkText: 'APPROVED 2026', watermarkOpacity: 0.25 }, '%PDF-', 'application/pdf');

  // Test 5: Bates Numbering
  await runJobAndDownload(token, 'bates', [file1], { prefix: 'LEGAL', startNumber: 100 }, '%PDF-', 'application/pdf');

  // Test 6: PDF to Word (.docx)
  await runJobAndDownload(token, 'pdf-to-word', [file1], {}, 'PK', 'wordprocessingml');

  // Test 7: PDF to Excel (.csv)
  await runJobAndDownload(token, 'pdf-to-excel', [file1], {}, '', 'csv');

  console.log('\n=============================================================');
  console.log('🎉 ALL TESTED TOOLS PASSED END-TO-END BACKEND & STREAMING DOWNLOAD');
  console.log('=============================================================\n');
}

testSuite().catch((err) => {
  console.error('\n❌ Test Suite Failed:', err);
  process.exit(1);
});
