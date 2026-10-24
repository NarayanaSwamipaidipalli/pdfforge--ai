import * as crypto from 'crypto';
import * as http from 'http';

const API_BASE = 'http://localhost:4000/api/v1';

// Create a valid 3-page PDF
function create3PagePdf(): Buffer {
  return Buffer.from(
    '%PDF-1.4\n' +
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n' +
    '2 0 obj << /Type /Pages /Kids [3 0 R 5 0 R 7 0 R] /Count 3 >> endobj\n' +
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >> endobj\n' +
    '4 0 obj << /Length 44 >> stream\n' +
    'BT /F1 14 Tf 72 700 Td (PAGE 1 CONTENT) Tj ET\n' +
    'endstream endobj\n' +
    '5 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 6 0 R >> endobj\n' +
    '6 0 obj << /Length 44 >> stream\n' +
    'BT /F1 14 Tf 72 700 Td (PAGE 2 CONTENT) Tj ET\n' +
    'endstream endobj\n' +
    '7 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 8 0 R >> endobj\n' +
    '8 0 obj << /Length 44 >> stream\n' +
    'BT /F1 14 Tf 72 700 Td (PAGE 3 CONTENT) Tj ET\n' +
    'endstream endobj\n' +
    'xref\n' +
    '0 9\n' +
    '0000000000 65535 f \n' +
    '0000000009 00000 n \n' +
    '0000000058 00000 n \n' +
    '0000000125 00000 n \n' +
    '0000000216 00000 n \n' +
    '0000000309 00000 n \n' +
    '0000000400 00000 n \n' +
    '0000000493 00000 n \n' +
    '0000000584 00000 n \n' +
    'trailer << /Size 9 /Root 1 0 R >>\n' +
    'startxref\n' +
    '677\n' +
    '%%EOF'
  );
}

async function uploadPdfFile(token: string, name: string): Promise<string> {
  const buf = create3PagePdf();
  const checksum = crypto.createHash('sha256').update(buf).digest('hex');

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
      if (res.statusCode && res.statusCode < 300) resolve();
      else reject(new Error(`S3 PUT failed with status ${res.statusCode}`));
    });
    req.on('error', reject);
    req.write(buf);
    req.end();
  });

  const confirmRes = await fetch(`${API_BASE}/files/confirm-upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ fileId: presign.fileId }),
  });
  if (!confirmRes.ok) throw new Error(`Confirm failed: ${await confirmRes.text()}`);
  const confirmed = await confirmRes.json() as any;
  return confirmed.file?.id || presign.fileId;
}

async function testDeletePages() {
  console.log('🧪 Testing Delete Pages End-to-End...');
  const email = `deltest_${Date.now()}@test.com`;
  const regRes = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'SecurePassword123!', name: 'Delete Tester' }),
  });
  const regData = await regRes.json() as any;
  const token = regData.tokens.accessToken;

  const fileId = await uploadPdfFile(token, 'ThreePageDocument.pdf');
  console.log('✔ Uploaded 3-page test PDF:', fileId);

  // Dispatch delete-pages with pagesToDelete as string "2" (the exact format sent by web frontend!)
  const jobRes = await fetch(`${API_BASE}/pdf/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      tool: 'delete-pages',
      fileIds: [fileId],
      parameters: {
        pagesToDelete: '2',
        deletePages: '2',
      },
    }),
  });
  if (!jobRes.ok) throw new Error(`Job create failed: ${await jobRes.text()}`);
  const job = await jobRes.json() as any;
  const jobId = job.jobId || job.id;
  console.log('✔ Job dispatched:', jobId);

  // Poll
  let status = job.status;
  for (let i = 0; i < 20; i++) {
    const sRes = await fetch(`${API_BASE}/pdf/jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const sJob = await sRes.json() as any;
    status = sJob.status;
    if (status === 'COMPLETED' || status === 'FAILED') {
      if (status === 'FAILED') {
        throw new Error(`Job FAILED with error: ${sJob.errorMessage}`);
      }
      break;
    }
    await new Promise(r => setTimeout(r, 600));
  }

  // Download result
  const dlRes = await fetch(`${API_BASE}/pdf/jobs/${jobId}/download`);
  if (!dlRes.ok) throw new Error(`Download failed: HTTP ${dlRes.status}`);
  const arrayBuf = await dlRes.arrayBuffer();
  console.log(`🎉 SUCCESS! Downloaded ${arrayBuf.byteLength} bytes. Delete Pages completed with zero errors!`);
}

testDeletePages().catch(err => {
  console.error('❌ Test failed:', err.message);
  process.exit(1);
});
