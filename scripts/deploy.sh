#!/bin/bash
#
# MRMS_FN production deploy script.
# Run on home server (or via: ssh user@home '/opt/mrms/scripts/deploy.sh').
#
set -euo pipefail
cd "$(dirname "$0")/.."   # /opt/mrms 기준
ROOT="$(pwd)"

echo "=== MRMS_FN deploy starting at $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
echo "Working directory: $ROOT"

echo "[1/6] git pull..."
git fetch origin main
git reset --hard origin/main

echo "[2/6] python venv + backend deps..."
if [ ! -d .venv ]; then
  python3 -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate
pip install --quiet --upgrade pip
pip install --quiet -e ".[dev]"

echo "[3/6] DB migrations..."
# shellcheck disable=SC1091
source scripts/lib/migrations.sh
apply_pending_migrations prisma/migrations

echo "[4/6] frontend install + build..."
# Next.js는 web/ 안의 .env.production을 build-time에 읽음.
# /opt/mrms/.env.production을 web/.env.production.local로 심볼릭링크 (없으면 생성).
ln -sfn "$ROOT/.env.production" web/.env.production.local
cd web
pnpm install --frozen-lockfile --config.strict-dep-builds=false
pnpm build
cd "$ROOT"

echo "[5/6] restart systemd services..."
sudo systemctl restart mrms-api
sudo systemctl restart mrms-web
sleep 5

echo "[6/6] smoke test..."
DOMAIN="${MRMS_PROD_DOMAIN:-https://mrms.approid.team}"
if ! curl -fsS "${DOMAIN}/api/health" | grep -q '"status":"ok"'; then
  echo "✗ /api/health failed" >&2
  sudo journalctl -u mrms-api -n 30 --no-pager >&2
  exit 1
fi
if ! curl -fsS -o /dev/null "${DOMAIN}/"; then
  echo "✗ / failed" >&2
  sudo journalctl -u mrms-web -n 30 --no-pager >&2
  exit 1
fi
echo "✓ deployed at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
