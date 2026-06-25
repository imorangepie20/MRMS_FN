"""취향 맞춤 신보(신곡) — 취향 시드 → Gemini(웹검색 grounded → 구조화 추출) →
ytmusicapi 해석 → 보유곡/discovery 제외 → EMPSource(source_type='new_release',
source_id='new_release:{user_id}') 적재.

discover.py 파이프라인을 본뜬다. 전부 SYNC(generate_user_mrt 배치 컨벤션), best-effort
(어떤 실패도 0 반환, 예외 전파/rollback 금지 — 호출자 트랜잭션 보존). Gemini는 2-call:
Call1=grounded 웹검색(최신 발매 사실 수집, schema 없음), Call2=구조화 추출(tools 없음).
요청 시 read_newrelease로 읽어 별도 섹션으로 노출.
"""
from __future__ import annotations

import logging

import psycopg
from google import genai
from google.genai import types

from mrms.config import settings
from mrms.db.emp import delete_emp_sources_by_source_id
from mrms.emp.base import upsert_track_and_emp_source
from mrms.recsys.discover import (
    DiscoveryLLMError,
    TrackSuggestion,
    TrackSuggestions,
    _blocked_song_keys,
    _owned_song_keys,
    read_discovery,
    resolve_via_ytmusic,
    taste_seed,
)

log = logging.getLogger(__name__)


_GROUNDED_PROMPT = (
    "너는 음악 큐레이터다. 주어진 사용자의 취향 아티스트와 장르를 보고, 웹 검색을 활용해 "
    "'최근 약 6개월 이내에 새로 발매된' 곡 중 그 취향의 사용자가 좋아할 만한 곡을 찾는다.\n"
    "- 최신 발매(신보/신곡) 위주. 오래된 곡은 금지.\n"
    "- 시드 아티스트 본인의 신곡뿐 아니라 비슷한 연관 아티스트의 신곡도 포함.\n"
    "- 실제로 존재하고 검색으로 확인된 곡만. artist·title·발매 시기를 함께 적어라.\n"
    "- 다양성: 같은 아티스트만 반복하지 말 것."
)

_EXTRACT_PROMPT = (
    "아래 텍스트에서 추천된 곡들의 artist와 title만 정확히 추출해 정리한다. "
    "텍스트에 없는 곡을 새로 지어내지 말 것. artist·title은 정확한 표기로."
)


def _client() -> genai.Client:
    return genai.Client(api_key=settings.gemini_api_key)


def gemini_new_releases(
    seed: dict, n: int, *, client: genai.Client | None = None
) -> list[TrackSuggestion]:
    """취향 시드 → Gemini 2단계(grounded 웹검색 → 구조화 추출) → 신곡 {artist,title} n개.

    Call1: tools=[google_search], schema 없음 → resp.text(자유텍스트).
    Call2: response_schema=TrackSuggestions, tools 없음 → resp.parsed.items.
    실패 시 DiscoveryLLMError(discover.py 재사용 — best-effort 신호)."""
    client = client or _client()
    seed_line = (
        f"취향 아티스트: {', '.join(seed.get('artists') or []) or '없음'}\n"
        f"취향 장르: {', '.join(seed.get('genres') or []) or '없음'}\n"
        f"이 취향에 맞는 최근 발매 신곡 {n}개를 웹 검색으로 찾아줘."
    )
    try:
        grounded = client.models.generate_content(
            model=settings.gemini_model,
            contents=seed_line,
            config=types.GenerateContentConfig(
                system_instruction=_GROUNDED_PROMPT,
                tools=[types.Tool(google_search=types.GoogleSearch())],
                max_output_tokens=4096,
            ),
        )
        text = grounded.text
        if not text:
            raise DiscoveryLLMError("grounded 신곡 검색이 빈 텍스트를 반환")
        resp = client.models.generate_content(
            model=settings.gemini_model,
            contents=f"{_EXTRACT_PROMPT}\n\n---\n{text}",
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=TrackSuggestions,
                max_output_tokens=4096,
                thinking_config=types.ThinkingConfig(thinking_budget=0),
            ),
        )
    except DiscoveryLLMError:
        raise
    except Exception as e:
        raise DiscoveryLLMError(str(e)) from e
    if resp.parsed is None:
        raise DiscoveryLLMError("Gemini가 파싱 가능한 신곡 목록을 주지 않음")
    return resp.parsed.items


