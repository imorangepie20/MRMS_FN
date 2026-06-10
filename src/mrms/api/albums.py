"""Albums API — get tracks."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from mrms.api.deps import db_conn, get_current_user_id
from mrms.db.user_track import get_user_track_states


router = APIRouter(tags=["albums"])


@router.get("/api/albums/{album_id}/tracks")
def album_tracks_endpoint(
    album_id: str,
    user_id: str = Depends(get_current_user_id),
    conn=Depends(db_conn),
):
    """앨범의 트랙들. Album에 coverUrl 컬럼 없어서 album_cover는 None."""
    with conn.cursor() as cur:
        cur.execute(
            '''SELECT id, title FROM "Album" WHERE id = %s''',
            (album_id,),
        )
        a = cur.fetchone()
        if not a:
            raise HTTPException(404, "album not found")
        album = {"id": a[0], "title": a[1], "cover_url": None}

        cur.execute(
            '''SELECT t.id, t.title, ar.name AS artist,
                      al.id AS album_id, al.title AS album_title,
                      tp_tidal."platformTrackId" AS tidal_track_id,
                      tp_spotify."platformTrackId" AS spotify_track_id,
                      t."durationMs" AS duration_ms
               FROM "Track" t
               JOIN "Artist" ar ON ar.id = t."artistId"
               LEFT JOIN "Album" al ON al.id = t."albumId"
               LEFT JOIN "TrackPlatform" tp_tidal
                 ON tp_tidal."trackId" = t.id AND tp_tidal.platform = 'tidal'
               LEFT JOIN "TrackPlatform" tp_spotify
                 ON tp_spotify."trackId" = t.id AND tp_spotify.platform = 'spotify'
               WHERE t."albumId" = %s
               ORDER BY t.id''',
            (album_id,),
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
            "album_cover": None,
            "tidal_track_id": r[5],
            "spotify_track_id": r[6],
            "duration_ms": r[7],
            "liked": states.get(r[0], (False, False))[0],
            "pct": states.get(r[0], (False, False))[1],
        }
        for r in rows
    ]
    return {"album": album, "tracks": tracks}
