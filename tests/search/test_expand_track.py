from __future__ import annotations

import httpx
import respx

from mrms.search.expand import _spotify_track, _tidal_track, fetch_track


@respx.mock
async def test_spotify_track_200_normalizes():
    respx.get("https://api.spotify.com/v1/tracks/abc").mock(return_value=httpx.Response(200, json={
        "id": "abc", "name": "Song", "artists": [{"name": "A"}],
        "album": {"name": "Alb", "images": [{"url": "u"}]},
        "duration_ms": 200000, "external_ids": {"isrc": "USABC1234567"}}))
    async with httpx.AsyncClient() as h:
        t = await _spotify_track(h, "tok", "abc")
    assert t["platform"] == "spotify" and t["platform_track_id"] == "abc" and t["title"] == "Song"


@respx.mock
async def test_spotify_track_404_none():
    respx.get("https://api.spotify.com/v1/tracks/x").mock(return_value=httpx.Response(404))
    async with httpx.AsyncClient() as h:
        assert await _spotify_track(h, "tok", "x") is None


@respx.mock
async def test_tidal_track_200_and_fetch_track_dispatch():
    respx.get(url__startswith="https://api.tidal.com/v1/tracks/999").mock(
        return_value=httpx.Response(200, json={
            "id": 999, "title": "T", "artists": [{"name": "B"}],
            "album": {"title": "Alb", "cover": "x-y-z"}, "duration": 200, "isrc": "USXYZ9876543"}))
    async with httpx.AsyncClient() as h:
        t = await _tidal_track(h, "tok", "999", "US")
        t2 = await fetch_track(h, "tidal", "999", "tok", "US")
    assert t["platform"] == "tidal" and t["platform_track_id"] == "999"
    assert t2 is not None and t2["platform_track_id"] == "999"
