"""Spotify 사용자의 favorites + playlists fetch."""
from __future__ import annotations

import httpx


SPOTIFY_API_BASE = "https://api.spotify.com/v1"


async def fetch_spotify_favorite_tracks(
    access_token: str,
    page_size: int = 50,
) -> list[str]:
    """GET /me/tracks — 좋아요 누른 트랙 (페이지네이션)."""
    headers = {"Authorization": f"Bearer {access_token}"}
    track_ids: list[str] = []
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
                    track_ids.append(tid)
            url = data.get("next")

    return track_ids


async def fetch_spotify_user_playlists(
    access_token: str,
    page_size: int = 50,
) -> list[str]:
    """GET /me/playlists — 사용자 플레이리스트 ID 목록."""
    headers = {"Authorization": f"Bearer {access_token}"}
    playlist_ids: list[str] = []
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
                    playlist_ids.append(pid)
            url = data.get("next")

    return playlist_ids


async def fetch_spotify_playlist_tracks(
    access_token: str,
    playlist_id: str,
    page_size: int = 100,
) -> list[str]:
    """GET /playlists/{id}/items — 트랙만 (local + episode 제외).

    /items + additional_types=track 사용 (Spotify 권장 — /tracks는 deprecated).
    """
    headers = {"Authorization": f"Bearer {access_token}"}
    track_ids: list[str] = []
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
                # /items endpoint: track 객체가 "item" 또는 "track" 키에 들어옴 (응답 형식 차이)
                track = item.get("item") or item.get("track")
                if not track:
                    continue
                if track.get("is_local"):
                    continue
                if track.get("type") and track["type"] != "track":
                    continue
                tid = track.get("id")
                if tid:
                    track_ids.append(tid)
            url = data.get("next")

    return track_ids