def read_newrelease(
    conn: psycopg.Connection, user_id: str, *, limit: int = 50
) -> list[dict]:
    """new_release:{user_id} EMPSource의 트랙 + 메타(youtube_track_id 포함). importedAt 순.

    read_discovery와 동형 — source_id 규칙만 다르다. dict 키는 read_discovery와 동일하게
    유지해야 main.py의 _unified가 그대로 읽는다."""
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
            (f"new_release:{user_id}", limit),
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


def generate_user_newrelease(
    conn: psycopg.Connection, user_id: str, *,
    client: genai.Client | None = None, n: int = 20,
) -> int:
    """취향 시드 → Gemini(2단계) → ytmusic 해석 → 보유곡+discovery 제외 → new_release 재적재.

    best-effort: 어떤 실패도 0 반환(예외 전파/rollback 금지 — 호출자 트랜잭션 보존).
    내부 upsert/delete는 자체 commit. 반환=적재 트랙 수."""
    from mrms.recsys.taste_mood import _song_key  # 함수-로컬: 순환 import 회피

    try:
        # prod 안전망: Gemini 키 없으면 조용히 skip (무회귀). client 명시 주입(테스트)이면 진행.
        if client is None and not settings.gemini_api_key:
            return 0
        seed = taste_seed(conn, user_id)
        if not seed["artists"]:
            return 0
        suggestions = gemini_new_releases(seed, n, client=client)
        resolved = resolve_via_ytmusic(conn, suggestions)
        if not resolved:
            return 0
        # 보유곡 + 이미 discovery로 노출 중인 곡 제외 (두 섹션 교차중복 방지)
        owned = _owned_song_keys(conn, user_id)
        disc_keys = {_song_key(d["artist"], d["title"]) for d in read_discovery(conn, user_id)}
        exclude = owned | disc_keys | _blocked_song_keys(conn, user_id)
        fresh = [t for t in resolved if _song_key(t["artist"], t["title"]) not in exclude]
        if not fresh:
            return 0
    except DiscoveryLLMError as e:
        log.warning("new_release LLM failed for %s: %r", user_id, e)
        return 0
    except Exception as e:  # noqa: BLE001 — best-effort, MRT 생성 막지 않음
        log.warning("new_release seed/resolve failed for %s: %r", user_id, e)
        return 0

    # 여기서부터 DB 쓰기 (내부 commit). 실패는 per-track rollback + continue.
    src = f"new_release:{user_id}"
    try:
        delete_emp_sources_by_source_id(conn, src)  # 자체 commit (replace)
    except Exception as e:  # noqa: BLE001 — best-effort: 예외 전파 금지(호출자 트랜잭션 보존)
        log.warning("new_release delete failed for %s: %r", user_id, e)
        return 0
    count = 0
    for t in fresh:
        try:
            upsert_track_and_emp_source(
                conn, isrc=None, title=t["title"], artist=t["artist"],
                album_title=t.get("album_title"), duration_ms=t.get("duration_ms"),
                platform="youtube", platform_track_id=t["platform_track_id"],
                source_type="new_release", source_id=src, source_name="New Releases",
                cover_url=t.get("album_cover"),
            )
            count += 1
        except Exception as e:  # noqa: BLE001 — 한 곡 실패가 나머지를 막지 않음
            conn.rollback()
            log.warning("new_release persist failed (%s): %r", t.get("title"), e)
    return count
