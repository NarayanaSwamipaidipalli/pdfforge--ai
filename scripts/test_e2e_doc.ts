import * as crypto from 'crypto';
import * as http from 'http';
import * as fs from 'fs';

const API_BASE = 'http://localhost:4000/api/v1';

async function uploadPdf(token: string, filePath: string, name: string): Promise<string> {
  const buf = fs.readFileSync(filePath);
  const checksum = crypto.createHash('sha256').update(buf).digest('hex');

  const presignRes = await fetch(${API_BASE}/files/presign-upload, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: Bearer  },
    body: JSON.stringify({
      fileName: name,
      fileSizeBytes: buf.length,
      mimeType: 'application/pdf',
      checksumSha256: checksum,
    }),
  });
  if (!presignRes.ok) throw new Error(Presign failed: );
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
      else reject(new Error(S3 PUT failed: ));
    });
    req.on('error', reject);
    req.write(buf);
    req.end();
  });

  const confirmRes = await fetch(${API_BASE}/files/confirm-upload, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: Bearer  },
    body: JSON.stringify({ fileId: presign.fileId }),
  });
  if (!confirmRes.ok) throw new Error(Confirm failed: );
  const confirmed = await confirmRes.json() as any;
  return confirmed.file?.id || presign.fileId;
}

async function main() {
  console.log('Testing End-to-End conversion of Documentation[1].pdf...');
  const email = 	est_doc_@test.com;
  const regRes = await fetch(${API_BASE}/auth/register, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'SecurePassword123!', name: 'Doc Tester' }),
  });
  const regData = await regRes.json() as any;
  const token = regData.tokens.accessToken;

  const pdfPath = 'C:/Users/rough/Downloads/Documentation[1].pdf';
  const fileId = await uploadPdf(token, pdfPath, 'Documentation[1].pdf');
  console.log('Uploaded PDF fileId:', fileId);

  const jobRes = await fetch(${API_BASE}/pdf/jobs, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: Bearer  },
    body: JSON.stringify({
      tool: 'pdf-to-word',
      fileIds: [fileId],
      parameters: {},
    }),
  });
  if (!jobRes.ok) throw new Error(Job create failed: );
  const job = await jobRes.json() as any;
  const jobId = job.jobId || job.id;
  console.log('Dispatched pdf-to-word JobId:', jobId);

  let status = job.status;
  for (let i = 0; i < 60; i++) {
    const sRes = await fetch(${API_BASE}/pdf/jobs/, {
      headers: { Authorization: Bearer  },
    });
    const sJob = await sRes.json() as any;
    status = sJob.status;
    console.log([Attempt ] Job status: );
    if (status === 'COMPLETED' || status === 'FAILED') {
      if (status === 'FAILED') throw new Error(Job failed: );
      break;
    }
    await new Promise(r => setTimeout(r, 2000));
  }

  const dlRes = await fetch(${API_BASE}/pdf/jobs//download);
  if (!dlRes.ok) throw new Error(Download failed: HTTP );
  const arrayBuf = await dlRes.arrayBuffer();
  const outPath = 'C:/Users/rough/Downloads/e2e_converted_Document.docx';
  fs.writeFileSync(outPath, Buffer.from(arrayBuf));
  console.log(Saved output to  ( bytes));
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
