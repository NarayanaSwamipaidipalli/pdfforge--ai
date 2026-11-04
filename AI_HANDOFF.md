# Doxera — AI Handoff Document

## Completed by Claude — 2026-11-04 (session 7)

### Dependency vulnerability remediation — CI workflow #58

**Root cause:** vitest@2's transitive dependency `tinypool <=2.1.1` had 2 critical CVEs
(GHSA-5gmw-xhrv-c9v3, GHSA-85c8-ppgw-ccpr — Prototype Pollution to RCE). These caused:
- `apps/web` `npm audit --audit-level=high` failure in the application job
- `scripts/remediation/registry-audit.cjs` exit code 1 in the integration job (npm bulk
  advisory API query returned critical findings for the web package-lock)

**Files changed:**

| File | Change |
| --- | --- |
| `apps/web/package.json` | `vitest: ^2.1.9` → `^5.1.0`; `@types/node: ^20.14.11` → `^22.0.0`; added `vite: ^6.4.0` (explicit peer dep required by vitest@5) |
| `apps/web/package-lock.json` | Regenerated — tinypool upgraded out of vulnerable range; vite@6 and vitest@5 resolved |

**Test results after upgrade:**

| Suite | Tests | Result |
| --- | --- | --- |
| `apps/web` vitest v5.1.0 (token migration + middleware) | 41 | ✅ all passed |
| `apps/api` jest (all 16 suites) | 166 | ✅ all passed |
| `apps/web` `tsc --noEmit` | — | ✅ 0 errors |
| `apps/web` `npm audit --audit-level=high` | — | ✅ 0 vulnerabilities |
| `apps/api` `npm audit --audit-level=high` | — | ✅ 0 findings at high/critical level |

**Unresolved advisories (API dev-only, do not block CI):**

`apps/api` has 23 low/moderate findings. All are dev-only and not actionable without breaking changes:

| Package chain | Severity | Exposure | Notes |
| --- | --- | --- | --- |
| `deepmerge` via `fork-ts-checker-webpack-plugin` → `@nestjs/cli` | Moderate | Dev tooling only | Fixing requires `@nestjs/cli@6.8.1` (major downgrade) — not viable |
| `minimatch <11.0.1` via jest/glob chain | Moderate | Dev tests only | Fixing requires downgrading `@nestjs/cli` and multiple jest packages — breaking |

Production and staging deployments never install devDependencies (`NODE_ENV=production`
in both Docker builds). No production surface exposure.

---

## Completed by Claude — 2026-11-04 (session 6)

### CI staging branch support, test verification, credential isolation audit

**Files changed:**

| File | Change |
| --- | --- |
| `.github/workflows/ci.yml` | Added `staging` to push branch triggers and to `pull_request` targets; added `npm test` before `npm run build` in frontend step so vitest runs in CI |
| `docs/STAGING_READINESS.md` | Gate #11 ✅ resolved; CI gap section updated from "required action" to "resolved"; CI credential isolation analysis section added; remaining gates table updated |

**Test results:**

| Suite | Tests | Result |
| --- | --- | --- |
| `apps/web` vitest (token migration + middleware) | 41 | ✅ all passed |
| `apps/api` jest (all 16 suites) | 166 | ✅ all passed |

**Key findings:**

| Finding | Verified |
| --- | --- |
| Pre-push hook | ✅ `git push --dry-run` blocked with correct message, exit 1 |
| CI staging trigger | ✅ `staging` added to push + PR branch triggers |
| `npm test` in CI | ✅ vitest added to frontend CI step before build |
| Production credentials in CI | ✅ no live secrets — `LOAD_LOCAL_ENV: 'false'`, dummy `DATABASE_URL`, all test suites use mocks |
| Vitest tests access no real env vars | ✅ node environment + manual stubs only, zero network calls |

**Gate reconciliation (after session 6):**
- ✅ green: 1, 2, 3, 4, 5, 6, 7, 11, 17, 18, 19, 20 (12 of 20)
- ⛔ operator/external: 8, 9, 10, 12, 13, 14, 15, 16 (8 of 20)

No push, deploy, production change, or secret exposure occurred.

---

## Completed by Claude — 2026-11-04 (session 5)

### Pre-deployment release gate finalization

**Files changed:**

| File | Change |
| --- | --- |
| `docs/STAGING_READINESS.md` | Rewrote with 20-gate GO/NO-GO checklist, Render dashboard read-only verification steps, Blueprint cross-contamination analysis, staging branch creation commands, CI gap documentation (Codex task), external credentials table, synthetic test data policy, rollback procedure references |
| `docs/STAGING_SMOKE_TESTS.md` | New: 9 non-destructive smoke test groups (health, auth, file upload, job poll, CORS, security headers, cleanup), Razorpay test sequence, 5 rollback scenarios, pass/fail criteria table |

