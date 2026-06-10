"""Tidal editorial 트랙 임포터 — api.tidal.com + X-Tidal-Token 방식.

openapi.tidal.com (3rd-party용)에는 editorial discovery 없음.
api.tidal.com (Tidal web 클라이언트가 쓰는 비공식 endpoint)에 X-Tidal-Token
헤더 붙이면 /v1/pages/explore에서 큐레이션 받을 수 있음.

토큰은 Setting 테이블의 'tidal_x_token' 키에서 읽거나 생성자 인자로 직접 전달.
없으면 fetch_editorial_playlists가 빈 리스트 반환 (importer는 graceful skip).
"""
from __future__ import annotations

from typing import Iterable

import httpx
import psycopg

from mrms.db.settings import get_setting
from mrms.emp.base import EMPImporter


TIDAL_API_BASE = "https://api.tidal.com/v1"
TOKEN_SETTING_KEY = "tidal_x_token"


class TidalEMPImporter(EMPImporter):
    """X-Tidal-Token 방식. token은 생성자 인자 또는 Setting('tidal_x_token')."""

    platform = "tidal"

    def __init__(self, conn: psycopg.Connection, token: str | None = None):
        self.token = token or get_setting(conn, TOKEN_SETTING_KEY)
        self._conn = conn

    def _headers(self) -> dict[str, str]:
        return {"X-Tidal-Token": self.token or ""}

    @staticmethod
    def _walk_playlists(node) -> Iterable[dict]:
        """페이지 응답 구조에서 {uuid, title} 형태의 playlist 후보를 모두 추출.

        Tidal /pages/explore는 rows[].modules[].pagedList.items 또는
        modules[].playlistList.items 등 다양한 깊이/형태. 재귀로 'uuid' + 'title'
        있는 객체를 다 끌어모음.
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
        params = {"countryCode": "US", "deviceType": "BROWSER"}
        async with httpx.AsyncClient(timeout=20.0) as http:
            r = await http.get(
                f"{TIDAL_API_BASE}/pages/explore",
                headers=self._headers(),
                params=params,
            )
            if r.status_code != 200:
                return []
            data = r.json()

        seen: set[str] = set()
        result: list[dict] = []
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
                    "countryCode": "US",
                    "limit": 100,
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
