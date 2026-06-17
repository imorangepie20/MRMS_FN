"""Playlist + PlaylistTrack DB 헬퍼."""
from __future__ import annotations

import secrets
from datetime import datetime, timezone

import psycopg

from mrms.db.ids import stable_id as _id
from mrms.db.user_track import upsert_user_track


def create_playlist(
    conn: psycopg.Connection,
    user_id: str,
    name: str,
    description: str | None,
    track_ids: list[str],
) -> str:
    """새 Playlist + PlaylistTrack 생성. playlist_id 반환."""
    ts = datetime.now(timezone.utc).isoformat()
    playlist_id = _id(f"playlist|{user_id}|{name}|{ts}")
    with conn.cursor() as cur:
        cur.execute(
            '''INSERT INTO "Playlist" (id, "userId", name, description)
               VALUES (%s, %s, %s, %s)''',
            (playlist_id, user_id, name, description),
        )
        for pos, track_id in enumerate(track_ids):
            cur.execute(
                '''INSERT INTO "PlaylistTrack" ("playlistId", "trackId", position)
                   VALUES (%s, %s, %s)
                   ON CONFLICT ("playlistId", "trackId") DO NOTHING''',
                (playlist_id, track_id, pos),
            )
    # 담은 곡을 라이브러리로 편입 → MRT에서 제외(ADR-002 '이동=UserTrack') + 취향 신호.
    # source='curated': PGT imported('playlist%')와 안 겹쳐 '내 플레이리스트'와 중복 노출 방지.
    # upsert conflict 규칙상 기존 'liked' 등은 강등하지 않음(EXCLUDED='liked'만 덮어씀).
    for track_id in track_ids:
        upsert_user_track(
            conn, user_id, track_id, is_core=False, source="curated", platform="mrms"
        )
    conn.commit()
    return playlist_id


def list_user_playlists(
    conn: psycopg.Connection, user_id: str
) -> list[dict]:
    """User의 playlists 목록 (트랙 카운트 포함)."""
    with conn.cursor() as cur:
        cur.execute(
            '''SELECT p.id, p.name, p.description, p."createdAt", p."shareId",
                      COUNT(pt."trackId") AS track_count
               FROM "Playlist" p
               LEFT JOIN "PlaylistTrack" pt ON pt."playlistId" = p.id
               WHERE p."userId" = %s
               GROUP BY p.id
               ORDER BY p."createdAt" DESC''',
            (user_id,),
        )
        rows = cur.fetchall()
    return [
        {
            "id": r[0],
            "name": r[1],
            "description": r[2],
            "created_at": r[3].isoformat() if r[3] else None,
            "share_id": r[4],
            "track_count": r[5],
        }
        for r in rows
    ]


def get_playlist_tracks(
    conn: psycopg.Connection, playlist_id: str
) -> list[dict]:
    """Playlist 안 트랙 (position 순). album_cover는 EMPSource.cover_url(있으면)."""
    with conn.cursor() as cur:
        cur.execute(
            '''SELECT t.id, t.title, a.name AS artist,
                      al.id AS album_id, al.title AS album_title,
                      tp_tidal."platformTrackId" AS tidal_track_id,
                      tp_spotify."platformTrackId" AS spotify_track_id,
                      t."durationMs" AS duration_ms,
                      ec.cover_url AS album_cover
               FROM "PlaylistTrack" pt
               JOIN "Track" t ON t.id = pt."trackId"
               JOIN "Artist" a ON a.id = t."artistId"
               LEFT JOIN "Album" al ON al.id = t."albumId"
               LEFT JOIN "TrackPlatform" tp_tidal
                 ON tp_tidal."trackId" = t.id AND tp_tidal.platform = 'tidal'
               LEFT JOIN "TrackPlatform" tp_spotify
                 ON tp_spotify."trackId" = t.id AND tp_spotify.platform = 'spotify'
               LEFT JOIN LATERAL (
                 SELECT cover_url FROM "EMPSource"
                 WHERE "trackId" = t.id AND cover_url IS NOT NULL LIMIT 1
               ) ec ON TRUE
               WHERE pt."playlistId" = %s
               ORDER BY pt.position''',
            (playlist_id,),
        )
        rows = cur.fetchall()
    return [
        {
            "track_id": r[0],
            "title": r[1],
            "artist": r[2],
            "album_id": r[3],
            "album_title": r[4],
            "album_cover": r[8],
            "tidal_track_id": r[5],
            "spotify_track_id": r[6],
            "duration_ms": r[7],
        }
        for r in rows
    ]


def get_playlist(
    conn: psycopg.Connection, playlist_id: str
) -> dict | None:
    """Playlist 메타 (share_id 포함)."""
    with conn.cursor() as cur:
        cur.execute(
            '''SELECT id, "userId", name, description, "createdAt", "shareId"
               FROM "Playlist" WHERE id = %s''',
            (playlist_id,),
        )
        row = cur.fetchone()
    if not row:
        return None
    return {
        "id": row[0],
        "user_id": row[1],
        "name": row[2],
        "description": row[3],
        "created_at": row[4].isoformat() if row[4] else None,
        "share_id": row[5],
    }


