"""FastAPI app — MRMS 데이터를 HTTP로 노출."""
from __future__ import annotations

from fastapi import Depends, FastAPI

import psycopg

from mrms.api.auth_tidal import router as tidal_router
from mrms.api.deps import db_conn, get_default_user_email
from mrms.api.schemas import (
    MrtLatestResponse,
    Persona,
    PersonaTrack,
    RecommendedAlbum,
    RecommendedTrack,
    UserInfo,
)
from mrms.db.user_embedding import fetch_latest_playlists
from mrms.db.user_track import get_or_create_user
from mrms.recsys.mrt import derive_recommended_albums, derive_recommended_tracks


app = FastAPI(title="MRMS API", version="0.1.0")
app.include_router(tidal_router)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/user", response_model=UserInfo)
def user(conn: psycopg.Connection = Depends(db_conn)) -> UserInfo:
    email = get_default_user_email()
    user_id = get_or_create_user(conn, email)
    conn.commit()
    with conn.cursor() as cur:
        cur.execute(
            'SELECT "displayName", country FROM "User" WHERE id = %s',
            (user_id,),
        )
        row = cur.fetchone()
        display_name, country = (row[0], row[1]) if row else (None, None)

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
    )


def _fetch_track_metadata(conn, track_ids: list[str]) -> dict[str, dict]:
    """Tidal 가용 트랙의 메타 + tidal_track_id 반환. Tidal 없는 트랙은 dict에 없음."""
    if not track_ids:
        return {}
    with conn.cursor() as cur:
        cur.execute(
            '''SELECT t.id, t.title, a.name, t."albumId", alb.title, tp."platformTrackId"
               FROM "Track" t
               JOIN "Artist" a ON a.id = t."artistId"
               LEFT JOIN "Album" alb ON alb.id = t."albumId"
               INNER JOIN "TrackPlatform" tp
                  ON tp."trackId" = t.id AND tp.platform = 'tidal'
               WHERE t.id = ANY(%s)''',
            (track_ids,),
        )
        rows = cur.fetchall()
    return {
        r[0]: {
            "title": r[1],
            "artist": r[2],
            "album_id": r[3],
            "album_title": r[4],
            "tidal_track_id": r[5],
        }
        for r in rows
    }


@app.get("/api/mrt/latest", response_model=MrtLatestResponse)
def mrt_latest(
    top_n: int = 20,
    top_tracks_n: int = 30,
    top_albums_n: int = 15,
    conn: psycopg.Connection = Depends(db_conn),
) -> MrtLatestResponse:
    email = get_default_user_email()
    user_id = get_or_create_user(conn, email)
    conn.commit()

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
    meta = _fetch_track_metadata(conn, all_track_ids)

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
    recommended_tracks = [
        RecommendedTrack(
            track_id=r["track_id"],
            title=meta[r["track_id"]]["title"],
            artist=meta[r["track_id"]]["artist"],
            album_id=meta[r["track_id"]]["album_id"],
            score=float(r["score"]),
            persona_idx=r.get("persona_idx"),
            tidal_track_id=meta[r["track_id"]]["tidal_track_id"],
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

    return MrtLatestResponse(
        generated_at=playlists_sorted[0].get("generatedAt"),
        model_version=playlists_sorted[0].get("modelVersion"),
        personas=personas,
        recommended_tracks=recommended_tracks,
        recommended_albums=recommended_albums,
    )
