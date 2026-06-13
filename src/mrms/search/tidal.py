"""Tidal per-type 검색 어댑터(api.tidal.com/v1, 유저 Bearer). 앨범/플레이리스트는
degrade-capable — 엔드포인트가 404/에러면 빈 리스트(spike: tidal-search-spike.md)."""
from __future__ import annotations

import httpx

from mrms.search.normalize import (
    normalize_tidal_album,
    normalize_tidal_playlist,
    normalize_tidal_track,
)

TIDAL_SEARCH_BASE = "https://api.tidal.com/v1/search"
LIMIT = 20


async def _get_items(http, path, token, q, country):
    try:
        r = await http.get(
            f"{TIDAL_SEARCH_BASE}/{path}",
            params={"query": q, "limit": LIMIT, "countryCode": country},
            headers={"Authorization": f"Bearer {token}"},
        )
        if r.status_code != 200:
            return []
        return r.json().get("items") or []
    except httpx.HTTPError:
        return []


async def search_tidal(
    http: httpx.AsyncClient, token: str, q: str, types: list[str], country: str
) -> dict:
    out = {"tracks": [], "albums": [], "playlists": []}
    if "track" in types:
        items = await _get_items(http, "tracks", token, q, country)
        out["tracks"] = [n for n in (normalize_tidal_track(i) for i in items) if n]
    if "album" in types:
        items = await _get_items(http, "albums", token, q, country)
        out["albums"] = [n for n in (normalize_tidal_album(i) for i in items) if n]
    if "playlist" in types:
        items = await _get_items(http, "playlists", token, q, country)
        out["playlists"] = [n for n in (normalize_tidal_playlist(i) for i in items) if n]
    return out
