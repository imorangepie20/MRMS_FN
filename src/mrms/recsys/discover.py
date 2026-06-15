"""EMP-밖 추천 discovery — 취향 시드 → Gemini 제안 → ytmusicapi 해석 → EMPSource 적재.

전부 SYNC (generate_user_mrt 배치 컨벤션). discovery는 EMPSource(source_type='discovery',
source_id='discovery:{user_id}')에만 적재하고, 요청 시 read_discovery로 읽어 50/50 블렌드.
"""
from __future__ import annotations

import logging

import psycopg
from google import genai
from google.genai import types
from pydantic import BaseModel

from mrms.config import settings
from mrms.db.emp import delete_emp_sources_by_source_id
from mrms.db.settings import get_setting
from mrms.emp.base import upsert_track_and_emp_source
from mrms.search.normalize import normalize_ytmusic_track
from mrms.search.youtube import AUTH_SETTING_KEY, _ytmusic

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


class DiscoveryLLMError(RuntimeError):
    """Gemini 호출/파싱 실패 — discovery는 best-effort라 호출부가 삼킨다."""


class TrackSuggestion(BaseModel):
    artist: str
    title: str


class TrackSuggestions(BaseModel):
    items: list[TrackSuggestion]


_DISCOVERY_PROMPT = (
    "너는 음악 큐레이터다. 주어진 사용자의 취향 아티스트와 장르를 보고, 그 취향의 사용자가 "
    "좋아할 만한 '연관 아티스트'의 실재하는 곡을 추천한다.\n"
    "- 시드 아티스트 '본인'의 곡은 피하고, 비슷하지만 다른 아티스트 위주로.\n"
    "- 실제로 존재하는 곡만(가공/허구 금지). artist·title은 정확한 표기로.\n"
    "- 다양성: 같은 아티스트만 반복하지 말 것."
)


def _client() -> genai.Client:
    return genai.Client(api_key=settings.gemini_api_key)


def gemini_related_tracks(
    seed: dict, n: int, *, client: genai.Client | None = None
) -> list[TrackSuggestion]:
    """취향 시드 → Gemini → 연관 곡 {artist,title} n개. 실패 시 DiscoveryLLMError."""
    client = client or _client()
    prompt = (
        f"취향 아티스트: {', '.join(seed.get('artists') or []) or '없음'}\n"
        f"취향 장르: {', '.join(seed.get('genres') or []) or '없음'}\n"
        f"이들과 연관된 다른 아티스트의 곡 {n}개를 추천해줘."
    )
    try:
        resp = client.models.generate_content(
            model=settings.gemini_model,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=_DISCOVERY_PROMPT,
                response_mime_type="application/json",
                response_schema=TrackSuggestions,
                max_output_tokens=4096,
                thinking_config=types.ThinkingConfig(thinking_budget=0),
            ),
        )
    except Exception as e:
        raise DiscoveryLLMError(str(e)) from e
    if resp.parsed is None:
        raise DiscoveryLLMError("Gemini가 파싱 가능한 출력을 주지 않음")
    return resp.parsed.items


def resolve_via_ytmusic(
    conn: psycopg.Connection, suggestions: list[TrackSuggestion]
) -> list[dict]:
    """각 {artist,title} 제안 → ytmusicapi 검색 → 첫 유효 트랙(videoId)으로 해석.

    해석 실패(존재하지 않음=환각)는 버린다. normalize_ytmusic_track shape 반환."""
    auth_raw = get_setting(conn, AUTH_SETTING_KEY)
    yt = _ytmusic(auth_raw)
    out: list[dict] = []
    for s in suggestions:
        try:
            raw = yt.search(f"{s.artist} {s.title}")
        except Exception as e:  # noqa: BLE001 — ytmusicapi 비공식, graceful
            log.warning("discovery ytmusic search failed (%s): %r", s.title, e)
            continue
        for item in raw or []:
            nt = normalize_ytmusic_track(item)
            if nt:
                out.append(nt)
                break
    return out


def _owned_song_keys(conn: psycopg.Connection, user_id: str) -> set[str]:
    """유저 라이브러리 곡의 _song_key 집합 (discovery에서 보유곡 제외용)."""
    from mrms.recsys.taste_mood import _song_key  # 함수-로컬: mrt↔discover 순환 import 회피

    with conn.cursor() as cur:
        cur.execute(
            '''SELECT ar.name, t.title
               FROM "UserTrack" ut
               JOIN "Track" t   ON t.id = ut."trackId"
               JOIN "Artist" ar ON ar.id = t."artistId"
               WHERE ut."userId" = %s''',
            (user_id,),
        )
        return {_song_key(r[0], r[1]) for r in cur.fetchall()}


def generate_user_discovery(
    conn: psycopg.Connection, user_id: str, *,
    client: genai.Client | None = None, n: int = 20,
) -> int:
    """취향 시드 → Gemini → ytmusicapi 해석 → 보유곡 제외 → discovery EMPSource 재적재.

    best-effort: 어떤 실패도 0 반환(예외 전파/rollback 금지 — 호출자 트랜잭션 보존).
    내부 upsert/delete는 자체 commit. 반환=적재 트랙 수."""
    from mrms.recsys.taste_mood import _song_key  # 함수-로컬: 순환 import 회피

    try:
        # prod 안전망: Gemini 키 없으면 조용히 skip (무회귀). 단 client가 명시 주입되면
        # 테스트 fake client를 쓰는 것이므로 키가 없어도 진행한다.
        if client is None and not settings.gemini_api_key:
            return 0
        seed = taste_seed(conn, user_id)
        if not seed["artists"]:
            return 0
        suggestions = gemini_related_tracks(seed, n, client=client)
        resolved = resolve_via_ytmusic(conn, suggestions)
        if not resolved:
            return 0
        owned = _owned_song_keys(conn, user_id)
        fresh = [t for t in resolved if _song_key(t["artist"], t["title"]) not in owned]
        if not fresh:
            return 0
    except DiscoveryLLMError as e:
        log.warning("discovery LLM failed for %s: %r", user_id, e)
        return 0
    except Exception as e:  # noqa: BLE001 — best-effort, MRT 생성 막지 않음
        log.warning("discovery seed/resolve failed for %s: %r", user_id, e)
        return 0

    # 여기서부터 DB 쓰기 (내부 commit). 실패는 per-track rollback + continue.
    src = f"discovery:{user_id}"
    try:
        delete_emp_sources_by_source_id(conn, src)  # 자체 commit (replace)
    except Exception as e:  # noqa: BLE001 — best-effort: 예외 전파 금지(호출자 트랜잭션 보존)
        log.warning("discovery delete failed for %s: %r", user_id, e)
        return 0
    count = 0
    for t in fresh:
        try:
            upsert_track_and_emp_source(
                conn, isrc=None, title=t["title"], artist=t["artist"],
                album_title=t.get("album_title"), duration_ms=t.get("duration_ms"),
                platform="youtube", platform_track_id=t["platform_track_id"],
                source_type="discovery", source_id=src, source_name="Discovery",
                cover_url=t.get("album_cover"),
            )
            count += 1
        except Exception as e:  # noqa: BLE001 — 한 곡 실패가 나머지를 막지 않음
            conn.rollback()
            log.warning("discovery persist failed (%s): %r", t.get("title"), e)
    return count


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
