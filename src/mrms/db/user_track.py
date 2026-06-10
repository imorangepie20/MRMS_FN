"""User / UserOAuth / UserTrack / Track 매칭 DB ops.

cuid 대신 sha1 기반 결정론적 ID 사용 (재실행 멱등성).
"""
from __future__ import annotations

from datetime import datetime

import psycopg

from mrms.db.ids import stable_id as _id


def get_or_create_user(conn: psycopg.Connection, email: str) -> str:
    """email 기준 사용자 조회 또는 생성. 사용자 id 반환."""
    user_id = _id(f"user|{email}")
    with conn.cursor() as cur:
        cur.execute(
            '''INSERT INTO "User" (id, email, "createdAt")
               VALUES (%s, %s, NOW())
               ON CONFLICT (email) DO NOTHING''',
            (user_id, email),
        )
        cur.execute('SELECT id FROM "User" WHERE email = %s', (email,))
        row = cur.fetchone()
    if row is None:
        raise RuntimeError(f"User row not found after upsert: {email}")
    return row[0]


def upsert_oauth(
    conn: psycopg.Connection,
    user_id: str,
    platform: str,
    access_token: str,
    refresh_token: str,
    expires_at: datetime,
    scopes: list[str],
) -> None:
    """UserOAuth UPSERT (userId+platform unique)."""
    row_id = _id(f"oauth|{user_id}|{platform}")
    with conn.cursor() as cur:
        cur.execute(
            '''INSERT INTO "UserOAuth"
                 (id, "userId", platform, "accessToken", "refreshToken", "expiresAt", scope)
               VALUES (%s, %s, %s, %s, %s, %s, %s)
               ON CONFLICT ("userId", platform) DO UPDATE SET
                 "accessToken" = EXCLUDED."accessToken",
                 "refreshToken" = EXCLUDED."refreshToken",
                 "expiresAt" = EXCLUDED."expiresAt",
                 scope = EXCLUDED.scope''',
            (row_id, user_id, platform, access_token, refresh_token, expires_at, scopes),
        )


def get_oauth(
    conn: psycopg.Connection, user_id: str, platform: str
) -> dict | None:
    """UserOAuth row 반환 (없으면 None)."""
    with conn.cursor() as cur:
        cur.execute(
            '''SELECT "accessToken", "refreshToken", "expiresAt", scope
               FROM "UserOAuth"
               WHERE "userId" = %s AND platform = %s''',
            (user_id, platform),
        )
        row = cur.fetchone()
    if row is None:
        return None
    return {
        "accessToken": row[0],
        "refreshToken": row[1],
        "expiresAt": row[2],
        "scope": list(row[3]) if row[3] else [],
    }


def find_track_id_by_isrc(conn: psycopg.Connection, isrc: str) -> str | None:
    """Track id 반환 (없으면 None)."""
    with conn.cursor() as cur:
        cur.execute('SELECT id FROM "Track" WHERE isrc = %s', (isrc,))
        row = cur.fetchone()
    return row[0] if row else None


def get_user_track_states(
    conn: psycopg.Connection, user_id: str, track_ids: list[str]
) -> dict[str, tuple[bool, bool]]:
    """trackId → (liked, pct) 매핑. 한 번에 fetch (N+1 회피).

    liked = source == 'liked', pct = isCore.
    UserTrack row 없는 트랙은 키 자체가 없음 — 호출부에서 (False, False) 기본.
    """
    states: dict[str, tuple[bool, bool]] = {}
    if not track_ids:
        return states
    with conn.cursor() as cur:
        cur.execute(
            '''SELECT "trackId", source, "isCore" FROM "UserTrack"
               WHERE "userId" = %s AND "trackId" = ANY(%s)''',
            (user_id, track_ids),
        )
        for row in cur.fetchall():
            states[row[0]] = (row[1] == "liked", bool(row[2]))
    return states


def upsert_user_track(
    conn: psycopg.Connection,
    user_id: str,
    track_id: str,
    is_core: bool,
    source: str,
    platform: str,
) -> None:
    """UserTrack UPSERT — conflict 시 liked가 playlist 이김."""
    row_id = _id(f"ut|{user_id}|{track_id}")
    with conn.cursor() as cur:
        cur.execute(
            '''INSERT INTO "UserTrack"
                 (id, "userId", "trackId", "isCore", source, platform)
               VALUES (%s, %s, %s, %s, %s, %s)
               ON CONFLICT ("userId", "trackId") DO UPDATE SET
                 "isCore" = "UserTrack"."isCore" OR EXCLUDED."isCore",
                 source = CASE
                   WHEN EXCLUDED.source = 'liked' THEN 'liked'
                   ELSE "UserTrack".source
                 END''',
            (row_id, user_id, track_id, is_core, source, platform),
        )
