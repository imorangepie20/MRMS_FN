"""EMP-밖 추천 discovery — 취향 시드 → Gemini 제안 → ytmusicapi 해석 → EMPSource 적재.

전부 SYNC (generate_user_mrt 배치 컨벤션). discovery는 EMPSource(source_type='discovery',
source_id='discovery:{user_id}')에만 적재하고, 요청 시 read_discovery로 읽어 50/50 블렌드.
"""
from __future__ import annotations

import logging

import psycopg

log = logging.getLogger(__name__)


def taste_seed(
    conn: psycopg.Connection, user_id: str, *, n_artists: int = 12, n_genres: int = 5
) -> dict:
    """유저 라이브러리(UserTrack)에서 top 아티스트명 + top mainGenre(Artist.mainGenre).

    UserEmbedding/UserPersona의 topGenres는 채워지지 않으므로 쿼리 시 직접 도출.
    반환 {"artists": [name,...], "genres": [genre,...]}."""
    with conn.cursor() as cur:
        cur.execute(
            '''SELECT ar.name, count(*) AS c
               FROM "UserTrack" ut
               JOIN "Track" t   ON t.id = ut."trackId"
               JOIN "Artist" ar ON ar.id = t."artistId"
               WHERE ut."userId" = %(uid)s
               GROUP BY ar.id, ar.name
               ORDER BY c DESC
               LIMIT %(n)s''',
            {"uid": user_id, "n": n_artists},
        )
        artists = [r[0] for r in cur.fetchall()]
        cur.execute(
            '''SELECT ar."mainGenre", count(*) AS c
               FROM "UserTrack" ut
               JOIN "Track" t   ON t.id = ut."trackId"
               JOIN "Artist" ar ON ar.id = t."artistId"
               WHERE ut."userId" = %(uid)s AND ar."mainGenre" IS NOT NULL
               GROUP BY ar."mainGenre"
               ORDER BY c DESC
               LIMIT %(m)s''',
            {"uid": user_id, "m": n_genres},
        )
        genres = [r[0] for r in cur.fetchall()]
    return {"artists": artists, "genres": genres}


def read_discovery(
    conn: psycopg.Connection, user_id: str, *, limit: int = 50
) -> list[dict]:
    """discovery:{user_id} EMPSource의 트랙 + 메타(youtube_track_id 포함). importedAt 순."""
    with conn.cursor() as cur:
        cur.execute(
            '''SELECT t.id, t.title, ar.name, t."albumId", alb.title,
                      t."durationMs",
                      tp_tidal."platformTrackId"   AS tidal_id,
                      tp_spotify."platformTrackId" AS spotify_id,
                      es.cover_url                 AS album_cover,
                      tp_youtube."platformTrackId" AS youtube_id
               FROM "EMPSource" es
               JOIN "Track" t   ON t.id = es."trackId"
               JOIN "Artist" ar ON ar.id = t."artistId"
               LEFT JOIN "Album" alb ON alb.id = t."albumId"
               LEFT JOIN "TrackPlatform" tp_tidal
                 ON tp_tidal."trackId" = t.id AND tp_tidal.platform = 'tidal'
               LEFT JOIN "TrackPlatform" tp_spotify
                 ON tp_spotify."trackId" = t.id AND tp_spotify.platform = 'spotify'
               LEFT JOIN "TrackPlatform" tp_youtube
                 ON tp_youtube."trackId" = t.id AND tp_youtube.platform = 'youtube'
                 AND tp_youtube."platformTrackId" NOT LIKE 'yt\\_%%' ESCAPE '\\'
               WHERE es.source_id = %s
               ORDER BY es."importedAt"
               LIMIT %s''',
            (f"discovery:{user_id}", limit),
        )
        rows = cur.fetchall()
    return [
        {
            "track_id": r[0], "title": r[1], "artist": r[2], "album_id": r[3],
            "album_title": r[4], "duration_ms": r[5], "tidal_track_id": r[6],
            "spotify_track_id": r[7], "album_cover": r[8], "youtube_track_id": r[9],
        }
        for r in rows
    ]


def blend_recsys(
    taste_ids: list[str], discovery_ids: list[str], n: int
) -> list[str]:
    """taste(EMP) / discovery(EMP 밖) track_id를 50/50 교차로 합쳐 최대 n개.

    taste 먼저 시작, 한 쪽이 비면 나머지를 채운다. track_id 정확 매칭으로 dedup."""
    out: list[str] = []
    seen: set[str] = set()
    ti = di = 0
    turn = 0  # 짝수=taste, 홀수=discovery
    while len(out) < n and (ti < len(taste_ids) or di < len(discovery_ids)):
        use_taste = turn % 2 == 0
        if use_taste and ti >= len(taste_ids):
            use_taste = False
        elif not use_taste and di >= len(discovery_ids):
            use_taste = True
        if use_taste and ti < len(taste_ids):
            tid = taste_ids[ti]
            ti += 1
            if tid not in seen:
                seen.add(tid)
                out.append(tid)
                turn += 1
        elif not use_taste and di < len(discovery_ids):
            tid = discovery_ids[di]
            di += 1
            if tid not in seen:
                seen.add(tid)
                out.append(tid)
                turn += 1
    return out
