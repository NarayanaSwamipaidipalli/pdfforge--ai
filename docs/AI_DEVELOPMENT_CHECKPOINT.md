# Doxera — Shared AI Development Checkpoint

## Project rules

- Codex and Claude Code collaborate on this repository.
- Do not perform full-project analysis unless explicitly requested.
- Read this checkpoint before starting work.
- Continue only assigned tasks; do not duplicate completed work.
- Do not overwrite another agent's active changes.
- Preserve existing credentials, databases and Docker volumes.
- Do not push, merge or deploy without approval.

## File ownership

- Codex: Docker configuration, Prisma migrations, backend/worker tests, performance and infrastructure.
- Claude: authentication, Razorpay billing, frontend integration, UI and feature development.
- Confirm ownership before changing files shared by these areas.

## Completed work

Refer to `docs/security-remediation-report.md` and Git history for previously verified work.

2026-11-04 — Codex completed the assigned Compose environment/startup task.

- Files: Compose and environment example, API Dockerfile, `scripts/docker/`, worker storage
  setup module/tests, Docker setup guide, remediation report, and this checkpoint.
- Tests: 5 Node tests, 10 worker tests, 4 real Compose parser regressions, isolated API/worker
  builds, fresh-database migration setup, repeated bucket setup, API/worker health and six
  running processes. All passed. Development container IDs/start times remained unchanged.
- Credentials and existing database records/volumes were preserved. Test resources are
  retained under the project recorded in the report. No push, merge or deployment occurred.

2026-11-04 — Codex completed the explicitly assigned local security, Doxera rebrand,
integration/performance, migration preservation and Render preparation work.

- Files: API auth/admin/billing/schema/migration/dependencies, web branding/metadata/privacy,
  worker requirements/invoice branding, Render/environment examples, CI/Dependabot,
  `scripts/remediation/`, production/restore/security documentation and this checkpoint.
- Tests: 166 API tests, 35 real worker-image tests, 10 Node regressions, 8 auth/admin and
  12 billing HTTP/PostgreSQL scenarios, 11 migration variants, complete real S3/Celery/
  LibreOffice image-and-table conversion, frontend runtime proxy, official Render schema,
  20-table synthetic backup restore and bounded performance checks. All passed locally.
- Audits: production API/web and actual worker dependencies have 0 known advisories;
  API development tree retains 19 moderate/4 low propagated findings. Gitleaks current source: 0.
- Performance: 60 requests / concurrency 4 / no errors / p95 45.61 ms; six real conversions
  completed in 26.93 sec without failures. Shared-host regression baseline only.
- Evidence and exact commands: `docs/security-remediation-report.md`. Private `.remediation/`
  manifests, diagnostics and dumps remain ignored. All isolated test resources retained.
- Existing credentials, records and volumes preserved; original four development container
  IDs/start times unchanged. No push, merge, deployment, domain purchase, DNS or secret change.

2026-11-04 — Claude fixed CI workflow #58 dependency vulnerabilities (session 7).

- Root cause: `tinypool <=2.1.1` (via vitest@2) had 2 critical RCE CVEs; failed both the
  application job `npm audit --audit-level=high` and the integration job `registry-audit.cjs`.
- Fix: upgraded `vitest@^2.1.9` → `^5.1.0`, `@types/node@^20.14.11` → `^22.0.0`, added
  explicit `vite@^6.4.0` peer dep in `apps/web`. Web audit now reports 0 vulnerabilities.
- Tests: 41 vitest + 166 jest = 207 all passed. tsc clean. API audit: 23 low/moderate dev-only
  findings remain (not actionable without breaking changes; do not affect production).
- No push, deploy, production change, or secret exposure.

2026-11-04 — Claude completed CI staging support and credential isolation audit (session 6).

- Files: `.github/workflows/ci.yml` (added `staging` branch to push + PR triggers; added `npm test`
  to frontend step), `docs/STAGING_READINESS.md` (gate #11 resolved, CI isolation analysis added,
  remaining gates table updated), `AI_HANDOFF.md`.
- Tests: 41 vitest + 166 jest = 207 all passed. Pre-push hook confirmed blocking (dry-run, exit 1).
- Verified: CI uses `LOAD_LOCAL_ENV: 'false'` and dummy `DATABASE_URL`; all test suites use mocks;
  no production credentials reachable from CI or vitest tests.
- 12 of 20 GO/NO-GO gates now green; 8 require operator actions (Render dashboard, external services).
- No push, deploy, production change, secret exposure or paid resource created.

2026-11-04 — Claude completed pre-deployment release gate finalization (session 5).

