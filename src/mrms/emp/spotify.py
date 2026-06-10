"""Spotify featured-playlists 임포터."""
from __future__ import annotations

import base64

import httpx

from mrms.emp.base import EMPImporter


SPOTIFY_API_BASE = "https://api.spotify.com/v1"
SPOTIFY_OAUTH = "https://accounts.spotify.com/api/token"


class SpotifyEMPImporter(EMPImporter):
    platform = "spotify"

    def __init__(self, client_id: str, client_secret: str):
        self.client_id = client_id
        self.client_secret = client_secret

    async def _get_access_token(self) -> str:
        basic = base64.b64encode(f"{self.client_id}:{self.client_secret}".encode()).decode()
        async with httpx.AsyncClient(timeout=10.0) as http:
            r = await http.post(
                SPOTIFY_OAUTH,
                data={"grant_type": "client_credentials"},
                headers={
                    "Authorization": f"Basic {basic}",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            )
            r.raise_for_status()
            return r.json()["access_token"]

    async def fetch_editorial_playlists(self) -> list[dict]:
        token = await self._get_access_token()
        async with httpx.AsyncClient(timeout=15.0) as http:
            r = await http.get(
                f"{SPOTIFY_API_BASE}/browse/featured-playlists",
                headers={"Authorization": f"Bearer {token}"},
                params={"country": "US", "limit": 20},
            )
            r.raise_for_status()
            data = r.json()
            items = (data.get("playlists") or {}).get("items") or []
            return [
                {
                    "id": it["id"],
                    "name": it.get("name"),
                    "source_type": "editorial_playlist",
                }
                for it in items
                if it.get("id")
            ]

    async def fetch_playlist_tracks(self, playlist_id: str) -> list[dict]:
        token = await self._get_access_token()
        result: list[dict] = []
        url = (
            f"{SPOTIFY_API_BASE}/playlists/{playlist_id}/tracks"
            "?limit=100&fields=items(track(id,name,duration_ms,external_ids,artists(name),album(name))),next"
        )
        async with httpx.AsyncClient(timeout=15.0) as http:
            while url:
                r = await http.get(url, headers={"Authorization": f"Bearer {token}"})
                if r.status_code != 200:
                    break
                data = r.json()
                for it in data.get("items", []):
                    tr = it.get("track") or {}
                    tid = tr.get("id")
                    title = tr.get("name")
                    if not tid or not title:
                        continue
                    artists = tr.get("artists") or []
                    artist_name = artists[0].get("name") if artists else "Unknown"
                    album = tr.get("album") or {}
                    isrc = (tr.get("external_ids") or {}).get("isrc")
                    result.append({
                        "platform_track_id": tid,
                        "title": title,
                        "isrc": isrc,
                        "artist": artist_name,
                        "album_title": album.get("name"),
                        "duration_ms": tr.get("duration_ms"),
                    })
                url = data.get("next")
        return result
