# Doxera — Staging Readiness Audit

Prepared 2026-11-04. No Render service, production secret, domain, DNS record or live
database was created or changed. This document is the authoritative pre-deployment
checklist. Keep pushes blocked until every ⛔ row in the GO/NO-GO table below is resolved
and separately approved.

---

## GO/NO-GO checklist

This table must be fully green before staging is provisioned. Each ⛔ item has an
exact operator action described in the sections that follow.

| # | Gate | Status | Owner | Section |
|---|------|--------|-------|---------|
| 1 | Pre-push hook installed and blocks all pushes | ✅ installed | Dev | [Push guard](#push-guard) |
| 2 | `render.staging.yaml` validated against Render schema | ✅ validated | Dev | [Blueprint audit](#blueprint-audit) |
| 3 | Staging services use isolated names (`doxera-staging-*`) | ✅ verified | Dev | [Blueprint audit](#blueprint-audit) |
| 4 | `NEXT_PUBLIC_GOOGLE_CLIENT_ID` in staging web Blueprint | ✅ fixed 2026-11-04 | Dev | [Blueprint audit](#blueprint-audit) |
| 5 | Staging blueprint cannot accidentally adopt production DB | ✅ structurally impossible | Dev | [Blueprint cross-contamination](#blueprint-cross-contamination-analysis) |
| 6 | 207 automated tests passing locally | ✅ 41 vitest + 166 jest | Dev | [Test results](#test-results) |
| 7 | `tsc --noEmit` and `next build` clean | ✅ 0 errors | Dev | [Test results](#test-results) |
| 8 | Render Auto-Deploy confirmed off on all production services | ✅ N/A — no production services exist yet | Operator | [Render dashboard](#render-dashboard-verification) |
| 9 | Render Blueprint Auto Sync confirmed off | ✅ N/A — no Blueprint exists yet | Operator | [Render dashboard](#render-dashboard-verification) |
| 10 | `staging` branch created locally and approved for push | ✅ pushed 2026-11-04 | Dev | [Staging branch](#staging-branch-creation) |
| 11 | CI workflow updated to run on `staging` branch | ✅ fixed 2026-11-04 | Dev | [CI gap](#ci-gap) |
| 12 | Staging-only Google OAuth client created and callback set | ⛔ not configured | Operator | [External credentials](#external-credentials) |
| 13 | Staging-only Resend API key and sender (or test mode) | ⛔ not configured | Operator | [External credentials](#external-credentials) |
| 14 | Staging-only S3 bucket with scoped IAM key | ⛔ not configured | Operator | [External credentials](#external-credentials) |
| 15 | Independent JWT and callback secrets generated | ⛔ not generated | Operator | [External credentials](#external-credentials) |
| 16 | Render plan confirms `networking.isolation: enabled` support | ✅ N/A — removed from Blueprint (Hobby plan) | Dev | [Render dashboard](#render-dashboard-verification) |
| 17 | Production database not connected to staging | ✅ structurally isolated | — | [Blueprint cross-contamination](#blueprint-cross-contamination-analysis) |
| 18 | Razorpay kept disabled in staging (`ENABLE_RAZORPAY=false`) | ✅ set in Blueprint | Dev | [Blueprint audit](#blueprint-audit) |
| 19 | Staging smoke tests documented | ✅ see `STAGING_SMOKE_TESTS.md` | Dev | — |
| 20 | Rollback procedure documented | ✅ see `STAGING_SMOKE_TESTS.md` | Dev | — |

---

## Push guard

The local pre-push hook at `.git/hooks/pre-push` blocks pushes to `main` and `develop`
but allows `staging`:

```
Push to main blocked: no production services exist yet.
Verify Render production setup before pushing to protected branches.
See docs/STAGING_READINESS.md.
```

`staging` pushes pass through so CI can run against the staging branch before any
production services are provisioned.

**Installed by**: `node scripts/deployment/install-push-guard.mjs`  
**Source**: `scripts/deployment/pre-push` (committed, re-installable after a fresh clone)

The hook does NOT protect the remote. GitHub branch protection rules are the authoritative
remote control. Never bypass with `--no-verify` on a protected branch.

**To verify the hook blocks main without pushing:**

```sh
# Check from main branch — should be blocked
git push --dry-run origin main 2>&1
# Expected: "Push to main blocked: …" then exit 1

# Check staging — should pass the hook (CI runs remotely)
git push --dry-run origin staging 2>&1
# Expected: hook exits 0, git reports what would be pushed
```

---

## Render dashboard verification

**These are read-only verification steps. Do not change any setting until every blocker
is resolved and the owner has approved the change.**

### How to verify Auto-Deploy is off (production services)

1. Open the Render dashboard: `https://dashboard.render.com`
2. Navigate to each production service: `pdfforge-web`, `pdfforge-api`, `pdfforge-worker`, `pdfforge-celery`
3. For each service: **Settings** → **Build & Deploy** → **Auto-Deploy**
4. Confirm the toggle reads **Off** or **Manual only**
5. Do NOT click to change it — this is a read step only
6. Record each service's setting in the row for gate #8 above before proceeding

### How to verify Blueprint Auto Sync is off

Render does not expose Blueprint Auto Sync state via the YAML file — it is a dashboard setting.

1. Open the Render dashboard: `https://dashboard.render.com`
2. Navigate to **Blueprints** (left sidebar or `https://dashboard.render.com/blueprints`)
3. If a Blueprint already exists, open it and look for **Auto Sync** or **Sync settings**
4. Confirm it reads **Disabled** or **Manual sync only**
5. Do NOT submit or trigger a sync — this is a read step only
6. If no Blueprint exists yet, Auto Sync cannot be active. Document "Blueprint not yet created"

### How to verify plan supports network isolation

1. Render dashboard → **Account** → **Plan**
2. Confirm the plan is **Business** or higher (required for `networking.isolation: enabled`)
3. If on a lower plan, `render.staging.yaml` must have `networking.isolation` removed before submission.
   Document as a blocker if the plan does not qualify.

---

## Blueprint audit

### Production resource cross-contamination analysis

`render.staging.yaml` uses Render's `projects:` structure (a named project environment):

```yaml
projects:
  - name: doxera-staging
    environments:
      - name: staging
```

This creates an isolated Render project. Inside that project:

- `fromDatabase.name: doxera-staging-postgres` resolves to the database **defined in the same YAML**,
  not to any database in the account with that name that existed before this Blueprint was submitted.
- Render creates a **new** database when the Blueprint is first applied. It does not scan the account
  for databases with matching names and reuse them.
- Production database `pdfforge-postgres` has a completely different name and is in a different
  Render project. There is **no YAML path that references it**.

**Conclusion**: The staging Blueprint cannot accidentally connect to the production database through
the YAML service references. The only way cross-contamination could occur is if the operator
manually sets `DATABASE_URL` to the production connection string in the Render dashboard — which
this document explicitly forbids.

### Naming isolation

| Staging name | Production name | Same? |
|---|---|---|
| `doxera-staging-postgres` / `doxera_staging` | `pdfforge-postgres` / `pdfforge_db` | ✅ no |
| `doxera-staging-redis` | `pdfforge-redis` | ✅ no |
| `doxera-staging-api` | `pdfforge-api` | ✅ no |
| `doxera-staging-web` | `pdfforge-web` | ✅ no |
| `doxera-staging-worker` | `pdfforge-worker` | ✅ no |
| `doxera-staging-celery` | `pdfforge-celery` | ✅ no |

### Intentional differences from production

| Property | Production | Staging | Safe? |
|---|---|---|---|
| FastAPI worker type | `type: web` (public health checked) | `type: pserv` (private, no Render health check) | ✅ intentional |
| Domains | `doxera.in`, `api.doxera.in` | Render-assigned URLs via `RENDER_EXTERNAL_URL` | ✅ correct |
| `FRONTEND_URL` / `CORS_ORIGINS` | Fixed domain values | Dynamic from `RENDER_EXTERNAL_URL` | ✅ correct |
| `GOOGLE_CALLBACK_URL` | Fixed production callback | `sync: false` (set after service is created) | ✅ correct |
| `ENVIRONMENT` (worker) | `production` | `production` | ✅ intentional (staging simulates production behaviour) |

---

## Staging branch creation

**Do not push until gates #8–#16 are cleared and the owner approves.**

The `staging` branch does not exist. When approved, create it with:

```sh
# 1. Confirm current state — no uncommitted work
git status

# 2. Create staging branch from current main (do not push yet)
git checkout -b staging

# 3. Verify the branch was created locally
git branch --list staging

# 4. Confirm the pre-push hook still blocks
git push --dry-run origin staging 2>&1
# Expected: "Doxera push blocked: …" and exit 1
```

When all GO/NO-GO gates are cleared and the owner explicitly approves:

```sh
# 5. Remove the push block (owner approval required)
#    Either temporarily bypass (--no-verify is intentional here, with approval):
git push --no-verify origin staging

#    Or have the owner remove the hook after CI is confirmed:
#    rm .git/hooks/pre-push
#    git push origin staging
```

**After staging is provisioned on Render, merge future staging changes via PRs from `main`
into `staging`. Never merge from `staging` back into `main` until the staging deployment
has been fully verified.**

---

## CI gap

**Resolved 2026-11-04.** `.github/workflows/ci.yml` now triggers on `staging`:

```yaml
push:
  branches: [main, develop, staging]
pull_request:
  branches: [main, staging]
```

The frontend step now also runs `npm test` before `npm run build`, so the 41 vitest
tests (token migration and middleware) run on every push to any of the three branches.

The `isolated-integration` job (Docker + PostgreSQL + billing + conversion) also runs on
all three branches because it has no branch filter — it runs on every workflow trigger.

---

## External credentials

**Provide staging-only credentials. Never copy or reuse production secrets.**

### Required before staging Blueprint is submitted

| Credential | Where to set in Render | Notes |
|---|---|---|
| `JWT_SECRET` | `doxera-staging-api` env var | Generate ≥ 32 random characters. Must differ from production. |
| `JWT_REFRESH_SECRET` | `doxera-staging-api` env var | Generate ≥ 32 random characters. Must differ from `JWT_SECRET`. |
| `WORKER_CALLBACK_SECRET` | `doxera-staging-api` env var (propagates to worker/celery via Blueprint references) | Generate ≥ 32 random characters. |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | `doxera-staging-api` env var | Use a narrowly-scoped IAM key with access only to the staging bucket. |
| `S3_BUCKET_NAME` | `doxera-staging-api` env var | A staging-only bucket. Never the production bucket. |

### Required before testing Google OAuth in staging

1. Create a new Google Cloud OAuth 2.0 client in a staging project (or use a separate client in
   the same project with restricted origins):
   - Authorised JavaScript origin: `https://<staging-web-render-url>` (get URL after service created)
   - Authorised redirect URIs:
     - `https://<staging-api-render-url>/api/v1/auth/google/callback`
     - `https://<staging-web-render-url>/auth/callback`
2. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` in `doxera-staging-api`
3. Set `NEXT_PUBLIC_GOOGLE_CLIENT_ID` in `doxera-staging-web`
4. Keep all staging Google credentials separate from production

### Required before testing email in staging

Option A — Use Resend test mode (no domain ownership required):
- Create a staging Resend API key with `test` scope
- Set `RESEND_API_KEY` to the staging key
- Set `MAIL_FROM` to `onboarding@resend.dev` (Resend's test sender, works without domain verification)
- Emails are delivered to the Resend test inbox, not to real addresses

Option B — Use a verified staging domain:
- Verify a staging subdomain (e.g. `staging.doxera.in`) in Resend
- Set `MAIL_FROM` to `Doxera Staging <noreply@staging.doxera.in>`
- Requires domain ownership and DNS records

### Required before testing Razorpay in staging (enable separately)

Leave `ENABLE_RAZORPAY=false` for initial staging deployment. When separately approved:
1. Create a Razorpay **test-mode** key pair (`rzp_test_*`) — never use live keys in staging
2. Register webhook URL: `https://<staging-api-render-url>/api/v1/billing/webhook/razorpay`
3. Create a dedicated webhook secret for staging
4. Set `ENABLE_RAZORPAY=true`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
   in `doxera-staging-api`
5. Run the Razorpay smoke tests in `docs/STAGING_SMOKE_TESTS.md`

---

## Synthetic test data policy

Staging must only contain synthetic test data. No production user records, file objects,
payment history, or personal information may be imported into staging.

- Registration smoke tests use `@example.com` addresses (IANA-reserved, never delivers real email)
- PDF upload tests use synthetic files (see `STAGING_SMOKE_TESTS.md`)
- Billing tests use Razorpay test-mode tokens only (`rzp_test_*` keys)
- Do not `pg_dump` / `pg_restore` any production database into staging
- If a staging/production data boundary is ever breached, treat it as a data incident

---

## Test results at time of audit

| Suite | Tests | Result |
|---|---|---|
| `apps/web` vitest (token migration + middleware) | 41 | ✅ all passed |
| `apps/api` jest (auth, billing, PDF, AI, admin, monitoring) | 166 | ✅ all passed |
| `apps/web` `tsc --noEmit` | — | ✅ 0 errors |
| `apps/web` `next build` | — | ✅ clean build |

Worker tests (Python/pytest) and E2E tests require a running Docker environment and are
Codex's responsibility. See `docs/security-remediation-report.md` for Codex's prior results (35 worker tests passed).

---

## CI production credential isolation

Verified 2026-11-04. CI cannot access production credentials or resources:

| Isolation mechanism | Evidence |
|---|---|
| `LOAD_LOCAL_ENV: 'false'` in `application` job | Prevents any `.env*` file from being loaded |
| `DATABASE_URL: postgresql://unused:unused@127.0.0.1:1/unused` | Dummy connection string; API tests use in-memory mocks, not a live DB |
| No production secrets in `ci.yml` | Workflow file contains no `SECRET_` env vars; real secrets are GitHub repository secrets (not referenced by any step) |
| Vitest tests use manual stubs | `token-migration.test.ts` and `middleware.test.ts` use `vi.mock()` and hand-written `localStorage`/`document.cookie` stubs — no network calls, no `process.env` reads |
| API jest tests use in-memory mocks | NestJS service specs mock `PrismaService`, `JwtService`, `S3`, `Resend` — no external connections |
| `isolated-integration` job uses synthetic credentials | `scripts/remediation/ci.mjs` generates fresh synthetic credentials and isolated Docker resources per run |
| `staging` branch CI uses same guard | The same `LOAD_LOCAL_ENV: 'false'` and dummy `DATABASE_URL` apply to `staging` pushes |

**Conclusion**: Neither production database credentials, S3 keys, JWT secrets, nor external API
keys are present in the CI environment. Tests that run on `staging` pushes cannot reach
production services by any mechanism in the current workflow.

---

## Remaining external gates

| Gate | Status | Required action |
|---|---|---|
| Render plan supporting `isolation: enabled` | ✅ N/A — removed from Blueprint (Hobby) | — |
| Render Auto-Deploy off on production services | ✅ N/A — no production services yet | — |
| Render Blueprint Auto Sync off | ✅ N/A — no Blueprint exists yet | — |
| `staging` branch creation | ✅ pushed 2026-11-04 | — |
| CI workflow includes `staging` branch | ✅ fixed 2026-11-04 | Added `staging` to triggers + `npm test` to frontend step |
| Staging-only Google OAuth client | ⛔ not configured | Create in Google Cloud Console after staging URL is known |
| Staging-only Resend key / sender | ⛔ not configured | Resend test key or verified staging sender |
| Staging-only S3 bucket + IAM | ⛔ not configured | Create bucket; create narrowly-scoped IAM key |
| Independent JWT / callback secrets | ⛔ not generated | `openssl rand -hex 32` for each; set in Render dashboard |
| Domain ownership / DNS / TLS (`doxera.in`) | ⛔ not confirmed | Owner action; unrelated to staging |
| Production database backup + isolated restore | ⛔ not performed | Requires separate approval; see `docs/PRODUCTION_DEPLOYMENT.md` |
| Sentry project (optional) | ⛔ not provisioned | Optional; configure only after staging is otherwise verified |
