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
