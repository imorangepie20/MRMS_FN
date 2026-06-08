# Sub-project H: Production Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Important — manual phases**: Tasks 1-8 are local repo changes (subagent-doable, TDD where applicable). Tasks 9-12 are MANUAL — they require ssh to user's home server / Cloudflare Dashboard / Spotify Dashboard / browser actions that subagents cannot perform. For those tasks the implementer's job is to print clear runbooks + wait for user confirmation.

**Goal:** MRMS_FN을 home server에 stable HTTPS로 배포 — Cloudflare Tunnel systemd 서비스 + 3개 systemd unit + deploy.sh + 자동 백업. 이후 G의 Spotify e2e를 prod에서 검증.

**Architecture:** Local repo에 deploy/systemd/backup 스크립트 + 운영 매뉴얼 추가. 사용자가 home server에서 한 번 셋업 (Python/Node/Docker/cloudflared 설치, /opt/mrms clone, systemd 등록, Cloudflare Dashboard 라우팅). 이후 ssh trigger로 git pull + 빌드 + 재시작.

**Tech Stack:** Bash, systemd, Cloudflare Tunnel, Postgres (Docker), Ubuntu/Zorin OS, pnpm/Python venv.

**Spec:** [docs/superpowers/specs/2026-06-09-prod-deployment-design.md](../specs/2026-06-09-prod-deployment-design.md)

---

## 파일 구조

```
.env.production.example           # NEW — secrets 비운 prod env 템플릿
docs/
└── deployment.md                  # NEW — 운영 매뉴얼 (restart/log/deploy 등)

scripts/
├── deploy.sh                      # NEW — ssh trigger 메인 deploy
├── backup.sh                      # NEW — pg_dump rotation
├── catalog_dump_helper.sh         # NEW — local DB의 catalog 5개 테이블 dump
└── systemd/
    ├── mrms-api.service           # NEW — uvicorn unit 템플릿
    └── mrms-web.service           # NEW — pnpm start unit 템플릿

web/next.config.ts                 # MODIFY — output: 'standalone' 추가
```

의존성 순서:
```
Task 1 (migrations tracking 기반) → Task 2 (deploy.sh) → Task 3 (backup.sh)
  → Task 4 (systemd units) → Task 5 (catalog_dump_helper.sh)
  → Task 6 (.env.production.example) → Task 7 (next.config.ts standalone)
  → Task 8 (docs/deployment.md)
  ⇧ 이상은 subagent 작업
  ⇩ 이하는 사용자 manual 작업
Task 9 (server prep) → Task 10 (systemd + tunnel install)
  → Task 11 (first deploy + smoke) → Task 12 (G e2e + close)
```

---

## Task 1: Migration tracking 메커니즘

raw SQL 마이그레이션이 prod에서 두 번 적용되면 ALTER TABLE 에러. 추적 테이블 도입.

**Files:**
- 이 task는 `scripts/deploy.sh` 안의 마이그레이션 섹션 패턴만 정의. 실제 deploy.sh는 Task 2.
- Test: `tests/scripts/test_migration_tracker.sh` (간단 bash 테스트)

- [ ] **Step 1: 디렉토리 + helper 함수 분리**

`scripts/lib/migrations.sh` 작성 — deploy.sh가 source할 함수:

```bash
#!/bin/bash
# Migration tracking — apply only new migrations not yet recorded.
#
# 사용:
#   source scripts/lib/migrations.sh
#   apply_pending_migrations prisma/migrations

apply_pending_migrations() {
  local migrations_dir="$1"
  if [ -z "$migrations_dir" ]; then
    echo "ERROR: migrations_dir required" >&2
    return 1
  fi

  # Tracking table 생성 (idempotent)
  docker compose exec -T pg psql -U mrms -d mrms -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE IF NOT EXISTS _applied_migrations (
  name TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ DEFAULT now()
);
SQL

  for dir in "$migrations_dir"/*/; do
    [ -d "$dir" ] || continue
    local name
    name="$(basename "$dir")"
    local sql_file="${dir}migration.sql"
    [ -f "$sql_file" ] || continue

    local applied
    applied="$(docker compose exec -T pg psql -U mrms -d mrms -t -A -c \
      "SELECT COUNT(*) FROM _applied_migrations WHERE name = '${name}';" | tr -d '[:space:]')"

    if [ "$applied" = "0" ]; then
      echo "  applying $name"
      if docker compose exec -T pg psql -U mrms -d mrms -v ON_ERROR_STOP=1 < "$sql_file"; then
        docker compose exec -T pg psql -U mrms -d mrms -c \
          "INSERT INTO _applied_migrations (name) VALUES ('${name}');" > /dev/null
      else
        echo "  ✗ failed: $name" >&2
        return 1
      fi
    else
      echo "  skip $name (already applied)"
    fi
  done
}
```

