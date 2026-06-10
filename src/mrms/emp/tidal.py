"""Tidal editorial playlist 임포터.

Note: Tidal API의 정확한 editorial endpoint는 환경에 따라 다를 수 있음.
실제 응답 형태가 다르면 _parse_* 메서드 조정 필요.
"""
from __future__ import annotations

import base64

import httpx

from mrms.emp.base import EMPImporter


TIDAL_API_BASE = "https://openapi.tidal.com/v2"
TIDAL_OAUTH = "https://auth.tidal.com/v1/oauth2/token"

# editorial wellknown playlists — API 실패 시 fallback
DEFAULT_PLAYLISTS = [
    {"id": "tidal_rising", "name": "Tidal Rising", "source_type": "editorial_playlist"},
    {"id": "tidal_discovery", "name": "Tidal Discovery", "source_type": "editorial_playlist"},
]


class TidalEMPImporter(EMPImporter):
    """Tidal editorial playlist 임포터."""

    platform = "tidal"

    def __init__(self, client_id: str, client_secret: str):
        self.client_id = client_id
        self.client_secret = client_secret

    async def _get_access_token(self) -> str:
        """client_credentials grant."""
        basic = base64.b64encode(f"{self.client_id}:{self.client_secret}".encode()).decode()
        async with httpx.AsyncClient(timeout=15.0) as http:
            r = await http.post(
                TIDAL_OAUTH,
                data={"grant_type": "client_credentials"},
                headers={
                    "Authorization": f"Basic {basic}",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            )
            r.raise_for_status()
            return r.json()["access_token"]

    async def fetch_editorial_playlists(self) -> list[dict]:
        """기본은 DEFAULT_PLAYLISTS. API 가능하면 거기서 가져옴."""
        token = await self._get_access_token()
        async with httpx.AsyncClient(timeout=15.0) as http:
            try:
                r = await http.get(
                    f"{TIDAL_API_BASE}/playlists",
                    headers={"Authorization": f"Bearer {token}"},
                    params={"countryCode": "US", "limit": 20},
                )
                if r.status_code == 200:
                    data = r.json()
                    items = data.get("items") or data.get("data") or []
                    result = []
                    for it in items:
                        pid = it.get("uuid") or it.get("id")
                        attr = it.get("attributes") or it
                        name = it.get("title") or attr.get("title")
                        if pid:
                            result.append({
                                "id": str(pid),
                                "name": name,
                                "source_type": "editorial_playlist",
                            })
                    if result:
                        return result
            except Exception:
                pass

        # fallback
        return DEFAULT_PLAYLISTS

    async def fetch_playlist_tracks(self, playlist_id: str) -> list[dict]:
        """한 playlist 트랙들."""
        token = await self._get_access_token()
        result: list[dict] = []
        async with httpx.AsyncClient(timeout=15.0) as http:
            r = await http.get(
                f"{TIDAL_API_BASE}/playlists/{playlist_id}/items",
                headers={"Authorization": f"Bearer {token}"},
                params={"countryCode": "US", "limit": 100},
            )
            if r.status_code != 200:
                return result
            data = r.json()
            items = data.get("items") or data.get("data") or []
            for it in items:
                # v1/v2 응답 형식 차이 흡수
                tid = it.get("id") or it.get("uuid")
                attr = it.get("attributes") or it
                title = attr.get("title")
                isrc = attr.get("isrc")
                duration_sec = attr.get("duration") or 0
                artists = attr.get("artists") or []
                artist_name = artists[0].get("name") if artists else "Unknown"
                album = attr.get("album") or {}
                album_title = album.get("title")
                if tid and title:
                    result.append({
                        "platform_track_id": str(tid),
                        "title": title,
                        "isrc": isrc,
                        "artist": artist_name,
                        "album_title": album_title,
                        "duration_ms": int(duration_sec) * 1000 if duration_sec else None,
                    })
        return result
