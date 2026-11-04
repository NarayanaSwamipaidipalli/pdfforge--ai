# PDFForge AI — Shared AI Development Checkpoint

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

## Active work and blockers

- Codex: assigned Compose task complete; live-stack changes await explicit approval and a
  private environment file containing the existing credentials.
- Claude: continue assigned authentication, billing and frontend tasks after confirming ownership.
- Earlier security remediation phases are not certified complete by the Compose tests.

## Next task

Confirm the next owner's assignment before further changes. Use `docs/DOCKER_COMPOSE_SETUP.md`
for deployment configuration; do not reset a database or rotate credentials to resolve startup.

## Handoff rules

After each task, record the task, changed files, tests/results, blockers and next task briefly.
