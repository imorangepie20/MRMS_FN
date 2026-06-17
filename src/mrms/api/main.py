"""FastAPI app — MRMS 데이터를 HTTP로 노출."""
from __future__ import annotations

import psycopg
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from mrms.api.admin_emp import router as admin_emp_router
from mrms.api.admin_users import router as admin_users_router
from mrms.api.albums import router as albums_router
from mrms.api.artist import router as artist_router
from mrms.api.artwork import router as artwork_router
from mrms.api.auth_account import router as auth_account_router
from mrms.api.auth_session import router as auth_session_router
from mrms.api.auth_spotify import router as auth_spotify_router
from mrms.api.auth_tidal import playback_router as tidal_playback_router
from mrms.api.auth_tidal import router as tidal_router
from mrms.api.auth_youtube import router as auth_youtube_router
from mrms.api.deps import db_conn, get_current_user_id
from mrms.api.emp_browse import router as emp_browse_router
from mrms.api.import_url import router as import_url_router
from mrms.api.landing import router as landing_router
from mrms.api.onboarding_api import router as onboarding_router
from mrms.api.pgt import router as pgt_router
from mrms.api.playback_resolve import router as playback_resolve_router
from mrms.api.playlists import router as playlists_router
from mrms.api.schemas import (
    MrtLatestResponse,
    Persona,
    PersonaTrack,
    RecommendedAlbum,
    RecommendedPlaylist,
    RecommendedTrack,
    UserInfo,
)
from mrms.api.search import router as search_router
from mrms.api.shared import router as shared_router
from mrms.api.situation import router as situation_router
from mrms.api.user_tracks import router as user_tracks_router
from mrms.api.wellness import router as wellness_router
from mrms.db.user_embedding import fetch_latest_playlists
from mrms.db.user_track import resolve_primary_platform
from mrms.recsys.discover import blend_recsys, read_discovery
from mrms.recsys.mrt import derive_recommended_albums, derive_recommended_tracks
from mrms.recsys.newrelease import read_newrelease

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
app.include_router(playback_resolve_router)
app.include_router(auth_account_router)
app.include_router(auth_session_router)
app.include_router(auth_spotify_router)
app.include_router(auth_youtube_router)
app.include_router(onboarding_router)
app.include_router(user_tracks_router)
app.include_router(playlists_router)
app.include_router(shared_router)
app.include_router(albums_router)
app.include_router(artist_router)
app.include_router(artwork_router)
app.include_router(admin_emp_router)
app.include_router(admin_users_router)
app.include_router(emp_browse_router)
app.include_router(pgt_router)
app.include_router(search_router)
app.include_router(import_url_router)
app.include_router(wellness_router)
app.include_router(situation_router)
app.include_router(landing_router)


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
            'SELECT email, nickname, "displayName", country FROM "User" WHERE id = %s',
            (user_id,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "User not found")
        email, nickname, display_name, country = row

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

    # primary는 저장값 대신 현재 연결된 플랫폼에서 계산 (구독 연결/해제 자동 반영).
    # 미연결이면 None — UserInfo.primary_platform 타입에 맞춰 폴백.
    primary_platform = resolve_primary_platform(conn, user_id)

    return UserInfo(
        user_id=user_id,
        email=email,
        nickname=nickname,
        displayName=display_name,
        country=country,
        personas_count=personas_count,
        user_tracks_count=tracks_count,
        primary_platform=primary_platform,
    )


