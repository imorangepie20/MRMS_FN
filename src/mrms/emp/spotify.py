"""Spotify editorial 트랙 임포터.

Spotify가 2024-11에 /browse/featured-playlists 같은 큐레이션 endpoint를
신규 앱에 차단. 대신 잘 알려진 public playlist ID 목록 (env로 override 가능)을
직접 /v1/playlists/{id}/tracks로 가져옴.
"""
from __future__ import annotations

import base64
import os

import httpx

from mrms.emp.base import EMPImporter


SPOTIFY_API_BASE = "https://api.spotify.com/v1"
SPOTIFY_OAUTH = "https://accounts.spotify.com/api/token"

# spotify-owned (또는 기타 공개) editorial playlists.
# 신규 앱은 spotify-owned algorithmic playlists 접근 제한될 수 있음 — 그 경우 403 skip.
# env `SPOTIFY_EMP_PLAYLISTS=id1,id2,...`로 override.
DEFAULT_PLAYLISTS: list[tuple[str, str]] = [
    ("37i9dQZEVXbMDoHDwVN2tF", "Global Top 50"),
    ("37i9dQZF1DXcBWIGoYBM5M", "Today's Top Hits"),
    ("37i9dQZF1DX0XUsuxWHRQd", "RapCaviar"),
    ("37i9dQZF1DX10zKzsJ2jva", "Viva Latino"),
    ("37i9dQZF1DX4o1oenSJRJd", "All Out 2010s"),
    ("37i9dQZF1DWXRqgorJj26U", "Rock Classics"),
    ("37i9dQZF1DX9tPFwDMOaN1", "K-Pop Daebak"),
    ("37i9dQZF1DX2RxBh3leLJj", "K-Pop Rising"),
    ("37i9dQZF1DWY6tYEFs22tT", "Jazz Vibes"),
    ("37i9dQZF1DX5Vy6DFOcx00", "Bossa Nova Dinner"),
]


def _load_playlists_from_env() -> list[tuple[str, str]] | None:
    raw = os.environ.get("SPOTIFY_EMP_PLAYLISTS", "").strip()
    if not raw:
        return None
    out: list[tuple[str, str]] = []
    for entry in raw.split(","):
        entry = entry.strip()
        if not entry:
            continue
        if ":" in entry:
            pid, name = entry.split(":", 1)
            out.append((pid.strip(), name.strip()))
        else:
            out.append((entry, entry))
    return out or None


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
        playlists = _load_playlists_from_env() or DEFAULT_PLAYLISTS
        return [
            {"id": pid, "name": name, "source_type": "editorial_playlist"}
            for pid, name in playlists
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
