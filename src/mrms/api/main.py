"""FastAPI app — MRMS 데이터를 HTTP로 노출."""
from __future__ import annotations

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

import psycopg

from mrms.api.albums import router as albums_router
from mrms.api.artwork import router as artwork_router
from mrms.api.auth_session import router as auth_session_router
from mrms.api.auth_spotify import router as auth_spotify_router
from mrms.api.auth_tidal import playback_router as tidal_playback_router, router as tidal_router
from mrms.api.deps import db_conn, get_current_user_id
from mrms.api.onboarding_api import router as onboarding_router
from mrms.api.playlists import router as playlists_router
from mrms.api.user_tracks import router as user_tracks_router
from mrms.api.schemas import (
    MrtLatestResponse,
    Persona,
    PersonaTrack,
    RecommendedAlbum,
    RecommendedPlaylist,
    RecommendedTrack,
    UserInfo,
)
from mrms.db.user_embedding import fetch_latest_playlists
from mrms.recsys.mrt import derive_recommended_albums, derive_recommended_tracks


app = FastAPI(title="MRMS API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3500", "http://localhost:3000", "https://mrms.approid.team"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(tidal_router)
app.include_router(tidal_playback_router)
app.include_router(auth_session_router)
app.include_router(auth_spotify_router)
app.include_router(onboarding_router)
app.include_router(user_tracks_router)
app.include_router(playlists_router)
app.include_router(albums_router)
app.include_router(artwork_router)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/user", response_model=UserInfo)
def user(
    user_id: str = Depends(get_current_user_id),
    conn: psycopg.Connection = Depends(db_conn),
) -> UserInfo:
    with conn.cursor() as cur:
        cur.execute(
            'SELECT email, "displayName", country, "primaryPlatform" FROM "User" WHERE id = %s',
            (user_id,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "User not found")
        email, display_name, country, primary_platform = row

        cur.execute(
            'SELECT COUNT(*) FROM "UserPersona" WHERE "userId" = %s',
            (user_id,),
        )
        personas_count = cur.fetchone()[0]

        cur.execute(
            'SELECT COUNT(*) FROM "UserTrack" WHERE "userId" = %s',
            (user_id,),
        )
        tracks_count = cur.fetchone()[0]

    return UserInfo(
        user_id=user_id,
        email=email,
        displayName=display_name,
        country=country,
        personas_count=personas_count,
        user_tracks_count=tracks_count,
        primary_platform=primary_platform,
    )


def _fetch_track_metadata(
    conn,
    track_ids: list[str],
    primary_platform: str = "tidal",
) -> dict[str, dict]:
    """{primary_platform}-가용 트랙의 메타 + tidal/spotify ID 반환.

    primary_platform='tidal': INNER JOIN tidal, LEFT JOIN spotify
    primary_platform='spotify': INNER JOIN spotify, LEFT JOIN tidal
    """
    if not track_ids:
        return {}
    if primary_platform == "spotify":
        join_clause = (
            'INNER JOIN "TrackPlatform" tp_s '
            '   ON tp_s."trackId" = t.id AND tp_s.platform = \'spotify\' '
            'LEFT JOIN "TrackPlatform" tp_t '
            '   ON tp_t."trackId" = t.id AND tp_t.platform = \'tidal\' '
        )
    else:
        join_clause = (
            'INNER JOIN "TrackPlatform" tp_t '
            '   ON tp_t."trackId" = t.id AND tp_t.platform = \'tidal\' '
            'LEFT JOIN "TrackPlatform" tp_s '
            '   ON tp_s."trackId" = t.id AND tp_s.platform = \'spotify\' '
        )
    sql = (
        'SELECT t.id, t.title, a.name, t."albumId", alb.title, '
        '       tp_t."platformTrackId", tp_s."platformTrackId", t."durationMs" '
        'FROM "Track" t '
        'JOIN "Artist" a ON a.id = t."artistId" '
        'LEFT JOIN "Album" alb ON alb.id = t."albumId" '
        + join_clause +
        'WHERE t.id = ANY(%s)'
    )
    with conn.cursor() as cur:
        cur.execute(sql, (track_ids,))
        rows = cur.fetchall()
    return {
        r[0]: {
            "title": r[1],
            "artist": r[2],
            "album_id": r[3],
            "album_title": r[4],
            "tidal_track_id": r[5],
            "spotify_track_id": r[6],
            "duration_ms": r[7],
        }
        for r in rows
    }


@app.get("/api/mrt/latest", response_model=MrtLatestResponse)
def mrt_latest(
    user_id: str = Depends(get_current_user_id),
    conn: psycopg.Connection = Depends(db_conn),
    top_n: int = 20,
    top_tracks_n: int = 20,
    top_albums_n: int = 15,
) -> MrtLatestResponse:
    # user의 primary_platform 확인
    with conn.cursor() as cur:
        cur.execute('SELECT "primaryPlatform" FROM "User" WHERE id = %s', (user_id,))
        row = cur.fetchone()
    primary_platform = row[0] if row else "tidal"

    playlists = fetch_latest_playlists(conn, user_id, limit=3)
    if not playlists:
        return MrtLatestResponse(
            personas=[],
            recommended_tracks=[],
            recommended_albums=[],
        )

    # persona_idx 기준 정렬
    playlists_sorted = sorted(
        playlists,
        key=lambda p: (p.get("context") or {}).get("personaIdx", 999),
    )

    all_track_ids = list({tid for p in playlists_sorted for tid in p["trackIds"]})
    meta = _fetch_track_metadata(conn, all_track_ids, primary_platform=primary_platform)

    # UserPersona의 trackCount 매핑
    with conn.cursor() as cur:
        cur.execute(
            'SELECT "personaIdx", "trackCount" FROM "UserPersona" WHERE "userId" = %s',
            (user_id,),
        )
        track_count_by_idx = {r[0]: r[1] for r in cur.fetchall()}

    personas: list[Persona] = []
    for p in playlists_sorted:
        ctx = p.get("context") or {}
        persona_idx = int(ctx.get("personaIdx", 0))
        scores = ctx.get("scores", [])
        playlist: list[PersonaTrack] = []
        for tid, sc in zip(p["trackIds"][:top_n], scores[:top_n]):
            m = meta.get(tid)
            if not m:
                continue  # Tidal 미가용 → skip
            playlist.append(PersonaTrack(
                track_id=tid,
                title=m["title"],
                artist=m["artist"],
                album_id=m["album_id"],
                album_title=m["album_title"],
                similarity=float(sc),
                tidal_track_id=m["tidal_track_id"],
                spotify_track_id=m["spotify_track_id"],
            ))
        personas.append(Persona(
            persona_idx=persona_idx,
            track_count=track_count_by_idx.get(persona_idx, 0),
            playlist=playlist,
        ))

    # derive
    playlists_with_scores = [
        {
            "context": p.get("context") or {},
            "trackIds": p["trackIds"],
            "scores": (p.get("context") or {}).get("scores", []),
        }
        for p in playlists_sorted
    ]
    rec_tracks_raw = derive_recommended_tracks(playlists_with_scores, top_n=top_tracks_n)

    # liked + pct 상태 한 번에 fetch (N+1 회피)
    rec_track_ids = [r["track_id"] for r in rec_tracks_raw if r["track_id"] in meta]
    user_track_state: dict[str, tuple[bool, bool]] = {}
    if rec_track_ids:
        with conn.cursor() as cur:
            cur.execute(
                '''SELECT "trackId", source, "isCore" FROM "UserTrack"
                   WHERE "userId" = %s AND "trackId" = ANY(%s)''',
                (user_id, rec_track_ids),
            )
            for row in cur.fetchall():
                user_track_state[row[0]] = (row[1] == "liked", bool(row[2]))

    recommended_tracks = [
        RecommendedTrack(
            track_id=r["track_id"],
            title=meta[r["track_id"]]["title"],
            artist=meta[r["track_id"]]["artist"],
            album_id=meta[r["track_id"]]["album_id"],
            album_title=meta[r["track_id"]]["album_title"],
            duration_ms=meta[r["track_id"]]["duration_ms"],
            score=float(r["score"]),
            persona_idx=r.get("persona_idx"),
            tidal_track_id=meta[r["track_id"]]["tidal_track_id"],
            spotify_track_id=meta[r["track_id"]]["spotify_track_id"],
            liked=user_track_state.get(r["track_id"], (False, False))[0],
            pct=user_track_state.get(r["track_id"], (False, False))[1],
        )
        for r in rec_tracks_raw
        if r["track_id"] in meta  # Tidal 가용한 것만
    ]

    track_to_album = {tid: m["album_id"] for tid, m in meta.items()}
    rec_albums_raw = derive_recommended_albums(playlists_with_scores, track_to_album, top_n=top_albums_n)
    # album_id → (title, artist) 조회
    album_titles: dict[str, tuple[str, str]] = {}
    album_ids = [r["album_id"] for r in rec_albums_raw]
    if album_ids:
        with conn.cursor() as cur:
            cur.execute(
                '''SELECT alb.id, alb.title, a.name
                   FROM "Album" alb JOIN "Artist" a ON a.id = alb."artistId"
                   WHERE alb.id = ANY(%s)''',
                (album_ids,),
            )
            for row in cur.fetchall():
                album_titles[row[0]] = (row[1], row[2])
    recommended_albums = [
        RecommendedAlbum(
            album_id=r["album_id"],
            title=album_titles.get(r["album_id"], ("?", "?"))[0],
            artist=album_titles.get(r["album_id"], ("?", "?"))[1],
            track_count=r["track_count"],
        )
        for r in rec_albums_raw
    ]

    # 각 페르소나를 추천 플레이리스트로 그대로 노출 (id, name, cover, count + persona_idx)
    recommended_playlists = [
        RecommendedPlaylist(
            id=f"mrt_persona_{p.persona_idx}",
            name=f"Persona {p.persona_idx + 1}",
            description=f"{p.track_count} tracks from your persona cluster",
            cover_url=None,
            track_count=p.track_count,
            persona_idx=p.persona_idx,
            persona_score=None,
        )
        for p in personas
    ]

    return MrtLatestResponse(
        generated_at=playlists_sorted[0].get("generatedAt"),
        model_version=playlists_sorted[0].get("modelVersion"),
        personas=personas,
        recommended_tracks=recommended_tracks,
        recommended_albums=recommended_albums,
        recommended_playlists=recommended_playlists,
    )
