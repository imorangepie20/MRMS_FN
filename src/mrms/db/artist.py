"""아티스트 단위 곡 조회 — 소개 팝업의 '그 아티스트 곡(재생 가능)'."""
from __future__ import annotations

import psycopg


def artist_tracks_by_name(
    conn: psycopg.Connection, name_normalized: str, *,
    user_id: str | None = None, limit: int = 30,
) -> list[dict]:
    """nameNormalized 아티스트의 곡 — ModalTrack shape(커버/플랫폼ID/duration).

    같은 곡(_song_key) dedup. user_id 있으면 liked/pct 부여."""
    from mrms.recsys.taste_mood import _song_key  # 함수-로컬: 순환 import 회피

    with conn.cursor() as cur:
        cur.execute(
            '''SELECT t.id, t.title, ar.name, t."albumId", alb.title,
                      tp_t."platformTrackId", tp_s."platformTrackId",
                      tp_y."platformTrackId", t."durationMs", ec.cover_url
               FROM "Track" t
               JOIN "Artist" ar ON ar.id = t."artistId"
               LEFT JOIN "Album" alb ON alb.id = t."albumId"
               LEFT JOIN "TrackPlatform" tp_t
                 ON tp_t."trackId" = t.id AND tp_t.platform = 'tidal'
               LEFT JOIN "TrackPlatform" tp_s
                 ON tp_s."trackId" = t.id AND tp_s.platform = 'spotify'
               LEFT JOIN "TrackPlatform" tp_y
                 ON tp_y."trackId" = t.id AND tp_y.platform = 'youtube'
                 AND tp_y."platformTrackId" NOT LIKE 'yt\\_%%' ESCAPE '\\'
               LEFT JOIN LATERAL (
                 SELECT cover_url FROM "EMPSource"
                 WHERE "trackId" = t.id AND cover_url IS NOT NULL LIMIT 1
               ) ec ON TRUE
               WHERE ar."nameNormalized" = %s
               ORDER BY t.title
               LIMIT %s''',
            (name_normalized, limit),
        )
        rows = cur.fetchall()

    out: list[dict] = []
    seen: set[str] = set()
    track_ids: list[str] = []
    for r in rows:
        sk = _song_key(r[2], r[1])
        if sk in seen:
            continue
        seen.add(sk)
        track_ids.append(r[0])
        out.append({
            "track_id": r[0], "title": r[1], "artist": r[2], "album_id": r[3],
            "album_title": r[4], "tidal_track_id": r[5], "spotify_track_id": r[6],
            "youtube_track_id": r[7], "duration_ms": r[8], "album_cover": r[9],
            "liked": False, "pct": False,
        })

    if user_id and track_ids:
        with conn.cursor() as cur:
            cur.execute(
                '''SELECT "trackId", source, "isCore" FROM "UserTrack"
                   WHERE "userId" = %s AND "trackId" = ANY(%s)''',
                (user_id, track_ids),
            )
            state = {row[0]: (row[1] == "liked", bool(row[2])) for row in cur.fetchall()}
        for t in out:
            liked, pct = state.get(t["track_id"], (False, False))
            t["liked"], t["pct"] = liked, pct
    return out
