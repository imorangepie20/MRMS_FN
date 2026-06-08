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

[superpowers/plans/2026-06-09-prod-deployment.md](superpowers/plans/2026-06-09-prod-deployment.md) Task 9~12 참고.

## .env.production 키 회전

본인이 Tidal/Spotify Dashboard에서 secret rotate하면:

```bash
ssh user@home
sudo -u mrms vim /opt/mrms/.env.production
# 값 수정 후 저장
sudo systemctl restart mrms-api mrms-web
```
