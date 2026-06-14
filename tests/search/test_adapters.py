from __future__ import annotations

import httpx
import pytest
import respx
from httpx import Response

from mrms.search.spotify import search_spotify
from mrms.search.tidal import search_tidal


@pytest.mark.asyncio
@respx.mock
async def test_search_spotify_groups():
    respx.get("https://api.spotify.com/v1/search").mock(return_value=Response(200, json={
        "tracks": {"items": [{"id": "sp1", "name": "Ditto",
                              "artists": [{"name": "NewJeans"}],
                              "album": {"name": "OMG", "images": [{"url": "c"}]},
                              "duration_ms": 185000,
                              "external_ids": {"isrc": "KRA401900001"}}]},
        "albums": {"items": [{"id": "al1", "name": "OMG",
                              "artists": [{"name": "NewJeans"}],
                              "images": [{"url": "c"}], "total_tracks": 2}]},
        "playlists": {"items": [None, {"id": "pl1", "name": "Hits",
                                       "owner": {"display_name": "Spotify"},
                                       "images": [{"url": "c"}],
                                       "tracks": {"total": 9}}]},
    }))
    async with httpx.AsyncClient() as http:
        r = await search_spotify(http, "TOKEN", "ditto", ["track", "album", "playlist"])
    assert len(r["tracks"]) == 1 and r["tracks"][0]["platform_track_id"] == "sp1"
    assert len(r["albums"]) == 1 and r["albums"][0]["platform_id"] == "al1"
    assert len(r["playlists"]) == 1  # None 항목 제거


@pytest.mark.asyncio
@respx.mock
async def test_search_tidal_albums_degrade_on_404():
    respx.get("https://api.tidal.com/v1/search/tracks").mock(return_value=Response(200, json={
        "items": [{"id": 1, "title": "Hype Boy", "artists": [{"name": "NewJeans"}],
                   "album": {"title": "NJ", "cover": "x"}, "duration": 179,
                   "isrc": "KRA401900002"}]}))
    respx.get("https://api.tidal.com/v1/search/albums").mock(return_value=Response(404))
    respx.get("https://api.tidal.com/v1/search/playlists").mock(return_value=Response(404))
    async with httpx.AsyncClient() as http:
        r = await search_tidal(http, "TOKEN", "newjeans", ["track", "album", "playlist"], "KR")
    assert len(r["tracks"]) == 1 and r["tracks"][0]["platform_track_id"] == "1"
    assert r["albums"] == [] and r["playlists"] == []  # degrade


@pytest.mark.asyncio
@respx.mock
async def test_search_spotify_raises_on_non_200():
    # 401(토큰 무효) 등은 조용히 빈 결과로 삼키지 말고 raise → 라우트가 skip 처리.
    respx.get("https://api.spotify.com/v1/search").mock(
        return_value=Response(401, json={"error": {"status": 401, "message": "Invalid access token"}})
    )
    async with httpx.AsyncClient() as http:
        with pytest.raises(RuntimeError):
            await search_spotify(http, "BADTOKEN", "ditto", ["track"])