- [ ] **Step 2: 간단 검증**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
bash -c 'source scripts/lib/migrations.sh && type apply_pending_migrations'
```

Expected: `apply_pending_migrations is a function`

- [ ] **Step 3: Commit**

```bash
mkdir -p scripts/lib
git add scripts/lib/migrations.sh
git commit -m "feat(scripts): migration tracking via _applied_migrations table"
```

---

## Task 2: scripts/deploy.sh

`/opt/mrms/scripts/deploy.sh`로 서버에서 실행될 메인 스크립트.

**Files:**
- Create: `scripts/deploy.sh`

- [ ] **Step 1: scripts/deploy.sh 작성**

```bash
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
cd web
pnpm install --frozen-lockfile
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
```

- [ ] **Step 2: 실행 권한 + shellcheck (선택)**

```bash
chmod +x scripts/deploy.sh
shellcheck scripts/deploy.sh 2>&1 | head -20 || true
```

shellcheck 없으면 skip 가능. critical 에러만 fix.

- [ ] **Step 3: Commit**

```bash
git add scripts/deploy.sh
git commit -m "feat(scripts): deploy.sh (git pull + venv + migrations + build + smoke)"
```

---

## Task 3: scripts/backup.sh

매일 02:00 pg_dump → 7일 rotation.

**Files:**
- Create: `scripts/backup.sh`

- [ ] **Step 1: backup.sh 작성**

```bash
#!/bin/bash
#
# pg_dump + 7-day rotation.
# Recommended cron entry (server, user=mrms):
#   0 2 * * * /opt/mrms/scripts/backup.sh > /var/log/mrms-backup.log 2>&1
#
set -euo pipefail
cd "$(dirname "$0")/.."

BACKUP_DIR="${MRMS_BACKUP_DIR:-/opt/mrms/backups}"
mkdir -p "$BACKUP_DIR"

ts="$(date -u +%Y%m%d_%H%M%S)"
out="${BACKUP_DIR}/mrms_${ts}.sql.gz"

echo "[backup] dumping to ${out}"
docker compose exec -T pg pg_dump -U mrms mrms | gzip > "$out"

# 7일 rotation
find "$BACKUP_DIR" -name "mrms_*.sql.gz" -mtime +7 -delete

ls -lh "$BACKUP_DIR" | tail -20
echo "[backup] done"
```

- [ ] **Step 2: 실행 권한**

```bash
chmod +x scripts/backup.sh
```

- [ ] **Step 3: Commit**

```bash
git add scripts/backup.sh
git commit -m "feat(scripts): backup.sh — pg_dump + 7-day rotation"
```

---

## Task 4: Systemd unit templates

서버 `/etc/systemd/system/` 에 복사할 템플릿.

**Files:**
- Create: `scripts/systemd/mrms-api.service`
- Create: `scripts/systemd/mrms-web.service`

- [ ] **Step 1: mrms-api.service 작성**

```ini
[Unit]
Description=MRMS_FN FastAPI backend
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=mrms
Group=mrms
WorkingDirectory=/opt/mrms
EnvironmentFile=/opt/mrms/.env.production
ExecStart=/opt/mrms/.venv/bin/uvicorn mrms.api.main:app --host 127.0.0.1 --port 8000
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

- [ ] **Step 2: mrms-web.service 작성**

