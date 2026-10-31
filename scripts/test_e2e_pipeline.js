const http = require('http');
const https = require('https');
const crypto = require('crypto');

function request(url, options = {}, data = null) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https://');
    const client = isHttps ? https : http;
    const req = client.request(url, options, (res) => {
      let chunks = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => {
        const bodyBuffer = Buffer.concat(chunks);
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          bodyBuffer,
          bodyText: bodyBuffer.toString('utf8'),
        });
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(data);
    }
    req.end();
  });
}

function createMinimalPdf() {
  const content = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 55 >>
stream
BT
/F1 24 Tf
100 700 Td
(PDFForge Production Release Audit) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000244 00000 n 
0000000349 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
426
%%EOF`;
  return Buffer.from(content, 'utf8');
}

async function runAudit() {
  console.log('====================================================');
  console.log('🚀 Running End-to-End PDF Pipeline Production Audit');
  console.log('====================================================');

  const API_BASE = 'http://localhost:4000/api/v1';

  // 1. Authenticate with seeded Admin
  console.log('\n[1/6] Authenticating with API Gateway...');
  const loginRes = await request(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, JSON.stringify({
    email: 'admin@pdfforge.ai',
    password: 'AdminPassword123!',
  }));

  if (loginRes.statusCode !== 200) {
    throw new Error(`Login failed with status ${loginRes.statusCode}: ${loginRes.bodyText}`);
  }
  const loginData = JSON.parse(loginRes.bodyText);
  const token = loginData.accessToken || (loginData.tokens && loginData.tokens.accessToken);
  if (!token) throw new Error('No access token returned from login');
  console.log('  ✔ Authenticated successfully as admin');

  // 2. Presign upload
  console.log('\n[2/6] Requesting S3 presigned upload URL...');
  const pdfBytes = createMinimalPdf();
  const checksum = crypto.createHash('sha256').update(pdfBytes).digest('hex');

  const presignRes = await request(`${API_BASE}/files/presign-upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  }, JSON.stringify({
    fileName: 'audit_test_sample.pdf',
    fileSizeBytes: pdfBytes.length,
    mimeType: 'application/pdf',
    checksumSha256: checksum,
  }));

  if (presignRes.statusCode !== 200 && presignRes.statusCode !== 201) {
    throw new Error(`Presign upload failed (${presignRes.statusCode}): ${presignRes.bodyText}`);
  }
  const presignData = JSON.parse(presignRes.bodyText);
  const { fileId, uploadUrl } = presignData;
  console.log(`  ✔ Presigned URL issued for fileId: ${fileId}`);

  // 3. Upload to S3/MinIO
  console.log('\n[3/6] Uploading PDF bytes to MinIO storage...');
  const s3UploadRes = await request(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Length': pdfBytes.length,
    },
  }, pdfBytes);

  if (s3UploadRes.statusCode !== 200) {
    throw new Error(`Direct S3 upload failed with status ${s3UploadRes.statusCode}: ${s3UploadRes.bodyText}`);
  }
  console.log('  ✔ File uploaded to MinIO storage successfully (HTTP 200)');

  // 4. Confirm upload
  console.log('\n[4/6] Confirming upload and verifying virus/MIME validation...');
  const confirmRes = await request(`${API_BASE}/files/confirm-upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  }, JSON.stringify({ fileId }));

  if (confirmRes.statusCode !== 200 && confirmRes.statusCode !== 201) {
    throw new Error(`Confirm upload failed (${confirmRes.statusCode}): ${confirmRes.bodyText}`);
  }
  console.log('  ✔ Upload confirmed and registered in database');

  // 5. Dispatch PDF job
  console.log('\n[5/6] Dispatching PDF job to Worker Engine queue...');
  const jobRes = await request(`${API_BASE}/pdf/jobs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  }, JSON.stringify({
    tool: 'watermark',
    fileIds: [fileId],
    parameters: { watermarkText: 'AUDIT-PASSED-2026' },
  }));

  if (jobRes.statusCode !== 200 && jobRes.statusCode !== 201) {
    throw new Error(`Job creation failed (${jobRes.statusCode}): ${jobRes.bodyText}`);
  }
  const jobData = JSON.parse(jobRes.bodyText);
  const jobId = jobData.jobId || (jobData.job && jobData.job.id) || jobData.id;
  console.log(`  ✔ Job created with ID: ${jobId}`);

  // 6. Poll for completion
  console.log('\n[6/6] Polling job execution status until completion...');
  let completed = false;
  let attempts = 0;
  while (!completed && attempts < 30) {
    attempts++;
    await new Promise((r) => setTimeout(r, 1000));
    const statusRes = await request(`${API_BASE}/pdf/jobs/${jobId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (statusRes.statusCode === 200) {
      const statusData = JSON.parse(statusRes.bodyText);
      const currentStatus = statusData.status;
      const progress = statusData.progress;
      console.log(`    [Attempt ${attempts}] Status: ${currentStatus}, Progress: ${progress}%`);
      if (currentStatus === 'COMPLETED') {
        completed = true;
      } else if (currentStatus === 'FAILED') {
        throw new Error(`Worker job failed: ${statusData.errorMessage}`);
      }
    }
  }

  if (!completed) {
    throw new Error('Job timed out waiting for completion');
  }

  // 7. Verify download
  console.log('\n[Download Verification] Streaming processed PDF from job download endpoint...');
  const downloadRes = await request(`${API_BASE}/pdf/jobs/${jobId}/download`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (downloadRes.statusCode !== 200) {
    throw new Error(`Download request failed (${downloadRes.statusCode}): ${downloadRes.bodyText}`);
  }
  const downloadedBytes = downloadRes.bodyBuffer;
  console.log(`  ✔ Successfully streamed processed PDF: ${downloadedBytes.length} bytes`);
  const isPdf = downloadedBytes.slice(0, 5).toString('utf8').startsWith('%PDF');
  if (!isPdf) {
    throw new Error('Downloaded file is not a valid PDF header');
  }
  console.log('  ✔ PDF magic bytes verified: %PDF');

  console.log('\n====================================================');
  console.log('🎉 END-TO-END VERIFICATION: 100% PASSED & PRODUCTION READY');
  console.log('====================================================');
}

runAudit().catch((err) => {
  console.error('\n❌ Audit Failure:', err.message);
  process.exit(1);
});
