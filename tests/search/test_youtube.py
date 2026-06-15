"""YouTube Music 검색 — ytmusicapi 주력 + 예산가드 Data API 폴백."""
from __future__ import annotations

import asyncio
from unittest.mock import patch

import httpx
import respx
from httpx import Response

from mrms.db.settings import set_setting
from mrms.search import youtube as yt


class _StubYT:
    def __init__(self, results):
        self._results = results

    def search(self, q):  # ytmusicapi 동기 시그니처
        return self._results


def _run(coro):
    return asyncio.run(coro)


def test_search_youtube_uses_ytmusicapi_no_fallback(db_conn):
    """ytmusicapi가 결과를 주면 폴백 없이 정규화 트랙 반환."""
    items = [{
        "resultType": "song", "videoId": "VID1", "title": "Man I Need",
        "artists": [{"name": "Olivia Dean"}], "album": {"name": "Man I Need"},
        "duration_seconds": 184, "thumbnails": [{"url": "big", "width": 500}],
    }]
    with patch.object(yt, "_ytmusic", return_value=_StubYT(items)):
        async def go():
            async with httpx.AsyncClient() as http:
                return await yt.search_youtube(db_conn, "man i need", http=http)
        res = _run(go())
    assert res["albums"] == [] and res["playlists"] == []
    assert len(res["tracks"]) == 1
    assert res["tracks"][0]["platform_track_id"] == "VID1"


@respx.mock
def test_search_youtube_falls_back_to_data_api_when_empty(db_conn, cleanup, monkeypatch):
    """ytmusicapi 0건 + 예산 남음 + API 키 → Data API 폴백 + 카운터 증가."""
    monkeypatch.setenv("YOUTUBE_DATA_API_KEY", "KEY123")
    cleanup('DELETE FROM "Setting" WHERE key LIKE %s', ("yt_search_fallback_count_%",))
    respx.get("https://www.googleapis.com/youtube/v3/search").mock(
        return_value=Response(200, json={"items": [
            {
                "id": {"videoId": "FBVID"},
                "snippet": {"title": "Fallback Song", "channelTitle": "Chan"},
            }
        ]}))
    with patch.object(yt, "_ytmusic", return_value=_StubYT([])):
        async def go():
            async with httpx.AsyncClient() as http:
                return await yt.search_youtube(db_conn, "obscure", http=http)
        res = _run(go())
    assert len(res["tracks"]) == 1
    assert res["tracks"][0]["platform_track_id"] == "FBVID"
    assert res["tracks"][0]["artist"] == "Chan"
    assert yt._today_count(db_conn) == 1


def test_search_youtube_skips_fallback_when_budget_exhausted(db_conn, cleanup, monkeypatch):
    """예산 소진이면 0건이어도 Data API 폴백 안 함."""
    monkeypatch.setenv("YOUTUBE_DATA_API_KEY", "KEY123")
    cleanup('DELETE FROM "Setting" WHERE key LIKE %s', ("yt_search_fallback_count_%",))
    cleanup('DELETE FROM "Setting" WHERE key = %s', ("yt_search_fallback_cap",))
    set_setting(db_conn, "yt_search_fallback_cap", "0")  # 예산 0
    with patch.object(yt, "_ytmusic", return_value=_StubYT([])):
        async def go():
            async with httpx.AsyncClient() as http:
                return await yt.search_youtube(db_conn, "obscure", http=http)
        res = _run(go())
    assert res["tracks"] == []  # 폴백 호출 안 됨 (respx 미설정이라 호출 시 에러날 것)
