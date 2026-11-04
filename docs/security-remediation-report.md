# Security remediation report

Status: local security implementation and isolated verification completed on 2026-11-04;
external staging/production gates remain. Production readiness is not established.

## Scope and preservation

The takeover began on branch `security/production-hardening` at commit `3d011ad`.
The original 11 modified tracked files and untracked frontend artifacts were preserved.
A private original patch and source hash manifest are retained in the ignored `.remediation/` directory.
Database backups were not read. No development database, running service, or existing Docker volume is a test target.
No push, merge, deployment, seed, reset, prune, or destructive cleanup is authorized by this work.

## Initial findings

Claude's Google token prechecks, OAuth UI/callback changes, and frontend Docker changes were partial.
Unsigned social credentials, password reset disclosure, default administrator provisioning,
ineffective 2FA, webhook verification bypasses, unsafe billing updates, and unauthenticated
worker routes remained. The initial migration lacks OAuth columns, webhook_events, and subscription columns.
The worker image lacks LibreOffice. CORS reflects arbitrary credentialed origins; frontend routing
depends on build-time configuration. Existing tests do not establish these security properties.

## Verification isolation

`scripts/remediation/isolated.mjs prepare` creates only uniquely named, labelled test resources,
an internal network, and a new PostgreSQL volume. It publishes no database port and never loads
environment files. Synthetic credentials remain in ignored evidence and are not printed.
Resources are retained; cleanup requires separate approval. Existing localhost integration scripts
are not executed against their default targets.

## Phase results

1. Isolation and recoverable checkpoint: completed; Compose fixes committed as `a9ec910`.
2. Authentication/admin: implemented and verified locally (166 API tests; 8 real database/HTTP scenarios).
3. Migration repair: additive migrations and preservation matrix verified on isolated databases; live adoption requires preflight.
4. Billing integrity: signed HTTP/database tests pass for 12 scenarios; provider network boundary simulated.
5. Worker access and LibreOffice: 35 image tests and the complete API/S3/Celery conversion pipeline pass.
6. Production configuration/builds: API, frontend and worker images build; runtime proxy and official Render schema pass. No deployment occurred.
7. CI/regression checks: configured; component checks executed locally. Hosted GitHub Actions execution remains pending a separately approved push.

## Remaining release gates

Verify actual domain ownership/branding clearance, live secret configuration, Google OAuth,
Resend delivery, payment-provider sandbox flows, per-client Render edge rate limiting,
backup destination/PITR, monitoring recipients, capacity and approved migration adoption.
See [the production runbook](PRODUCTION_DEPLOYMENT.md). None of those external resources
was changed, and no push, merge, deployment or production-readiness claim is made.

## Scoped Compose handoff — 2026-11-04

Completed the assigned Docker Compose environment and startup task. Authentication,
billing, and frontend implementation files were not changed in this task.

Changes: `docker-compose.yml`, `.env.example`, `apps/api/Dockerfile`,
`scripts/docker/prepare-env.mjs`, `scripts/docker/prepare-env.test.mjs`,
`scripts/docker/verify-compose.mjs`, `services/pdf-worker/app/init_storage.py`,
`services/pdf-worker/tests/test_init_storage.py`, and `docs/DOCKER_COMPOSE_SETUP.md`.
The shared checkpoint is `docs/AI_DEVELOPMENT_CHECKPOINT.md`.

- The configuration helper uses Compose's own environment resolution, preserves existing
  credentials and native `DATABASE_URL`, and derives an encoded `COMPOSE_DATABASE_URL`.
  It supplies a verified pinned MinIO digest only when an explicit image was not supplied.
- PostgreSQL health uses configured names; worker startup waits for healthy Redis.
  Storage region/bucket settings are consistent, and CORS defaults to the configured frontend.
- Migration and bucket initialization are explicit `setup` profile services. Bucket setup
  never deletes or overwrites objects and suppresses raw SDK errors.
- API ownership is set during image copying, avoiding a recursive ownership pass over dependencies.

Verification results:

