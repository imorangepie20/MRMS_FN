"""랜딩 preview 풀 — 전역 카탈로그의 real-ISRC 랜덤 후보."""
from __future__ import annotations

import psycopg


def pick_preview_candidates(conn: psycopg.Connection, limit: int = 10) -> list[dict]:
    """전역 카탈로그에서 real-ISRC 트랙 랜덤 후보(메타). 부족하면 적게.

    new_release EMPSource는 전역엔 비어 있어(per-user 생성) 풀을 전체 real-ISRC로 잡는다.
    (synthetic 'emp_' ISRC·길이≠12 제외 → Deezer/iTunes resolve 가능한 실 ISRC만.)"""
    with conn.cursor() as cur:
        cur.execute(
            '''WITH pool AS (
                 SELECT id FROM "Track"
                 WHERE isrc IS NOT NULL
                   AND isrc NOT LIKE 'emp\\_%%' ESCAPE '\\'
                   AND length(isrc) = 12
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
