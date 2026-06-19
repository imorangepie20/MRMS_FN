"""TidalEMPImporter 비디오 인제스트."""
import httpx as _httpx
import pytest
import respx

from mrms.emp.tidal import (
    TIDAL_BASE,
    TidalEMPImporter,
    _normalize_video,
    _video_cover,
)


def test_video_cover_url():
    assert _video_cover("c6420d6e-4176-4893-a062-5a25a16fef02") == (
        "https://resources.tidal.com/images/c6420d6e/4176/4893/a062/5a25a16fef02/640x360.jpg"
    )
    assert _video_cover(None) is None


def test_normalize_video():
    item = {
        "id": 529748781,
        "title": "hate that i made you love me",
        "imageId": "c6420d6e-4176-4893-a062-5a25a16fef02",
        "duration": 300,
        "artist": {"id": 4332277, "name": "Ariana Grande"},
        "artists": [{"id": 4332277, "name": "Ariana Grande"}],
    }
    v = _normalize_video(item)
    assert v == {
        "video_id": "529748781",
        "title": "hate that i made you love me",
        "artist": "Ariana Grande",
        "cover_url": "https://resources.tidal.com/images/c6420d6e/4176/4893/a062/5a25a16fef02/640x360.jpg",
    }


def test_normalize_video_missing_fields_returns_none():
    assert _normalize_video({"title": "no id"}) is None
    assert _normalize_video({"id": 1}) is None
    assert _normalize_video("not a dict") is None


@pytest.mark.asyncio
@respx.mock
async def test_fetch_video_playlists():
    page = {"rows": [{"modules": [{
        "type": "PLAYLIST_LIST",
        "showMore": None,
        "pagedList": {"items": [
            {"uuid": "pl-1", "title": "New Pop Videos",
             "squareImage": "ab12cd34-0000-1111-2222-333344445555"},
            {"uuid": "pl-2", "title": "New K-Pop Videos",
             "image": "ff00aa11-0000-1111-2222-333344445555"},
        ]},
    }]}]}
    respx.get(f"{TIDAL_BASE}/v1/pages/videos").mock(return_value=_httpx.Response(200, json=page))
    imp = TidalEMPImporter(conn=None, token="tok")
    async with _httpx.AsyncClient() as http:
        pls = await imp._fetch_video_playlists(http)
    assert [(p["uuid"], p["title"]) for p in pls] == [
        ("pl-1", "New Pop Videos"), ("pl-2", "New K-Pop Videos"),
    ]


@pytest.mark.asyncio
@respx.mock
async def test_fetch_playlist_videos():
    items = {"items": [
        {"item": {"id": 1, "title": "MV A", "imageId": "aa11bb22-0000-1111-2222-333344445555",
                  "artist": {"name": "Artist A"}}, "type": "video"},
        {"item": {"id": 2, "title": "MV B", "imageId": "cc33dd44-0000-1111-2222-333344445555",
                  "artist": {"name": "Artist B"}}, "type": "video"},
    ]}
    respx.get(f"{TIDAL_BASE}/v1/playlists/pl-1/items").mock(
        return_value=_httpx.Response(200, json=items))
    imp = TidalEMPImporter(conn=None, token="tok")
    async with _httpx.AsyncClient() as http:
        vids = await imp._fetch_playlist_videos(http, "pl-1")
    assert [v["video_id"] for v in vids] == ["1", "2"]
    assert vids[0]["artist"] == "Artist A"


@pytest.mark.asyncio
@respx.mock
async def test_import_videos_persists_sections(db_conn, cleanup):
    from mrms.db.emp_section import list_sections_with_items
    cleanup('DELETE FROM "EMPSectionItem" WHERE "itemId" = %s AND "itemType" = %s', ("1", "video"))
    cleanup('DELETE FROM "EMPSection" WHERE "sectionKey" = %s', ("video:pl-1",))
    page = {"rows": [{"modules": [{"type": "PLAYLIST_LIST", "showMore": None,
        "pagedList": {"items": [{"uuid": "pl-1", "title": "New Pop Videos",
            "squareImage": "ab12cd34-0000-1111-2222-333344445555"}]}}]}]}
    items = {"items": [{"item": {"id": 1, "title": "MV A",
        "imageId": "aa11bb22-0000-1111-2222-333344445555",
        "artist": {"name": "Artist A"}}, "type": "video"}]}
    respx.get(f"{TIDAL_BASE}/v1/pages/videos").mock(return_value=_httpx.Response(200, json=page))
    respx.get(f"{TIDAL_BASE}/v1/playlists/pl-1/items").mock(
        return_value=_httpx.Response(200, json=items))

    imp = TidalEMPImporter(conn=db_conn, token="tok")
    async with _httpx.AsyncClient() as http:
        n = await imp._import_videos(db_conn, http, base_order=0)
    assert n >= 1
    secs = list_sections_with_items(db_conn)
    vsec = [s for s in secs if s["section_key"] == "video:pl-1"]
    assert vsec and vsec[0]["display_title"] == "New Pop Videos"
    assert vsec[0]["items"][0]["item_type"] == "video"
    assert vsec[0]["items"][0]["item_id"] == "1"
