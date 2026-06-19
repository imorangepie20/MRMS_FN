"""클래식 공연 실황 — YouTube Data API 인제스트."""
import httpx as _httpx
import pytest
import respx

from mrms.emp.youtube_videos import (
    CLASSICAL_CHANNELS,
    YT_SEARCH_URL,
    _normalize_yt_video,
    _yt_thumbnail,
    fetch_classical_videos,
    import_classical_videos,
)


def test_yt_thumbnail_prefers_largest():
    sn = {"thumbnails": {
        "default": {"url": "d.jpg"}, "medium": {"url": "m.jpg"},
        "high": {"url": "h.jpg"}, "maxres": {"url": "x.jpg"},
    }}
    assert _yt_thumbnail(sn) == "x.jpg"
    assert _yt_thumbnail({"thumbnails": {"default": {"url": "d.jpg"}}}) == "d.jpg"
    assert _yt_thumbnail({}) is None


def test_normalize_yt_video_unescapes_title():
    item = {
        "id": {"videoId": "abc123"},
        "snippet": {
            "title": "Holst: The Planets &amp; Elgar&#39;s Enigma",
            "channelTitle": "London Symphony Orchestra",
            "thumbnails": {"high": {"url": "h.jpg"}},
        },
    }
    v = _normalize_yt_video(item)
    assert v == {
        "video_id": "abc123",
        "title": "Holst: The Planets & Elgar's Enigma",
        "channel": "London Symphony Orchestra",
        "cover_url": "h.jpg",
    }


def test_normalize_yt_video_bad_returns_none():
    assert _normalize_yt_video({"id": {}, "snippet": {"title": "x"}}) is None  # no videoId
    assert _normalize_yt_video({"id": {"videoId": "x"}, "snippet": {}}) is None  # no title
    assert _normalize_yt_video("nope") is None


def _payload():
    return {"items": [
        {"id": {"videoId": "v1"}, "snippet": {
            "title": "Beethoven: Symphony No. 9", "channelTitle": "Berliner Philharmoniker",
            "thumbnails": {"high": {"url": "v1.jpg"}}}},
        {"id": {"videoId": "v2"}, "snippet": {
            "title": "Mahler: Symphony No. 2 &amp; encore",
            "channelTitle": "Chicago Symphony Orchestra",
            "thumbnails": {"maxres": {"url": "v2.jpg"}}}},
    ]}


@pytest.mark.asyncio
@respx.mock
async def test_fetch_classical_videos_dedups_across_channels():
    # 모든 채널이 같은 결과를 줘도 video_id로 dedup → 2개
    respx.get(YT_SEARCH_URL).mock(return_value=_httpx.Response(200, json=_payload()))
    async with _httpx.AsyncClient() as http:
        vids = await fetch_classical_videos(http, api_key="testkey", per_channel=8)
    assert [v["video_id"] for v in vids] == ["v1", "v2"]
    assert vids[1]["title"] == "Mahler: Symphony No. 2 & encore"  # html unescape
    assert vids[0]["cover_url"] == "v1.jpg"


def test_roster_is_nonempty_and_well_formed():
    assert len(CLASSICAL_CHANNELS) >= 5
    for cid, name in CLASSICAL_CHANNELS:
        assert cid.startswith("UC") and name


@pytest.mark.asyncio
@respx.mock
async def test_import_classical_videos_creates_section(db_conn, cleanup, monkeypatch):
    """platform='youtube' + item_type='youtube_video' 섹션 저장 + only_video 노출."""
    from mrms.db.emp_section import list_sections_with_items
    monkeypatch.setenv("YOUTUBE_DATA_API_KEY", "testkey")
    cleanup('DELETE FROM "EMPSection" WHERE "sectionKey" = %s', ("video:classical-live",))
    respx.get(YT_SEARCH_URL).mock(return_value=_httpx.Response(200, json=_payload()))

    async with _httpx.AsyncClient() as http:
        n = await import_classical_videos(db_conn, http, display_order=0)
    assert n == 2

    secs = list_sections_with_items(db_conn, only_video=True)
    sec = [s for s in secs if s["section_key"] == "video:classical-live"]
    assert sec and sec[0]["platform"] == "youtube"
    assert sec[0]["display_title"] == "클래식 공연 실황"
    assert {i["item_type"] for i in sec[0]["items"]} == {"youtube_video"}
    assert [i["item_id"] for i in sec[0]["items"]] == ["v1", "v2"]


@pytest.mark.asyncio
async def test_import_classical_videos_no_key_is_noop(db_conn, monkeypatch):
    monkeypatch.delenv("YOUTUBE_DATA_API_KEY", raising=False)
    async with _httpx.AsyncClient() as http:
        assert await import_classical_videos(db_conn, http) == 0
