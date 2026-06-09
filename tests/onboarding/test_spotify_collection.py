"""Spotify favorites + playlists fetch 테스트."""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from mrms.onboarding.spotify_collection import (
    fetch_spotify_favorite_tracks,
    fetch_spotify_playlist_tracks,
    fetch_spotify_user_playlists,
)


@pytest.mark.asyncio
async def test_fetch_favorites_returns_id_to_isrc_map():
    """GET /me/tracks 응답에서 {id: isrc} 추출 (ISRC inline)."""
    fake = MagicMock()
    fake.status_code = 200
    fake.json = MagicMock(return_value={
        "items": [
            {"track": {"id": "TR_A", "external_ids": {"isrc": "USRC10000001"}}},
            {"track": {"id": "TR_B", "external_ids": {"isrc": "USRC10000002"}}},
            {"track": {"id": "TR_C"}},  # ISRC 없음 → None
        ],
        "total": 3,
        "next": None,
    })
    fake_client = MagicMock()
    fake_client.__aenter__ = AsyncMock(return_value=fake_client)
    fake_client.__aexit__ = AsyncMock(return_value=None)
    fake_client.get = AsyncMock(return_value=fake)

    with patch("httpx.AsyncClient", return_value=fake_client):
        result = await fetch_spotify_favorite_tracks(access_token="fake")
    assert result == {
        "TR_A": "USRC10000001",
        "TR_B": "USRC10000002",
        "TR_C": None,
    }


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
    """플레이리스트 items에서 트랙만 (local/episode 제외) + ISRC inline."""
    fake = MagicMock()
    fake.status_code = 200
    fake.json = MagicMock(return_value={
        "items": [
            {"track": {"id": "TR_X", "type": "track", "is_local": False,
                       "external_ids": {"isrc": "USRC10000001"}}},
            {"track": {"id": "EP_Y", "type": "episode", "is_local": False}},
            {"track": {"id": "LOC_Z", "type": "track", "is_local": True}},
            {"track": {"id": "TR_W", "type": "track", "is_local": False,
                       "external_ids": {"isrc": "USRC10000002"}}},
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
        result = await fetch_spotify_playlist_tracks(access_token="fake", playlist_id="PL_X")
    assert result == {
        "TR_X": "USRC10000001",
        "TR_W": "USRC10000002",
    }