**Key findings:**

| Finding | Status |
| --- | --- |
| Pre-push hook (`.git/hooks/pre-push`) | ✅ installed, blocks all pushes with exit 1 |
| `git push --dry-run` test | ✅ blocked, correct message, no remote contact |
| Blueprint cross-contamination | ✅ structurally impossible — `fromDatabase.name` is Blueprint-scoped; production DB has different name and project |
| `doxera-staging-*` naming isolation | ✅ zero name overlap with `pdfforge-*` production services |
| CI `staging` branch trigger | ⛔ missing — `.github/workflows/ci.yml` triggers on `main`/`develop` only; `staging` absent (Codex task) |
| Render Auto-Deploy / Blueprint Auto Sync | ⛔ unverified — read-only dashboard steps documented |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` in staging Blueprint | ✅ fixed session 4 |
| `render.staging.yaml` env var completeness | ✅ all required `sync: false` fields present |
| Synthetic test data policy | ✅ documented — `@example.com` addresses, no production DB import |

**Remaining gates (count: 9 of 20 unresolved):**
All ⛔ items in `docs/STAGING_READINESS.md` require operator or Codex action.
No push, deploy, production change or secret exposure occurred this session.

---

## Completed by Claude — 2026-11-04 (session 4)

### Staging readiness audit and Blueprint fixes

**Test results:**

| Suite | Tests | Result |
| --- | --- | --- |
| `apps/web` vitest (token migration + middleware) | 41 | ✅ all passed |
| `apps/api` jest (auth, billing, PDF, AI, admin, monitoring, filters) | 166 | ✅ all passed |
| `apps/web` `tsc --noEmit` | — | ✅ 0 errors |
| `apps/web` `next build` | — | ✅ clean build (from prior session) |

**Files changed:**

| File | Change |
| --- | --- |
| `render.staging.yaml` | Added `NEXT_PUBLIC_GOOGLE_CLIENT_ID: sync: false` to staging web service — required for Google One-Tap GSI script; was present in production Blueprint but absent from staging |
| `.env.staging.example` | Added `NEXT_PUBLIC_GOOGLE_CLIENT_ID=` field with comment |
| `docs/STAGING_READINESS.md` | New: full staging readiness audit — isolation table, intentional production differences, operator pre-flight checklist, auth/PDF/billing/email/health verification steps, database adoption rules, all remaining external gates |

**Staging Blueprint findings:**

- All five staging services use separate names, branch `staging`, and `autoDeployTrigger: 'off'` ✅
- PostgreSQL, Redis, and S3 bucket are fully isolated from production ✅
- FastAPI worker uses `type: pserv` in staging (private — no public URL, no Render health check) vs `type: web` in production — intentional for staging isolation, documented ✅
- Render Blueprint Auto Sync is **not controlled by YAML** — still an unresolved blocker ✅
- `staging` branch does not yet exist in the repository — must be created from `main` before Blueprint is submitted ⛔

---

## Completed by Claude — 2026-11-04 (session 3)

### Token migration verification and authentication compatibility testing

**New / updated files:**

| File | Change |
| --- | --- |
| `apps/web/src/lib/token-migration.ts` | Added `Secure` cookie attribute on HTTPS; escaped regex special chars; documented HttpOnly limitation |
| `apps/web/src/lib/auth-store.ts` | Added `Secure` attribute to `setCookie` on HTTPS |
| `apps/web/src/lib/api-client.ts` | Added `Secure` attribute to cookie setter |
| `apps/web/src/lib/__tests__/token-migration.test.ts` | 20 vitest tests: localStorage, sessionStorage, cookie migration, Secure on HTTP vs HTTPS, HttpOnly limitation, SSR guard, JWT round-trip, conflicting keys |
| `apps/web/src/__tests__/middleware.test.ts` | 21 vitest tests: public/protected routes, new + legacy cookie, refresh token + legacy fallback, conflicting cookies, security headers, subpath protection |
| `apps/web/vitest.config.ts` | Vitest configuration (node environment, `@/*` alias) |
| `apps/web/package.json` | Added `"test": "vitest run"` and `"test:watch": "vitest"`; vitest@2 dev dependency |
| `apps/web/tsconfig.json` | Excluded test files and vitest.config.ts from tsc compilation |

**Security notes confirmed by tests:**
- `Secure` cookie attribute added automatically when `location.protocol === 'https:'`
- HttpOnly refresh token not migrated by JS — middleware fallback covers it
- Conflicting cookies: `doxera_token` always wins, no invalid fallback path exists

---

## Completed by Claude — 2026-11-04 (session 2)

### Token key migration (pdfforge_token → doxera_token)

Backward-compatible migration. Existing users are not logged out.

| File | Change |
| --- | --- |
| `apps/web/src/lib/token-migration.ts` | Created: one-time migration shim |
| `apps/web/src/lib/auth-store.ts` | Calls `migrateTokenKeys()` at module load; all keys → `doxera_*` |
| `apps/web/src/lib/api-client.ts` | `pdfforge_token` → `doxera_token` |
| `apps/web/src/middleware.ts` | Accepts both `doxera_token` and legacy `pdfforge_token` cookies |
| `apps/web/src/app/admin/page.tsx` | `pdfforge_token` → `doxera_token` |
| `apps/web/src/app/dashboard/page.tsx` | `pdfforge_token` → `doxera_token` |
| `apps/web/src/app/billing/page.tsx` | `pdfforge_token` → `doxera_token` |
| `apps/web/src/app/account/page.tsx` | Token + Google link state keys renamed |
| `apps/web/src/app/settings/page.tsx` | `pdfforge_token` → `doxera_token` |
| `apps/web/src/app/ai-studio/page.tsx` | `pdfforge_token` → `doxera_token` |
| `apps/web/src/app/tools/[slug]/page.tsx` | `pdfforge_token` → `doxera_token` |
| `apps/web/src/app/organizations/page.tsx` | `pdfforge_token` → `doxera_token` |
| `apps/web/src/app/pricing/page.tsx` | `pdfforge_token` → `doxera_token` |
| `apps/web/src/app/auth/callback/page.tsx` | Google link state key renamed |
| `apps/web/src/app/(auth)/login/page.tsx` | Placeholder client-ID guard renamed |
| `apps/web/src/app/(auth)/register/page.tsx` | Same placeholder guard rename |
| `apps/web/tsconfig.json` | Excluded `__tests__` from tsc compilation |

---

## Completed by Claude — 2026-11-04 (session 1)

### Doxera rebranding (Phase 1–3 frontend gaps)

| File | Change |
| --- | --- |
| `apps/web/src/app/(auth)/forgot-password/page.tsx` | Added dark mode |
| `apps/web/src/app/(auth)/reset-password/page.tsx` | Added dark mode |
| `apps/web/src/app/(auth)/verify-email/page.tsx` | Added dark mode |
| `apps/web/src/app/tools/[slug]/page.tsx` | Renamed download filename prefix |
| `apps/web/src/app/features/page.tsx` | Renamed comparison table data property |
| `apps/web/src/app/billing/page.tsx` | Wired storage quota meter to real auth store values |
| `cli/src/cli.ts` | Updated User-Agent and descriptions |
| `sdks/python/pdfforge/client.py` | Updated User-Agent |
| `sdks/python/pdfforge/async_client.py` | Updated User-Agent |
| `sdks/python/pdfforge/__init__.py` | Updated module docstring |

**Intentionally preserved:** `PDFForgeClient` / `AsyncPDFForgeClient` / `PDFForgeError` Python SDK class names (breaking change); `PDFForgeConfig` node SDK type; Helm chart names.

---

## Remaining manual steps

1. **Legacy middleware fallback removal**: After 30-day migration window post-deploy, remove `pdfforge_token` and `pdfforge_refresh_token` fallbacks from `middleware.ts`.
2. **`staging` branch creation**: Create `git checkout -b staging` from `main` and push (requires approval).
3. **Render Blueprint Auto Sync confirmation**: Verify it is off in the Render dashboard before submitting `render.staging.yaml`. **Release blocker.**
4. **Staging credentials**: Supply staging-only credentials for all `sync: false` fields per the operator checklist in `docs/STAGING_READINESS.md`.
5. **Google OAuth staging setup**: Create staging-only OAuth client; register callback URL after staging service is created.
6. **Razorpay staging**: Create test-mode key pair (`rzp_test_*`); register staging webhook; test captured payment, duplicate, bad signature, subscription update.
7. **Resend staging**: Create staging-only API key; verify sender domain; test registration and password-reset email delivery.
8. **Python SDK breaking rename**: Bump to 2.0.0, add `DoxeraClient` alias, re-publish.
9. **Helm chart rename** (`infrastructure/helm/pdfforge/`): Requires separate migration plan.
10. **GitHub repository rename**: Rename on GitHub → `git remote set-url origin <new-url>`.
11. **Domain / DNS / TLS**: Domain ownership, DNS propagation, TLS certificate, HTTPS redirects — requires owner approval.
12. **Production database adoption**: Backup, isolated restore, schema diff, migration adoption — requires separate approval.
13. **Hosted CI**: Has not run; requires an approved push.

## Deployment blockers

- No push, merge, deploy, DNS change or domain purchase authorized.
- Render Auto-Deploy and Blueprint Auto Sync are unverified; treat as release blockers.
- `staging` branch does not exist.
- Google Console OAuth, Resend delivery, Razorpay sandbox flows, and Render edge rate-limits unverified.
- Production database not inspected; adoption requires separate approval.
