"""Tidal v2 API → DB import.

엔드포인트는 spec 작성 시점 추정. 실제 호출에서 다르면 코드 조정 필요
(spec section 14 참고).

이 모듈은 fetch 레이어만 — DB import orchestration은 Task 7의 import_all에서.
"""
from __future__ import annotations

from dataclasses import dataclass

import httpx

from mrms.sync.jsonapi import flatten_jsonapi, get_next_cursor


BASE_URL = "https://openapi.tidal.com/v2"


@dataclass
class ImportStats:
    liked_fetched: int = 0
    liked_matched: int = 0
    liked_no_isrc: int = 0
    liked_not_in_catalog: int = 0
    playlists_fetched: int = 0
    playlist_tracks_fetched: int = 0
    playlist_tracks_matched: int = 0
    playlist_tracks_no_isrc: int = 0
    playlist_tracks_not_in_catalog: int = 0
    user_tracks_upserted: int = 0
    user_tracks_is_core: int = 0

    def summary_lines(self) -> list[str]:
        return [
            f"좋아요 트랙 fetch: {self.liked_fetched} (매칭 {self.liked_matched}, "
            f"ISRC 없음 {self.liked_no_isrc}, 미존재 {self.liked_not_in_catalog})",
            f"플레이리스트 {self.playlists_fetched}개 → 트랙 {self.playlist_tracks_fetched}개 "
            f"(매칭 {self.playlist_tracks_matched})",
            f"UserTrack 적재: {self.user_tracks_upserted} (isCore=true: {self.user_tracks_is_core})",
        ]


class TidalImporter:
    def __init__(self, http: httpx.AsyncClient, access_token: str, country_code: str):
        self.http = http
        self.token = access_token
        self.country = country_code

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.token}",
            "Accept": "application/vnd.api+json",
        }

    async def _get(self, path: str, params: dict | None = None) -> dict:
        url = path if path.startswith("http") else f"{BASE_URL}{path}"
        full_params = {"countryCode": self.country, **(params or {})}
        r = await self.http.get(url, params=full_params, headers=self._headers())
        r.raise_for_status()
        return r.json()

    async def fetch_user_info(self) -> dict:
        body = await self._get("/users/me")
        # /users/me는 단일 리소스라 data가 dict일 수 있음 — flatten_jsonapi는 list 가정.
        # dict일 때는 직접 평탄화, list일 때만 flatten 사용.
        data = body.get("data")
        if isinstance(data, dict):
            attrs = data.get("attributes") or {}
            return {"id": data.get("id"), **attrs}
        flat = flatten_jsonapi(body, focus_type="users")
        if not flat:
            return {}
        return flat[0]

    async def fetch_liked_tracks(self, user_id: str) -> list[dict]:
        items: list[dict] = []
        path = f"/userCollections/{user_id}/relationships/tracks"
        cursor: str | None = None
        while True:
            params = {"include": "tracks", "locale": "en-US"}
            if cursor:
                params["page[cursor]"] = cursor
            body = await self._get(path, params=params)
            items.extend(flatten_jsonapi(body, focus_type="tracks"))
            cursor = get_next_cursor(body)
            if not cursor:
                break
        return items

    async def fetch_my_playlists(self, user_id: str) -> list[dict]:
        items: list[dict] = []
        cursor: str | None = None
        while True:
            params = {"filter[r.owners.id]": user_id}
            if cursor:
                params["page[cursor]"] = cursor
            body = await self._get("/playlists", params=params)
            items.extend(flatten_jsonapi(body, focus_type="playlists"))
            cursor = get_next_cursor(body)
            if not cursor:
                break
        return items

    async def fetch_playlist_tracks(self, playlist_id: str) -> list[dict]:
        items: list[dict] = []
        cursor: str | None = None
        while True:
            params = {"include": "items"}
            if cursor:
                params["page[cursor]"] = cursor
            body = await self._get(f"/playlists/{playlist_id}/relationships/items", params=params)
            items.extend(flatten_jsonapi(body, focus_type="tracks"))
            cursor = get_next_cursor(body)
            if not cursor:
                break
        return items
