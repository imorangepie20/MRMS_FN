"""iTunes Search API 클라이언트.

무료 공개 엔드포인트, OAuth 불필요.
ISRC 또는 텍스트로 트랙을 찾고 90초 m4a preview URL을 반환.

Docs: https://performance-partners.apple.com/search-api
"""

from __future__ import annotations

import asyncio
import logging
from typing import Optional

import httpx
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

log = logging.getLogger(__name__)

BASE_URL = "https://itunes.apple.com/search"

# Apple 검색 국가 — US가 가장 광범위, KR은 K-pop 우선
DEFAULT_COUNTRIES = ("US", "KR")


class ITunesError(Exception):
    pass


@retry(
    retry=retry_if_exception_type((httpx.HTTPError, asyncio.TimeoutError, ITunesError)),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    reraise=True,
)
async def _search(client: httpx.AsyncClient, params: dict) -> list[dict]:
    r = await client.get(BASE_URL, params=params, timeout=15.0)
    if r.status_code == 429:
        # 잠시 대기 후 재시도하면 보통 풀림
        await asyncio.sleep(2.0)
        raise ITunesError("rate limited")
    r.raise_for_status()
    body = r.json()
    return body.get("results", []) or []


async def search_by_isrc(
    client: httpx.AsyncClient,
    isrc: str,
    countries: tuple[str, ...] = DEFAULT_COUNTRIES,
) -> Optional[str]:
    """ISRC로 검색해 preview URL 반환. 못 찾으면 None."""
    isrc = isrc.strip()
    if not isrc:
        return None
    for country in countries:
        try:
            results = await _search(
                client,
                {"term": isrc, "entity": "song", "country": country, "limit": 1},
            )
        except Exception as e:
            log.debug("isrc search failed [%s/%s]: %s", isrc, country, e)
            continue
        if results:
            url = results[0].get("previewUrl")
            if url:
                return url
    return None


async def search_by_text(
    client: httpx.AsyncClient,
    title: str,
    artist: str,
    countries: tuple[str, ...] = DEFAULT_COUNTRIES,
) -> Optional[str]:
    """제목+아티스트로 검색 (fallback). 제목 정확 일치 우선."""
    title = (title or "").strip()
    artist = (artist or "").strip()
    if not title:
        return None
    # 여러 아티스트면 첫 명만 (콤마 split)
    artist_main = artist.split(",")[0].strip() if artist else ""
    term = f"{title} {artist_main}".strip()
    title_lower = title.lower()

    for country in countries:
        try:
            results = await _search(
                client,
                {"term": term, "entity": "song", "country": country, "limit": 5},
            )
        except Exception as e:
            log.debug("text search failed [%s/%s]: %s", term, country, e)
            continue
        if not results:
            continue
        # 1순위: 제목 정확 일치
        for r in results:
            if (r.get("trackName") or "").lower() == title_lower:
                url = r.get("previewUrl")
                if url:
                    return url
        # 2순위: 첫 결과
        url = results[0].get("previewUrl")
        if url:
            return url
    return None
