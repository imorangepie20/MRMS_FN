"""SpotifyEMPImporter — featured-playlists 임포터."""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from mrms.emp.spotify import SpotifyEMPImporter


@pytest.mark.asyncio
async def test_fetch_featured_playlists():
    importer = SpotifyEMPImporter(client_id="x", client_secret="y")
    fake_resp = MagicMock()
    fake_resp.status_code = 200
    fake_resp.json = MagicMock(
        return_value={
            "playlists": {
                "items": [
                    {"id": "spl1", "name": "New Music Friday"},
                    {"id": "spl2", "name": "RapCaviar"},
                ]
            }
        }
    )
    fake_resp.raise_for_status = MagicMock()
    fake_client = MagicMock()
    fake_client.__aenter__ = AsyncMock(return_value=fake_client)
    fake_client.__aexit__ = AsyncMock(return_value=None)
    fake_client.get = AsyncMock(return_value=fake_resp)

    with patch("httpx.AsyncClient", return_value=fake_client), \
         patch.object(SpotifyEMPImporter, "_get_access_token", AsyncMock(return_value="t")):
        result = await importer.fetch_editorial_playlists()
    assert len(result) >= 2
    assert {p["id"] for p in result} >= {"spl1", "spl2"}


@pytest.mark.asyncio
async def test_fetch_playlist_tracks_extracts_isrc_inline():
    importer = SpotifyEMPImporter(client_id="x", client_secret="y")
    fake_resp = MagicMock()
    fake_resp.status_code = 200
    fake_resp.json = MagicMock(
        return_value={
            "items": [
                {
                    "track": {
                        "id": "st1",
                        "name": "Song A",
                        "duration_ms": 180000,
                        "external_ids": {"isrc": "USRC10000001"},
                        "artists": [{"name": "Artist A"}],
                        "album": {"name": "Album A"},
                    }
                },
                {
                    "track": {
                        "id": "st2",
                        "name": "Song B",
                        "duration_ms": 200000,
                        "external_ids": {},
                        "artists": [{"name": "Artist B"}],
                        "album": {"name": "Album B"},
                    }
                },
            ],
            "next": None,
        }
    )
    fake_client = MagicMock()
    fake_client.__aenter__ = AsyncMock(return_value=fake_client)
    fake_client.__aexit__ = AsyncMock(return_value=None)
    fake_client.get = AsyncMock(return_value=fake_resp)

    with patch("httpx.AsyncClient", return_value=fake_client), \
         patch.object(SpotifyEMPImporter, "_get_access_token", AsyncMock(return_value="t")):
        tracks = await importer.fetch_playlist_tracks("spl1")
    assert len(tracks) == 2
    assert tracks[0]["isrc"] == "USRC10000001"
    assert tracks[0]["title"] == "Song A"
    assert tracks[0]["platform_track_id"] == "st1"
    assert tracks[1]["isrc"] is None
