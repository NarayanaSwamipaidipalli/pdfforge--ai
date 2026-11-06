#!/usr/bin/env bash
# ==============================================================================
# PDFForge AI - Run the full stack locally WITHOUT Docker and WITHOUT VS Code.
#
# Requirements (native installs): Node.js 20+, Python 3.12+, PostgreSQL 16, Redis.
# Object storage: uses $S3_ENDPOINT if set, otherwise a local MinIO binary if on
# PATH, otherwise a `moto` S3-compatible mock server installed into .local/.
#
#   ./scripts/run-local.sh          # install deps (first run), start everything
#   ./scripts/run-local.sh stop     # stop everything started by this script
#
# Logs are written to .local/logs/, PIDs to .local/pids/.
# ==============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCAL="$ROOT/.local"
LOGS="$LOCAL/logs"
PIDS="$LOCAL/pids"
mkdir -p "$LOGS" "$PIDS"

stop_all() {
  for f in "$PIDS"/*.pid; do
    [ -f "$f" ] || continue
    pid="$(cat "$f")"
    # Each service runs in its own session/process group: kill the whole group
    # so child processes (next-server, nest's node process, ...) stop too.
    kill -TERM -- "-$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true
    echo "stopped $(basename "$f" .pid) ($pid)"
    rm -f "$f"
  done
}
if [ "${1:-}" = "stop" ]; then stop_all; exit 0; fi

need() { command -v "$1" >/dev/null 2>&1 || { echo "Missing required tool: $1" >&2; exit 1; }; }
need node; need npm; need python3; need psql; need redis-server

# ---- Dev configuration (local only; generated secrets persist in .local/dev.env)
if [ ! -f "$LOCAL/dev.env" ]; then
  rnd() { python3 -c 'import secrets; print(secrets.token_hex(32))'; }
  cat > "$LOCAL/dev.env" <<EOF
PG_PASSWORD=$(rnd | cut -c1-24)
JWT_SECRET=$(rnd)
JWT_REFRESH_SECRET=$(rnd)
WORKER_CALLBACK_SECRET=$(rnd)
EOF
fi
# shellcheck disable=SC1091
source "$LOCAL/dev.env"

export NODE_ENV=development ENVIRONMENT=development
export PORT=4000 FRONTEND_URL=http://localhost:3000 CORS_ORIGINS=http://localhost:3000
export DATABASE_URL="postgresql://pdfforge:${PG_PASSWORD}@localhost:5432/pdfforge_db?schema=public"
export REDIS_URL=redis://localhost:6379/0
export CELERY_BROKER_URL=redis://localhost:6379/0 CELERY_RESULT_BACKEND=redis://localhost:6379/1
export S3_ENDPOINT="${S3_ENDPOINT:-http://localhost:9000}" S3_PUBLIC_ENDPOINT="${S3_PUBLIC_ENDPOINT:-http://localhost:9000}"
export S3_BUCKET_NAME=pdfforge-documents S3_AUTO_CREATE_BUCKET=true AWS_REGION=us-east-1
export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-minioadmin}" AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-minioadmin}"
export PDF_WORKER_URL=http://localhost:8000 API_GATEWAY_INTERNAL_URL=http://localhost:4000
export JWT_SECRET JWT_REFRESH_SECRET WORKER_CALLBACK_SECRET
export PYTHONWARNINGS="ignore::FutureWarning:fitz"

wait_port() { # name port
  for _ in $(seq 1 120); do
    (echo >"/dev/tcp/127.0.0.1/$2") 2>/dev/null && { echo "  ✓ $1 listening on :$2"; return 0; }
    sleep 1
  done
  echo "  ✗ $1 did not open :$2 - see $LOGS/$1.log" >&2; return 1
}
start() { # name dir cmd...
  local name="$1" dir="$2"; shift 2
  (cd "$dir" && exec setsid "$@") </dev/null >"$LOGS/$name.log" 2>&1 &
  echo $! >"$PIDS/$name.pid"
}

echo "== PostgreSQL & Redis"
if ! pg_isready -q -h localhost; then
  (service postgresql start || sudo service postgresql start) >/dev/null 2>&1 || true
fi
pg_isready -q -h localhost || { echo "PostgreSQL is not running; start it and retry." >&2; exit 1; }
psql_admin() { if [ "$(id -u)" = 0 ]; then su postgres -c "psql -qtA -c \"$1\""; else sudo -u postgres psql -qtA -c "$1"; fi; }
if [ -z "$(psql_admin "SELECT 1 FROM pg_roles WHERE rolname='pdfforge'")" ]; then
  psql_admin "CREATE USER pdfforge WITH PASSWORD '${PG_PASSWORD}' CREATEDB;"
else
  psql_admin "ALTER USER pdfforge WITH PASSWORD '${PG_PASSWORD}';"
fi
[ -n "$(psql_admin "SELECT 1 FROM pg_database WHERE datname='pdfforge_db'")" ] || psql_admin "CREATE DATABASE pdfforge_db OWNER pdfforge;"
redis-cli ping >/dev/null 2>&1 || redis-server --daemonize yes >/dev/null
echo "  ✓ ready"

echo "== Dependencies (first run only)"
[ -d "$ROOT/apps/api/node_modules" ] || (cd "$ROOT/apps/api" && npm install --no-audit --no-fund)
[ -d "$ROOT/apps/web/node_modules" ] || (cd "$ROOT/apps/web" && npm install --no-audit --no-fund)
VENV="$ROOT/services/pdf-worker/.venv"
[ -x "$VENV/bin/uvicorn" ] || { python3 -m venv "$VENV" && "$VENV/bin/pip" install -q -r "$ROOT/services/pdf-worker/requirements.txt"; }

echo "== Database migrations"
(cd "$ROOT/apps/api" && npx prisma generate >/dev/null && npx prisma migrate deploy | tail -1)

echo "== Object storage"
if (echo >/dev/tcp/127.0.0.1/9000) 2>/dev/null; then
  echo "  ✓ something already listening on :9000"
elif command -v minio >/dev/null; then
  MINIO_ROOT_USER="$AWS_ACCESS_KEY_ID" MINIO_ROOT_PASSWORD="$AWS_SECRET_ACCESS_KEY" \
    start s3 "$LOCAL" minio server "$LOCAL/minio-data" --address :9000 --console-address :9001
  wait_port s3 9000
else
  [ -x "$LOCAL/s3venv/bin/moto_server" ] || { python3 -m venv "$LOCAL/s3venv" && "$LOCAL/s3venv/bin/pip" install -q "moto[server]"; }
  start s3 "$LOCAL" "$LOCAL/s3venv/bin/moto_server" -H 127.0.0.1 -p 9000
  wait_port s3 9000
fi

echo "== Services"
start pdf-worker "$ROOT/services/pdf-worker" "$VENV/bin/uvicorn" app.main:app --host 127.0.0.1 --port 8000
start celery "$ROOT/services/pdf-worker" "$VENV/bin/celery" -A app.celery_app.celery_app worker --loglevel=info --concurrency=2
start api "$ROOT/apps/api" npx nest start
start web "$ROOT/apps/web" npx next dev -p 3000
wait_port pdf-worker 8000
wait_port api 4000
wait_port web 3000

cat <<EOF

============================================================
  PDFForge AI is running (no Docker):
  - Web Application:   http://localhost:3000
  - API Swagger Docs:  http://localhost:4000/api/docs
  - Python Worker:     http://localhost:8000/health
  Logs: $LOGS     Stop: ./scripts/run-local.sh stop
============================================================
EOF
