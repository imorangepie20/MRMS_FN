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


def test_video_section_key():
    from mrms.emp.tidal import _video_section_key
    assert _video_section_key("Featured") == "video:featured"
    assert _video_section_key("New Video Playlists") == "video:new-video-playlists"
    assert _video_section_key("Classics Video Playlists") == "video:classics-video-playlists"
    assert _video_section_key("New Music Videos") == "video:new-music-videos"
    assert _video_section_key("Classics") == "video:classics"


@pytest.mark.asyncio
@respx.mock
async def test_fetch_video_page_modules():
    """페이지의 모든 모듈을 순서대로 섹션화 — 화면(Tidal /videos) 미러.
    MULTIPLE_TOP_PROMOTIONS/VIDEO_LIST=개별 비디오, PLAYLIST_LIST=플레이리스트 카드."""
    page = {"rows": [
        {"modules": [{"type": "MULTIPLE_TOP_PROMOTIONS", "title": "Featured", "items": [
            {"type": "VIDEO", "artifactId": "111", "shortHeader": "Feat A",
             "imageId": "aa11bb22-0000-1111-2222-333344445555"},
            {"type": "CATEGORY_PAGES", "artifactId": "pages/x", "shortHeader": "skip"},
        ]}]},
        {"modules": [{"type": "PLAYLIST_LIST", "title": "New Video Playlists",
                      "showMore": None, "pagedList": {"items": [
            {"uuid": "pl-1", "title": "New Pop Videos",
             "squareImage": "ab12cd34-0000-1111-2222-333344445555"},
        ]}}]},
        {"modules": [{"type": "VIDEO_LIST", "title": "New Music Videos",
                      "pagedList": {"items": [
            {"id": 222, "title": "MV B", "imageId": "cc33dd44-0000-1111-2222-333344445555",
             "artist": {"name": "Artist B"}},
        ]}}]},
    ]}
    respx.get(f"{TIDAL_BASE}/v1/pages/videos").mock(return_value=_httpx.Response(200, json=page))
    imp = TidalEMPImporter(conn=None, token="tok")
    async with _httpx.AsyncClient() as http:
        secs = await imp._fetch_video_page_modules(http)
    assert [(s["key"], s["kind"]) for s in secs] == [
        ("video:featured", "video"),
        ("video:new-video-playlists", "video_playlist"),
        ("video:new-music-videos", "video"),
    ]
    assert len(secs[0]["items"]) == 1  # CATEGORY_PAGES 스킵
    assert secs[0]["items"][0]["video_id"] == "111"
    assert secs[1]["items"][0]["uuid"] == "pl-1"
    assert secs[2]["items"][0]["video_id"] == "222"


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
async def test_import_videos_mirrors_all_modules(db_conn, cleanup):
    """페이지 모듈을 제목·순서·타입 그대로 EMPSection으로 미러:
    PLAYLIST_LIST=플레이리스트 카드, MULTIPLE_TOP_PROMOTIONS/VIDEO_LIST=개별 비디오."""
    from mrms.db.emp_section import list_sections_with_items
    cleanup(
        'DELETE FROM "EMPSection" WHERE "sectionKey" IN (%s, %s, %s)',
        ("video:featured", "video:new-video-playlists", "video:new-music-videos"),
    )
    page = {"rows": [
        {"modules": [{"type": "MULTIPLE_TOP_PROMOTIONS", "title": "Featured", "items": [
            {"type": "VIDEO", "artifactId": "111", "shortHeader": "Feat A",
             "imageId": "aa11bb22-0000-1111-2222-333344445555"},
            {"type": "CATEGORY_PAGES", "artifactId": "pages/x", "shortHeader": "skip me"},
        ]}]},
        {"modules": [{"type": "PLAYLIST_LIST", "title": "New Video Playlists",
                      "showMore": None, "pagedList": {"items": [
            {"uuid": "pl-1", "title": "New Pop Videos",
             "squareImage": "ab12cd34-0000-1111-2222-333344445555"},
        ]}}]},
        {"modules": [{"type": "VIDEO_LIST", "title": "New Music Videos",
                      "pagedList": {"items": [
            {"id": 222, "title": "MV B", "imageId": "cc33dd44-0000-1111-2222-333344445555",
             "artist": {"name": "Artist B"}},
        ]}}]},
    ]}
    respx.get(f"{TIDAL_BASE}/v1/pages/videos").mock(return_value=_httpx.Response(200, json=page))

    imp = TidalEMPImporter(conn=db_conn, token="tok")
    async with _httpx.AsyncClient() as http:
        n, keys = await imp._import_videos(db_conn, http, base_order=0)
    assert n == 3  # featured 1 + playlist 1 + video 1
    assert keys == {"video:featured", "video:new-video-playlists", "video:new-music-videos"}
    by_key = {s["section_key"]: s for s in list_sections_with_items(db_conn, only_video=True)}

    fsec = by_key["video:featured"]
    assert fsec["display_title"] == "Featured"
    assert len(fsec["items"]) == 1  # CATEGORY_PAGES 스킵
    assert fsec["items"][0]["item_type"] == "video"
    assert fsec["items"][0]["item_id"] == "111"

    psec = by_key["video:new-video-playlists"]
    assert psec["display_title"] == "New Video Playlists"
    assert psec["items"][0]["item_type"] == "video_playlist"
    assert psec["items"][0]["item_id"] == "pl-1"

    vsec = by_key["video:new-music-videos"]
    assert vsec["display_title"] == "New Music Videos"
    assert vsec["items"][0]["item_type"] == "video"
    assert vsec["items"][0]["item_id"] == "222"

    # 페이지 순서 보존(0,1,2)
    assert [by_key[k]["display_order"] for k in
            ("video:featured", "video:new-video-playlists", "video:new-music-videos")] == [0, 1, 2]


def test_prune_stale_video_sections_keeps_current(db_conn, cleanup):
    """이번 sync에 없는 video:% 섹션만 삭제하고, keep_keys에 든 실제 섹션은 보존.
    (shared dev DB 안전 — 기존 키 전부 keep에 넣고 주입한 stale만 제거 확인.)"""
    from mrms.db.emp_section import (
        list_sections_with_items,
        upsert_section,
        upsert_section_item,
    )
    cleanup('DELETE FROM "EMPSection" WHERE "sectionKey" = %s', ("video:__stale_test__",))

    existing = {s["section_key"] for s in list_sections_with_items(db_conn, only_video=True)}
    stale_id = upsert_section(db_conn, platform="tidal",
                              section_key="video:__stale_test__",
                              display_title="Stale", display_order=99)
    upsert_section_item(db_conn, section_id=stale_id, item_type="video",
                        item_id="999", title="old", cover_url=None, display_order=0)

    deleted = TidalEMPImporter._prune_stale_video_sections(db_conn, keep_keys=existing)
    after = {s["section_key"] for s in list_sections_with_items(db_conn, only_video=True)}
    assert deleted >= 1
    assert "video:__stale_test__" not in after  # 주입한 stale 삭제됨(items도 CASCADE)
    assert existing <= after  # 실제 섹션은 전부 보존


def test_prune_stale_video_sections_empty_keep_is_noop(db_conn):
    """keep_keys가 비면(빈 fetch) 아무것도 안 지운다 — 전체 삭제 방지."""
    assert TidalEMPImporter._prune_stale_video_sections(db_conn, keep_keys=set()) == 0