```ini
[Unit]
Description=MRMS_FN Next.js frontend
After=mrms-api.service network.target

[Service]
Type=simple
User=mrms
Group=mrms
WorkingDirectory=/opt/mrms/web
EnvironmentFile=/opt/mrms/.env.production
ExecStart=/usr/bin/pnpm start --port 3500
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

- [ ] **Step 3: Commit**

```bash
mkdir -p scripts/systemd
git add scripts/systemd/mrms-api.service scripts/systemd/mrms-web.service
git commit -m "feat(systemd): mrms-api + mrms-web unit templates"
```

---

## Task 5: catalog_dump_helper.sh

local dev DB의 catalog 5개 테이블만 dump.

**Files:**
- Create: `scripts/catalog_dump_helper.sh`

- [ ] **Step 1: catalog_dump_helper.sh 작성**

```bash
#!/bin/bash
#
# Dump catalog tables (Track, Artist, Album, TrackPlatform, TrackEmbedding)
# from local dev DB for transfer to production server.
#
# Output: catalog_dump.sql (in current directory)
# Then: scp catalog_dump.sql user@home:/opt/mrms/
#       ssh user@home 'cd /opt/mrms && docker compose exec -T pg psql -U mrms -d mrms < catalog_dump.sql'
#
set -euo pipefail

OUT="${1:-catalog_dump.sql}"
HOST="${PG_HOST:-localhost}"
PORT="${PG_PORT:-5433}"
USER="${PG_USER:-mrms}"
DB="${PG_DB:-mrms}"

echo "[catalog] dumping to ${OUT}"
PGPASSWORD="${PG_PASSWORD:-mrms}" pg_dump \
  --host="$HOST" --port="$PORT" --username="$USER" \
  --table='"Artist"' \
  --table='"Album"' \
  --table='"Track"' \
  --table='"TrackPlatform"' \
  --table='"TrackEmbedding"' \
  --data-only \
  --column-inserts \
  --disable-triggers \
  "$DB" > "$OUT"

wc -l "$OUT"
echo "[catalog] done"
```

- [ ] **Step 2: 권한 + sanity (실행은 안 함)**

```bash
chmod +x scripts/catalog_dump_helper.sh
bash -n scripts/catalog_dump_helper.sh
```

Expected: no syntax error

- [ ] **Step 3: Commit**

```bash
git add scripts/catalog_dump_helper.sh
git commit -m "feat(scripts): catalog_dump_helper.sh (5-table data-only dump)"
```

---

## Task 6: .env.production.example

secrets 비운 prod 환경변수 템플릿.

**Files:**
- Create: `.env.production.example`

- [ ] **Step 1: .env.production.example 작성**

```bash
# MRMS_FN production environment.
# Copy to .env.production on server (chmod 600).

# --- Database ---
DATABASE_URL=postgresql://mrms:mrms@localhost:5433/mrms

# --- Tidal ---
TIDAL_CLIENT_ID=CHANGEME
TIDAL_CLIENT_SECRET=CHANGEME
TIDAL_REDIRECT_URI=https://mrms.approid.team/callback/tidal
TIDAL_SCOPES="r_usr w_usr w_sub"

# --- Spotify ---
SPOTIFY_CLIENT_ID=CHANGEME
SPOTIFY_CLIENT_SECRET=CHANGEME
SPOTIFY_REDIRECT_URI=https://mrms.approid.team/api/auth/spotify/callback

# --- Frontend (build-time vars) ---
# In prod we serve from same origin so /api works.
NEXT_PUBLIC_API_BASE=/api

# --- Optional override for deploy.sh smoke test domain ---
# MRMS_PROD_DOMAIN=https://mrms.approid.team
```

- [ ] **Step 2: .gitignore 확인 — .env.production은 ignore돼야 함**

```bash
grep -E "^\.env" .gitignore
```

기존에 `.env*`가 있어야 함 (`.env`, `.env.local`, `.env.bak* `등 자동 ignore). 만약 명시 안 됐으면 추가:

```bash
# 이미 .env / .env.bak* 가 있는지 확인 후, 없으면 추가
grep -q "^\.env\.production$" .gitignore || echo ".env.production" >> .gitignore
```

`.env.production.example`은 명시적으로 ignore하지 **않음** (커밋되어야 함).

- [ ] **Step 3: Commit**

```bash
git add .env.production.example .gitignore
git commit -m "feat: .env.production.example template"
```

---

## Task 7: web/next.config.ts standalone output

`pnpm start`가 가벼운 standalone 서버로 동작하도록.

**Files:**
- Modify: `web/next.config.ts`

- [ ] **Step 1: 현재 next.config.ts 확인**

```bash
cat "/Volumes/MacExtend 1/MRMS_FN/web/next.config.ts"
```

- [ ] **Step 2: output: 'standalone' 추가**

`web/next.config.ts`의 nextConfig 객체에 `output: "standalone"` 추가. 기존 rewrites/etc 보존.

예시 (현재 파일 구조에 맞춰 적용):

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // ... 기존 옵션 유지
};

export default nextConfig;
```

