# Sub-project H: Production Deployment (Design)

**날짜**: 2026-06-09
**상태**: 디자인 (사용자 승인 완료)
**범위**: MRMS_FN을 home server에 안정적으로 배포. Cloudflare Tunnel을 systemd 서비스로 영구화 → OAuth/SDK 같은 production-shaped 기능이 dev 환경 hack 없이 동작.

## 1. Goal + 사용자 의도

현재 OAuth 검증이 매번 막힘 — Cloudflare Tunnel을 dev laptop에서 재생성하니까 깨지고, dev 환경 자체가 fragile. 본인이 정확히 짚음: **"개발오류를 개발해서 잡네"**.

H의 목표: production-shaped 기능 (OAuth/SDK)을 prod에서 검증 가능하게 만들기. 이후 G 같은 sub-project가 dev tunnel 재생성 굴레 없이 검증 가능.

부가 효과: G의 Spotify 검증을 prod에서 마무리. 향후 sub-project도 prod 우선 검증 가능.

## 2. Success Criteria

- [ ] `mrms.approid.team`이 home server에서 365일/24시간 응답
- [ ] Cloudflare Tunnel이 죽지 않음 (systemd 자동 복구)
- [ ] `git push` + 1줄 ssh 명령으로 prod 배포
- [ ] Tidal + Spotify OAuth callback이 stable HTTPS URL로 동작
- [ ] my-forever-music과 포트/도메인 충돌 없음
- [ ] postgres 데이터 매일 자동 백업 (7일 rotation)
- [ ] Backend/Frontend 시작 실패 시 systemd 자동 재시작

## 3. Architecture

```
[Home Server — Ubuntu/Zorin, RTX 2060, 24GB, 1TB]
├── Cloudflare Tunnel (systemd 서비스 — 24/7 stable)
│   ├── mrms.approid.team (Public Hostname routing — Dashboard)
│   │   ├── path /api/.*  → http://localhost:8000  (FastAPI)
│   │   └── catch-all     → http://localhost:3500  (Next.js prod)
│   └── (my-forever-music 기존 라우트 그대로 보존 — 다른 hostname)
│
├── /opt/mrms (MRMS_FN deployment)
│   ├── docker-compose: postgres on :5433
│   ├── Python venv + uvicorn (systemd: mrms-api)
│   ├── Next.js production build + pnpm start (systemd: mrms-web)
│   └── .env.production (secrets)
│
├── /opt/mrms/backups (pg_dump rotation)
│   └── 매일 02:00, 7일치 유지
│
└── my-forever-music (기존 그대로, 다른 포트, 다른 subdomain)
```

## 4. Components

### 4.1 Cloudflare Tunnel as systemd service

`cloudflared service install <token>` 한 번 실행:
- `/etc/systemd/system/cloudflared.service` 자동 생성
- 부팅 시 자동 시작
- 죽으면 자동 재시작 (systemd Restart=on-failure)
- Public Hostname routing은 Cloudflare Dashboard에서 관리 (코드 X)

### 4.2 Systemd services 3개

```ini
# /etc/systemd/system/mrms-api.service
[Unit]
Description=MRMS_FN FastAPI backend
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=mrms
WorkingDirectory=/opt/mrms
EnvironmentFile=/opt/mrms/.env.production
ExecStart=/opt/mrms/.venv/bin/uvicorn mrms.api.main:app --host 127.0.0.1 --port 8000
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```ini
# /etc/systemd/system/mrms-web.service
[Unit]
Description=MRMS_FN Next.js frontend
After=mrms-api.service

[Service]
Type=simple
User=mrms
WorkingDirectory=/opt/mrms/web
EnvironmentFile=/opt/mrms/.env.production
ExecStart=/usr/bin/pnpm start --port 3500
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```yaml
# docker-compose.yml 변경 없이 그대로 — 기존 postgres on :5433
```

### 4.3 Deploy script

`/opt/mrms/scripts/deploy.sh`:

```bash
#!/bin/bash
set -e
cd /opt/mrms

echo "[1/6] git pull..."
git pull origin main

echo "[2/6] backend deps..."
source .venv/bin/activate
pip install -e ".[dev]" --quiet

echo "[3/6] DB migrations (raw SQL)..."
# 신규 prisma/migrations/ 디렉토리 중 미적용 migration_lock 비교 후 적용
# 또는 그냥 새 *.sql 파일들 한 번씩 더 돌려도 멱등성 보장된다면 OK
# 현재 raw SQL 패턴: ALTER TABLE IF NOT EXISTS 등 멱등성 SQL 권장
for sql in prisma/migrations/*/migration.sql; do
  echo "  applying $sql"
  docker compose exec -T pg psql -U mrms -d mrms < "$sql" || true
done

echo "[4/6] frontend build..."
cd web
pnpm install --frozen-lockfile
pnpm build
cd ..

echo "[5/6] restart services..."
sudo systemctl restart mrms-api
sudo systemctl restart mrms-web
sleep 5

echo "[6/6] smoke test..."
curl -fs https://mrms.approid.team/api/health | grep -q '"status":"ok"'
curl -fs -o /dev/null https://mrms.approid.team/
echo "✓ deployed"
```

