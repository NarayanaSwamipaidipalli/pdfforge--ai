# Docker Compose setup

Compose reads deployment settings from an explicitly selected private environment file.
It does not recover credentials from an existing container or change database passwords.
The API starts without applying migrations; schema and bucket setup are separate, opt-in commands.

## Prepare configuration

For a new installation, copy `.env.example` to `.env.docker.local` and supply the PostgreSQL,
MinIO, JWT, refresh-token, and worker credentials. For an existing installation, use its
existing credentials. `.env.docker.local` is ignored by Git.

```powershell
node scripts/docker/prepare-env.mjs --env-file .env.docker.local
docker compose --env-file .env.docker.local config --quiet
```

The helper changes only `COMPOSE_DATABASE_URL` and an empty/missing `MINIO_IMAGE`. It encodes
the existing PostgreSQL password for a connection URL, including reserved characters such as
`@`, `:`, `/`, `#`, `%`, and `$`. It preserves `DATABASE_URL` for native tools and every existing
credential. Docker Compose itself resolves quoting and interpolation before the helper derives
the URL, so its parsing matches PostgreSQL's actual environment. Missing or startup-invalid
secrets produce setting names only; no new credentials are generated and no service is contacted.

The default MinIO reference is a digest of the image verified locally. An explicit `MINIO_IMAGE`
is retained. Dependency/security review of that image is a separate release requirement.

## Initialize a fresh installation

These commands are for a fresh installation whose database and volumes you own. They are
not required merely to validate configuration. Existing installations must review pending
migrations before invoking `migrate`; never use a reset to resolve connection failures.

```powershell
docker compose --env-file .env.docker.local --profile setup build
docker compose --env-file .env.docker.local up -d postgres redis minio
docker compose --env-file .env.docker.local --profile setup run migrate
docker compose --env-file .env.docker.local --profile setup run storage-init
docker compose --env-file .env.docker.local up -d api-gateway pdf-worker celery-worker web
```

`storage-init` waits for MinIO, creates only the configured bucket if absent, and leaves an
existing bucket and its objects intact. Authentication errors fail without replacing credentials.
The workers wait for Redis's existing healthcheck. PostgreSQL's healthcheck uses the configured
user and database name. All published development ports remain bound to loopback.

## Verify without using development services

```powershell
node --test scripts/docker/prepare-env.test.mjs
node scripts/docker/verify-compose.mjs --config-only
node scripts/docker/verify-compose.mjs
```

The full verification builds current API/worker images and uses a unique project, internal
network, synthetic credentials, fresh database, and separate volumes. It publishes no ports.
It verifies explicit migrations, repeated bucket setup, API/worker readiness, and unchanged
development-container IDs/start timestamps. Private logs and the resource manifest are retained
under `.remediation/`; there is no automatic cleanup.

## Startup diagnostics

| Symptom | Resolution |
| --- | --- |
| Required environment setting is missing | Populate the named setting in the selected private file, then rerun the helper. |
| Connection URL fails with a password containing reserved characters | Rerun the helper; it derives an encoded Docker URL while preserving the password. |
| PostgreSQL rejects credentials for an existing volume | Supply that database's original credentials. Changing initialization variables does not change existing users. |
| API reports missing tables on a fresh database | Run the explicit `migrate` setup command after reviewing its target. |
| Uploads report a missing storage bucket | Run the explicit `storage-init` setup command after reviewing its target. |
| Production secret validation fails | Coordinate a reviewed application-secret change with the authentication owner. The setup helper does not rotate credentials. |