def _fetch_track_metadata(
    conn,
    track_ids: list[str],
) -> dict[str, dict]:
    """요청 트랙의 메타 + tidal/spotify/youtube ID. **플랫폼 가용성 필터 없음.**

    예전엔 primary_platform 기준 INNER JOIN으로 '재생 가능한 트랙만' 노출했으나,
    youtube 재생 resolve가 보편화돼 모든 트랙이 재생 가능 → 필터를 제거했다(추천이
    유저 플랫폼 때문에 0이 되던 버그 해소). tidal/spotify/youtube ID는 있으면 노출하고,
    재생 플랫폼 선택은 프론트 player의 FALLBACK_ORDER가 담당. 합성 yt_ placeholder는 제외.
    """
    if not track_ids:
        return {}
    with conn.cursor() as cur:
        cur.execute(
            '''SELECT t.id, t.title, a.name, t."albumId", alb.title,
                      tp_t."platformTrackId", tp_s."platformTrackId",
                      tp_y."platformTrackId", t."durationMs", ec.cover_url
               FROM "Track" t
               JOIN "Artist" a ON a.id = t."artistId"
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
            "spotify_track_id": r[6],
            "youtube_track_id": r[7],
            "duration_ms": r[8],
            "album_cover": r[9],
        }
        for r in rows
    }


@app.get("/api/mrt/latest", response_model=MrtLatestResponse)
def mrt_latest(
    user_id: str = Depends(get_current_user_id),
    conn: psycopg.Connection = Depends(db_conn),
    top_n: int = 20,
    top_tracks_n: int = 50,
    top_albums_n: int = 15,
) -> MrtLatestResponse:
    # 추천은 연결 플랫폼과 무관하게 항상 노출 — 메타는 플랫폼 가용성 필터 없이 전체 반환
    # (youtube 재생 resolve가 보편화돼 모든 트랙이 재생 가능). 재생 플랫폼 선택은 프론트
    # player의 FALLBACK_ORDER(tidal→spotify→youtube)가 담당.
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

    # EMP-밖 discovery 캐시 읽기 (배치에서 적재됨). 메타는 여기가 제공(persona meta엔 없음).
    discovery_rows = read_discovery(conn, user_id, limit=top_tracks_n)
    disc_meta = {d["track_id"]: d for d in discovery_rows}

    # 취향 맞춤 신보 캐시 읽기 (별도 섹션용 — 메인 블렌드엔 안 섞음).
    newrelease_rows = read_newrelease(conn, user_id, limit=top_tracks_n)
    nr_meta = {d["track_id"]: d for d in newrelease_rows}

    # hidden(owned|blocked)을 persona + discovery + 신보 union으로 계산
    union_ids = list(set(all_track_ids) | set(disc_meta) | set(nr_meta))
    owned: set[str] = set()
    if union_ids:
        with conn.cursor() as cur:
            cur.execute(
                'SELECT "trackId" FROM "UserTrack" WHERE "userId"=%s AND "trackId"=ANY(%s)',
                (user_id, union_ids),
            )
            owned = {r[0] for r in cur.fetchall()}

    # 싫어요(disliked)/관심없어요(dismissed) 반응한 트랙·앨범도 표시에서 제외
    from mrms.db.user_blocked import blocked_track_ids
    blocked = blocked_track_ids(conn, user_id, ["disliked", "dismissed"]) if union_ids else set()
    hidden = owned | blocked

    # UserPersona의 trackCount 매핑
    with conn.cursor() as cur:
        cur.execute(
            'SELECT "personaIdx", "trackCount" FROM "UserPersona" WHERE "userId" = %s',
            (user_id,),
        )
        track_count_by_idx = {r[0]: r[1] for r in cur.fetchall()}

    # 곡 단위(_song_key) 중복/보유 제외 — 같은 곡이 여러 track_id(tidal/spotify=ISRC,
    # youtube/vibe=무ISRC)로 존재해, track_id 정확매칭만으론 중복곡·보유곡이 새어 나간다.
    from mrms.recsys.discover import _owned_song_keys
    from mrms.recsys.taste_mood import _song_key
    owned_song_keys = _owned_song_keys(conn, user_id)
    # 싫어요(disliked)/관심없어요(dismissed)도 곡 단위로 제외 — track_id 정확매칭만으론
    # 같은 곡의 다른 버전(track_id)이 다시 추천된다(싫어요 누른 곡 재노출 버그).
    blocked_song_keys: set[str] = set()
    if blocked:
        with conn.cursor() as cur:
            cur.execute(
                '''SELECT ar.name, t.title FROM "Track" t
                   JOIN "Artist" ar ON ar.id = t."artistId"
                   WHERE t.id = ANY(%s)''',
                (list(blocked),),
            )
            blocked_song_keys = {_song_key(r[0], r[1]) for r in cur.fetchall()}
    excluded_song_keys = owned_song_keys | blocked_song_keys
    nr_song_keys = {_song_key(d["artist"], d["title"]) for d in newrelease_rows}

    personas: list[Persona] = []
    for p in playlists_sorted:
        ctx = p.get("context") or {}
        persona_idx = int(ctx.get("personaIdx", 0))
        scores = ctx.get("scores", [])
        playlist: list[PersonaTrack] = []
        seen_p: set[str] = set()
        for tid, sc in zip(p["trackIds"][:top_n], scores[:top_n]):
            if tid in hidden:
                continue  # PGT 보유 트랙 + 부정 반응 트랙 → MRT에서 제외
            m = meta.get(tid)
            if not m:
                continue
            sk = _song_key(m["artist"], m["title"])
            if sk in excluded_song_keys or sk in seen_p:
                continue  # 보유곡(다른 track_id) + 같은 곡 중복 제거
            seen_p.add(sk)
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
    taste_score = {r["track_id"]: (float(r["score"]), r.get("persona_idx")) for r in rec_tracks_raw}

    # 50/50 교차 블렌드 (track_id dedup) — taste(EMP) + discovery(EMP 밖)
    blended_ids = blend_recsys(
        [r["track_id"] for r in rec_tracks_raw],
        [d["track_id"] for d in discovery_rows],
        top_tracks_n,
    )

    # 통합 메타: persona meta(youtube 없음) 또는 discovery meta(youtube 있음)
    def _unified(tid: str) -> dict | None:
        if tid in disc_meta:
            d = disc_meta[tid]
            return {
                "title": d["title"], "artist": d["artist"], "album_id": d["album_id"],
                "album_title": d["album_title"], "duration_ms": d["duration_ms"],
                "tidal_track_id": d["tidal_track_id"], "spotify_track_id": d["spotify_track_id"],
                "youtube_track_id": d["youtube_track_id"], "album_cover": d["album_cover"],
            }
        if tid in nr_meta:
            d = nr_meta[tid]
            return {
                "title": d["title"], "artist": d["artist"], "album_id": d["album_id"],
                "album_title": d["album_title"], "duration_ms": d["duration_ms"],
                "tidal_track_id": d["tidal_track_id"], "spotify_track_id": d["spotify_track_id"],
                "youtube_track_id": d["youtube_track_id"], "album_cover": d["album_cover"],
            }
        if tid in meta:
            return meta[tid]  # meta에 youtube_track_id·album_cover 포함
        return None

    # liked/pct 상태 — 블렌드된 트랙 전체에 대해 한 번에
    user_track_state: dict[str, tuple[bool, bool]] = {}
    if blended_ids:
        with conn.cursor() as cur:
            cur.execute(
                '''SELECT "trackId", source, "isCore" FROM "UserTrack"
                   WHERE "userId" = %s AND "trackId" = ANY(%s)''',
                (user_id, blended_ids),
            )
            for row in cur.fetchall():
                user_track_state[row[0]] = (row[1] == "liked", bool(row[2]))

    recommended_tracks = []
    seen_keys: set[str] = set()
    for tid in blended_ids:
        if tid in hidden:
            continue
        u = _unified(tid)
        if u is None:
            continue
        sk = _song_key(u["artist"], u["title"])
        # 보유곡(다른 track_id) · 신보 전용섹션 곡 · 이미 추가한 곡 = 곡 단위로 제외
        if sk in excluded_song_keys or sk in nr_song_keys or sk in seen_keys:
            continue
        seen_keys.add(sk)
        score, persona_idx = taste_score.get(tid, (0.0, None))
        liked, pct = user_track_state.get(tid, (False, False))
        recommended_tracks.append(RecommendedTrack(
            track_id=tid,
            title=u["title"], artist=u["artist"], album_id=u["album_id"],
            album_title=u["album_title"], duration_ms=u["duration_ms"],
            score=score, persona_idx=persona_idx,
            tidal_track_id=u["tidal_track_id"], spotify_track_id=u["spotify_track_id"],
            youtube_track_id=u["youtube_track_id"], album_cover=u.get("album_cover"),
            liked=liked, pct=pct,
        ))

    # 취향 맞춤 신보 — 별도 섹션(blend 안 함, importedAt 순). 미보유라 score/liked/pct 기본값.
    newrelease_ids = [d["track_id"] for d in newrelease_rows]
    recommended_new_releases = []
    seen_nr: set[str] = set()
    for tid in newrelease_ids:
        if tid in hidden:
            continue
        u = _unified(tid)
        if u is None:
            continue
        sk = _song_key(u["artist"], u["title"])
        if sk in excluded_song_keys or sk in seen_nr:
            continue  # 보유곡(다른 track_id) + 신보 내 같은 곡 중복 제거
        seen_nr.add(sk)
        recommended_new_releases.append(RecommendedTrack(
            track_id=tid,
            title=u["title"], artist=u["artist"], album_id=u["album_id"],
            album_title=u["album_title"], duration_ms=u["duration_ms"],
            score=0.0, persona_idx=None,
            tidal_track_id=u["tidal_track_id"], spotify_track_id=u["spotify_track_id"],
            youtube_track_id=u["youtube_track_id"], album_cover=u.get("album_cover"),
            liked=False, pct=False,
        ))

    # owned·차단 트랙은 album 집계에도 기여하지 않도록 track_to_album에서 제외
    track_to_album = {tid: m["album_id"] for tid, m in meta.items() if tid not in hidden}
    rec_albums_raw = derive_recommended_albums(playlists_with_scores, track_to_album, top_n=top_albums_n)
    # album_id → (title, artist, cover_url) 조회. Album 테이블엔 커버 컬럼이 없어,
    # 그 앨범 소속 트랙 중 EMPSource.cover_url 있는 것 하나를 대표 커버로 끌어온다.
    album_meta: dict[str, tuple[str, str, str | None]] = {}
    album_ids = [r["album_id"] for r in rec_albums_raw]
    if album_ids:
        with conn.cursor() as cur:
            cur.execute(
                '''SELECT alb.id, alb.title, a.name,
                          (SELECT es.cover_url FROM "Track" t2
                             JOIN "EMPSource" es ON es."trackId" = t2.id
                           WHERE t2."albumId" = alb.id AND es.cover_url IS NOT NULL
                           LIMIT 1) AS cover_url
                   FROM "Album" alb JOIN "Artist" a ON a.id = alb."artistId"
                   WHERE alb.id = ANY(%s)''',
                (album_ids,),
            )
            for row in cur.fetchall():
                album_meta[row[0]] = (row[1], row[2], row[3])
    recommended_albums = [
        RecommendedAlbum(
            album_id=r["album_id"],
            title=album_meta.get(r["album_id"], ("?", "?", None))[0],
            artist=album_meta.get(r["album_id"], ("?", "?", None))[1],
            track_count=r["track_count"],
            cover_url=album_meta.get(r["album_id"], ("?", "?", None))[2],
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
        recommended_new_releases=recommended_new_releases,
    )
