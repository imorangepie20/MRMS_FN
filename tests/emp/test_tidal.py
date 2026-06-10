"""TidalEMPImporter — editorial playlist + 트랙 fetch + upsert."""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from mrms.emp.tidal import TidalEMPImporter


@pytest.mark.asyncio
async def test_fetch_editorial_playlists():
    """editorial endpoint mock → playlist 목록 반환."""
    importer = TidalEMPImporter(client_id="x", client_secret="y")
    fake_resp = MagicMock()
    fake_resp.status_code = 200
    fake_resp.json = MagicMock(
        return_value={
            "items": [
                {"uuid": "pl1", "title": "Rising"},
                {"uuid": "pl2", "title": "New Arrivals"},
            ]
        }
    )
    fake_client = MagicMock()
    fake_client.__aenter__ = AsyncMock(return_value=fake_client)
    fake_client.__aexit__ = AsyncMock(return_value=None)
    fake_client.get = AsyncMock(return_value=fake_resp)

    with patch("httpx.AsyncClient", return_value=fake_client), \
         patch.object(TidalEMPImporter, "_get_access_token", AsyncMock(return_value="fake_token")):
        result = await importer.fetch_editorial_playlists()
    assert len(result) >= 2
    ids = [p["id"] for p in result]
    assert "pl1" in ids


@pytest.mark.asyncio
async def test_fetch_playlist_tracks_parses_isrc():
    """playlist tracks API → ISRC 포함 dict 리스트."""
    importer = TidalEMPImporter(client_id="x", client_secret="y")
    fake_resp = MagicMock()
    fake_resp.status_code = 200
    fake_resp.json = MagicMock(
        return_value={
            "items": [
                {
                    "id": "tt1",
                    "title": "Song A",
                    "isrc": "USRC10000001",
                    "duration": 180,
                    "artists": [{"name": "Artist A"}],
                    "album": {"title": "Album A"},
                },
                {
                    "id": "tt2",
                    "title": "Song B",
                    "isrc": None,
                    "duration": 200,
                    "artists": [{"name": "Artist B"}],
                    "album": {"title": "Album B"},
                },
            ]
        }
    )
    fake_client = MagicMock()
    fake_client.__aenter__ = AsyncMock(return_value=fake_client)
    fake_client.__aexit__ = AsyncMock(return_value=None)
    fake_client.get = AsyncMock(return_value=fake_resp)

    with patch("httpx.AsyncClient", return_value=fake_client), \
         patch.object(TidalEMPImporter, "_get_access_token", AsyncMock(return_value="fake_token")):
        tracks = await importer.fetch_playlist_tracks("pl1")
    assert len(tracks) == 2
    assert tracks[0]["isrc"] == "USRC10000001"
    assert tracks[0]["title"] == "Song A"
    assert tracks[0]["artist"] == "Artist A"
    assert tracks[0]["album_title"] == "Album A"
    assert tracks[0]["duration_ms"] == 180_000
    assert tracks[0]["platform_track_id"] == "tt1"
    assert tracks[1]["isrc"] is None
