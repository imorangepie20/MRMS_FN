"""SpotifyEMPImporter — hardcoded editorial playlist IDs (Spotify가 /browse/featured-playlists 차단)."""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from mrms.emp.spotify import DEFAULT_PLAYLISTS, SpotifyEMPImporter


@pytest.mark.asyncio
async def test_default_playlists_returned():
    """env var 없으면 DEFAULT_PLAYLISTS 기반."""
    importer = SpotifyEMPImporter(client_id="x", client_secret="y")
    result = await importer.fetch_editorial_playlists()
    assert len(result) == len(DEFAULT_PLAYLISTS)
    assert all(p["source_type"] == "editorial_playlist" for p in result)
    ids = {p["id"] for p in result}
    assert {pid for pid, _ in DEFAULT_PLAYLISTS} == ids


@pytest.mark.asyncio
async def test_env_override(monkeypatch):
    """SPOTIFY_EMP_PLAYLISTS env로 override."""
    monkeypatch.setenv(
        "SPOTIFY_EMP_PLAYLISTS",
        "abc:Custom A, def:Custom B, ghi",
    )
    importer = SpotifyEMPImporter(client_id="x", client_secret="y")
    result = await importer.fetch_editorial_playlists()
    assert len(result) == 3
    assert {p["id"] for p in result} == {"abc", "def", "ghi"}
    name_map = {p["id"]: p["name"] for p in result}
    assert name_map["abc"] == "Custom A"
    assert name_map["ghi"] == "ghi"


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
