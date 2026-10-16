#!/usr/bin/env bash
set -e

echo "=========================================================="
echo " PDFForge AI - Enterprise Development Bootstrap (macOS/Linux)"
echo "=========================================================="

# 1. Check requirements
command -v node >/dev/null 2>&1 || { echo >&2 "Node.js required but not installed. Aborting."; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo >&2 "Python 3 required but not installed. Aborting."; exit 1; }

echo "✓ Node.js $(node -v) detected"
echo "✓ Python $(python3 --version) detected"

# 2. Setup API env
if [ ! -f "apps/api/.env" ]; then
    cp apps/api/.env.example apps/api/.env
    echo "→ Created apps/api/.env from template"
fi

# 3. Setup Worker venv
if [ ! -d "services/pdf-worker/.venv" ]; then
    python3 -m venv services/pdf-worker/.venv
    echo "→ Created Python virtual environment in services/pdf-worker/.venv"
fi

echo "=========================================================="
echo "Setup complete! Run entire stack with: docker-compose up --build"
echo "=========================================================="
