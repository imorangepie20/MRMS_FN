"""EMP browse API — section/item listing + per-item tracks. 사용자용."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

import psycopg

from mrms.api.deps import db_conn, get_current_user_id
from mrms.db.emp_section import list_sections_with_items
from mrms.db.user_track import get_user_track_states


router = APIRouter(prefix="/api/emp", tags=["emp_browse"])


@router.get("/sections")
def get_sections(
    platform: str | None = None,
    user_id: str = Depends(get_current_user_id),  # auth required
    conn: psycopg.Connection = Depends(db_conn),
):
    sections = list_sections_with_items(conn, platform=platform)
    return {"sections": sections}


# tidal: playlist/album/mix · spotify embed: playlist/album/artist
# flo: playlist/channel · melon: chart · vibe: station/playlist
VALID_ITEM_TYPES = {"playlist", "album", "mix", "artist", "channel", "chart", "station"}


@router.get("/items/{item_type}/{item_id}/tracks")
def get_item_tracks(
    item_type: str,
    item_id: str,
    limit: int = 100,
    user_id: str = Depends(get_current_user_id),
    conn: psycopg.Connection = Depends(db_conn),
):
    if item_type not in VALID_ITEM_TYPES:
        raise HTTPException(400, f"item_type must be one of {sorted(VALID_ITEM_TYPES)}")

    source_id = f"{item_type}:{item_id}"

    with conn.cursor() as cur:
        cur.execute(
            '''SELECT t.id, t.title, ar.name AS artist,
                      t."albumId", alb.title AS album_title,
                      t."durationMs",
                      tp_tidal."platformTrackId" AS tidal_id,
                      tp_spotify."platformTrackId" AS spotify_id,
                      es.cover_url AS album_cover
               FROM "EMPSource" es
               JOIN "Track" t ON t.id = es."trackId"
               JOIN "Artist" ar ON ar.id = t."artistId"
               LEFT JOIN "Album" alb ON alb.id = t."albumId"
               LEFT JOIN "TrackPlatform" tp_tidal
                 ON tp_tidal."trackId" = t.id AND tp_tidal.platform = 'tidal'
               LEFT JOIN "TrackPlatform" tp_spotify
                 ON tp_spotify."trackId" = t.id AND tp_spotify.platform = 'spotify'
               WHERE es.source_id = %s
               ORDER BY es."importedAt"
               LIMIT %s''',
            (source_id, limit),
        )
        rows = cur.fetchall()

    states = get_user_track_states(conn, user_id, [r[0] for r in rows])
    tracks = [
        {
            "track_id": r[0],
            "title": r[1],
            "artist": r[2],
            "album_id": r[3],
            "album_title": r[4],
            # EMPSource.cover_url — 트랙 단위 커버 (chart/모달 노출용).
            # 플랫폼이 트랙 커버를 안 주면 None (spotify embed 등).
            "album_cover": r[8],
            "duration_ms": r[5],
            "tidal_track_id": r[6],
            "spotify_track_id": r[7],
            "liked": states.get(r[0], (False, False))[0],
            "pct": states.get(r[0], (False, False))[1],
        }
        for r in rows
    ]
    return {"tracks": tracks}
