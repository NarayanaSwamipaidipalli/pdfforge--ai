# Security remediation report

Status: implementation and isolated verification in progress. Production readiness is not established.

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

1. Isolation and baseline: in progress.
2. Authentication: in progress.
3. Migration repair: in progress.
4. Billing integrity: in progress.
5. Worker access and LibreOffice: in progress.
6. Production configuration, builds, runtime proxy, Render: in progress.
7. CI, integration tests, final evidence: pending.

## Remaining release gates

Record exact test commands, counts, build results, conversion evidence, dependency findings,
and external-provider limitations below before drawing release conclusions.

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
