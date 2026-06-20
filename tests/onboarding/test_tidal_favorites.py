"""Tidal favorites fetch 테스트."""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from mrms.onboarding.tidal_favorites import fetch_tidal_favorite_tracks


@pytest.mark.asyncio
async def test_fetch_returns_track_ids():
    """Tidal /favorites/tracks 응답에서 trackId 추출."""
    fake_response = MagicMock()
    fake_response.status_code = 200
    fake_response.json = MagicMock(return_value={
        "items": [
            {"item": {"id": 111, "title": "T1"}},
            {"item": {"id": 222, "title": "T2"}},
        ],
        "totalNumberOfItems": 2,
    })
    fake_client = MagicMock()
    fake_client.__aenter__ = AsyncMock(return_value=fake_client)
    fake_client.__aexit__ = AsyncMock(return_value=None)
    fake_client.get = AsyncMock(return_value=fake_response)

    with patch("httpx.AsyncClient", return_value=fake_client):
        ids = await fetch_tidal_favorite_tracks(
            access_token="fake_token",
            tidal_user_id="12345",
            country="KR",
        )
    assert ids == ["111", "222"]


@pytest.mark.asyncio
async def test_fetch_paginates():
    """totalNumberOfItems > limit이면 페이지네이션."""
    page1 = MagicMock()
    page1.status_code = 200
    page1.json = MagicMock(return_value={
        "items": [{"item": {"id": i}} for i in range(50)],
        "totalNumberOfItems": 75,
    })
    page2 = MagicMock()
    page2.status_code = 200
    page2.json = MagicMock(return_value={
        "items": [{"item": {"id": i}} for i in range(50, 75)],
        "totalNumberOfItems": 75,
    })
    fake_client = MagicMock()
    fake_client.__aenter__ = AsyncMock(return_value=fake_client)
    fake_client.__aexit__ = AsyncMock(return_value=None)
    fake_client.get = AsyncMock(side_effect=[page1, page2])

    with patch("httpx.AsyncClient", return_value=fake_client):
        ids = await fetch_tidal_favorite_tracks(
            access_token="fake",
            tidal_user_id="12345",
            country="KR",
        )
    assert len(ids) == 75


@pytest.mark.asyncio
async def test_fetch_user_playlists_returns_uuids():
    """User playlists → list of UUIDs."""
    fake_response = MagicMock()
    fake_response.status_code = 200
    fake_response.json = MagicMock(return_value={
        "items": [
            {"uuid": "pl-aaa", "title": "P1"},
            {"uuid": "pl-bbb", "title": "P2"},
        ],
        "totalNumberOfItems": 2,
    })
    fake_client = MagicMock()
    fake_client.__aenter__ = AsyncMock(return_value=fake_client)
    fake_client.__aexit__ = AsyncMock(return_value=None)
    fake_client.get = AsyncMock(return_value=fake_response)

    from mrms.onboarding.tidal_favorites import fetch_tidal_user_playlists

    with patch("httpx.AsyncClient", return_value=fake_client):
        pls = await fetch_tidal_user_playlists(
            access_token="fake", tidal_user_id="12345", country="KR",
        )
    assert pls == [("pl-aaa", "P1"), ("pl-bbb", "P2")]


@pytest.mark.asyncio
async def test_fetch_playlist_tracks_skips_non_tracks():
    """플레이리스트 items에서 트랙만 (video 등 제외)."""
    fake_response = MagicMock()
    fake_response.status_code = 200
    fake_response.json = MagicMock(return_value={
        "items": [
            {"item": {"id": 111, "type": "track"}},
            {"item": {"id": 222, "type": "video"}},
            {"item": {"id": 333, "type": "track"}},
        ],
        "totalNumberOfItems": 3,
    })
    fake_client = MagicMock()
    fake_client.__aenter__ = AsyncMock(return_value=fake_client)
    fake_client.__aexit__ = AsyncMock(return_value=None)
    fake_client.get = AsyncMock(return_value=fake_response)

    from mrms.onboarding.tidal_favorites import fetch_tidal_playlist_tracks

    with patch("httpx.AsyncClient", return_value=fake_client):
        tracks = await fetch_tidal_playlist_tracks(
            access_token="fake", playlist_uuid="pl-xyz", country="KR",
        )
    assert [t["id"] for t in tracks] == ["111", "333"]  # video(222) 제외
    assert tracks[0]["artist"] == "Unknown"