- [ ] **Step 3: 로컬 빌드 검증**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN/web"
pnpm build 2>&1 | tail -10
```

Expected: 빌드 성공. `.next/standalone/` 디렉토리 생성됨.

- [ ] **Step 4: Commit**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
git add web/next.config.ts
git commit -m "feat(web): standalone output for production"
```

---

## Task 8: docs/deployment.md 운영 매뉴얼

본인이 prod 서버 관리할 때 참고할 cheatsheet.

**Files:**
- Create: `docs/deployment.md`

- [ ] **Step 1: docs/deployment.md 작성**

```markdown
# MRMS_FN — Production Deployment & Operations

> 본인용 운영 매뉴얼. 서버 = home server (Ubuntu/Zorin). 도메인 = `mrms.approid.team` (Cloudflare Tunnel).

## 빠른 명령

### Deploy

로컬 laptop에서:

```bash
# 1. 코드 푸시
git push origin main

# 2. 서버에 deploy 트리거
ssh user@home '/opt/mrms/scripts/deploy.sh'
```

서버에서 직접도 가능:
```bash
ssh user@home
cd /opt/mrms
./scripts/deploy.sh
```

### 로그 보기

```bash
# Backend
sudo journalctl -u mrms-api -f

# Frontend
sudo journalctl -u mrms-web -f

# Tunnel
sudo journalctl -u cloudflared -f

# Postgres
cd /opt/mrms && docker compose logs -f pg
```

### 서비스 재시작 (deploy 없이)

```bash
sudo systemctl restart mrms-api
sudo systemctl restart mrms-web
sudo systemctl restart cloudflared
```

### 서비스 상태 확인

```bash
sudo systemctl status mrms-api mrms-web cloudflared
```

### Backup 수동 실행

```bash
/opt/mrms/scripts/backup.sh
ls -lh /opt/mrms/backups/
```

### DB 직접 접근

```bash
cd /opt/mrms
docker compose exec pg psql -U mrms -d mrms
```

## 트러블슈팅

### `/api/health` 응답 없음

```bash
# 1. uvicorn 살아있나?
sudo systemctl status mrms-api
sudo journalctl -u mrms-api -n 50

# 2. postgres OK?
cd /opt/mrms && docker compose ps
```

### Tunnel 안 됨

```bash
sudo systemctl status cloudflared
sudo journalctl -u cloudflared -n 50

# 재시작
sudo systemctl restart cloudflared
```

### Deploy 실패 (migration 에러)

```bash
# 어떤 마이그레이션까지 적용됐는지
cd /opt/mrms
docker compose exec -T pg psql -U mrms -d mrms -c \
  'SELECT name, applied_at FROM _applied_migrations ORDER BY applied_at DESC LIMIT 10;'

# 마이그레이션 SQL 직접 적용 (해당 디렉토리 식별 후)
docker compose exec -T pg psql -U mrms -d mrms < prisma/migrations/<dir>/migration.sql

# 적용 기록 수동 추가
docker compose exec -T pg psql -U mrms -d mrms -c \
  "INSERT INTO _applied_migrations (name) VALUES ('<migration_name>');"
```

### Disk 공간 부족 (백업 누적)

```bash
du -sh /opt/mrms/backups/
# 수동 정리 (7일 이상)
find /opt/mrms/backups/ -name "mrms_*.sql.gz" -mtime +7 -delete
```

## 서버 최초 셋업

[../docs/superpowers/plans/2026-06-09-prod-deployment.md](superpowers/plans/2026-06-09-prod-deployment.md) Task 9~12 참고.

## .env.production 키 회전

본인이 Tidal/Spotify Dashboard에서 secret rotate하면:

```bash
ssh user@home
sudo -u mrms vim /opt/mrms/.env.production
# 값 수정 후 저장
sudo systemctl restart mrms-api mrms-web
```
```

- [ ] **Step 2: Commit**

```bash
git add docs/deployment.md
git commit -m "docs: deployment.md operations manual"
```

---

## Task 9: [MANUAL] Server prep

> 이 태스크는 사용자가 home server에서 직접 실행. 구현 subagent는 명령을 출력하고 사용자 confirmation 대기.

