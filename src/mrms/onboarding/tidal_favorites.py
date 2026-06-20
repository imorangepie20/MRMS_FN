"""Tidal 사용자의 좋아요 트랙 목록 fetch."""
from __future__ import annotations

import httpx


TIDAL_API_BASE = "https://api.tidal.com/v1"


async def fetch_tidal_favorite_tracks(
    access_token: str,
    tidal_user_id: str,
    country: str = "KR",
    page_size: int = 50,
) -> list[str]:
    """전체 좋아요 트랙 ID 목록 반환 (페이지네이션 처리)."""
    headers = {"Authorization": f"Bearer {access_token}"}
    track_ids: list[str] = []
    offset = 0

    async with httpx.AsyncClient(timeout=15.0) as http:
        while True:
            r = await http.get(
                f"{TIDAL_API_BASE}/users/{tidal_user_id}/favorites/tracks",
                params={"countryCode": country, "limit": page_size, "offset": offset},
                headers=headers,
            )
            if r.status_code != 200:
                raise RuntimeError(f"Tidal favorites failed: {r.status_code} {r.text[:200]}")
            data = r.json()
            items = data.get("items", [])
            for item in items:
                track = item.get("item") or item
                track_id = track.get("id")
                if track_id is not None:
                    track_ids.append(str(track_id))
            total = data.get("totalNumberOfItems", len(track_ids))
            offset += len(items)
            if not items or offset >= total:
                break

    return track_ids


async def fetch_tidal_user_playlists(
    access_token: str,
    tidal_user_id: str,
    country: str = "KR",
    page_size: int = 50,
) -> list[tuple[str, str]]:
    """User의 플레이리스트 (uuid, title) 목록 (페이지네이션). title은 일반 Playlist 생성용."""
    headers = {"Authorization": f"Bearer {access_token}"}
    playlists: list[tuple[str, str]] = []
    offset = 0

    async with httpx.AsyncClient(timeout=15.0) as http:
        while True:
            r = await http.get(
                f"{TIDAL_API_BASE}/users/{tidal_user_id}/playlists",
                params={"countryCode": country, "limit": page_size, "offset": offset},
                headers=headers,
            )
            if r.status_code != 200:
                raise RuntimeError(f"Tidal playlists failed: {r.status_code} {r.text[:200]}")
            data = r.json()
            items = data.get("items", [])
            for item in items:
                pl = item.get("item") or item
                uuid_val = pl.get("uuid")
                if uuid_val:
                    playlists.append((uuid_val, (pl.get("title") or "Playlist").strip()))
            total = data.get("totalNumberOfItems", len(playlists))
            offset += len(items)
            if not items or offset >= total:
                break

    return playlists


async def fetch_tidal_playlist_tracks(
    access_token: str,
    playlist_uuid: str,
    country: str = "KR",
    page_size: int = 100,
) -> list[dict]:
    """플레이리스트 트랙 메타 목록 [{id, title, artist, isrc, cover, duration_ms}].
    비-track(video 등) 제외. 메타는 미매칭 트랙 카탈로그 생성용(전곡 import)."""
    headers = {"Authorization": f"Bearer {access_token}"}
    tracks: list[dict] = []
    offset = 0

    async with httpx.AsyncClient(timeout=15.0) as http:
        while True:
            r = await http.get(
                f"{TIDAL_API_BASE}/playlists/{playlist_uuid}/items",
                params={"countryCode": country, "limit": page_size, "offset": offset},
                headers=headers,
            )
            if r.status_code != 200:
                raise RuntimeError(f"Tidal playlist items failed: {r.status_code} {r.text[:200]}")
            data = r.json()
            items = data.get("items", [])
            for item in items:
                track = item.get("item") or item
                if track.get("type") and track["type"] != "track":
                    continue  # video, etc.
                tid = track.get("id")
                if tid is None:
                    continue
                artist = (track.get("artist") or {}).get("name")
                if not artist:
                    arts = track.get("artists") or []
                    artist = arts[0].get("name") if arts else None
                cover_id = (track.get("album") or {}).get("cover")
                cover = (
                    f"https://resources.tidal.com/images/{cover_id.replace('-', '/')}/320x320.jpg"
                    if isinstance(cover_id, str) and "-" in cover_id else None
                )
                dur = track.get("duration")
                tracks.append({
                    "id": str(tid),
                    "title": track.get("title") or "",
                    "artist": artist or "Unknown",
                    "isrc": track.get("isrc"),
                    "cover": cover,
                    "duration_ms": dur * 1000 if isinstance(dur, int) else None,
                })
            total = data.get("totalNumberOfItems", len(tracks))
            offset += len(items)
            if not items or offset >= total:
                break

    return tracks
