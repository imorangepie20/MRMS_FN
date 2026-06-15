from __future__ import annotations

import json

import httpx
import respx

from mrms.search.expand import (
    _spotify_playlist_tracks,
    _spotify_track,
    _tidal_track,
    fetch_track,
)


def _embed_html(name: str, tracks: list[dict]) -> str:
    nd = {"props": {"pageProps": {"state": {"data": {"entity": {
        "name": name, "trackList": tracks}}}}}}
    return (
        "<!DOCTYPE html><html><body>"
        f'<script id="__NEXT_DATA__" type="application/json">{json.dumps(nd)}</script>'
        "</body></html>"
    )


def _embed_track(tid: str, title: str, subtitle: str, duration: int = 180000) -> dict:
    return {"uri": f"spotify:track:{tid}", "title": title,
            "subtitle": subtitle, "duration": duration}


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


@respx.mock
async def test_spotify_playlist_tracks_api_200_uses_api():
    respx.get(url__startswith="https://api.spotify.com/v1/playlists/PL/tracks").mock(
        return_value=httpx.Response(200, json={"items": [
            {"track": {"id": "t1", "name": "Song", "artists": [{"name": "A"}],
                       "album": {"name": "Alb", "images": [{"url": "u"}]},
                       "duration_ms": 200000, "external_ids": {"isrc": "USABC1234567"}}}]}))
    async with httpx.AsyncClient() as h:
        out = await _spotify_playlist_tracks(h, "tok", "PL")
    assert [t["platform_track_id"] for t in out] == ["t1"]
    assert out[0]["platform"] == "spotify" and out[0]["title"] == "Song"


@respx.mock
async def test_spotify_playlist_tracks_404_falls_back_to_embed():
    # 에디토리얼 플리는 Web API tracks가 404 → embed 위젯 스크래핑 폴백
    respx.get(url__startswith="https://api.spotify.com/v1/playlists/37i9/tracks").mock(
        return_value=httpx.Response(404))
    html = _embed_html("Today's Top Hits", [
        _embed_track("e1", "Hit One", "Artist X"),
        _embed_track("e2", "Hit Two", "Artist Y"),
    ])
    respx.get(url__startswith="https://open.spotify.com/embed/playlist/37i9").mock(
        return_value=httpx.Response(200, text=html))
    async with httpx.AsyncClient() as h:
        out = await _spotify_playlist_tracks(h, "tok", "37i9")
    assert [t["platform_track_id"] for t in out] == ["e1", "e2"]
    assert out[0]["title"] == "Hit One" and out[0]["artist"] == "Artist X"
    assert out[0]["platform"] == "spotify"


@respx.mock
async def test_spotify_playlist_tracks_api_empty_falls_back_to_embed():
    # API 200이나 items가 비면(차단·빈 응답)도 embed 폴백
    respx.get(url__startswith="https://api.spotify.com/v1/playlists/PL2/tracks").mock(
        return_value=httpx.Response(200, json={"items": []}))
    html = _embed_html("PL2", [_embed_track("z1", "Z", "ZA")])
    respx.get(url__startswith="https://open.spotify.com/embed/playlist/PL2").mock(
        return_value=httpx.Response(200, text=html))
    async with httpx.AsyncClient() as h:
        out = await _spotify_playlist_tracks(h, "tok", "PL2")
    assert [t["platform_track_id"] for t in out] == ["z1"]
