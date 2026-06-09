"""Playlist + PlaylistTrack DB 헬퍼."""
from __future__ import annotations

import hashlib
from datetime import datetime, timezone

import psycopg


def _id(value: str) -> str:
    h = hashlib.sha1(value.encode()).hexdigest()[:24]
    return f"c{h}"


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
    conn.commit()
    return playlist_id


def list_user_playlists(
    conn: psycopg.Connection, user_id: str
) -> list[dict]:
    """User의 playlists 목록 (트랙 카운트 포함)."""
    with conn.cursor() as cur:
        cur.execute(
            '''SELECT p.id, p.name, p.description, p."createdAt",
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
            "track_count": r[4],
        }
        for r in rows
    ]


def get_playlist_tracks(
    conn: psycopg.Connection, playlist_id: str
) -> list[dict]:
    """Playlist 안 트랙 (position 순). album_cover는 None (Album에 coverUrl 컬럼 없음)."""
    with conn.cursor() as cur:
        cur.execute(
            '''SELECT t.id, t.title, a.name AS artist,
                      al.id AS album_id, al.title AS album_title,
                      tp_tidal."platformTrackId" AS tidal_track_id,
                      tp_spotify."platformTrackId" AS spotify_track_id,
                      t."durationMs" AS duration_ms
               FROM "PlaylistTrack" pt
               JOIN "Track" t ON t.id = pt."trackId"
               JOIN "Artist" a ON a.id = t."artistId"
               LEFT JOIN "Album" al ON al.id = t."albumId"
               LEFT JOIN "TrackPlatform" tp_tidal
                 ON tp_tidal."trackId" = t.id AND tp_tidal.platform = 'tidal'
               LEFT JOIN "TrackPlatform" tp_spotify
                 ON tp_spotify."trackId" = t.id AND tp_spotify.platform = 'spotify'
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
            "album_cover": None,  # Album에 coverUrl 없음
            "tidal_track_id": r[5],
            "spotify_track_id": r[6],
            "duration_ms": r[7],
        }
        for r in rows
    ]


def get_playlist(
    conn: psycopg.Connection, playlist_id: str
) -> dict | None:
    """Playlist 메타."""
    with conn.cursor() as cur:
        cur.execute(
            '''SELECT id, "userId", name, description, "createdAt"
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
    }
