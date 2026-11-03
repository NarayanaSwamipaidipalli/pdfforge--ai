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
