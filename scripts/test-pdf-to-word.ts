import * as crypto from 'crypto';
import * as http from 'http';

const API_BASE = 'http://localhost:4000/api/v1';

// Generate a multi-element PDF buffer directly
function generateRichPdf(): Buffer {
  return Buffer.from(
    '%PDF-1.4\n' +
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n' +
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n' +
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >> endobj\n' +
    '4 0 obj << /Length 260 >> stream\n' +
    'BT /F1 16 Tf 72 720 Td (PDF TO WORD ENTERPRISE ENGINE TEST) Tj ET\n' +
    'BT /F1 11 Tf 72 690 Td (High fidelity layout preservation test: fonts, tables, alignment, and images.) Tj ET\n' +
    '72 650 468 40 re S\n' +
    '72 650 234 40 re S\n' +
    'BT /F1 10 Tf 80 665 Td (Module Component) Tj ET\n' +
    'BT /F1 10 Tf 314 665 Td (Conversion Status: Verified) Tj ET\n' +
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
    '520\n' +
    '%%EOF'
  );
}

async function uploadPdf(token: string, name: string): Promise<string> {
  const buf = generateRichPdf();
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
      else reject(new Error(`S3 PUT failed: ${res.statusCode}`));
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

async function main() {
  console.log('🧪 Running End-to-End PDF-to-Word Conversion Pipeline Test...');
  const email = `pdf2word_${Date.now()}@test.com`;
  const regRes = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'SecurePassword123!', name: 'Word Tester' }),
  });
  const regData = await regRes.json() as any;
  const token = regData.tokens.accessToken;

  const fileId = await uploadPdf(token, 'Contract_Layout_Test.pdf');
  console.log('✔ Uploaded source test PDF:', fileId);

  // Dispatch pdf-to-word job
  const jobRes = await fetch(`${API_BASE}/pdf/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      tool: 'pdf-to-word',
      fileIds: [fileId],
      parameters: {
        ocr_enabled: true,
        table_recognition: true,
        preserve_images: true,
      },
    }),
  });
  if (!jobRes.ok) throw new Error(`Job create failed: ${await jobRes.text()}`);
  const job = await jobRes.json() as any;
  const jobId = job.jobId || job.id;
  console.log('✔ PDF-to-Word Job dispatched:', jobId);

  // Poll
  let status = job.status;
  for (let i = 0; i < 30; i++) {
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

  // Download converted Word document
  const dlRes = await fetch(`${API_BASE}/pdf/jobs/${jobId}/download`);
  if (!dlRes.ok) throw new Error(`Download failed: HTTP ${dlRes.status}`);
  const contentType = dlRes.headers.get('content-type') || '';
  const arrayBuf = await dlRes.arrayBuffer();
  const header = Buffer.from(arrayBuf).subarray(0, 4).toString('utf-8');

  console.log(`\n🎉 SUCCESS!`);
  console.log(`- Downloaded: ${arrayBuf.byteLength} bytes`);
  console.log(`- Content-Type: ${contentType}`);
  console.log(`- ZIP/DOCX Magic Header: '${header}' (PK.. indicates valid OpenXML Word document)`);
  
  if (!header.startsWith('PK')) {
    throw new Error('Downloaded file does not have valid ZIP / PK header for .docx');
  }
}

main().catch(err => {
  console.error('❌ Pipeline test failed:', err);
  process.exit(1);
});
