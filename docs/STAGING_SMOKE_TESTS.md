# Doxera — Staging Smoke Tests and Rollback Procedures

Prepared 2026-11-04. All commands are non-destructive read-only checks or use
IANA-reserved test addresses. No production systems are involved.

Run these tests only after the GO/NO-GO checklist in `docs/STAGING_READINESS.md`
is fully green and staging services are deployed.

---

## Prerequisites

Replace these placeholders before running:

```sh
export STAGING_API=https://<doxera-staging-api render url>
export STAGING_WEB=https://<doxera-staging-web render url>
export TS=$(date +%s)   # unique suffix for test accounts
```

---

## 1. Health checks

These are always safe — they read server state and touch nothing.

```sh
# API health (NestJS)
curl -sf "$STAGING_API/api/v1/health"       && echo "api: health OK"
curl -sf "$STAGING_API/api/v1/health/live"  && echo "api: live OK"
curl -sf "$STAGING_API/api/v1/health/ready" && echo "api: ready OK"

# Web app — Next.js should serve the login page
curl -sf "$STAGING_WEB/login" -o /dev/null -w "%{http_code}" | grep -q 200 \
  && echo "web: login OK"

# Web → API proxy (same-origin path)
curl -sf "$STAGING_WEB/api/v1/health" -o /dev/null -w "%{http_code}" | grep -q 200 \
  && echo "web: proxy to api OK"
```

Expected: all five checks print `OK`. Any HTTP 5xx is a blocker; investigate logs before continuing.

---

## 2. Auth — registration

Uses `@example.com` (IANA-reserved, never delivers real email, safe for staging).

```sh
# Register a synthetic test user
curl -sf -X POST "$STAGING_API/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"smoke+$TS@example.com\",\"password\":\"SmokeTest#1234\",\"name\":\"Smoke $TS\"}" \
  | tee /tmp/register.json

# Verify response contains a user object (no token yet — email verification required)
cat /tmp/register.json | grep -q '"id"' && echo "register: OK"
```

---

## 3. Auth — login (after email verification bypass for staging)

If the staging API does not auto-verify emails, set `SKIP_EMAIL_VERIFICATION=true`
(or use the admin endpoint to manually mark the test account as verified) before
running the login check. Never use this flag in production.

```sh
# Login
curl -sf -X POST "$STAGING_API/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"smoke+$TS@example.com\",\"password\":\"SmokeTest#1234\"}" \
  -c /tmp/staging-cookies.txt \
  | tee /tmp/login.json

# Extract token for subsequent requests
export STAGING_TOKEN=$(cat /tmp/login.json | grep -oP '"accessToken":"\K[^"]+')
[ -n "$STAGING_TOKEN" ] && echo "login: token received" || echo "login: FAIL — no token"
```

---

## 4. Auth — authenticated profile fetch

```sh
curl -sf "$STAGING_API/api/v1/auth/me" \
  -H "Authorization: Bearer $STAGING_TOKEN" \
  | grep -q '"email"' && echo "profile: OK"
```

---

## 5. File upload — PDF conversion (synthetic file)

This creates a job record. If Razorpay is disabled, free-tier quotas apply.

```sh
# Create a minimal synthetic PDF (1-page, text only, 2 KB)
printf '%%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n4 0 obj<</Length 44>>stream\nBT /F1 12 Tf 72 720 Td (Smoke test) Tj ET\nendstream\nendobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\nxref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000266 00000 n \n0000000360 00000 n \ntrailer<</Root 1 0 R/Size 6>>\nstartxref\n441\n%%%%EOF\n' > /tmp/smoke-test.pdf

# Submit conversion job (convert to Word — a supported tool)
curl -sf -X POST "$STAGING_API/api/v1/tools/pdf-to-word" \
  -H "Authorization: Bearer $STAGING_TOKEN" \
  -F "file=@/tmp/smoke-test.pdf" \
  | tee /tmp/job.json

export JOB_ID=$(cat /tmp/job.json | grep -oP '"jobId":"\K[^"]+')
[ -n "$JOB_ID" ] && echo "upload: job $JOB_ID created" || echo "upload: FAIL"
```

---

## 6. Job status poll

```sh
# Poll up to 10 times (30-second intervals) for job completion
for i in $(seq 1 10); do
  STATUS=$(curl -sf "$STAGING_API/api/v1/jobs/$JOB_ID" \
    -H "Authorization: Bearer $STAGING_TOKEN" \
    | grep -oP '"status":"\K[^"]+')
  echo "job status [$i/10]: $STATUS"
  case "$STATUS" in
    completed) echo "job: COMPLETED ✅"; break ;;
    failed)    echo "job: FAILED ⛔"; break ;;
    *)         sleep 30 ;;
  esac
done
```

---

## 7. CORS headers verification

Verify CORS is restricted to the staging web origin:

```sh
# Should return the staging web URL in Access-Control-Allow-Origin, not *
curl -sf -I -X OPTIONS "$STAGING_API/api/v1/health" \
  -H "Origin: $STAGING_WEB" \
  -H "Access-Control-Request-Method: GET" \
  | grep -i "access-control-allow-origin"

# Wildcard MUST NOT appear
curl -sf -I -X OPTIONS "$STAGING_API/api/v1/health" \
  -H "Origin: $STAGING_WEB" \
  -H "Access-Control-Request-Method: GET" \
  | grep -i "access-control-allow-origin" | grep -qv '\*' \
  && echo "CORS: no wildcard OK" || echo "CORS: FAIL — wildcard detected"
```

