"""Spotify /v1/search 멀티타입 어댑터. 토큰은 호출자가 주입(auth_spotify.get_token)."""
from __future__ import annotations

import httpx

from mrms.search.normalize import (
    normalize_spotify_album,
    normalize_spotify_playlist,
    normalize_spotify_track,
)

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
    body = r.json() if r.status_code == 200 else {}
    tracks = [n for n in (normalize_spotify_track(i)
              for i in (body.get("tracks") or {}).get("items") or []) if n]
    albums = [n for n in (normalize_spotify_album(i)
              for i in (body.get("albums") or {}).get("items") or []) if n]
    playlists = [n for n in (normalize_spotify_playlist(i)
                 for i in (body.get("playlists") or {}).get("items") or []) if n]
    return {"tracks": tracks, "albums": albums, "playlists": playlists}
