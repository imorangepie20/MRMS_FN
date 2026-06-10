"""Generic Setting key-value 헬퍼."""
from __future__ import annotations

import psycopg


def get_setting(conn: psycopg.Connection, key: str) -> str | None:
    with conn.cursor() as cur:
        cur.execute('SELECT value FROM "Setting" WHERE key = %s', (key,))
        row = cur.fetchone()
    return row[0] if row else None


def set_setting(conn: psycopg.Connection, key: str, value: str | None) -> None:
    with conn.cursor() as cur:
        if value is None:
            cur.execute('DELETE FROM "Setting" WHERE key = %s', (key,))
        else:
            cur.execute(
                '''INSERT INTO "Setting" (key, value, "updatedAt")
                   VALUES (%s, %s, NOW())
                   ON CONFLICT (key) DO UPDATE
                     SET value = EXCLUDED.value, "updatedAt" = NOW()''',
                (key, value),
            )
    conn.commit()


def list_settings(conn: psycopg.Connection, keys: list[str]) -> dict[str, str | None]:
    """Bulk get."""
    if not keys:
        return {}
    with conn.cursor() as cur:
        cur.execute('SELECT key, value FROM "Setting" WHERE key = ANY(%s)', (keys,))
        rows = cur.fetchall()
    found = {r[0]: r[1] for r in rows}
    return {k: found.get(k) for k in keys}