---

## 8. Security headers (web)

```sh
curl -sf -I "$STAGING_WEB/login" | grep -iE \
  "strict-transport-security|x-frame-options|x-content-type-options|referrer-policy|content-security-policy"
```

Expected: at least `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and
`Referrer-Policy` are present (set by Next.js middleware).

---

## 9. Cleanup — delete smoke test account

```sh
# Delete the synthetic test account (if admin or self-delete endpoint exists)
curl -sf -X DELETE "$STAGING_API/api/v1/account" \
  -H "Authorization: Bearer $STAGING_TOKEN" \
  && echo "cleanup: account deleted" || echo "cleanup: manual deletion needed"

rm -f /tmp/register.json /tmp/login.json /tmp/job.json /tmp/staging-cookies.txt /tmp/smoke-test.pdf
```

If the self-delete endpoint is not available, manually delete the test user via
the staging admin panel at `$STAGING_WEB/admin`.

---

## Razorpay smoke tests (run only after Razorpay is separately enabled)

Requires `ENABLE_RAZORPAY=true` and test-mode keys (`rzp_test_*`).

```sh
# 1. Trigger a test payment (use Razorpay test card: 4111 1111 1111 1111 / any future exp / 123)
#    via the billing page at: $STAGING_WEB/billing

# 2. Simulate webhook delivery from Razorpay test dashboard:
#    Dashboard → Webhooks → Send test event → payment.captured

# 3. Verify webhook was received with valid signature (check API logs)
curl -sf "$STAGING_API/api/v1/billing/subscription" \
  -H "Authorization: Bearer $STAGING_TOKEN" \
  | grep -q '"plan"' && echo "billing: subscription status accessible"

# 4. Simulate duplicate webhook (send same event twice)
#    Verify API returns 200 without double-crediting

# 5. Simulate bad signature (modify the payload body)
#    Verify API returns 400 without processing
```

---

## Rollback procedures

### Scenario A — Staging services started but no data written

If staging is provisioned but nothing has run successfully:

1. In Render dashboard: open the `doxera-staging` project
2. For each service: **Settings** → **Delete service** → confirm
3. Delete the staging PostgreSQL database: **Dashboard** → Databases → `doxera-staging-postgres` → **Delete**
4. Delete the staging Redis instance similarly
5. No data existed; rollback is complete

### Scenario B — Staging migration failed mid-flight

If `prisma migrate deploy` ran but partially failed:

```sh
# 1. Find the failed migration name from Render deploy logs

# 2. SSH into doxera-staging-api (Render Shell in dashboard) and run:
npx prisma migrate resolve --rolled-back <failed-migration-name>

# 3. Redeploy the service with the previous image:
#    Render dashboard → doxera-staging-api → Deploys → select last-good deploy → Manual Deploy
```

### Scenario C — Staging API is healthy but worker jobs are failing

1. Check `doxera-staging-celery` logs in Render dashboard
2. Verify `WORKER_CALLBACK_SECRET` matches between API and worker
   (Render dashboard → `doxera-staging-api` env vars → `WORKER_CALLBACK_SECRET`)
3. If a credential mismatch is found, update it in Render and redeploy the worker

### Scenario D — Roll back a specific staging deploy (not a full teardown)

Render keeps the last 10 deploy images for each service:

1. Render dashboard → `doxera-staging-api` → **Deploys** tab
2. Find the last-known-good deploy
3. Click **Rollback to this deploy** (or **Re-deploy** on that row)
4. Repeat for `doxera-staging-web`, `doxera-staging-worker`, `doxera-staging-celery` if needed

**Production impact**: none. Staging and production share no resources. Rolling back
staging services does not affect production in any way.

### Scenario E — Full staging teardown (start over)

1. In Render dashboard: delete every `doxera-staging-*` service, database, and Redis instance
2. Verify no cross-linked resources remain
3. Re-read `docs/STAGING_READINESS.md` and satisfy all GO/NO-GO gates before re-submitting the Blueprint

---

## Smoke test pass/fail criteria

| Check | Pass | Fail (action) |
|---|---|---|
| All 3 API health endpoints | HTTP 200 | Check DB connection + migration status |
| Web login page loads | HTTP 200 | Check Next.js build logs, `NEXT_PUBLIC_APP_URL` |
| Web → API proxy | HTTP 200 | Check `API_GATEWAY_HOSTPORT` env var |
| Registration | Returns `id` field | Check DB `DATABASE_URL`, migration |
| Login | Returns `accessToken` | Check `JWT_SECRET`, email verification status |
| Authenticated profile | Returns `email` field | Check token expiry, guard configuration |
| PDF job created | Returns `jobId` | Check worker `WORKER_CALLBACK_SECRET`, S3 credentials |
| Job completes | `status: completed` within 5 min | Check Celery logs, LibreOffice installation |
| CORS no wildcard | No `*` in ACAO header | Check `CORS_ORIGINS` env var on API |
| Security headers present | At least 3 headers | Check Next.js middleware |