로컬 laptop에서 `ssh user@home '/opt/mrms/scripts/deploy.sh'`로 trigger.

> **마이그레이션 멱등성 메모**: 현재 G의 raw SQL 마이그레이션 (`ALTER TABLE ADD COLUMN`)은 idempotent 아님. 본 sub-project에서 신규 마이그레이션을 `IF NOT EXISTS` 패턴으로 작성. 기존 F/G 마이그레이션은 첫 deploy 시 한 번만 적용 (이후 `|| true`로 swallow).

### 4.4 환경 분리

```
.env              # dev (laptop) — git ignored
.env.production   # prod (home server) — git ignored, 서버에 수동 배치
```

`.env.production` 핵심:
```bash
DATABASE_URL=postgresql://mrms:mrms@localhost:5433/mrms
DEFAULT_USER_EMAIL=  # 빈 값 또는 제거 (multi-user via session)

TIDAL_CLIENT_ID=fX2JxdmntZWK0ixT
TIDAL_CLIENT_SECRET=...
TIDAL_REDIRECT_URI=https://mrms.approid.team/callback/tidal
TIDAL_SCOPES="r_usr w_usr w_sub"

SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
SPOTIFY_REDIRECT_URI=https://mrms.approid.team/api/auth/spotify/callback

NEXT_PUBLIC_API_BASE=/api   # same-origin (mrms.approid.team) — Next.js rewrites 불필요
```

Frontend build-time 변수 (`NEXT_PUBLIC_*`)는 `.env.production`을 `web/.env.production.local`로 심볼릭 링크 또는 build 직전 cp.

### 4.5 데이터 마이그레이션 — 카탈로그만

```bash
# laptop에서 (한 번)
pg_dump --table='"Track"' --table='"Artist"' --table='"Album"' \
        --table='"TrackPlatform"' --table='"TrackEmbedding"' \
        --data-only --column-inserts \
        -h localhost -p 5433 -U mrms mrms > catalog_dump.sql

# 서버로 전송 + 적용
scp catalog_dump.sql user@home:/opt/mrms/
ssh user@home 'docker compose exec -T pg psql -U mrms -d mrms < /opt/mrms/catalog_dump.sql'
```

User 관련 테이블 (User, UserOAuth, UserTrack, UserEmbedding, UserPersona, AuthSession, PlaylistHistory)은 prod에서 새로 — 본인이 prod에서 가입하면 신규 사용자.

### 4.6 Backup

```bash
# /opt/mrms/scripts/backup.sh
#!/bin/bash
set -e
BACKUP_DIR=/opt/mrms/backups
mkdir -p "$BACKUP_DIR"
ts=$(date +%Y%m%d_%H%M%S)
docker compose exec -T pg pg_dump -U mrms mrms | gzip > "$BACKUP_DIR/mrms_${ts}.sql.gz"
# 7일치 rotation
find "$BACKUP_DIR" -name "mrms_*.sql.gz" -mtime +7 -delete
```

systemd timer 또는 cron:
```
# crontab -u mrms -e
0 2 * * * /opt/mrms/scripts/backup.sh > /var/log/mrms-backup.log 2>&1
```

## 5. Error Handling

| 상황 | 처리 |
|---|---|
| git pull 실패 (conflict, 권한 등) | deploy.sh `set -e` → 즉시 중단. ssh 비0 종료 → 로컬에서 알 수 있음 |
| 백엔드 시작 실패 (포트 충돌, DB 안 됨, env 누락) | systemd `Restart=on-failure` 3회 후 fail. `journalctl -u mrms-api -n 100` |
| Frontend 빌드 실패 | `pnpm build` 비0 → 스크립트 중단, 이전 빌드 그대로 유지 (auto rollback) |
| Migration SQL 실패 | 멱등성 SQL (IF NOT EXISTS 등) 권장. 실패 시 `|| true`로 다음 마이그레이션 진행 — 단순화. 별도 alembic 도입은 H+1로 |
| Cloudflared 연결 손실 | systemd 자동 재시작. tunnel 자체 reconnect |
| Postgres 컨테이너 중단 | docker compose `restart: unless-stopped` → 자동 부활 |
| Disk full (backup 누적) | rotation 7일치 + alert는 OOS (size monitoring 추후) |

## 6. Observability

| 도구 | 역할 |
|---|---|
| `journalctl -u mrms-api -f` | FastAPI 실시간 로그 |
| `journalctl -u mrms-web -f` | Next.js 실시간 로그 |
| `journalctl -u cloudflared -f` | Tunnel 로그 |
| `docker compose logs -f pg` | Postgres |
| `/api/health` | 외부 헬스 체크 (Cloudflare Web Analytics에 monitor 추가 가능) |
| `htop`/`btop` | 시스템 리소스 |

