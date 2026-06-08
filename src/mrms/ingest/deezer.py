"""Deezer Search/Lookup API 클라이언트.

무료 공개 endpoint, OAuth 불필요 (메타/검색용).
응답에 ISRC + 30초 preview URL이 동시에 포함되어 카탈로그 enrichment에 이상적.

향후 확장:
    - User playlist sync는 OAuth flow 별도 추가 예정 (deezer.py에 OAuth 메서드 합류)
    - 현재 모듈은 anonymous read-only 사용

Docs:
    - https://developers.deezer.com/api/search
    - https://developers.deezer.com/api/track
"""

from __future__ import annotations

import asyncio
import logging
from typing import Optional, TypedDict

import httpx
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

log = logging.getLogger(__name__)

BASE_URL = "https://api.deezer.com"


class DeezerError(Exception):
    pass


class DeezerTrack(TypedDict, total=False):
    """Deezer 트랙 응답에서 우리가 쓰는 필드만 추출."""

    deezer_id: int
    isrc: Optional[str]
    title: str
    artist: str
    album: Optional[str]
    duration: int
    preview_url: Optional[str]


@retry(
    retry=retry_if_exception_type((httpx.HTTPError, asyncio.TimeoutError, DeezerError)),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    reraise=True,
)
async def _get_json(
    client: httpx.AsyncClient,
    url: str,
    params: Optional[dict] = None,
) -> dict:
    r = await client.get(url, params=params, timeout=15.0)
    if r.status_code == 429:
        await asyncio.sleep(2.0)
        raise DeezerError("rate limited")
    if r.status_code == 800:
        # Deezer 가끔 800을 반환 (no data)
        return {}
    r.raise_for_status()
    body = r.json()
    if isinstance(body, dict) and body.get("error"):
        err = body["error"]
        code = err.get("code")
        msg = err.get("message", "unknown")
        if code == 800:  # no data found
            return {}
        raise DeezerError(f"deezer error [{code}]: {msg}")
    return body if isinstance(body, dict) else {}


def _normalize(body: dict) -> Optional[DeezerTrack]:
    """Deezer 응답 dict → 정규화된 DeezerTrack."""
    if not body or not body.get("id"):
        return None
    artist = body.get("artist") or {}
    album = body.get("album") or {}
    return DeezerTrack(
        deezer_id=int(body["id"]),
        isrc=body.get("isrc"),
        title=body.get("title") or "",
        artist=artist.get("name") or "",
        album=album.get("title"),
        duration=int(body.get("duration") or 0),
        preview_url=body.get("preview"),
    )


async def lookup_by_isrc(
    client: httpx.AsyncClient,
    isrc: str,
) -> Optional[DeezerTrack]:
    """ISRC 직접 lookup. /track/isrc:XXX 사용 → 한 번에 ISRC + preview URL."""
    isrc = (isrc or "").strip()
    if not isrc:
        return None
    try:
        body = await _get_json(client, f"{BASE_URL}/track/isrc:{isrc}")
    except DeezerError as e:
        log.debug("isrc lookup [%s]: %s", isrc, e)
        return None
    return _normalize(body)


async def search_by_text(
    client: httpx.AsyncClient,
    title: str,
    artist: str,
) -> Optional[DeezerTrack]:
    """제목 + 아티스트 fuzzy 검색. 제목 정확 일치 우선."""
    title = (title or "").strip()
    artist = (artist or "").strip()
    if not title:
        return None
    artist_main = artist.split(",")[0].strip() if artist else ""

    # Deezer advanced search: artist:"X" track:"Y"
    if artist_main:
        q = f'artist:"{artist_main}" track:"{title}"'
    else:
        q = f'track:"{title}"'

    try:
        body = await _get_json(
            client,
            f"{BASE_URL}/search/track",
            params={"q": q, "limit": 5},
        )
    except DeezerError as e:
        log.debug("text search [%s]: %s", q, e)
        return None

    results = body.get("data", []) if isinstance(body, dict) else []
    if not results:
        # fallback: simpler query without quotes
        try:
            body = await _get_json(
                client,
                f"{BASE_URL}/search/track",
                params={"q": f"{title} {artist_main}".strip(), "limit": 5},
            )
        except DeezerError:
            return None
        results = body.get("data", []) if isinstance(body, dict) else []
    if not results:
        return None

    # 1순위: 제목 정확 일치 + preview 있음
    title_lower = title.lower()
    for r in results:
        if (r.get("title") or "").lower() == title_lower and r.get("preview"):
            return _normalize(r)

    # 2순위: 첫 결과 중 preview 있는 것
    for r in results:
        if r.get("preview"):
            return _normalize(r)

    # 3순위: 그냥 첫 결과 (preview 없어도 ISRC는 있을 수 있음)
    return _normalize(results[0])


async def enrich_one(
    client: httpx.AsyncClient,
    isrc: Optional[str],
    title: str,
    artist: str,
) -> Optional[DeezerTrack]:
    """ISRC 있으면 그것으로, 없으면 텍스트로. 정규화된 DeezerTrack 반환."""
    if isrc:
        result = await lookup_by_isrc(client, isrc)
        if result and result.get("preview_url"):
            return result
    return await search_by_text(client, title, artist)
