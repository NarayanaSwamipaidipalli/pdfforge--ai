# Doxera staging verification follow-up — 2026-11-04

**Status: blocked for push and deployment in this Codex session.** The user explicitly
answered "Not confirmed — keep pushes blocked" for production Render Auto-Deploy and
Blueprint Auto Sync. No later approval in this session supersedes that instruction.
This note records scoped verification; it does not repeat the completed application
security remediation or certify current staging isolation.

## Concurrent-work handoff

Work started from clean `8c64e61` with checkpoint `a9ec910`. During this pass another
session advanced the repository through `3e8ac90`, `75743fb` and `d4b20ee`, committed the
new deployment scripts, changed staging configuration and documentation, and left active
authentication/frontend/Compose edits. Those changes were preserved. The repository is
no longer the clean two-commit starting state. Do not stage all changes for this handoff.

The initial Codex changes added explicit `autoDeployTrigger: off`, corrected Render's
ignored group-level secret declarations, prepared a separate staging Blueprint and
environment-name example, added configuration regression checks, and installed/tested
an unconditional local pre-push block. The initial 12 focused tests passed.

Subsequent edits removed staging `networking.isolation` and `permissions.protection` and
changed the hook. The checked-in and installed hooks match each other, but no longer match
the unconditional block that this session tested. Current documentation describes allowing
staging pushes. That conflicts with this session's push restriction; do not use it as approval.
File ownership was requested before further edits to the shared Blueprint/hook.

## Current evidence

| Check | Result and limit |
| --- | --- |
| Official Render schema | Both `render.yaml` and `render.staging.yaml` pass draft 2020-12 validation. Schema validity does not prove network isolation or live settings. |
| `node scripts/deployment/verify.cjs` | Fails: staging private network isolation must be enabled. It deliberately does not permit missing isolation based on naming alone. |
| `node --test scripts/deployment/render-config.test.cjs` | Current tree: 9 pass, 3 fail after concurrent isolation removal. One failure is the real configuration contract; two negative cases depend on a valid baseline. Earlier 12/12 result is superseded for the current tree. |
| Required environment names | API/worker names were checked against runtime configuration; the actual API validator accepted synthetic resolved staging inputs. No private environment file or secret value was read or printed. |
| Local push guard | Initially installed and verified with `git hook run pre-push` (exit 1, no remote contact). Later changed concurrently; unconditional blocking is no longer verified. |
| Local and remote GitHub workflow review | Inspected CI builds/tests, no production deployment step found in the inspected files. The remote main CI file had blob `82538c4b090dc5d7a2ca78ac8ee83bd15a1687f2`; later remote changes are not covered by that snapshot. |
| External triggers | Render service settings, Blueprint Auto Sync, GitHub webhooks/apps and deploy-hook usage remain unverified. No Render connector/CLI credential or GitHub administration tool was available for these checks. |

This pass did not push, deploy, provision services, read database records, alter development
services/volumes, rotate credentials, or contact payment/email providers. Other-session
actions reported in `AI_HANDOFF.md` are not actions or verification claimed by this pass.

## Resolve before any push

- [ ] Confirm ownership of `render.staging.yaml` and the tracked/installed pre-push hooks.
- [ ] Reconcile the current hook with the user's all-push restriction; test locally without
  `git push`, including `--dry-run`, which is not evidence of zero remote contact.
- [ ] Read the actual production service Auto-Deploy settings and Blueprint Auto Sync.
  Record workspace, service identities, timestamp, reviewer and status; omit secrets and
  deploy-hook URLs. Review GitHub webhooks/apps and any external deployment automation.
- [ ] Treat each push and each Blueprint sync/provisioning action as separately unapproved
  until the user explicitly authorizes it. Git hooks can be bypassed and are clone-local.
- [ ] Restore environment network isolation after ownership confirmation, or propose an
  explicitly verified separate-workspace design before approving Hobby staging. Different
  service names/projects alone do not separate a workspace's private network.
- [ ] Verify target workspace/resource identities before adoption. Render references can
  resolve services outside a Blueprint in the same workspace; schema validity alone does
  not make production resource adoption "structurally impossible".

