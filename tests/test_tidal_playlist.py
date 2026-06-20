"""Tidal 플레이리스트 생성 헬퍼 (레거시 v1: sessions→create→etag→items)."""
import httpx as _httpx
import pytest
import respx

from mrms.tidal_playlist import (
    TIDAL_API,
    TIDAL_OPENAPI,
    create_tidal_playlist,
    make_tidal_playlist_public,
)


@pytest.mark.asyncio
@respx.mock
async def test_create_tidal_playlist_flow():
    respx.get(f"{TIDAL_API}/sessions").mock(
        return_value=_httpx.Response(200, json={"userId": 42, "countryCode": "US"}))
    create = respx.post(f"{TIDAL_API}/users/42/playlists").mock(
        return_value=_httpx.Response(200, json={"uuid": "pl-uuid"}))
    respx.get(f"{TIDAL_API}/playlists/pl-uuid").mock(
        return_value=_httpx.Response(200, json={}, headers={"ETag": "etag-1"}))
    add = respx.post(f"{TIDAL_API}/playlists/pl-uuid/items").mock(
        return_value=_httpx.Response(200, json={}))

    uuid = await create_tidal_playlist("tok", "My PL", "desc", ["100", "200", "300"])

    assert uuid == "pl-uuid"
    # create: 제목 폼 전달
    assert b"title=My+PL" in create.calls.last.request.content
    # add: If-None-Match(etag) + trackIds
    req = add.calls.last.request
    assert req.headers.get("If-None-Match") == "etag-1"
    assert "trackIds=100%2C200%2C300" in req.content.decode()


@pytest.mark.asyncio
@respx.mock
async def test_create_tidal_playlist_batches_over_50():
    respx.get(f"{TIDAL_API}/sessions").mock(
        return_value=_httpx.Response(200, json={"userId": 1, "countryCode": "KR"}))
    respx.post(f"{TIDAL_API}/users/1/playlists").mock(
        return_value=_httpx.Response(200, json={"uuid": "u"}))
    g = respx.get(f"{TIDAL_API}/playlists/u").mock(
        return_value=_httpx.Response(200, json={}, headers={"ETag": "e"}))
    a = respx.post(f"{TIDAL_API}/playlists/u/items").mock(
        return_value=_httpx.Response(200, json={}))

    await create_tidal_playlist("tok", "t", None, [str(i) for i in range(120)])

    # 50+50+20 → 3배치, 배치마다 etag 재취득
    assert a.calls.call_count == 3
    assert g.calls.call_count == 3


@pytest.mark.asyncio
@respx.mock
async def test_make_tidal_playlist_public():
    respx.get(f"{TIDAL_API}/sessions").mock(
        return_value=_httpx.Response(200, json={"userId": 1, "countryCode": "KR"}))
    patch = respx.patch(f"{TIDAL_OPENAPI}/playlists/u-1").mock(
        return_value=_httpx.Response(200, json={}))
    await make_tidal_playlist_public("tok", "u-1")
    assert patch.called
    body = patch.calls.last.request.content.decode()
    assert '"accessType": "PUBLIC"' in body


@pytest.mark.asyncio
@respx.mock
async def test_create_tidal_playlist_raises_on_create_error():
    respx.get(f"{TIDAL_API}/sessions").mock(
        return_value=_httpx.Response(200, json={"userId": 1, "countryCode": "KR"}))
    respx.post(f"{TIDAL_API}/users/1/playlists").mock(
        return_value=_httpx.Response(401, json={"error": "unauthorized"}))
    with pytest.raises(_httpx.HTTPStatusError):
        await create_tidal_playlist("tok", "t", None, ["1"])