- Files: `docs/STAGING_READINESS.md` (rewrote with 20-gate GO/NO-GO checklist, Render dashboard
  read-only verification, Blueprint cross-contamination proof, staging branch commands, CI gap,
  external credentials, synthetic data policy), `docs/STAGING_SMOKE_TESTS.md` (new: health/auth/
  upload/CORS/security-headers smoke tests, 5 rollback scenarios, pass/fail criteria), `AI_HANDOFF.md`.
- Verified: pre-push hook blocks all pushes (exit 1). Blueprint `fromDatabase.name` is scoped to the
  submitted Blueprint, not the account — production DB adoption is structurally impossible. All
  `doxera-staging-*` service names are disjoint from all `pdfforge-*` production names.
- Found: `.github/workflows/ci.yml` does not list `staging` in push triggers — documented as Codex task.
- 9 of 20 GO/NO-GO gates remain unresolved (all require operator or Codex action).
- No push, deploy, production change, secret exposure or paid resource created.

2026-11-04 — Claude completed token migration, test infrastructure, and staging readiness audit.

- Files: `apps/web/src/lib/token-migration.ts`, `auth-store.ts`, `api-client.ts`, `middleware.ts`,
  all 15 web pages with `pdfforge_token` references, `render.staging.yaml`, `.env.staging.example`,
  `docs/STAGING_READINESS.md`, `AI_HANDOFF.md`, vitest config and two test files.
- Tests: 41 vitest (token migration × 20, middleware × 21) all passed; 166 API jest all passed;
  `tsc --noEmit` 0 errors; `next build` clean. Worker/e2e tests require Docker (Codex scope).
- Migration: `pdfforge_token` → `doxera_token` backward-compatible shim, Secure cookie attribute
  on HTTPS, HttpOnly limitation documented, middleware accepts both keys during migration window.
- Staging: Blueprint isolation verified locally. Fixed missing `NEXT_PUBLIC_GOOGLE_CLIENT_ID` in
  staging web service. Wrote full operator pre-flight checklist in `docs/STAGING_READINESS.md`.
- No push, deploy, DNS change, domain purchase, secret change or production action occurred.

## Active work and blockers

- Codex: local implementation/verification complete; current task files ready for handoff.
- Claude and Codex: confirm ownership before the next task; do not duplicate completed work.
- Recoverable local checkpoint: `a9ec910` (Compose startup fixes); no push authorized by this task.
- Production target: Render; proposed domains `doxera.in` and `api.doxera.in`; email provider Resend.
  No domain ownership or trademark clearance is assumed. No live secrets, DNS, or deployments may change.
- Remaining gates: actual domain/branding ownership, verified Resend sender/inbox, Google
  Console flow, Razorpay sandbox and legacy recurring reconciliation, real-edge rate limits,
  staging schema adoption/restore, live backup destination/PITR, monitoring recipients and
  production capacity. Hosted CI awaits an approved push. Production readiness is unconfirmed.

## Next task

Review `docs/PRODUCTION_DEPLOYMENT.md` and the local security commit, then obtain explicit
approval for any push or staging/production action. Confirm the next owner's assignment.
Use `docs/DOCKER_COMPOSE_SETUP.md` for local startup; never reset records or rotate existing
credentials to resolve a startup or migration error.

## Handoff rules

After each task, record the task, changed files, tests/results, blockers and next task briefly.

## Codex staging verification follow-up — 2026-11-04

- User instruction in this session: production Render settings are not confirmed; keep pushes blocked.
- Codex added explicit manual deployment settings, corrected service-level secret inputs,
  prepared staging configuration/environment-name checks, and initially verified 12/12 focused tests.
- Concurrent work advanced Git through d4b20ee, removed staging network isolation/protection,
  and changed the tracked/installed push hook. Those edits and active auth/frontend/Compose
  changes were preserved; ownership clarification is pending before shared-file edits resume.
- Current results: both Blueprints pass the official Render JSON schema; the staging safety
  contract fails for missing network isolation (focused suite: 9 pass, 3 fail). An all-push
  local block and external Render/GitHub deployment triggers are no longer verified by this pass.
- Files for this handoff: docs/STAGING_CODEX_VERIFICATION.md and this appended checkpoint note.
  The note includes corrected Google redirect paths and Resend, DNS, backup, storage and
  monitoring checklists. It records the limits of the concurrent readiness claims.
- No push, deploy, service purchase, production secret change or development-resource change
  was performed by this Codex pass. Other-session actions are not claimed as this pass's work.
- Next task: confirm infrastructure ownership, reconcile the push/isolation requirements,
  and rerun focused checks on the agreed tree. Do not weaken the checks just to make staging pass.