Sentry/Grafana는 OOS. 트래픽 늘거나 자주 깨지면 그때 추가.

## 7. Testing

### 7.1 Deploy smoke test

`deploy.sh` 마지막 단계에 자동:
- `/api/health` HTTP 200 + `"status":"ok"` 포함
- `/` HTTP 200 (또는 307 redirect)

### 7.2 OAuth e2e (G 검증)

deploy 후 본인 브라우저:
- 시크릿 창 → `https://mrms.approid.team/login`
- Tidal 흐름 한 사이클
- Spotify 흐름 한 사이클 (G에서 미검증)

### 7.3 회귀

전체 백엔드 test는 laptop dev DB에서 실행 (CI 없으므로 수동). prod 서버에 별도 pytest 환경 X.

## 8. Migration 경로

### Step 1: 본인 home server 사전 작업

- `mrms` 시스템 사용자 생성 + sudoers (systemctl restart 권한)
- `git clone https://github.com/.../MRMS_FN /opt/mrms`
- Python 3.10+ + Node 22 + pnpm + Docker + cloudflared 설치
- `.env.production` 수동 배치
- catalog_dump.sql 전송 + DB 적용

### Step 2: Systemd services + Cloudflare Tunnel 설치

- `sudo cloudflared service install <token>`
- `/etc/systemd/system/mrms-{api,web}.service` 작성
- `sudo systemctl enable --now mrms-api mrms-web cloudflared`

### Step 3: Cloudflare Dashboard 라우팅

- Public Hostname: `mrms.approid.team`
  - path `api/.*` → `http://localhost:8000`
  - catch-all → `http://localhost:3500`

### Step 4: 첫 deploy

- 로컬에서 `git push origin main`
- `ssh user@home '/opt/mrms/deploy.sh'`
- smoke test 통과 확인

### Step 5: G e2e 검증

- 시크릿 창 → /login → Spotify 흐름 한 번 → 본 sub-project 완료

## 9. File Changes (local repo)

| File | 변경 |
|---|---|
| `.env.production.example` (신규) | prod env 템플릿 (secrets 비움) |
| `docs/deployment.md` (신규) | 본인용 운영 매뉴얼 — restart, log 보기, deploy 실행 등 |
| `scripts/deploy.sh` (신규) | 서버에서 실행되는 deploy 스크립트 |
| `scripts/backup.sh` (신규) | postgres pg_dump rotation |
| `scripts/systemd/mrms-api.service` (신규) | unit file 템플릿 |
| `scripts/systemd/mrms-web.service` (신규) | unit file 템플릿 |
| `scripts/catalog_dump_helper.sh` (신규) | catalog 5개 테이블 dump 명령 |
| `web/next.config.ts` | output: 'standalone' 추가 (pnpm start 최적화) |

기존 코드 (FastAPI / Next.js / 비즈니스 로직) 변경 없음.

## 10. Out of Scope

- **GitHub Actions auto-deploy CI/CD** — 수동 deploy.sh로 시작. 빈도 늘면 자동화
- **Staging 환경** — prod 단일
- **Load balancing / multi-region** — single instance
- **CDN** — Next.js standalone build로 충분
- **Sentry/Datadog/Grafana** — journalctl로 충분
- **Email/Slack 배포 알림** — 본인이 수동 확인
- **Blue-green deployment** — `systemctl restart` 5초 다운타임 허용
- **Docker로 모든 것 컨테이너화** — Python/Node systemd로 직접. Docker는 postgres만
- **HTTPS cert 직접 관리** — Cloudflare가 처리 (tunnel TLS termination)
- **DDoS/rate limit** — Cloudflare proxy 자동

## 11. Follow-up

- **H+1**: GitHub Actions로 deploy 자동화 (push → 자동 ssh deploy)
- **H+2**: Sentry 같은 error tracking
- **H+3**: 사용량 분석 (몇 명이 회원가입? 어디서 이탈?)
- **G**: 본 sub-project 끝나면 prod에서 Spotify e2e 검증 후 G 머지

## 12. Risks

- **Home server 다운** — 인터넷/전기 끊김 시 서비스 중단. UPS/이중화는 OOS (개인 프로젝트 수준)
- **Cloudflare Tunnel 서비스 자체 장애** — 자주는 아니지만 가능
- **Catalog dump SQL 적용 실패** — FK constraint 순서 등. `pg_dump --data-only --column-inserts`로 INSERT 순서 보장 + helper script로 검증
- **Deploy 중 다운타임 ~10초** — `systemctl restart` 시. 허용
- **서버에 secrets 노출** — `.env.production` 권한 600 + mrms 사용자만 읽기
