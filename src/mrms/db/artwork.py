"""Album artwork URL cache (ArtworkCache table)."""
from __future__ import annotations

import psycopg


def _key(artist: str, album: str) -> str:
    return f"{artist.strip()}|{album.strip()}".lower()


def get_cached(
    conn: psycopg.Connection, artist: str, album: str
) -> tuple[bool, str | None]:
    """캐시 조회. (hit, url) — hit=True면 hit (url은 None일 수 있음 negative cache)."""
    with conn.cursor() as cur:
        cur.execute(
            'SELECT url FROM "ArtworkCache" WHERE key = %s',
            (_key(artist, album),),
        )
        row = cur.fetchone()
    if row is None:
        return False, None
    return True, row[0]


def upsert(
    conn: psycopg.Connection, artist: str, album: str, url: str | None
) -> None:
    """캐시 저장 (None도 저장 — negative cache)."""
    with conn.cursor() as cur:
        cur.execute(
            '''INSERT INTO "ArtworkCache" (key, url, "fetchedAt")
               VALUES (%s, %s, NOW())
               ON CONFLICT (key) DO UPDATE
                 SET url = EXCLUDED.url, "fetchedAt" = NOW()''',
            (_key(artist, album), url),
        )
    conn.commit()
