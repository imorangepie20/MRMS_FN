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
async def test_import_videos_featured_and_new_sections(db_conn, cleanup):
    """Featured(개별 비디오 카드) + New(플레이리스트 카드) 두 섹션을 저장.
    Featured는 type=='VIDEO'만(CATEGORY_PAGES 등 스킵), New는 video_playlist 카드."""
    from mrms.db.emp_section import list_sections_with_items
    cleanup(
        'DELETE FROM "EMPSection" WHERE "sectionKey" IN (%s, %s)',
        ("video:featured", "video:new"),
    )
    page = {"rows": [
        {"modules": [{"type": "MULTIPLE_TOP_PROMOTIONS", "title": "Featured", "items": [
            {"type": "VIDEO", "artifactId": "111", "shortHeader": "Feat A",
             "imageId": "aa11bb22-0000-1111-2222-333344445555"},
            {"type": "CATEGORY_PAGES", "artifactId": "pages/x", "shortHeader": "skip me"},
        ]}]},
        {"modules": [{"type": "PLAYLIST_LIST", "showMore": None, "pagedList": {"items": [
            {"uuid": "pl-1", "title": "New Pop Videos",
             "squareImage": "ab12cd34-0000-1111-2222-333344445555"},
            {"uuid": "pl-2", "title": "New K-Pop Videos",
             "image": "ff00aa11-0000-1111-2222-333344445555"},
        ]}}]},
    ]}
    respx.get(f"{TIDAL_BASE}/v1/pages/videos").mock(return_value=_httpx.Response(200, json=page))

    imp = TidalEMPImporter(conn=db_conn, token="tok")
    async with _httpx.AsyncClient() as http:
        n = await imp._import_videos(db_conn, http, base_order=0)
    assert n == 3  # featured 1 + playlists 2
    secs = list_sections_with_items(db_conn, only_video=True)

    fsec = [s for s in secs if s["section_key"] == "video:featured"]
    assert fsec and fsec[0]["display_title"] == "Featured"
    fitems = fsec[0]["items"]
    assert len(fitems) == 1  # CATEGORY_PAGES 스킵
    assert fitems[0]["item_type"] == "video"
    assert fitems[0]["item_id"] == "111"

    nsec = [s for s in secs if s["section_key"] == "video:new"]
    assert nsec and nsec[0]["display_title"] == "New"
    assert {i["item_type"] for i in nsec[0]["items"]} == {"video_playlist"}
    assert {i["item_id"] for i in nsec[0]["items"]} == {"pl-1", "pl-2"}
