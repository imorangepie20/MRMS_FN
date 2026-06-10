"""재생 시점 트랙 lazy 해결 — 플랫폼 카탈로그 검색으로 platform track ID 확보.

GET /api/playback/resolve/{track_id}?platform=spotify|tidal
- TrackPlatform에 매핑이 이미 있으면 외부 호출 없이 바로 반환
- 없으면 해당 플랫폼 카탈로그 검색 (ISRC 우선 → 텍스트 폴백) 후
  TrackPlatform upsert → 다음 재생부터는 직행

토큰 인프라:
- Spotify: auth_spotify.get_token 재사용 (UserOAuth + 자동 refresh)
- Tidal: auth_tidal._get_access_token 재사용 (UserOAuth + 자동 refresh).
  ISRC 필터는 openapi.tidal.com /v2/tracks?filter[isrc]=,
  텍스트 검색은 api.tidal.com /v1/search/tracks (playbackinfo와 같은
  Bearer 사용자 토큰 패턴 — artists가 인라인이라 매칭 검증에 적합).
"""
from __future__ import annotations

from typing import Literal

import httpx
import psycopg
from fastapi import APIRouter, Depends, HTTPException

from mrms.api.auth_spotify import get_token as _spotify_token
from mrms.api.auth_tidal import _get_access_token as _tidal_token
from mrms.api.deps import db_conn, get_current_user_id
from mrms.db.ids import stable_id
from mrms.sync.jsonapi import flatten_jsonapi


router = APIRouter(prefix="/api/playback", tags=["playback"])

SPOTIFY_SEARCH_URL = "https://api.spotify.com/v1/search"
TIDAL_V2_TRACKS_URL = "https://openapi.tidal.com/v2/tracks"
TIDAL_V1_SEARCH_URL = "https://api.tidal.com/v1/search/tracks"

SEARCH_LIMIT = 5
DURATION_TOLERANCE_MS = 5000


def _usable_isrc(isrc: str | None) -> bool:
    """진짜 ISRC인지 — EMP 합성 키 (emp_<platform>_<id>)는 검색에 못 씀."""
    return bool(isrc) and len(isrc) == 12 and isrc.isalnum()


def _norm(s: str | None) -> str:
    return (s or "").strip().lower()


def _pick_match(
    candidates: list[dict],
    title: str,
    artist: str,
    duration_ms: int | None,
    isrc: str | None = None,
) -> dict | None:
    """검색 결과에서 안전한 후보 선택. 없으면 None (엉뚱한 곡 재생 방지).

    candidates: [{id, title, artists: [name, ...], isrc, duration_ms}]
    - ISRC 정확 일치가 있으면 무조건 그것
    - 텍스트 매칭: 제목 일치(2점)/포함(1점) AND 아티스트 일치(2점)/포함(1점)
      둘 다 0점이면 탈락. durationMs ±5초 이내면 +1 가산점. 최고점 반환.
    """
    if isrc:
        for c in candidates:
            if c.get("isrc") and str(c["isrc"]).upper() == isrc.upper():
                return c

    nt, na = _norm(title), _norm(artist)
    best: dict | None = None
    best_score = 0
    for c in candidates:
        ct = _norm(c.get("title"))
        if not ct or not nt:
            continue
        if ct == nt:
            t_score = 2
        elif nt in ct or ct in nt:
            t_score = 1
        else:
            continue

        a_score = 0
        for name in c.get("artists") or []:
            cn = _norm(name)
            if not cn or not na:
                continue
            if cn == na:
                a_score = max(a_score, 2)
            elif na in cn or cn in na:
                a_score = max(a_score, 1)
        if a_score == 0:
            continue

        score = t_score + a_score
        cd = c.get("duration_ms")
        if duration_ms and cd and abs(duration_ms - cd) <= DURATION_TOLERANCE_MS:
            score += 1
        if score > best_score:
            best_score = score
            best = c
    return best


async def _get_json(
    http: httpx.AsyncClient,
    url: str,
    *,
    params: dict,
    headers: dict,
    what: str,
) -> dict:
    """외부 API GET — 실패는 전부 502 + 명확한 메시지."""
    try:
        r = await http.get(url, params=params, headers=headers)
    except httpx.HTTPError as e:
        raise HTTPException(502, f"{what} request failed: {e}")
    if r.status_code != 200:
        raise HTTPException(502, f"{what} returned {r.status_code}: {r.text[:200]}")
    try:
        return r.json()
    except ValueError as e:
        raise HTTPException(502, f"{what} returned invalid JSON: {e}")


# ───────────────────────── Spotify ─────────────────────────

def _spotify_candidate(item: dict) -> dict | None:
    if not isinstance(item, dict) or item.get("id") is None:
        return None
    return {
        "id": str(item["id"]),
        "title": item.get("name"),
        "artists": [
            a.get("name") for a in item.get("artists") or [] if isinstance(a, dict)
        ],
        "isrc": (item.get("external_ids") or {}).get("isrc"),
        "duration_ms": item.get("duration_ms"),
    }