- [ ] **Step 1: 시스템 사용자 + 디렉토리**

서버에서:

```bash
# mrms 사용자 생성
sudo adduser --system --group --shell /bin/bash --home /opt/mrms mrms

# /opt/mrms 권한
sudo mkdir -p /opt/mrms
sudo chown -R mrms:mrms /opt/mrms
```

- [ ] **Step 2: 필수 패키지 설치**

```bash
# Python 3.10+
sudo apt update
sudo apt install -y python3.10 python3.10-venv python3-pip

# Node 22 + pnpm (한 번에)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo corepack enable
sudo corepack prepare pnpm@latest --activate

# Docker (없으면)
sudo apt install -y docker.io docker-compose-plugin
sudo usermod -aG docker mrms

# Git
sudo apt install -y git curl

# cloudflared
wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb
```

검증:

```bash
python3 --version  # 3.10+
node --version     # 22.x
pnpm --version
docker --version
cloudflared --version
git --version
```

- [ ] **Step 3: Repo clone**

```bash
sudo -u mrms git clone https://github.com/imorangepie20/MRMS_FN.git /opt/mrms
# (실제 repo URL로 교체)
```

- [ ] **Step 4: .env.production 배치**

local laptop에서 dev `.env`를 베이스로 `.env.production` 만들고 (TIDAL_REDIRECT_URI / SPOTIFY_REDIRECT_URI 등 prod 도메인으로) — scp로 전송:

```bash
# laptop에서 — 본인이 손으로 secrets 채워서
scp .env.production user@home:/tmp/mrms-env-prod

# 서버에서
sudo mv /tmp/mrms-env-prod /opt/mrms/.env.production
sudo chown mrms:mrms /opt/mrms/.env.production
sudo chmod 600 /opt/mrms/.env.production
```

- [ ] **Step 5: Postgres 시작 + 초기 schema 적용**

```bash
sudo -u mrms bash -c 'cd /opt/mrms && docker compose up -d pg'
sleep 10

# 초기 schema (prisma/init/*.sql) 적용 — 한 번만
for f in /opt/mrms/prisma/init/*.sql; do
  sudo -u mrms bash -c "cd /opt/mrms && docker compose exec -T pg psql -U mrms -d mrms < '$f'"
done
```

- [ ] **Step 6: Catalog 데이터 마이그**

laptop에서:

```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
./scripts/catalog_dump_helper.sh catalog_dump.sql
wc -l catalog_dump.sql
scp catalog_dump.sql user@home:/tmp/
```

서버에서:

```bash
sudo -u mrms bash -c 'cd /opt/mrms && docker compose exec -T pg psql -U mrms -d mrms < /tmp/catalog_dump.sql'
rm /tmp/catalog_dump.sql
```

검증:

```bash
sudo -u mrms bash -c 'cd /opt/mrms && docker compose exec -T pg psql -U mrms -d mrms -c "SELECT (SELECT COUNT(*) FROM \"Track\") AS tracks, (SELECT COUNT(*) FROM \"TrackPlatform\") AS platforms, (SELECT COUNT(*) FROM \"TrackEmbedding\") AS embeddings;"'
```

Expected: tracks 165k+, platforms 160k+, embeddings 165k+ (laptop dev DB와 같은 카운트)

- [ ] **Step 7: 사용자 confirm**

서버 prep 끝났음을 사용자가 확인. 다음 task로.

---

## Task 10: [MANUAL] Systemd + Cloudflare Tunnel 설치

- [ ] **Step 1: Systemd unit 복사**

서버에서:

```bash
sudo cp /opt/mrms/scripts/systemd/mrms-api.service /etc/systemd/system/
sudo cp /opt/mrms/scripts/systemd/mrms-web.service /etc/systemd/system/
sudo systemctl daemon-reload
```

- [ ] **Step 2: 백엔드 venv 사전 생성 (첫 시작 전)**

```bash
sudo -u mrms bash <<'EOF'
cd /opt/mrms
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -e ".[dev]"
EOF
```

- [ ] **Step 3: 프론트엔드 사전 빌드**

```bash
sudo -u mrms bash <<'EOF'
cd /opt/mrms/web
pnpm install --frozen-lockfile
pnpm build
EOF
```

- [ ] **Step 4: sudoers — mrms가 systemctl restart 가능하게**

```bash
sudo visudo -f /etc/sudoers.d/mrms
```

