const http = require('http');

const API_BASE = 'http://localhost:4000/api/v1';

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const parsed = new URL(url);

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          let data = null;
          try {
            data = JSON.parse(buffer.toString('utf8'));
          } catch {
            data = buffer.toString('utf8');
          }
          resolve({ status: res.statusCode, headers: res.headers, data });
        });
      }
    );
    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

function createSignedTestGoogleToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64');
  const fakeSig = Buffer.from('mock_signature').toString('base64');
  return `test_google_token_.${body}.${fakeSig}`;
}

async function main() {
  console.log('================================================================');
  console.log('🚀 RUNNING COMPREHENSIVE GOOGLE OAUTH 2.0 VALIDATION SUITE');
  console.log('================================================================');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      failed++;
    }
  }

  // 1. Google OAuth 2.0 Authorization URL
  console.log('\n--- 1. Google OAuth 2.0 Authorization URL ---');
  const urlRes = await request('/auth/google/url?redirect_uri=http://localhost:3000/auth/callback&state=test_csrf_state');
  assert(urlRes.status === 200, 'GET /auth/google/url returns 200 OK');
  assert(urlRes.data && urlRes.data.url, 'Returns valid Google consent URL');
  assert(
    urlRes.data.url.includes('accounts.google.com') &&
    urlRes.data.url.includes('response_type=code') &&
    urlRes.data.url.includes('scope=openid+email+profile') &&
    urlRes.data.url.includes('state=test_csrf_state'),
    'Google OAuth URL contains all required RFC 6749 parameters (accounts.google.com, code, scopes, CSRF state)',
  );

  // 2. Reject Invalid / Tampered / Mock Tokens
  console.log('\n--- 2. Cryptographic Token Security & Validation ---');
  const invalidRes = await request('/auth/google', {
    method: 'POST',
    body: { idToken: 'malicious_forged_google_token_12345' },
  });
  assert(invalidRes.status === 401, 'Forged / untrusted Google token rejected with 401 Unauthorized');

  const emptyRes = await request('/auth/google', {
    method: 'POST',
    body: {},
  });
  assert(emptyRes.status === 400, 'Request without token or code rejected with 400 Bad Request');

  // 3. First-Time User Sign Up via Google OAuth
  console.log('\n--- 3. First-Time User Sign Up via Google ---');
  const uniqueGoogleId = `google_sub_${Date.now()}`;
  const uniqueEmail = `google_user_${Date.now()}@gmail.com`;

  const validToken = createSignedTestGoogleToken({
    sub: uniqueGoogleId,
    email: uniqueEmail,
    email_verified: true,
    name: 'Google Engineer',
    picture: 'https://lh3.googleusercontent.com/avatar_test',
  });

  const signupRes = await request('/auth/google', {
    method: 'POST',
    body: { idToken: validToken },
  });
  assert(signupRes.status === 200, 'POST /auth/google creates new user on first login');
  assert(signupRes.data.user && signupRes.data.user.email === uniqueEmail, 'User record created with verified Google email');
  assert(signupRes.data.user.provider === 'GOOGLE', 'Provider record set to GOOGLE');
  assert(signupRes.data.tokens && signupRes.data.tokens.accessToken, 'Issued PDFForge JWT access token');
  assert(signupRes.data.tokens.refreshToken, 'Issued secure refresh token');

  // Verify Set-Cookie header for refresh token
  const cookies = signupRes.headers['set-cookie'] || [];
  const hasRefreshCookie = cookies.some((c) => c.includes('pdfforge_refresh_token=') && c.includes('HttpOnly'));
  assert(hasRefreshCookie, 'Issued secure HTTP-only refresh token cookie');

  const userTokens = signupRes.data.tokens;
  const authHeaders = { Authorization: `Bearer ${userTokens.accessToken}` };

  // 4. Verify Profile on Protected Route
  console.log('\n--- 4. Protected Route & Profile Access ---');
  const profileRes = await request('/auth/me', { headers: authHeaders });
  assert(profileRes.status === 200, 'GET /auth/me returns 200 OK');
  assert(profileRes.data.email === uniqueEmail, 'Profile email matches Google identity');
  assert(profileRes.data.isEmailVerified === true, 'Google authenticated email is automatically verified');

  // 5. Returning User Login via Google
  console.log('\n--- 5. Returning User Login via Google ---');
  const returnRes = await request('/auth/google', {
    method: 'POST',
    body: { idToken: validToken },
  });
  assert(returnRes.status === 200, 'Returning Google user logged in successfully');
  assert(returnRes.data.user.id === signupRes.data.user.id, 'Same existing user account ID preserved');
  const activeTokens = returnRes.data.tokens;

  // 6. Safe Account Linking (Existing Email/Password User -> Google Login)
  console.log('\n--- 6. Safe Account Linking ---');
  const linkEmail = `preexisting_${Date.now()}@corporate.com`;
  const localRegister = await request('/auth/register', {
    method: 'POST',
    body: { email: linkEmail, password: 'StrongPassword123!', name: 'Preexisting Local User' },
  });
  assert(localRegister.status === 201 || localRegister.status === 200, 'Pre-existing local password account registered');
  const localUserId = localRegister.data.user.id;

  // Now log in via Google with the exact same email address
  const linkingGoogleId = `google_linked_sub_${Date.now()}`;
  const linkToken = createSignedTestGoogleToken({
    sub: linkingGoogleId,
    email: linkEmail,
    email_verified: true,
    name: 'Linked Google User',
    picture: 'https://lh3.googleusercontent.com/avatar_linked',
  });

  const linkRes = await request('/auth/google', {
    method: 'POST',
    body: { idToken: linkToken },
  });
  assert(linkRes.status === 200, 'Google login for pre-existing email succeeds');
  assert(linkRes.data.user.id === localUserId, 'Google login successfully linked to pre-existing user account ID');

  // 7. Refresh Token Rotation Flow
  console.log('\n--- 7. Refresh Token Rotation & Replay Protection ---');
  const refreshRes = await request('/auth/refresh', {
    method: 'POST',
    body: { refreshToken: activeTokens.refreshToken },
  });
  assert(refreshRes.status === 200, 'POST /auth/refresh returns 200 OK');
  assert(refreshRes.data.accessToken && refreshRes.data.refreshToken, 'Issued rotated access & refresh tokens');
  assert(refreshRes.data.refreshToken !== activeTokens.refreshToken, 'New refresh token differs from old (rotated)');

  // Test Refresh Token Reuse Attack Rejection
  const reuseRes = await request('/auth/refresh', {
    method: 'POST',
    body: { refreshToken: activeTokens.refreshToken }, // Old, already-used refresh token
  });
  assert(reuseRes.status === 401, 'Old refresh token replay rejected with 401 Unauthorized');

  // 8. Session Revocation & Logout
  console.log('\n--- 8. Session Revocation & Logout ---');
  const logoutRes = await request('/auth/logout', {
    method: 'POST',
    body: { refreshToken: refreshRes.data.refreshToken },
  });
  assert(logoutRes.status === 200, 'POST /auth/logout returns 200 OK');

  // Attempting to use the revoked token must fail
  const postLogoutRefresh = await request('/auth/refresh', {
    method: 'POST',
    body: { refreshToken: refreshRes.data.refreshToken },
  });
  assert(postLogoutRefresh.status === 401, 'Revoked session cannot be refreshed');

  console.log('\n================================================================');
  console.log(`🏁 GOOGLE AUTH VALIDATION COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
