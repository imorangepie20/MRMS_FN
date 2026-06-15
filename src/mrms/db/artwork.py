"""Album artwork URL cache (ArtworkCache table)."""
from __future__ import annotations

import psycopg


def _key(artist: str, album: str) -> str:
    return f"{artist.strip()}|{album.strip()}".lower()


def get_cached(
    conn: psycopg.Connection, artist: str, album: str
) -> tuple[bool, str | None]:
    """캐시 조회. (hit, url) — hit=True면 hit (url은 None일 수 있음 negative cache).

    positive(url 있음)는 영구. negative(url None)는 7일 후 만료 → miss로 취급해 재시도
    (iTunes 일시 장애·rate limit이 영구 빈칸으로 굳는 것 방지)."""
    with conn.cursor() as cur:
        cur.execute(
            '''SELECT url FROM "ArtworkCache"
               WHERE key = %s
                 AND (url IS NOT NULL OR "fetchedAt" > NOW() - INTERVAL '7 days')''',
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