내용:
```
mrms ALL=(ALL) NOPASSWD: /bin/systemctl restart mrms-api, /bin/systemctl restart mrms-web
```

- [ ] **Step 5: Systemd 서비스 시작 + 자동 시작 등록**

```bash
sudo systemctl enable --now mrms-api
sudo systemctl enable --now mrms-web
sudo systemctl status mrms-api mrms-web
```

Expected: 두 서비스 모두 `active (running)`. journalctl로 에러 없는지 확인.

- [ ] **Step 6: Cloudflare Tunnel 설치 (systemd service)**

본인이 가지고 있는 token으로:

```bash
sudo cloudflared service install <YOUR_TUNNEL_TOKEN>
sudo systemctl status cloudflared
```

- [ ] **Step 7: Cloudflare Dashboard 라우팅 확인**

브라우저 → https://one.dash.cloudflare.com → Networks → Tunnels → `mrms` → **Public Hostname** 탭:

| Subdomain | Domain | Path | Service |
|---|---|---|---|
| mrms | approid.team | api/.* | http://localhost:8000 |
| mrms | approid.team | (비움) | http://localhost:3500 |

(이미 있으면 OK. 없으면 추가)

- [ ] **Step 8: 외부 검증**

laptop에서:

```bash
curl -fsS https://mrms.approid.team/api/health
curl -fsS -o /dev/null -w "%{http_code}\n" https://mrms.approid.team/
```

Expected: `{"status":"ok"}`, `307` or `200`

- [ ] **Step 9: ssh key 등록 (deploy.sh 비밀번호 없이 trigger용)**

laptop에서 본인 ssh public key를 home server에 등록:

```bash
ssh-copy-id user@home
# (이미 했으면 skip)
```

검증: `ssh user@home 'echo OK'` — 비밀번호 없이 OK 나오면 성공

---

## Task 11: [MANUAL] 첫 deploy + smoke test

- [ ] **Step 1: laptop에서 deploy 트리거**

```bash
ssh user@home 'sudo -u mrms /opt/mrms/scripts/deploy.sh'
```

기대 출력:
```
=== MRMS_FN deploy starting at ... ===
[1/6] git pull...
[2/6] python venv + backend deps...
[3/6] DB migrations...
  applying 20260608121106_add_auth_session
  applying 20260608135912_add_primary_platform
[4/6] frontend install + build...
[5/6] restart systemd services...
[6/6] smoke test...
✓ deployed at ...
```

실패 시 — 로그 확인:

```bash
ssh user@home 'sudo journalctl -u mrms-api -n 50 --no-pager'
ssh user@home 'sudo journalctl -u mrms-web -n 50 --no-pager'
```

- [ ] **Step 2: Cron 백업 등록**

서버에서:

```bash
sudo crontab -u mrms -e
```

추가:
```
0 2 * * * /opt/mrms/scripts/backup.sh > /var/log/mrms-backup.log 2>&1
```

검증 (수동 1회 실행):
```bash
sudo -u mrms /opt/mrms/scripts/backup.sh
ls -lh /opt/mrms/backups/
```

- [ ] **Step 3: 외부 검증 한 번 더**

```bash
curl -fsS https://mrms.approid.team/api/health
```

Expected: `{"status":"ok"}`

---

## Task 12: [MANUAL] G prod e2e + close

> 본 task로 G sub-project도 마무리됨.

- [ ] **Step 1: G branch를 prod 서버에 적용**

deploy.sh는 `origin main`을 가져오므로 G branch를 main에 머지해야 함:

```bash
# laptop에서
cd "/Volumes/MacExtend 1/MRMS_FN"
git checkout main
git merge feature/spotify-login --no-ff -m "merge: G sub-project (Spotify alternative login)"
git log --oneline -3
```

main에 H 작업 + G 머지 둘 다 들어감. 다시 deploy:

```bash
ssh user@home 'sudo -u mrms /opt/mrms/scripts/deploy.sh'
```

- [ ] **Step 2: Spotify Dashboard에 prod redirect URI 등록**

https://developer.spotify.com/dashboard → 본인 앱 → Settings → Redirect URIs에 다음 추가 + Save:

```
https://mrms.approid.team/api/auth/spotify/callback
```

- [ ] **Step 3: 브라우저 시크릿 창 — Spotify flow 검증**

`https://mrms.approid.team/login`

