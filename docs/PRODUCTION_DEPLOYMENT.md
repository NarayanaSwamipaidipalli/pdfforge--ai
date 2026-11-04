# Doxera: proposed Render production deployment

Prepared on 2026-11-04. No Render service, production secret, domain, DNS record or live
database was changed. `doxera.in` and `api.doxera.in` are proposed names only. Domain
ownership and trademark clearance require the owner's separate confirmation.
The repository and existing `pdfforge-*` service names, package names, JWT issuer/audience,
cookie/storage keys, database tables and environment variable names retain compatibility.

## Review before rollout

Review `render.yaml`, `.env.production.example`, the migration history and
[the verification report](security-remediation-report.md). The Blueprint was validated
against [Render's official schema](https://render.com/schema/render.yaml.json); that is
not an account-level deployment validation. Reconcile it with the existing Render resources
before applying it: do not create replacements for an existing database or rename resources.
Paid plan changes and all live actions require owner approval.

Keep deployment manual until migration and provider checks are complete. Blueprint creation,
sync and pushes can trigger deployment; this task authorizes none of them.
The API's pre-deploy command runs `prisma migrate deploy`; it must not run against an
unreviewed existing database. Existing-schema migration adoption is described below.

## Secrets and service connections

Use the Render dashboard/environment group or an approved secret manager. Never put values
in Git, build arguments, tickets, terminal output or client-side environment variables.
`sync: false` intentionally requires the operator to supply/reuse private values; it does
not rotate existing credentials. Production secrets were not generated or changed here.

| Setting | Operator action after approval |
| --- | --- |
| `DATABASE_URL` | Preserve the existing intended database; use Render's internal connection string. |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | Reuse independent strong existing secrets (at least 32 characters). Rotation logs users out and needs a separate plan. |
| `WORKER_CALLBACK_SECRET` | Supply the same strong value to API, FastAPI and Celery via `pdfforge-shared`. |
| Redis | Use the managed internal connection string for API and all Celery settings; keep external access disabled. |
| Storage | Reuse the bucket, region and narrowly scoped storage credentials. Confirm private objects, CORS, encryption and retention separately. |
| `RESEND_API_KEY`, `MAIL_FROM` | Supply a sending-scoped key and verified sender only after domain verification. |
| Google OAuth | Supply existing client settings and review approved origins/redirects. |
| Razorpay | Supply distinct API/webhook secrets and explicitly approved INR paise prices before enabling. |
| `SENTRY_DSN` | Optional owner-controlled monitoring destination; leave blank until approved. |

The frontend proxy reads `API_GATEWAY_INTERNAL_URL` or Render's `API_GATEWAY_HOSTPORT`
at runtime. The API uses `PDF_WORKER_HOSTPORT` and `API_GATEWAY_HOSTPORT` internally.
No frontend rebuild is required to change the API service address. Worker mutations and
callbacks still require the shared credential even on the private network.

## Domains, HTTPS and email

After ownership and rollout approval, add the proposed frontend/API domains to the intended
Render services. Copy the exact DNS values from Render; no registrar records or target IPs
are assumed in this repository. Verify the domains in Render and then check HTTPS, HTTP
redirects, certificate renewal, cross-origin requests and secure cookies. Render provisions
TLS and HTTP-to-HTTPS redirects after domain setup; those properties have not been tested
on these proposed domains. See [Render custom domains](https://render.com/docs/custom-domains).

The proposed frontend origin is `https://doxera.in`; the API origin is
`https://api.doxera.in`. `FRONTEND_URL`, `CORS_ORIGINS`, frontend metadata and the approved
Google origins must agree. Do not add arbitrary credentialed CORS origins.

Verify the sending domain with Resend using the DNS records it supplies. Review SPF, DKIM
and DMARC with the domain operator. Only then set, for example, `Doxera <noreply@doxera.in>`
as `MAIL_FROM`. Disable email click/open tracking for recovery links. Resend requires a
verified owned domain; no mailbox or domain has been provisioned. See
[Resend domain verification](https://resend.com/docs/dashboard/domains/introduction).
The adapter uses the fixed HTTPS [send-email API](https://resend.com/docs/api-reference/emails/send-email),
an idempotency key, a timeout, and no redirects. Tests simulate delivery, not a live inbox.

Password recovery returns 503 before account lookup when delivery is unconfigured.
Once configured, responses do not disclose account existence; failed delivery invalidates
the failed reset credential and emits only a generic warning. Verify successful delivery,
expired links and a single-use reset using a dedicated staging account before launch.

## Authentication and payment provider gates

Google settings must include the exact supported redirect flow:
`https://doxera.in/api/v1/auth/google/callback` (server redirect via same-origin proxy)
and `https://doxera.in/auth/callback` (frontend code exchange), plus the intended JavaScript
origin. Confirm the configured client type, consent screen and current application flow
in staging. Verify secure state cookies, one-time state, matching nonce, wrong client and
replay rejection. Automated tests verify real locally signed RSA tokens and PostgreSQL state
consumption; they do not prove Google Console configuration or a live OAuth exchange.
GitHub sign-in, email verification and incomplete TOTP are disabled rather than bypassed.

Razorpay remains disabled in the Blueprint. Before enabling it, review live/test mode,
the exact pricing entries and `https://api.doxera.in/api/v1/billing/webhook/razorpay`
against the controller route. Use a dedicated webhook secret. Test signed captured payments,
provider retry after a temporary failure, concurrent duplicates and refund/cancellation
policy in the provider sandbox. Test keys and arbitrary test tokens never authorize login.
Current new checkout is a single paid term, **not an automatic renewal mandate**.
Unreconciled legacy recurring charges return retryable 503 without consuming the event;
reconcile each provider subscription to trusted local terms before enabling that traffic.
Never reset billing tables or fabricate invoices to resolve reconciliation errors.

## Existing database adoption and preservation

Only isolated synthetic databases were tested. The live schema and backups were deliberately
not inspected. The verified matrix covers fresh, initial baseline, partial additive schema,
already-applied and fully adopted schema, incompatible types/indexes/duplicates, and auth
revocation adoption. Tests compare all original table contents before/after, run Prisma
schema diff and repeat deployment; incompatible schemas fail without changing records.

For the actual target, obtain approval, verify the database identity privately, take and
verify a recoverable provider backup, and restore it to a new isolated staging database.
Inspect `_prisma_migrations`, column types, defaults, constraints and indexes on that copy.
Use Prisma schema diff to determine which exact migrations are represented. `migrate resolve
--applied` only records history: use it only after proving that the corresponding full schema
already exists. Never mark a partially applied migration as applied to suppress an error.

The original initial migration is unchanged. The forward security migration adds
`users.googleId`, `users.provider`, `webhook_events`, trusted billing fields and related
constraints. The new authentication migration adds `users.tokenVersion` and `oauth_states`.
Preserve existing nonzero token versions. If an `oauth_states` table already exists, verify
the complete migration before adoption; do not rerun its CREATE TABLE blindly.
Resolve unexpected drift through a separately reviewed forward migration. Do not use
`db push`, `migrate reset`, destructive cleanup, seeds or manual record deletion.

## Backups and recovery

The Blueprint proposes paid Render Postgres and an internal-only network policy. Render
documents PITR for paid databases (3 days on Hobby, 7 days on Pro or higher), with recovery
into a new instance. Check the account's actual recovery window and earliest recovery point;
neither was configured or verified here. See [Render recovery](https://render.com/docs/postgresql-backups).

Choose an encrypted offsite logical backup destination, schedule, access owner and retention
period before launch. Do not silently reuse the document bucket or log connection strings.
Test an isolated restore before cutover; retain the original database and validate users,
payment totals, subscriptions and file ownership before any approved connection switch.
The automated synthetic `pg_dump`/`pg_restore` drill checks every public table's row count
and contents and proves its test source is unchanged; it does not verify live Render PITR.
See [restore procedure](RESTORE.md).

## Monitoring and remaining release checks

The Blueprint checks frontend `/login`, API `/api/v1/health` and worker `/health`.
Use `/api/v1/health/live` for liveness and `/api/v1/health/ready` for database readiness.
FastAPI health alone does not prove that Celery consumes jobs. Add a synthetic staging
conversion canary and alerts for repeated job failures, absent consumers, queue age,
database/storage failures, resource saturation, recovery delivery failures and billing
webhook retries. Proposed alert defaults: 3 failed health checks, >1% HTTP 5xx over 5 minutes,
oldest queued job >120 seconds, and any sustained webhook processing error. Tune against
actual workloads and assign an incident recipient before activation.

Sentry is optional and configured to disable default integrations and PII collection;
explicit errors strip request bodies, cookies, headers, query strings and user context.
Verify this in the chosen monitoring account using a synthetic error before enabling alerts.
No Sentry project, uptime monitor, alert route or backup destination was created here.
Admin telemetry contains historical placeholder capacity/queue/revenue fields and must not
be treated as an operational monitoring source.

The proxy strips untrusted forwarding headers; the backend currently rate-limits by its
socket peer. Validate per-client limits at the real Render edge before launch: proxy users
can otherwise share one rate-limit bucket. Do not enable unrestricted `trust proxy` or
accept arbitrary client-supplied forwarding headers as a workaround.

Local performance results are a bounded shared-host regression baseline, not Render sizing
or a production capacity guarantee. Verify approved load, concurrency, retention, email,
OAuth, payment sandbox, privacy/contact details, HTTPS and recovery in staging. Review
remaining low/moderate development dependency advisories. Production readiness remains
unconfirmed until these external gates and the rollout are explicitly approved and tested.