Render distinguishes service auto-deploy from dashboard Blueprint Auto Sync. `sync: false`
belongs on service inputs, not environment-group entries; new keys on existing resources
need manual operator setup. See [Blueprint reference](https://render.com/docs/blueprint-spec)
and [Auto Sync settings](https://render.com/docs/infrastructure-as-code#disabling-automatic-sync).
Same-workspace/same-region services share networking unless isolation is enabled on an
eligible plan. See [private networking](https://render.com/docs/private-network).

## Environment setup checklist (names only)

- [ ] API inputs: `JWT_SECRET`, `JWT_REFRESH_SECRET`, `WORKER_CALLBACK_SECRET`,
  `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME`; supply independent staging
  authentication keys and staging-only storage credentials through the approved secret store.
  Do not copy production/development secrets or print generated values.
- [ ] Broker/database references: `DATABASE_URL`, `REDIS_URL`, `CELERY_BROKER_URL`,
  `CELERY_RESULT_BACKEND` must resolve only to the approved staging instances.
- [ ] Worker routing: `API_GATEWAY_HOSTPORT`, `PDF_WORKER_HOSTPORT` and the shared callback
  credential must agree across API/FastAPI/Celery. API-derived worker references use the
  same storage/callback values; environment-group `AWS_REGION` must match the actual bucket.
- [ ] Use production safeguards in staging: `NODE_ENV=production`, `ENVIRONMENT=production`,
  `LOAD_LOCAL_ENV=false`, `S3_AUTO_CREATE_BUCKET=false`. Keep payment flags disabled until
  separately approved sandbox setup. Current source also documents `ALLOW_RAZORPAY_LIVE`;
  leave it false/absent in staging and use only provider test credentials when enabling tests.
- [ ] Origins: `FRONTEND_URL`, `CORS_ORIGINS`, `NEXT_PUBLIC_APP_URL` use the actual staging
  frontend HTTPS origin. Review the Docker build's public variables/metadata with the frontend
  owner; runtime proxy verification does not prove static canonical metadata uses staging.
- [ ] Optional integration inputs: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
  `GOOGLE_CALLBACK_URL`, optional frontend `NEXT_PUBLIC_GOOGLE_CLIENT_ID`,
  `MAIL_PROVIDER`, `RESEND_API_KEY`, `MAIL_FROM`, `SENTRY_DSN`. Public Google client IDs are
  not client secrets; never expose `GOOGLE_CLIENT_SECRET` in frontend settings.

## Resend checklist

- [ ] After approval, use a separate staging key with `sending_access`, restricted to the
  verified sending domain where possible. Resend documents `full_access` and
  `sending_access`, not a `test` API-key scope. See [API key permissions](https://resend.com/docs/api-reference/api-keys/create-api-key).
- [ ] Confirm domain ownership and the exact SPF/DKIM records supplied by Resend; review
  DMARC and use a verified sender for `MAIL_FROM`. Set `MAIL_PROVIDER=resend` and keep the
  key only on the staging API. Disable click/open tracking for password reset links.
- [ ] Use documented simulation recipients such as `delivered@resend.dev` and
  `bounced@resend.dev` for provider-event tests. A simulated event is not proof of a real
  inbox receiving a recovery link. See [Resend test emails](https://resend.com/docs/dashboard/emails/send-test-emails).
- [ ] Separately approve an email to an owner-controlled staging inbox; verify link origin,
  expiry, one-time use, replay rejection and old-session revocation. Do not log or copy reset
  links into shared evidence. Unconfigured delivery must fail closed.

## DNS and Google OAuth checklist

- [ ] `doxera.in` and `api.doxera.in` remain proposed production names. Confirm ownership
  and branding clearance; no domain purchase or DNS mutation is authorized here.
- [ ] Start with the actual assigned staging frontend HTTPS URL. Do not guess its Render
  hostname or attach production domains to staging. Any custom staging subdomain needs
  owner approval and the exact DNS records supplied by Render.
- [ ] After an approved setup, verify TLS, HTTP redirects, correct frontend/API routing and
  cookie handling. See [Render custom domains](https://render.com/docs/custom-domains).
- [ ] Use a separate staging Google OAuth client. Register both callback paths on the
  **frontend** origin: `/auth/callback` and `/api/v1/auth/google/callback`. The login page
  uses the former; the latter must match `GOOGLE_CALLBACK_URL` for the server flow.
  The frontend proxy keeps the state-cookie flow on the same origin.
- [ ] Authorized JavaScript origin is the frontend origin without a path. Do not use the
  staging API host as the server callback when state cookies were set on the frontend.

Proposed production redirect URIs:

```text
https://doxera.in/auth/callback
https://doxera.in/api/v1/auth/google/callback
```

Local frontend on port 3000:

```text
http://localhost:3000/auth/callback
http://localhost:3000/api/v1/auth/google/callback
```

## Database backup checklist

- [ ] Record the staging database's resource identity and empty/synthetic-data policy before
  approving migrations. Never target the running development database or import production
  records for this task. Review migration history and forward-only adoption first.
- [ ] Confirm the paid database's actual backup/PITR window, recovery points and access owner.
  Render restores PITR into a new instance; verify the actual account entitlement rather than
  assuming a plan name guarantees readiness. See [Render recovery](https://render.com/docs/postgresql-backups).
- [ ] Select an encrypted backup destination, retention period, access controls, schedule,
  failure alert and target recovery time/point. Production backup access is a separate approval.
- [ ] After approval, restore synthetic staging data into a new isolated instance, compare
  rows/content and application ownership, and preserve the source. The prior 20-table local
  restore remains valid evidence for its synthetic fixture, not for live Render backups.
- [ ] Never reset/drop records or mark failed migrations applied/rolled back solely to clear
  an error. Preserve the failed state and review the actual schema before recovery.

## Object storage checklist

- [ ] Choose a separate staging bucket/account scope, region and narrowly scoped credentials.
  Block public access, verify encryption and prohibit access to production buckets.
- [ ] Provision only after approval; automatic application bucket creation stays disabled.
  Apply CORS only to the actual staging frontend origin, with required PUT/GET/HEAD methods,
  upload headers and exposed ETag for multipart uploads. CORS is not authorization.
  See [S3 CORS](https://docs.aws.amazon.com/AmazonS3/latest/userguide/cors.html).
- [ ] For a compatible non-AWS store, explicitly review `S3_ENDPOINT` on API/workers and
  browser-reachable `S3_PUBLIC_ENDPOINT` on the API. Do not expose storage secrets in URLs.
- [ ] Define staging object retention, incomplete multipart expiry, version/backup retention
  and restore ownership. Verify presigned upload, actual conversion, download, expiration and
  cross-user denial with synthetic files after rollout approval; retain test data until cleanup approval.

## Monitoring checklist

- [ ] Select a staging-only Sentry project/DSN and named alert recipient after approval.
  Verify the existing privacy filter using a synthetic error; exclude credentials, cookies,
  reset links, document content and signed storage URLs from logs and monitoring.
- [ ] Monitor frontend login, API liveness/readiness, worker health and actual Celery
  consumption. Worker HTTP health alone does not prove successful queued conversions.
- [ ] Define thresholds and ownership for HTTP errors, queue age, conversion failures,
  missing consumers, storage/database failures, email delivery failures and webhook retries.
  Use measured telemetry; historical admin dashboard placeholders are not monitoring evidence.
- [ ] Test alert delivery and escalation with a synthetic event. Validate real-edge per-client
  rate limits before public staging tests; never trust arbitrary forwarding headers.
- [ ] Keep DNS, provider setup, backup verification and monitoring delivery marked unverified
  until actual scoped tests pass. Do not infer readiness from a green schema validator.

## Next owner

Confirm shared-file ownership and reconcile network isolation, push-hook behavior and
conflicting checklist claims before further infrastructure edits. Then run the focused
configuration suite and official schema validation on that exact tree. Existing auth/billing/
frontend changes remain owned by their active author and are excluded from this handoff commit.