체크리스트:

- [ ] /login에 두 버튼 (Tidal + Spotify)
- [ ] **Spotify 클릭** → spotify.com authorize 페이지 → 동의
- [ ] /onboarding 자동 이동
- [ ] 진행 메시지: "Spotify 좋아요..." → "플레이리스트..." → "임베딩..." → "추천..."
- [ ] 완료 → /mrt 자동 이동
- [ ] /mrt 페르소나 카드 + 추천 트랙 보임
- [ ] Spotify Premium이면 ▶ → 풀 곡 재생
- [ ] Free면 "Spotify Premium 필요" 메시지

- [ ] **Step 4: 회귀 — 기존 Tidal 사용자도 OK인지**

새 시크릿 창 → /login → Tidal 흐름:

- [ ] Tidal Modal + user_code 표시
- [ ] visibilitychange 후 자동 인식
- [ ] /onboarding → /mrt
- [ ] Tidal 풀 곡 재생 (proxy)

- [ ] **Step 5: laptop dev 환경 정리**

prod에서 다 동작하면 dev tunnel/laptop은 코드 작성만:

```bash
# laptop의 .env에 SPOTIFY_REDIRECT_URI를 dev 임시 값에서 prod로 복원
sed -i.bak 's|^SPOTIFY_REDIRECT_URI=.*|SPOTIFY_REDIRECT_URI=https://mrms.approid.team/api/auth/spotify/callback|' .env
```

(dev 환경 .env는 commit 안 됨 — 본인 기록용)

- [ ] **Step 6: H + G 마무리**

```bash
git status   # working tree clean
git log --oneline main..HEAD   # 빈 출력 — main이 최신
```

H/G 두 sub-project 완료. G branch 삭제:

```bash
git branch -d feature/spotify-login
```

---

## Self-Review

**Spec coverage**:
- ✅ Section 3 (Architecture) → Task 1-11 전체
- ✅ Section 4.1 (cloudflared systemd) → Task 10 Step 6
- ✅ Section 4.2 (3 systemd) → Task 4 (templates), Task 10 (등록)
- ✅ Section 4.3 (deploy.sh) → Task 2
- ✅ Section 4.4 (.env.production) → Task 6, Task 9 Step 4
- ✅ Section 4.5 (catalog 마이그) → Task 5 (helper), Task 9 Step 6
- ✅ Section 4.6 (backup) → Task 3 (script), Task 11 Step 2 (cron)
- ✅ Section 5 (Error handling) → deploy.sh `set -euo pipefail` + systemd Restart
- ✅ Section 6 (Observability) → docs/deployment.md (Task 8)
- ✅ Section 7 (Testing — smoke) → deploy.sh 마지막, Task 11
- ✅ Section 7.2 (G e2e) → Task 12
- ✅ Section 8 (Migration paths) → Task 9-11에 단계별
- ✅ Section 9 (File Changes) → Task 1-8에 분산

**Placeholders check**:
- "(실제 repo URL로 교체)" in Task 9 Step 3 — 본인이 자기 GitHub repo URL 넣음. 명시적으로 사용자 입력이 필요한 부분.
- "<YOUR_TUNNEL_TOKEN>" in Task 10 Step 6 — 본인 token. 명시적 사용자 입력.
- 그 외 코드 블록은 모두 작성 가능 형태.

**Type consistency**:
- 모든 스크립트 경로 `/opt/mrms/scripts/<name>.sh` 형태로 통일
- systemd 사용자 `mrms` 일관
- DB 컨테이너 호출 `docker compose exec -T pg psql -U mrms -d mrms` 일관
- Backup 디렉토리 `/opt/mrms/backups/` 일관

**Risks** (subagent 실행 시 주의):
- Tasks 9-12는 본인이 직접 home server에서 수행해야 함. subagent 실행 모드는 명령을 출력 + 사용자 확인 대기.
- Task 11 첫 deploy에서 migration이 두 번째 실행될 수 있음 (Task 9 Step 5에서 prisma/init 적용 후, Task 11 deploy.sh이 prisma/migrations 적용). `_applied_migrations` tracking + idempotent로 안전.
- Task 12 G merge 시 main과 G 브랜치 사이 conflict 가능성 — H 작업이 main에서 진행됐고 G는 별도 브랜치라 큰 conflict 없을 듯. 발생 시 수동 해결.
