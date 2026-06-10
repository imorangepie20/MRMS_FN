"""Tidal editorial 트랙 임포터 — tidal.com/v1 + X-Tidal-Token 방식.

openapi.tidal.com (3rd-party용)에는 editorial discovery 없음.
tidal.com (Tidal web 클라이언트가 직접 호출하는 endpoint)에 X-Tidal-Token
헤더 붙이면 /v1/pages/* 에서 큐레이션 받을 수 있음.

토큰은 Setting 테이블의 'tidal_x_token' 키에서 읽거나 생성자 인자로 직접 전달.
없으면 fetch_editorial_playlists가 빈 리스트 반환 (importer는 graceful skip).
"""
from __future__ import annotations

from typing import Iterable

import httpx
import psycopg

from mrms.db.settings import get_setting
from mrms.emp.base import EMPImporter


TIDAL_API_BASE = "https://tidal.com/v1"
TOKEN_SETTING_KEY = "tidal_x_token"
DEFAULT_COUNTRY = "US"
DEFAULT_LOCALE = "en_US"
DEFAULT_DEVICE = "BROWSER"

# 다양한 페르소나를 만족시키려면 풀이 넓어야 함. 장르별 페이지 + explore 페이지 다 훑음.
DISCOVERY_PAGES = [
    "explore",
    "home",
    "genre_pop",
    "genre_rock",
    "genre_hiphop",
    "genre_rnb",
    "genre_electronic",
    "genre_country",
    "genre_latin",
    "genre_jazz",
    "genre_classical",
    "genre_blues",
    "genre_folk",
    "genre_reggae",
    "genre_metal",
    "genre_kpop",
    "genre_jpop",
    "genre_indie",
    "genre_world",
]


class TidalEMPImporter(EMPImporter):
    """X-Tidal-Token 방식. token은 생성자 인자 또는 Setting('tidal_x_token')."""

    platform = "tidal"

    def __init__(self, conn: psycopg.Connection, token: str | None = None):
        self.token = token or get_setting(conn, TOKEN_SETTING_KEY)
        self._conn = conn

    def _headers(self) -> dict[str, str]:
        return {
            "X-Tidal-Token": self.token or "",
            "Accept": "application/json",
        }

    def _common_params(self) -> dict[str, str]:
        return {
            "countryCode": DEFAULT_COUNTRY,
            "locale": DEFAULT_LOCALE,
            "deviceType": DEFAULT_DEVICE,
        }

    @staticmethod
    def _walk_playlists(node) -> Iterable[dict]:
        """페이지 응답 구조에서 {uuid, title} 형태의 playlist 후보 추출.

        Tidal /pages/* 응답은 rows[].modules[].pagedList.items 또는
        modules[].playlistList.items 등 다양한 깊이/형태. 재귀로 'uuid' + 'title'
        있는 객체 모두 수집.
        """
        if isinstance(node, dict):
            uuid = node.get("uuid")
            title = node.get("title")
            if uuid and title and isinstance(uuid, str) and len(uuid) >= 16:
                yield {"uuid": uuid, "title": title}
            for v in node.values():
                yield from TidalEMPImporter._walk_playlists(v)
        elif isinstance(node, list):
            for v in node:
                yield from TidalEMPImporter._walk_playlists(v)

    async def fetch_editorial_playlists(self) -> list[dict]:
        if not self.token:
            return []
        seen: set[str] = set()
        result: list[dict] = []
        async with httpx.AsyncClient(timeout=20.0) as http:
            for page in DISCOVERY_PAGES:
                try:
                    r = await http.get(
                        f"{TIDAL_API_BASE}/pages/{page}",
                        headers=self._headers(),
                        params=self._common_params(),
                    )
                    if r.status_code != 200:
                        continue
                    data = r.json()
                except Exception:
                    continue
                for cand in self._walk_playlists(data):
                    uuid = cand["uuid"]
                    if uuid in seen:
                        continue
                    seen.add(uuid)
                    result.append({
                        "id": uuid,
                        "name": cand["title"],
                        "source_type": "editorial_playlist",
                    })
        return result

    async def fetch_playlist_tracks(self, playlist_id: str) -> list[dict]:
        if not self.token:
            return []
        result: list[dict] = []
        offset = 0
        async with httpx.AsyncClient(timeout=20.0) as http:
            while True:
                params = {
                    **self._common_params(),
                    "limit": 50,
                    "offset": offset,
                }
                r = await http.get(
                    f"{TIDAL_API_BASE}/playlists/{playlist_id}/items",
                    headers=self._headers(),
                    params=params,
                )
                if r.status_code != 200:
                    break
                data = r.json()
                items = data.get("items") or []
                if not items:
                    break
                for entry in items:
                    tr = entry.get("item") if isinstance(entry.get("item"), dict) else entry
                    if not tr:
                        continue
                    tid = tr.get("id")
                    title = tr.get("title")
                    if not tid or not title:
                        continue
                    isrc = tr.get("isrc")
                    duration_sec = tr.get("duration") or 0
                    artists = tr.get("artists") or []
                    artist_name = artists[0].get("name") if artists else "Unknown"
                    album = tr.get("album") or {}
                    album_title = album.get("title")
                    result.append({
                        "platform_track_id": str(tid),
                        "title": title,
                        "isrc": isrc,
                        "artist": artist_name,
                        "album_title": album_title,
                        "duration_ms": int(duration_sec) * 1000 if duration_sec else None,
                    })
                total = data.get("totalNumberOfItems") or len(items)
                offset += len(items)
                if offset >= total:
                    break
        return result
