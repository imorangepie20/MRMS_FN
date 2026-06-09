"""Spotify favorites + playlists fetch 테스트."""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from mrms.onboarding.spotify_collection import (
    fetch_spotify_favorite_tracks,
    fetch_spotify_playlist_tracks,
    fetch_spotify_user_playlists,
)


@pytest.mark.asyncio
async def test_fetch_favorites_returns_track_ids():
    """GET /me/tracks 응답에서 track.id 추출."""
    fake = MagicMock()
    fake.status_code = 200
    fake.json = MagicMock(return_value={
        "items": [
            {"track": {"id": "TR_A", "name": "T1"}},
            {"track": {"id": "TR_B", "name": "T2"}},
        ],
        "total": 2,
        "next": None,
    })
    fake_client = MagicMock()
    fake_client.__aenter__ = AsyncMock(return_value=fake_client)
    fake_client.__aexit__ = AsyncMock(return_value=None)
    fake_client.get = AsyncMock(return_value=fake)

    with patch("httpx.AsyncClient", return_value=fake_client):
        ids = await fetch_spotify_favorite_tracks(access_token="fake")
    assert ids == ["TR_A", "TR_B"]


@pytest.mark.asyncio
async def test_fetch_user_playlists_returns_ids():
    """GET /me/playlists 응답에서 playlist.id 추출."""
    fake = MagicMock()
    fake.status_code = 200
    fake.json = MagicMock(return_value={
        "items": [
            {"id": "PL_A", "name": "P1"},
            {"id": "PL_B", "name": "P2"},
        ],
        "total": 2,
        "next": None,
    })
    fake_client = MagicMock()
    fake_client.__aenter__ = AsyncMock(return_value=fake_client)
    fake_client.__aexit__ = AsyncMock(return_value=None)
    fake_client.get = AsyncMock(return_value=fake)

    with patch("httpx.AsyncClient", return_value=fake_client):
        ids = await fetch_spotify_user_playlists(access_token="fake")
    assert ids == ["PL_A", "PL_B"]


@pytest.mark.asyncio
async def test_fetch_playlist_tracks_skips_local_and_episodes():
    """플레이리스트 items에서 트랙만 (local/episode 제외)."""
    fake = MagicMock()
    fake.status_code = 200
    fake.json = MagicMock(return_value={
        "items": [
            {"track": {"id": "TR_X", "type": "track", "is_local": False}},
            {"track": {"id": "EP_Y", "type": "episode", "is_local": False}},
            {"track": {"id": "LOC_Z", "type": "track", "is_local": True}},
            {"track": {"id": "TR_W", "type": "track", "is_local": False}},
            {"track": None},  # 삭제된 트랙
        ],
        "total": 5,
        "next": None,
    })
    fake_client = MagicMock()
    fake_client.__aenter__ = AsyncMock(return_value=fake_client)
    fake_client.__aexit__ = AsyncMock(return_value=None)
    fake_client.get = AsyncMock(return_value=fake)

    with patch("httpx.AsyncClient", return_value=fake_client):
        ids = await fetch_spotify_playlist_tracks(access_token="fake", playlist_id="PL_X")
    assert ids == ["TR_X", "TR_W"]
