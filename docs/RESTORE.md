# Doxera Restore Procedure

## PostgreSQL

1. Obtain explicit approval for recovery. Preserve the original database and active services.
2. Create a new isolated database from a verified backup or provider point-in-time recovery point.
3. Verify identity, schema history, users, subscriptions, payment totals and ownership on that copy.
4. Review pending migrations and schema adoption as described in [the Render runbook](PRODUCTION_DEPLOYMENT.md). Apply approved forward migrations to the copy only.
5. Validate authentication, billing records and a synthetic processing job against isolated services.
6. Plan any traffic pause and connection switch separately. Promote only after explicit approval; retain the original database for recovery.

Paid Render Postgres supports PITR according to the account's plan; confirm the actual window
and recovery points. An offsite encrypted logical backup destination and schedule still need
an owner decision. Test a restore before launch and at least quarterly. These are required
operator actions, not a claim that production backups are already configured.

The synthetic drill is `node scripts/remediation/backup.mjs .remediation/pipeline-<id>`
after a successful isolated pipeline run. It only accepts a labeled test project and a
synthetic pipeline database, restores to a new database, compares every public table's row
counts and contents, and checks the test source remains unchanged. It never uses a live URL,
resets a database, or removes resources. Its dump remains in ignored private local evidence.

## Redis

Redis is used for queues and transient job state. Enable AOF persistence and daily backups, or provision a managed Redis service with automatic snapshots. After provider recovery, restart workers and drain/requeue interrupted jobs.

## Object storage

Restore versioned or deleted objects from MinIO/site-replication snapshots. Verify object ownership, checksums, and lifecycle status before returning traffic to the API.