async def _resolve_spotify(
    http: httpx.AsyncClient, token: str, track: dict
) -> str | None:
    headers = {"Authorization": f"Bearer {token}"}
    isrc = track["isrc"] if _usable_isrc(track["isrc"]) else None

    # 1차: ISRC 검색
    if isrc:
        body = await _get_json(
            http, SPOTIFY_SEARCH_URL,
            params={"q": f"isrc:{isrc}", "type": "track", "limit": SEARCH_LIMIT},
            headers=headers, what="spotify isrc search",
        )
        items = (body.get("tracks") or {}).get("items") or []
        candidates = [c for c in (_spotify_candidate(i) for i in items) if c]
        for c in candidates:
            # ISRC 확인 일치 우선, external_ids 없으면 필터 결과를 신뢰
            if c["isrc"] is None or str(c["isrc"]).upper() == isrc.upper():
                return c["id"]

    # 2차: 텍스트 검색
    body = await _get_json(
        http, SPOTIFY_SEARCH_URL,
        params={
            "q": f'track:"{track["title"]}" artist:"{track["artist"]}"',
            "type": "track",
            "limit": SEARCH_LIMIT,
        },
        headers=headers, what="spotify search",
    )
    items = (body.get("tracks") or {}).get("items") or []
    candidates = [c for c in (_spotify_candidate(i) for i in items) if c]
    best = _pick_match(
        candidates, track["title"], track["artist"], track["duration_ms"], isrc=isrc,
    )
    return best["id"] if best else None


# ───────────────────────── Tidal ─────────────────────────

async def _resolve_tidal(
    http: httpx.AsyncClient, token: str, track: dict, country: str
) -> str | None:
    headers = {"Authorization": f"Bearer {token}"}
    isrc = track["isrc"] if _usable_isrc(track["isrc"]) else None

    # 1차: openapi v2 ISRC 필터
    if isrc:
        body = await _get_json(
            http, TIDAL_V2_TRACKS_URL,
            params={"countryCode": country, "filter[isrc]": isrc},
            headers={**headers, "Accept": "application/vnd.api+json"},
            what="tidal isrc lookup",
        )
        for item in flatten_jsonapi(body, focus_type="tracks"):
            item_isrc = item.get("isrc")
            # ISRC 확인 일치 우선, attribute 없으면 필터 결과를 신뢰
            if item_isrc is None or str(item_isrc).upper() == isrc.upper():
                return str(item["id"])

    # 2차: v1 텍스트 검색 (artists 인라인)
    body = await _get_json(
        http, TIDAL_V1_SEARCH_URL,
        params={
            "query": f'{track["title"]} {track["artist"]}',
            "limit": SEARCH_LIMIT,
            "countryCode": country,
        },
        headers=headers, what="tidal search",
    )
    candidates: list[dict] = []
    for item in body.get("items") or []:
        if not isinstance(item, dict) or item.get("id") is None:
            continue
        duration_sec = item.get("duration")
        candidates.append({
            "id": str(item["id"]),
            "title": item.get("title"),
            "artists": [
                a.get("name") for a in item.get("artists") or [] if isinstance(a, dict)
            ],
            "isrc": item.get("isrc"),
            "duration_ms": int(duration_sec) * 1000 if duration_sec else None,
        })
    best = _pick_match(
        candidates, track["title"], track["artist"], track["duration_ms"], isrc=isrc,
    )
    return best["id"] if best else None


# ───────────────────────── Endpoint ─────────────────────────

@router.get("/resolve/{track_id}")
async def resolve_track(
    track_id: str,
    platform: Literal["spotify", "tidal"],
    user_id: str = Depends(get_current_user_id),
    conn: psycopg.Connection = Depends(db_conn),
) -> dict:
    """우리 track_id → 플랫폼 track ID lazy 해결."""
    # 1. Track 로드
    with conn.cursor() as cur:
        cur.execute(
            'SELECT t.title, a.name, t.isrc, t."durationMs" '
            'FROM "Track" t JOIN "Artist" a ON a.id = t."artistId" '
            'WHERE t.id = %s',
            (track_id,),
        )
        row = cur.fetchone()
    if not row:
        raise HTTPException(404, "track not found")
    track = {
        "title": row[0],
        "artist": row[1],
        "isrc": row[2],
        "duration_ms": row[3] or None,  # 0 = 미상 → 가산점 비교 생략
    }

    # 2. 이미 매핑 있으면 검색 생략
    with conn.cursor() as cur:
        cur.execute(
            'SELECT "platformTrackId" FROM "TrackPlatform" '
            'WHERE "trackId" = %s AND platform = %s',
            (track_id, platform),
        )
        row = cur.fetchone()
    if row:
        return {"platform_track_id": row[0]}

    # 3. 플랫폼 토큰 — OAuth 미연결/refresh 실패는 미인증(401) 취급
    # (tidal refresh 실패는 HTTPException이 아닌 예외로 올라올 수 있어 broad catch)
    try:
        if platform == "spotify":
            token = (await _spotify_token(user_id=user_id, conn=conn))["access_token"]
        else:
            token = await _tidal_token(user_id, conn)
    except HTTPException as e:
        raise HTTPException(401, f"{platform} auth unavailable: {e.detail}")
    except Exception as e:
        raise HTTPException(401, f"{platform} auth unavailable: {type(e).__name__}")

    # 4. 검색 + 매칭
    with conn.cursor() as cur:
        cur.execute('SELECT country FROM "User" WHERE id = %s', (user_id,))
        u = cur.fetchone()
    country = u[0] if u and u[0] else "US"

    async with httpx.AsyncClient(timeout=10.0) as http:
        if platform == "spotify":
            platform_track_id = await _resolve_spotify(http, token, track)
        else:
            platform_track_id = await _resolve_tidal(http, token, track, country)

    if not platform_track_id:
        raise HTTPException(404, "no match")

    # 5. TrackPlatform upsert — 다음부터 직행
    tp_id = stable_id(f"tp|{platform}|{platform_track_id}")
    with conn.cursor() as cur:
        cur.execute(
            '''INSERT INTO "TrackPlatform"
                 (id, "trackId", platform, "platformTrackId")
               VALUES (%s, %s, %s, %s)
               ON CONFLICT DO NOTHING''',
            (tp_id, track_id, platform, platform_track_id),
        )
    conn.commit()

    return {"platform_track_id": platform_track_id}