| Check | Result |
| --- | --- |
| Node environment-helper regressions | 5 passed |
| Worker storage initialization regressions, networking disabled | 10 passed |
| Actual Compose parsing: unquoted hash, variable interpolation, literal dollars, multiline password | 4 passed |
| Actual Compose configuration and isolation assertions | Passed |
| API and worker production image builds | Passed |
| Explicit migration setup on fresh isolated PostgreSQL | Passed |
| Bucket initialization and repeat initialization | Passed |
| API readiness and FastAPI health over the isolated network | Passed |
| PostgreSQL, Redis, MinIO, API, FastAPI and Celery running | Passed |
| Development container IDs and start timestamps unchanged | Passed |

The successful runtime run is recorded in ignored evidence at
`.remediation/pdfforge-compose-check-1793761714375-6d882427/`.
An initial attempt stopped on an unsupported Compose CLI flag before running migrations;
that flag was corrected. All test resources remain retained. No existing database,
development volume, running service, credential, remote branch, or deployment was changed.

Remaining rollout steps: populate a private deployment environment file with the existing
credentials, review the target and pending migrations, and explicitly approve any live-stack
restart or rollout. This scoped verification does not establish completion of the earlier
authentication/billing security project or production readiness.

## Doxera security and production preparation — 2026-11-04

The user subsequently assigned authentication, billing, migration verification, complete
integration/performance testing, production preparation and Doxera rebranding to Codex.
The tree was clean after checkpoint `a9ec910`; no other agent's active edits were replaced.
The existing internal identifiers and original initial/security migration files were preserved.

### Implemented changes and files

| Area | Files and resulting behavior |
| --- | --- |
| Authentication | `apps/api/src/auth/`, `common/guards/jwt-auth.guard*`: strict JWT purpose/issuer/audience/algorithm and finite expiry; database role/status and version on every protected request; atomic refresh rotation and immediate access revocation after password/logout/admin changes. |
| OAuth | `auth.service.ts`, Prisma `OAuthState`: cryptographic Google verification retained; hashed state is persisted and consumed atomically with browser/redirect/user binding. No test-token or unsigned-token login is accepted. |
| Recovery/email | `transactional-email*`, auth DTO/controller/service: Resend adapter, 15-minute hashed single-use reset, bounded HTTPS requests, recovery throttles, generic public results and no token/provider-detail disclosure. Unconfigured delivery fails closed. |
| Admin | `admin.controller.ts`, `admin.service.ts`, `admin.security.spec.ts`: current database permissions, superadmin-only role changes, no self suspension, concurrency-safe preservation of the last superadmin, credential/session revocation and transactional audit records. |
| Migrations | `schema.prisma`, `20261104000000_auth_revocation/migration.sql`, `scripts/remediation/migrations.mjs`: additive token version/state schema, adoption and rollback tests; original users/payments/subscriptions/invoices and other table contents compared. |
| Billing | `billing.service.ts`, `billing.security.spec.ts`, real HTTP fixtures: signed raw webhook verification and trusted provider orders retained; conflicting reuse of event IDs rejected, incomplete legacy events fail retryably, ambiguous same-second events cannot restore overdue access. |
| Images/dependencies | API/worker Dockerfiles, API package/lock, worker requirements: compatible Nest 11 upgrade, unused integrations removed, patched dependencies, production API pruning with Prisma CLI retained, Redis client fixed for resolved Kombu transport. |
| Branding | Web pages/layout/navbar/footer/metadata/manifest/icon/social image, checkout/receipt labels, worker invoice templates, README/SDK/CLI/docs: Doxera visible naming. Internal packages, JWT identity, database/storage/cookie/environment keys unchanged. Unsupported certification/retention claims removed from the main security/privacy material. |
| Render/monitoring | `render.yaml`, `.env.production.example`, `common/monitoring*`, `docs/PRODUCTION_DEPLOYMENT.md`, `RESTORE.md`: proposed domains, verified-sender Resend settings, private secret placeholders, privacy-filtered optional Sentry, backup and manual rollout instructions. |
| CI/evidence | `.github/workflows/ci.yml`, `.github/dependabot.yml`, `scripts/remediation/`: Node 22 tests/builds, gitleaks current-source scan, npm/pip audits, real isolated migration/auth/billing/conversion/runtime/performance/restore checks. Artifact upload excludes manifests, private diagnostics, environment files and dumps. |

