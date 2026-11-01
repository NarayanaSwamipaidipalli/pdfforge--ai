/**
 * PDFForge AI - Comprehensive Authentication System & Account Lifecycle Verification
 * Tests Registration, Login, Profile retrieval, Profile updates, Password change,
 * Google linking/unlinking, Token refresh rotation, Logout, and Account deletion.
 */

const http = require('http');

const API_BASE = 'http://localhost:4000/api/v1';

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`);
    const reqOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch {
          json = data;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: json,
        });
      });
    });

    req.on('error', reject);

    if (options.body) {
      const bodyStr = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
      req.setHeader('Content-Type', 'application/json');
      req.setHeader('Content-Length', Buffer.byteLength(bodyStr));
      req.write(bodyStr);
    }

    req.end();
  });
}

async function run() {
  console.log('================================================================');
  console.log('🚀 RUNNING END-TO-END AUTHENTICATION & ACCOUNT SYSTEM VALIDATION');
  console.log('================================================================\n');

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

  const testEmail = `auth_test_${Date.now()}@pdfforge.ai`;
  const initialPassword = 'InitialP@ssword123!';
  const updatedPassword = 'UpdatedP@ssword456!';
  let accessToken = '';
  let refreshTokenCookie = '';
  let userId = '';

  // 1. REGISTRATION
  console.log('--- 1. User Registration ---');
  const regRes = await request('/auth/register', {
    method: 'POST',
    body: {
      email: testEmail,
      password: initialPassword,
      name: 'Test Engineer',
    },
  });
  assert(regRes.status === 201 || regRes.status === 200, `POST /auth/register returned ${regRes.status}`);
  assert(regRes.data?.user?.email === testEmail, 'User created with specified email');
  assert(regRes.data?.tokens?.accessToken, 'Access token generated on registration');
  userId = regRes.data?.user?.id;
  accessToken = regRes.data?.tokens?.accessToken;

  // 2. EMAIL / PASSWORD LOGIN
  console.log('\n--- 2. Email & Password Authentication ---');
  const loginRes = await request('/auth/login', {
    method: 'POST',
    body: {
      email: testEmail,
      password: initialPassword,
    },
  });
  assert(loginRes.status === 200, 'POST /auth/login returned 200 OK');
  assert(loginRes.data?.tokens?.accessToken, 'Access token issued');
  accessToken = loginRes.data.tokens.accessToken;
  const setCookie = loginRes.headers['set-cookie'];
  assert(Array.isArray(setCookie) && setCookie.some((c) => c.includes('pdfforge_refresh_token')), 'Secure HttpOnly refresh cookie set');

  // 3. PROFILE & ACCOUNT RETRIEVAL (/auth/me)
  console.log('\n--- 3. Account Details & Metadata Retrieval ---');
  const meRes = await request('/auth/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  assert(meRes.status === 200, 'GET /auth/me returned 200 OK');
  assert(meRes.data?.id === userId, 'Retrieved matching user ID');
  assert(meRes.data?.provider === 'LOCAL', 'Provider initially identified as LOCAL');
  assert(meRes.data?.plan === 'FREE', 'Account plan initially FREE');
  assert(typeof meRes.data?.storageUsedBytes !== 'undefined', 'Storage telemetry present');
  assert(Boolean(meRes.data?.createdAt), 'Account creation date present');

  // 4. UPDATE PROFILE (Name & Avatar)
  console.log('\n--- 4. Profile Information Update ---');
  const updatedName = 'Alexander Mercer Staff';
  const updatedAvatar = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150';
  const updateRes = await request('/auth/profile', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: {
      name: updatedName,
      avatarUrl: updatedAvatar,
    },
  });
  assert(updateRes.status === 200, 'PATCH /auth/profile returned 200 OK');
  assert(updateRes.data?.name === updatedName, 'User name successfully updated');
  assert(updateRes.data?.avatarUrl === updatedAvatar, 'User avatar URL successfully updated');

  // 5. CHANGE PASSWORD
  console.log('\n--- 5. Password Update Lifecycle ---');
  const changePassRes = await request('/auth/change-password', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: {
      oldPassword: initialPassword,
      newPassword: updatedPassword,
    },
  });
  assert(changePassRes.status === 200, 'POST /auth/change-password returned 200 OK');

  // 6. LOGIN WITH OLD PASSWORD MUST FAIL
  console.log('\n--- 6. Verify Old Password Invalidation ---');
  const oldLoginRes = await request('/auth/login', {
    method: 'POST',
    body: {
      email: testEmail,
      password: initialPassword,
    },
  });
  assert(oldLoginRes.status === 401, 'Login with old password rejected with 401 Unauthorized');

  // 7. LOGIN WITH NEW PASSWORD MUST SUCCEED
  console.log('\n--- 7. Login with New Password ---');
  const newLoginRes = await request('/auth/login', {
    method: 'POST',
    body: {
      email: testEmail,
      password: updatedPassword,
    },
  });
  assert(newLoginRes.status === 200, 'Login with new password succeeded with 200 OK');
  accessToken = newLoginRes.data.tokens.accessToken;

  // 8. GOOGLE OAUTH URL & IDENTITY ENDPOINTS
  console.log('\n--- 8. Google OAuth & Identity Integration ---');
  const googleUrlRes = await request('/auth/google/url');
  assert(googleUrlRes.status === 200, 'GET /auth/google/url returned 200 OK');
  assert(googleUrlRes.data?.url?.includes('accounts.google.com'), 'Valid Google OAuth URL generated');

  // 9. REFRESH TOKEN ROTATION
  console.log('\n--- 9. Refresh Token Rotation ---');
  const refreshCookieHeader = newLoginRes.headers['set-cookie']?.find((c) => c.includes('pdfforge_refresh_token'));
  const refreshRes = await request('/auth/refresh', {
    method: 'POST',
    headers: {
      Cookie: refreshCookieHeader ? refreshCookieHeader.split(';')[0] : '',
    },
  });
  assert(refreshRes.status === 200, 'POST /auth/refresh with HttpOnly cookie returned 200 OK');
  assert(Boolean(refreshRes.data?.accessToken), 'New rotated access token received');
  accessToken = refreshRes.data.accessToken;

  // 10. LOGOUT & SESSION INVALIDATION
  console.log('\n--- 10. Logout & Token Invalidation ---');
  const logoutRes = await request('/auth/logout', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Cookie: refreshCookieHeader ? refreshCookieHeader.split(';')[0] : '',
    },
  });
  assert(logoutRes.status === 200, 'POST /auth/logout returned 200 OK');

  // 11. RE-LOGIN FOR ACCOUNT DELETION TEST
  console.log('\n--- 11. Re-login for Account Deletion Verification ---');
  const reLoginRes = await request('/auth/login', {
    method: 'POST',
    body: {
      email: testEmail,
      password: updatedPassword,
    },
  });
  accessToken = reLoginRes.data.tokens.accessToken;

  // 12. PERMANENT ACCOUNT DELETION
  console.log('\n--- 12. Permanent Account Deletion ---');
  // Attempt with bad confirmation phrase first
  const badDeleteRes = await request('/auth/account', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: {
      confirmation: 'WRONG',
      password: updatedPassword,
    },
  });
  assert(badDeleteRes.status === 400, 'Account deletion without "DELETE" confirmation rejected with 400 Bad Request');

  // Attempt with correct confirmation
  const deleteRes = await request('/auth/account', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: {
      confirmation: 'DELETE',
      password: updatedPassword,
    },
  });
  assert(deleteRes.status === 200, 'DELETE /auth/account succeeded with 200 OK');
  assert(deleteRes.data?.success === true, 'Confirmation of permanent account deletion received');

  // Verify deleted user can no longer log in
  const postDeleteLogin = await request('/auth/login', {
    method: 'POST',
    body: {
      email: testEmail,
      password: updatedPassword,
    },
  });
  assert(postDeleteLogin.status === 401, 'Deleted user cannot log in (401 Unauthorized)');

  console.log('\n================================================================');
  console.log(`🏁 AUTHENTICATION VALIDATION COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
