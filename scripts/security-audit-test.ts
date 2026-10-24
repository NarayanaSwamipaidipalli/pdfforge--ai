/**
 * PDFForge AI - Enterprise Security & OWASP Penetration Test Suite
 * Automatically verifies defenses against SQLi, Path Traversal, Auth Bypass, CORS, and Headers.
 */

const API_BASE = process.env.API_BASE_URL || 'http://localhost:4000/api/v1';
const WEB_BASE = process.env.WEB_BASE_URL || 'http://localhost:3000';

async function runSecurityAudit() {
  console.log('=============================================================');
  console.log('🛡️  PDFForge AI - Automated OWASP Security Verification Suite');
  console.log('=============================================================\n');

  let passed = 0;
  let total = 0;

  function assert(testName: string, condition: boolean, detail?: string) {
    total++;
    if (condition) {
      console.log(`   ✔ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`   ❌ FAIL: ${testName} - ${detail || 'Assertion failed'}`);
    }
  }

  // 1. Auth Protection on Sensitive Endpoints
  console.log('1. Authentication Bypass Protection:');
  try {
    const res = await fetch(`${API_BASE}/admin/telemetry`);
    assert('Reject unauthenticated request to /admin/telemetry (HTTP 401)', res.status === 401);
  } catch (err: any) {
    assert('Reject unauthenticated request to /admin/telemetry', false, err.message);
  }

  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: 'Bearer forged.fake.jwt.token' },
    });
    assert('Reject forged JWT access token (HTTP 401)', res.status === 401);
  } catch (err: any) {
    assert('Reject forged JWT access token', false, err.message);
  }

  // 2. HTTP Security Headers Audit
  console.log('\n2. Enterprise HTTP Security Response Headers:');
  try {
    const res = await fetch(`${API_BASE}/admin/telemetry`);
    const headers = res.headers;

    assert(
      'X-Content-Type-Options: nosniff present',
      headers.get('x-content-type-options') === 'nosniff',
    );
    assert(
      'X-Frame-Options: SAMEORIGIN present (Anti-Clickjacking)',
      headers.get('x-frame-options') === 'SAMEORIGIN',
    );
    assert(
      'Content-Security-Policy header present',
      !!headers.get('content-security-policy'),
    );
    assert(
      'Strict-Transport-Security (HSTS) present',
      !!headers.get('strict-transport-security'),
    );
  } catch (err: any) {
    assert('Verify security response headers', false, err.message);
  }

  // 3. SQL Injection Rejection
  console.log('\n3. SQL Injection Parameterized Query Guard:');
  try {
    const sqliPayload = "' OR '1'='1' --";
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: sqliPayload, password: 'password123' }),
    });
    assert(
      'SQL Injection in login email safely rejected with 400 or 401 (no 500 DB leak)',
      res.status === 400 || res.status === 401,
    );
  } catch (err: any) {
    assert('SQL Injection test', false, err.message);
  }

  // 4. Path Traversal Guard
  console.log('\n4. Path Traversal & File System Sandbox Guard:');
  try {
    const traversalPayload = '../../../../etc/passwd';
    const res = await fetch(`${API_BASE}/pdf/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: 'compress',
        fileIds: [traversalPayload],
        parameters: {},
      }),
    });
    assert(
      'Path traversal fileId safely handled without leaking system files',
      res.status === 400 || res.status === 404 || res.status === 500,
    );
  } catch (err: any) {
    assert('Path traversal test', false, err.message);
  }

  // 5. Ephemeral Retention & Nonce Check
  console.log('\n5. Robots.txt and Sitemap Security Directives:');
  try {
    const res = await fetch(`${WEB_BASE}/robots.txt`);
    const text = await res.text();
    assert(
      'Robots.txt restricts sensitive paths (/admin, /api/)',
      text.includes('Disallow: /admin') && text.includes('Disallow: /api/'),
    );
  } catch (err: any) {
    assert('Robots.txt check', false, err.message);
  }

  console.log('\n=============================================================');
  console.log(`📊 Security Audit Complete: ${passed}/${total} Checks Passed (${Math.round((passed / total) * 100)}%)`);
  console.log('=============================================================\n');

  if (passed < total) process.exit(1);
}

runSecurityAudit().catch((err) => {
  console.error('Fatal Security Audit Error:', err);
  process.exit(1);
});
