"""Spotify /v1/search 멀티타입 어댑터. 토큰은 호출자가 주입(auth_spotify.get_token)."""
from __future__ import annotations

import logging

import httpx

from mrms.search.normalize import (
    normalize_spotify_album,
    normalize_spotify_playlist,
    normalize_spotify_track,
)

log = logging.getLogger(__name__)

SPOTIFY_SEARCH_URL = "https://api.spotify.com/v1/search"
LIMIT = 20


async def search_spotify(
    http: httpx.AsyncClient, token: str, q: str, types: list[str]
) -> dict:
    r = await http.get(
        SPOTIFY_SEARCH_URL,
        params={"q": q, "type": ",".join(types), "limit": LIMIT},
        headers={"Authorization": f"Bearer {token}"},
    )
    if r.status_code != 200:
        # 401(토큰 만료/무효) 등을 조용히 빈 결과로 삼키면 "결과 0, 안내 없음"이 돼
        # 혼란스럽다 → raise 해서 라우트가 해당 플랫폼을 skip(부분 결과 안내) + 로깅하게.
        log.warning("spotify /v1/search %s: %s", r.status_code, r.text[:400])
        raise RuntimeError(f"spotify search failed: {r.status_code}")
    body = r.json()
    tracks = [n for n in (normalize_spotify_track(i)
              for i in (body.get("tracks") or {}).get("items") or []) if n]
    albums = [n for n in (normalize_spotify_album(i)
              for i in (body.get("albums") or {}).get("items") or []) if n]
    playlists = [n for n in (normalize_spotify_playlist(i)
                 for i in (body.get("playlists") or {}).get("items") or []) if n]
    return {"tracks": tracks, "albums": albums, "playlists": playlists}