### Verified results

All Docker verification used project `pdfforge-security-1793762617746-2e88d5d7`, its own
internal network and new volumes/databases, without publishing host ports. Production images
ran as non-root users. No development database query, existing-volume write, reset, deletion,
seed, cleanup or live provider request was performed. Failed test resources were also retained.
The four original development container IDs and start timestamps were unchanged at final review.

Commands below use `PDFFORGE_SECURITY_MANIFEST=.remediation/security-run-nov04.json`.
The private manifest contains only synthetic test credentials and is ignored by Git.

| Command/check | Actual result |
| --- | --- |
| `node scripts/remediation/build.mjs api` / `api-test` / `web` / `worker` | All four final Docker image targets build successfully. |
| `node scripts/remediation/api-tests.mjs` | 16 suites / 166 tests pass in final dependency image, networking disabled. Includes real local RSA Google signatures, JWT failures, CORS, email failure privacy, admin, billing, quotas and processing regressions. |
| `node --test scripts/remediation/proxy.test.mjs scripts/remediation/safe-redirect.test.mjs scripts/docker/prepare-env.test.mjs` | 10 pass. |
| `node scripts/remediation/auth.mjs` | 8 real PostgreSQL/HTTP scenarios pass: privilege injection/stale role, refresh race/replay, reset race and revocation, delivery privacy/logout, OAuth state replay, admin escalation, concurrent root demotion and ban preservation. |
| `node scripts/remediation/billing.mjs` | 12 real PostgreSQL/HTTP scenarios pass, including rollback/retry, concurrent duplicate/provider/client events, trusted prices and ownership, lifecycle ordering, invoice integrity and quota races. External provider responses are simulated. |
| `node scripts/remediation/migrations.mjs` | 11-case preservation matrix: fresh, baseline, partial, already, unbaselined, incompatible, duplicates, bad index, auth partial, auth adopted and auth incompatible. Valid cases diff cleanly and support repeated deploy; invalid cases reject with data preserved. |
| `node scripts/remediation/worker.mjs test` | 35 pass inside the actual final worker image, networking disabled. LibreOffice conversion, images/tables, simultaneous profiles, timeouts, worker auth/config, PDF-to-DOCX and bucket initialization covered. |
| `node scripts/remediation/pipeline.mjs` | 10 complete production-image assertions pass: registration/login/secure cookie, auth/CORS denials, refresh CAS, actual S3 upload, ownership isolation, Redis/Celery/LibreOffice/callback/download. |
| PDF structural/rendered inspection | One-page PDF retains 1 embedded image, 7 drawing objects including table borders, all sentinel text and reading order. PNG visually inspected; table and image are intact. Original fixture content is intentionally preserved. |
| `node scripts/remediation/web-runtime.mjs .remediation/pipeline-2697ced1` | Doxera HTML, manifest, SVG icon, social image, runtime API destination, no-store proxy and unauthenticated rejection pass. Production API includes Prisma CLI/Sentry and excludes Jest/Nest CLI/unused integration modules. |
| `node scripts/remediation/performance.mjs .remediation/pipeline-2697ced1` | 60 HTTP requests, concurrency 4, zero errors; p50 11.43 ms, p95 45.61 ms, p99 83.44 ms, 184.79 requests/sec. Six real document conversions, dispatch concurrency 2, zero errors, 26.93 sec total, queued completion p95 26.71 sec. Shared-host baseline only. |
| `node scripts/remediation/backup.mjs .remediation/pipeline-2697ced1` | Real custom-format `pg_dump`/`pg_restore` into new synthetic DB: all 20 public tables' row counts and contents match; source unchanged. No live backup read or PITR test. |
| `node scripts/remediation/render.mjs` | Blueprint passes the official Render JSON Schema draft 2020-12. No Render API mutations. |
| `node scripts/remediation/npm-audit.mjs` | API and web production: 0 advisories. Web all dependencies: 0. API all dependencies: 0 critical, 0 high, 19 moderate, 4 low (development dependency/meta-advisory chains). |
| `node scripts/remediation/dependencies.mjs` | Direct vulnerable installed-version matches: API 1 low (`deepmerge`) and 1 moderate (`minimatch`), both development-only; web 0. Full npm audit above includes affected parent packages. No forced downgrade/breaking override applied to hide them. |
| `node scripts/remediation/worker.mjs audit` | 0 known vulnerabilities in the actual installed image requirements, audited separately from scanner packages. |
| `node scripts/remediation/secrets.mjs` | 0 current-source gitleaks findings; example bearer credential and smoke-fixture secret replaced with variable/generated values. No historical Git secret-clearance claim. |

