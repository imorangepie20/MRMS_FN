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
