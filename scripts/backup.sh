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
