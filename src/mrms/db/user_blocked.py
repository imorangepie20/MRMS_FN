"""UserBlocked — 부정 반응(싫어요=disliked, 관심없어요=dismissed) DB ops."""
from __future__ import annotations

import psycopg

from mrms.db.ids import stable_id as _id


def block_target(
    conn: psycopg.Connection,
    user_id: str,
    target_id: str,
    target_type: str,   # 'track' | 'album'
    reason: str,        # 'disliked' | 'dismissed'
) -> None:
    """부정 반응 1행 upsert. (userId,targetId,targetType) 충돌 시 reason 갱신."""
    row_id = _id(f"blocked|{user_id}|{target_type}|{target_id}")
    with conn.cursor() as cur:
        cur.execute(
            '''INSERT INTO "UserBlocked" (id, "userId", "targetId", "targetType", reason)
               VALUES (%s, %s, %s, %s, %s)
               ON CONFLICT ("userId", "targetId", "targetType")
                 DO UPDATE SET reason = EXCLUDED.reason''',
            (row_id, user_id, target_id, target_type, reason),
        )
    conn.commit()


def clear_dismissed(conn: psycopg.Connection, user_id: str) -> int:
    """일시 숨김(dismissed) 행 전부 삭제. 삭제 수 반환. (재생성 후 호출)"""
    with conn.cursor() as cur:
        cur.execute(
            'DELETE FROM "UserBlocked" WHERE "userId" = %s AND reason = %s',
            (user_id, "dismissed"),
        )
        n = cur.rowcount
    conn.commit()
    return n


def blocked_track_ids(
    conn: psycopg.Connection, user_id: str, reasons: list[str]
) -> set[str]:
    """차단/숨김된 trackId 집합 — 트랙 직접 차단 ∪ 차단 앨범의 트랙."""
    with conn.cursor() as cur:
        cur.execute(
            '''SELECT "targetId" FROM "UserBlocked"
                 WHERE "userId" = %s AND "targetType" = 'track' AND reason = ANY(%s)
               UNION
               SELECT t.id FROM "Track" t
                 JOIN "UserBlocked" ub
                   ON ub."targetId" = t."albumId" AND ub."targetType" = 'album'
                 WHERE ub."userId" = %s AND ub.reason = ANY(%s)''',
            (user_id, reasons, user_id, reasons),
        )
        return {r[0] for r in cur.fetchall()}
