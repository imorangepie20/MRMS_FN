from __future__ import annotations

import httpx
import respx

from mrms.search.spotify_artist import fetch_spotify_artist


@respx.mock
async def test_fetch_spotify_artist_200():
    respx.post("https://accounts.spotify.com/api/token").mock(
        return_value=httpx.Response(200, json={"access_token": "T"}))
    respx.get(url__startswith="https://api.spotify.com/v1/search").mock(
        return_value=httpx.Response(200, json={"artists": {"items": [
            {"name": "Frank Sinatra", "genres": ["jazz", "swing"],
             "images": [{"url": "https://img/fs.jpg"}]}]}}))
    async with httpx.AsyncClient() as h:
        image, genres = await fetch_spotify_artist(h, "Frank Sinatra")
    assert image == "https://img/fs.jpg" and genres == ["jazz", "swing"]


@respx.mock
async def test_fetch_spotify_artist_no_match():
    respx.post("https://accounts.spotify.com/api/token").mock(
        return_value=httpx.Response(200, json={"access_token": "T"}))
    respx.get(url__startswith="https://api.spotify.com/v1/search").mock(
        return_value=httpx.Response(200, json={"artists": {"items": []}}))
    async with httpx.AsyncClient() as h:
        image, genres = await fetch_spotify_artist(h, "Nobody")
    assert image is None and genres == []