def set_playlist_share(
    conn: psycopg.Connection, playlist_id: str, on: bool
) -> str | None:
    """공유 토글. on이면 shareId 생성(없을 때만)·반환, off면 NULL로 비우고 None 반환."""
    with conn.cursor() as cur:
        if not on:
            cur.execute(
                'UPDATE "Playlist" SET "shareId" = NULL WHERE id = %s', (playlist_id,)
            )
            conn.commit()
            return None
        cur.execute('SELECT "shareId" FROM "Playlist" WHERE id = %s', (playlist_id,))
        row = cur.fetchone()
        existing = row[0] if row else None
        if existing:
            return existing  # idempotent — 기존 토큰 유지
        share_id = secrets.token_urlsafe(9)
        cur.execute(
            'UPDATE "Playlist" SET "shareId" = %s WHERE id = %s',
            (share_id, playlist_id),
        )
    conn.commit()
    return share_id


def get_playlist_by_share_id(
    conn: psycopg.Connection, share_id: str
) -> dict | None:
    """공유 토큰으로 플레이리스트 메타(+owner displayName). 없으면 None."""
    with conn.cursor() as cur:
        cur.execute(
            '''SELECT p.id, p.name, p.description, p."createdAt", u."displayName"
               FROM "Playlist" p
               JOIN "User" u ON u.id = p."userId"
               WHERE p."shareId" = %s''',
            (share_id,),
        )
        row = cur.fetchone()
    if not row:
        return None
    return {
        "id": row[0],
        "name": row[1],
        "description": row[2],
        "created_at": row[3].isoformat() if row[3] else None,
        "owner_name": row[4],
    }


def add_tracks_to_playlist(
    conn: psycopg.Connection, playlist_id: str, track_ids: list[str], user_id: str
) -> dict:
    """곡을 끝에 추가(중복 스킵) + curated UserTrack 편입. {added, skipped} 반환."""
    added = 0
    with conn.cursor() as cur:
        cur.execute(
            'SELECT COALESCE(MAX(position), -1) FROM "PlaylistTrack" WHERE "playlistId"=%s',
            (playlist_id,),
        )
        nxt = cur.fetchone()[0] + 1
        for tid in track_ids:
            cur.execute(
                '''INSERT INTO "PlaylistTrack" ("playlistId", "trackId", position)
                   VALUES (%s, %s, %s)
                   ON CONFLICT ("playlistId", "trackId") DO NOTHING''',
                (playlist_id, tid, nxt),
            )
            if cur.rowcount:  # 1=신규 삽입, 0=중복 스킵
                added += 1
                nxt += 1
    # 담은 곡 라이브러리 편입(ADR-002). upsert는 멱등이라 전체 대상에 호출해도 안전.
    for tid in track_ids:
        upsert_user_track(
            conn, user_id, tid, is_core=False, source="curated", platform="mrms"
        )
    conn.commit()
    return {"added": added, "skipped": len(track_ids) - added}


def remove_track_from_playlist(
    conn: psycopg.Connection, playlist_id: str, track_id: str
) -> None:
    """플레이리스트에서 곡 제거. UserTrack은 미변경(다른 플리/좋아요 안전)."""
    with conn.cursor() as cur:
        cur.execute(
            'DELETE FROM "PlaylistTrack" WHERE "playlistId"=%s AND "trackId"=%s',
            (playlist_id, track_id),
        )
    conn.commit()


def reorder_playlist_tracks(
    conn: psycopg.Connection, playlist_id: str, track_ids: list[str]
) -> bool:
    """전달 순서대로 position 재기록. 전달 집합이 기존 집합과 정확히 일치할 때만
    적용(True). 불일치(경합/누락)면 변경 없이 False."""
    with conn.cursor() as cur:
        cur.execute(
            'SELECT "trackId" FROM "PlaylistTrack" WHERE "playlistId"=%s', (playlist_id,)
        )
        existing = [r[0] for r in cur.fetchall()]
        if len(track_ids) != len(existing) or set(track_ids) != set(existing):
            return False
        for pos, tid in enumerate(track_ids):
            cur.execute(
                'UPDATE "PlaylistTrack" SET position=%s WHERE "playlistId"=%s AND "trackId"=%s',
                (pos, playlist_id, tid),
            )
    conn.commit()
    return True


def update_playlist_meta(
    conn: psycopg.Connection, playlist_id: str, name: str, description: str | None
) -> None:
    """이름·설명 수정."""
    with conn.cursor() as cur:
        cur.execute(
            'UPDATE "Playlist" SET name=%s, description=%s WHERE id=%s',
            (name, description, playlist_id),
        )
    conn.commit()


def delete_playlist(conn: psycopg.Connection, playlist_id: str) -> None:
    """플레이리스트 + 그 PlaylistTrack 삭제. UserTrack은 미변경."""
    with conn.cursor() as cur:
        cur.execute('DELETE FROM "PlaylistTrack" WHERE "playlistId"=%s', (playlist_id,))
        cur.execute('DELETE FROM "Playlist" WHERE id=%s', (playlist_id,))
    conn.commit()
