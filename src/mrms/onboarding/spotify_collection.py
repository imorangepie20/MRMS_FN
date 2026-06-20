"""Spotify 사용자의 favorites + playlists fetch."""
from __future__ import annotations

import httpx


SPOTIFY_API_BASE = "https://api.spotify.com/v1"


async def fetch_spotify_favorite_tracks(
    access_token: str,
    page_size: int = 50,
) -> dict[str, str | None]:
    """GET /me/tracks — 좋아요 누른 트랙 {spotify_id: isrc}. ISRC는 inline."""
    headers = {"Authorization": f"Bearer {access_token}"}
    result: dict[str, str | None] = {}
    url = f"{SPOTIFY_API_BASE}/me/tracks?limit={page_size}&offset=0"

    async with httpx.AsyncClient(timeout=15.0) as http:
        while url:
            r = await http.get(url, headers=headers)
            if r.status_code != 200:
                raise RuntimeError(f"Spotify favorites failed: {r.status_code} {r.text[:200]}")
            data = r.json()
            for item in data.get("items", []):
                track = item.get("track") or {}
                tid = track.get("id")
                if tid:
                    isrc = (track.get("external_ids") or {}).get("isrc")
                    result[tid] = isrc
            url = data.get("next")

    return result


async def fetch_spotify_user_playlists(
    access_token: str,
    page_size: int = 50,
) -> list[tuple[str, str]]:
    """GET /me/playlists — 사용자 플레이리스트 (id, name) 목록. name은 일반 Playlist 생성용."""
    headers = {"Authorization": f"Bearer {access_token}"}
    playlists: list[tuple[str, str]] = []
    url = f"{SPOTIFY_API_BASE}/me/playlists?limit={page_size}&offset=0"

    async with httpx.AsyncClient(timeout=15.0) as http:
        while url:
            r = await http.get(url, headers=headers)
            if r.status_code != 200:
                raise RuntimeError(f"Spotify playlists failed: {r.status_code} {r.text[:200]}")
            data = r.json()
            for item in data.get("items", []):
                pid = item.get("id")
                if pid:
                    playlists.append((pid, (item.get("name") or "Playlist").strip()))
            url = data.get("next")

    return playlists


async def fetch_spotify_playlist_tracks(
    access_token: str,
    playlist_id: str,
    page_size: int = 100,
) -> list[dict]:
    """GET /playlists/{id}/items → 트랙 메타 [{id, title, artist, isrc, cover, duration_ms}].
    local + episode 제외. 메타(특히 isrc·title·artist)는 미매칭 카탈로그 생성용(전곡 import).

    /items + additional_types=track 사용 (Spotify 권장 — /tracks는 deprecated).
    ISRC는 inline (external_ids.isrc) — /tracks?ids= 별도 호출 안 함 (Dev Mode 403).
    """
    headers = {"Authorization": f"Bearer {access_token}"}
    tracks: list[dict] = []
    url = (
        f"{SPOTIFY_API_BASE}/playlists/{playlist_id}/items"
        f"?limit={page_size}&offset=0&additional_types=track"
    )

    async with httpx.AsyncClient(timeout=15.0) as http:
        while url:
            r = await http.get(url, headers=headers)
            if r.status_code != 200:
                raise RuntimeError(f"Spotify playlist items failed: {r.status_code} {r.text[:200]}")
            data = r.json()
            for item in data.get("items", []):
                # /items endpoint: track 객체가 "item" 또는 "track" 키에 들어옴
                track = item.get("item") or item.get("track")
                if not track or track.get("is_local"):
                    continue
                if track.get("type") and track["type"] != "track":
                    continue
                tid = track.get("id")
                if not tid:
                    continue
                arts = track.get("artists") or []
                images = (track.get("album") or {}).get("images") or []
                tracks.append({
                    "id": tid,
                    "title": track.get("name") or "",
                    "artist": (arts[0].get("name") if arts else None) or "Unknown",
                    "isrc": (track.get("external_ids") or {}).get("isrc"),
                    "cover": images[0].get("url") if images else None,
                    "duration_ms": track.get("duration_ms"),
                })
            url = data.get("next")

    return tracks


