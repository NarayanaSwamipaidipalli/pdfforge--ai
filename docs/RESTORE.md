# PDFForge AI Restore Procedure

## PostgreSQL

1. Stop API and worker deployments.
2. Create a fresh database from the latest provider-managed snapshot or point-in-time recovery point.
3. Verify the recovered database with a read-only application account.
4. Run `cd apps/api && npx prisma migrate deploy` against the recovered database.
5. Start the API and validate authentication, billing records, and a non-destructive processing job.
6. Promote the recovered database only after application health checks pass.

Maintain encrypted daily snapshots with point-in-time recovery. Test a restore at least quarterly.

## Redis

Redis is used for queues and transient job state. Enable AOF persistence and daily backups, or provision a managed Redis service with automatic snapshots. After provider recovery, restart workers and drain/requeue interrupted jobs.

## Object storage

Restore versioned or deleted objects from MinIO/site-replication snapshots. Verify object ownership, checksums, and lifecycle status before returning traffic to the API.
