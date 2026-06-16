"""Spotify 아티스트 조회 — app 토큰(client_credentials)으로 이미지/장르. best-effort."""
from __future__ import annotations

import logging

import httpx

from mrms.search.app_token import get_app_token

log = logging.getLogger(__name__)

SPOTIFY_SEARCH_URL = "https://api.spotify.com/v1/search"


async def fetch_spotify_artist(
    http: httpx.AsyncClient, name: str
) -> tuple[str | None, list[str]]:
    """이름으로 Spotify 아티스트 검색 → (image_url, genres). 실패/무매칭 → (None, [])."""
    try:
        tok = await get_app_token(http, "spotify")
        r = await http.get(
            SPOTIFY_SEARCH_URL,
            params={"q": name, "type": "artist", "limit": 1},
            headers={"Authorization": f"Bearer {tok}"},
        )
        if r.status_code != 200:
            log.warning("spotify artist %s: %s", name, r.status_code)
            return None, []
        items = ((r.json().get("artists") or {}).get("items")) or []
        if not items:
            return None, []
        a = items[0]
        imgs = a.get("images") or []
        image = imgs[0].get("url") if imgs else None
        return image, list(a.get("genres") or [])
    except Exception as e:  # noqa: BLE001 — best-effort
        log.warning("spotify artist fetch failed for %s: %r", name, e)
        return None, []
