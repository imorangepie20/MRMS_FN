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
MAX_PAGES = 1000  # 안전 상한 — 보통 사용자는 트랙 1만개 이내. 외부 API 무한 루프 방지.


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
        flat = flatten_jsonapi(body, focus_type="users")
        if not flat:
            return {}
        return flat[0]

    async def fetch_liked_tracks(self, user_id: str) -> list[dict]:
        seen: dict[tuple[str, str], dict] = {}
        path = f"/userCollections/{user_id}/relationships/tracks"
        cursor: str | None = None
        for _ in range(MAX_PAGES):
            params = {"include": "tracks", "locale": "en-US"}
            if cursor:
                params["page[cursor]"] = cursor
            body = await self._get(path, params=params)
            for item in flatten_jsonapi(body, focus_type="tracks"):
                seen[(item.get("type", ""), item.get("id", ""))] = item
            next_cursor = get_next_cursor(body)
            if not next_cursor or next_cursor == cursor:
                break
            cursor = next_cursor
        return list(seen.values())

    async def fetch_my_playlists(self, user_id: str) -> list[dict]:
        items: list[dict] = []
        cursor: str | None = None
        for _ in range(MAX_PAGES):
            params = {"filter[r.owners.id]": user_id}
            if cursor:
                params["page[cursor]"] = cursor
            body = await self._get("/playlists", params=params)
            items.extend(flatten_jsonapi(body, focus_type="playlists"))
            next_cursor = get_next_cursor(body)
            if not next_cursor or next_cursor == cursor:
                break
            cursor = next_cursor
        return items

    async def fetch_playlist_tracks(self, playlist_id: str) -> list[dict]:
        items: list[dict] = []
        cursor: str | None = None
        for _ in range(MAX_PAGES):
            params = {"include": "items"}
            if cursor:
                params["page[cursor]"] = cursor
            body = await self._get(f"/playlists/{playlist_id}/relationships/items", params=params)
            items.extend(flatten_jsonapi(body, focus_type="tracks"))
            next_cursor = get_next_cursor(body)
            if not next_cursor or next_cursor == cursor:
                break
            cursor = next_cursor
        return items


async def import_all(
    conn,
    user_id: str,
    importer: TidalImporter,
) -> ImportStats:
    """전체 import 흐름 — 좋아요 + 플레이리스트 → DB 적재.

    UserTrack은 이미 있어도 UPSERT 규칙대로 머지 (liked > playlist).
    같은 트랙이 양쪽에 있으면 stats.user_tracks_upserted는 1로 카운트.
    """
    from mrms.db.user_track import find_track_id_by_isrc, upsert_user_track

    stats = ImportStats()
    upserted_tracks: set[str] = set()

    # 사용자 정보
    user_info = await importer.fetch_user_info()
    tidal_uid = user_info.get("id")

    # 좋아요 트랙
    liked = await importer.fetch_liked_tracks(user_id=tidal_uid)
    stats.liked_fetched = len(liked)
    for t in liked:
        isrc = t.get("isrc")
        if not isrc:
            stats.liked_no_isrc += 1
            continue
        track_id = find_track_id_by_isrc(conn, isrc)
        if not track_id:
            stats.liked_not_in_catalog += 1
            continue
        upsert_user_track(
            conn, user_id, track_id,
            is_core=True, source="liked", platform="tidal",
        )
        stats.liked_matched += 1
        if track_id not in upserted_tracks:
            upserted_tracks.add(track_id)
            stats.user_tracks_upserted += 1
            stats.user_tracks_is_core += 1

    # 플레이리스트
    playlists = await importer.fetch_my_playlists(user_id=tidal_uid)
    stats.playlists_fetched = len(playlists)
    for pl in playlists:
        title = pl.get("title", "untitled")
        tracks = await importer.fetch_playlist_tracks(playlist_id=pl["id"])
        for t in tracks:
            stats.playlist_tracks_fetched += 1
            isrc = t.get("isrc")
            if not isrc:
                stats.playlist_tracks_no_isrc += 1
                continue
            track_id = find_track_id_by_isrc(conn, isrc)
            if not track_id:
                stats.playlist_tracks_not_in_catalog += 1
                continue
            upsert_user_track(
                conn, user_id, track_id,
                is_core=False, source=f"playlist:{title}", platform="tidal",
            )
            stats.playlist_tracks_matched += 1
            if track_id not in upserted_tracks:
                upserted_tracks.add(track_id)
                stats.user_tracks_upserted += 1
                # isCore는 liked로 안 들어왔으면 false 유지 — is_core 카운트 X

    return stats
