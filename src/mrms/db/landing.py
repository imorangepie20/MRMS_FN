"""랜딩 preview 풀 — 전역 최신곡(new_release) 중 real-ISRC 랜덤 후보 + previewUrl write."""
from __future__ import annotations

import psycopg


def pick_preview_candidates(conn: psycopg.Connection, limit: int = 15) -> list[dict]:
    """전역 new_release 풀에서 real-ISRC 트랙 랜덤 후보(메타+previewUrl 현재값). 부족하면 적게."""
    with conn.cursor() as cur:
        cur.execute(
            '''WITH pool AS (
                 SELECT t.id
                 FROM "Track" t
                 JOIN "EMPSource" e ON e."trackId" = t.id AND e.source_type = 'new_release'
                 WHERE t.isrc IS NOT NULL
                   AND t.isrc NOT LIKE 'emp\\_%%' ESCAPE '\\'
                   AND length(t.isrc) = 12
                 GROUP BY t.id
                 ORDER BY random() LIMIT %s
               )
               SELECT t.id, t.title, ar.name, t."albumId", alb.title,
                      tp_t."platformTrackId", tp_s."platformTrackId", tp_y."platformTrackId",
                      t."durationMs", t.isrc, t."previewUrl", ec.cover_url
               FROM pool p
               JOIN "Track" t ON t.id = p.id
               JOIN "Artist" ar ON ar.id = t."artistId"
               LEFT JOIN "Album" alb ON alb.id = t."albumId"
               LEFT JOIN "TrackPlatform" tp_t ON tp_t."trackId"=t.id AND tp_t.platform='tidal'
               LEFT JOIN "TrackPlatform" tp_s ON tp_s."trackId"=t.id AND tp_s.platform='spotify'
               LEFT JOIN "TrackPlatform" tp_y ON tp_y."trackId"=t.id AND tp_y.platform='youtube'
                 AND tp_y."platformTrackId" NOT LIKE 'yt\\_%%' ESCAPE '\\'
               LEFT JOIN LATERAL (
                 SELECT cover_url FROM "EMPSource"
                 WHERE "trackId"=t.id AND cover_url IS NOT NULL LIMIT 1
               ) ec ON TRUE''',
            (limit,),
        )
        rows = cur.fetchall()
    return [{
        "track_id": r[0], "title": r[1], "artist": r[2], "album_id": r[3],
        "album_title": r[4], "tidal_track_id": r[5], "spotify_track_id": r[6],
        "youtube_track_id": r[7], "duration_ms": r[8], "isrc": r[9],
        "preview_url": r[10], "album_cover": r[11],
    } for r in rows]


def set_track_preview_url(conn: psycopg.Connection, track_id: str, url: str) -> None:
    """resolve된 preview URL을 Track에 캐시(write-through). 자체 commit."""
    with conn.cursor() as cur:
        cur.execute('UPDATE "Track" SET "previewUrl"=%s WHERE id=%s', (url, track_id))
    conn.commit()