Private evidence: `.remediation/api-tests.log`, `auth-results.txt`, `billing-results.txt`,
`migration-results*.json`, `worker-tests.log`, `worker-audit.json`, `*-npm-audit*.json`,
`secret-scan.json`, `render-validation.txt`, and `.remediation/pipeline-2697ced1/`.
Manifests, dumps and raw diagnostics must remain private and uncommitted.

### Failures investigated and corrected

The first pipeline used DNS labels longer than botocore permits; the test harness now uses
short unique container names while retaining project ownership labels. The next real queue
test exposed Kombu requiring redis-py >=6.1 while requirements pinned 5.0.7; pinning 6.4.0
fixed actual dispatch. Render validation required draft 2020-12, string PostgreSQL version,
and quoted boolean environment values; all were corrected. Initial fixture-only failures
(branding assertion, missing test DI provider/BigInt serialization, regenerated event timestamp,
case-sensitive synthetic admin email, Prisma 5 masking failed SQL transactions) were corrected
without weakening the expected security/data-preservation behavior.

### Boundaries and unresolved release problems

Google Console/live token exchange, Resend inbox delivery, Razorpay sandbox/live capture,
Render account compatibility, domain ownership/HTTPS, backup destination/PITR, alert delivery,
and production load remain unverified. No production secrets were set or rotated. Legacy
recurring billing requires explicit provider reconciliation; new Razorpay purchases buy one
term. Incomplete GitHub/TOTP/email-verification paths remain disabled. Recovery response
contents are uniform; real-provider delivery timing has not been profiled for enumeration.
The backend proxy peer rate-limit bucket must be validated at Render's real edge before launch.
Historical admin capacity/queue/revenue placeholders are not operational monitoring.
Lower-severity development advisories remain tracked. Hosted CI has not run because this task
does not push. A fresh staging restore, external provider verification and an approved rollout
are required before claiming production readiness.

### Hosted CI on `staging` (2026-11-04, Claude)

- Run #58 (`3e8ac90`): web `npm audit --audit-level=high` failed. `tinypool <=2.1.1` (via
  `vitest@2`) had critical advisories GHSA-5gmw-xhrv-c9v3 and GHSA-85c8-ppgw-ccpr, along with
  related vite/esbuild/@vitest/mocker advisories. The integration job's registry audit failed on
  the same lockfile. Fixed in `75743fb` with `vitest@^5.1.0`, `vite@^6.4.0` and `@types/node@^22`.
  These are dev-only and are not in the runtime image.
- Run #59 (`75743fb`): both jobs failed at the web `npm ci`. The lockfile had been regenerated with
  npm 11 and `--legacy-peer-deps`. npm 10 (bundled with Node 22, used by the CI runner and by
  `node:22-alpine` in `apps/web/Dockerfile`) rejected it as out of sync (`picomatch@2.3.2 does not
  satisfy picomatch@4.0.7`). Fix: the lockfile was repaired with npm 10 and strict peer resolution.
  Only the `picomatch` nesting changed. Verified: clean `npm ci` passes on npm 10 and 11, 41 vitest
  tests pass, `next build` is clean, web audit shows 0 vulnerabilities, and an isolated web Docker
  build succeeds. Generate future lockfiles with Node 22 / npm 10.
- Unchanged: the API has 23 low/moderate advisories, all dev-only (jest / `@nestjs/cli` chains).
  They cannot be fixed without breaking downgrades and are below the CI `high` threshold.
