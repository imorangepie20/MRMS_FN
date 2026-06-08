"""Tidal Importer 테스트 — mock 응답 기반."""
from unittest.mock import AsyncMock

import pytest

from mrms.sync.tidal_importer import ImportStats, TidalImporter


def _make_importer(http_mock):
    return TidalImporter(
        http=http_mock,
        access_token="ACCESS_TEST",
        country_code="KR",
    )


@pytest.mark.asyncio
async def test_fetch_user_info_parses_jsonapi():
    http = AsyncMock()
    http.get = AsyncMock(return_value=_resp({
        "data": {
            "id": "u_123",
            "type": "users",
            "attributes": {"country": "KR", "email": "me@x.com", "displayName": "Me"},
        }
    }))
    importer = _make_importer(http)
    info = await importer.fetch_user_info()
    assert info["id"] == "u_123"
    assert info["country"] == "KR"
    assert info["email"] == "me@x.com"


@pytest.mark.asyncio
async def test_fetch_liked_tracks_paginates_and_extracts_isrc():
    http = AsyncMock()
    page1 = {
        "data": [{"id": "t1", "type": "tracks", "attributes": {}}],
        "included": [
            {"id": "t1", "type": "tracks", "attributes": {"isrc": "AAA111111111", "title": "T1"}}
        ],
        "links": {"next": "https://x?page%5Bcursor%5D=PAGE2"},
    }
    page2 = {
        "data": [{"id": "t2", "type": "tracks", "attributes": {}}],
        "included": [
            {"id": "t2", "type": "tracks", "attributes": {"isrc": "BBB222222222", "title": "T2"}}
        ],
        "links": {},
    }
    http.get = AsyncMock(side_effect=[_resp(page1), _resp(page2)])
    importer = _make_importer(http)
    tracks = await importer.fetch_liked_tracks(user_id="u_123")
    isrcs = sorted(t["isrc"] for t in tracks if t.get("isrc"))
    assert isrcs == ["AAA111111111", "BBB222222222"]


@pytest.mark.asyncio
async def test_fetch_playlists_returns_owner_only():
    http = AsyncMock()
    http.get = AsyncMock(return_value=_resp({
        "data": [
            {"id": "p1", "type": "playlists", "attributes": {"title": "Mine"}},
        ],
        "links": {},
    }))
    importer = _make_importer(http)
    pls = await importer.fetch_my_playlists(user_id="u_123")
    assert len(pls) == 1
    assert pls[0]["title"] == "Mine"


@pytest.mark.asyncio
async def test_import_stats_default_zero():
    stats = ImportStats()
    assert stats.liked_matched == 0
    assert stats.user_tracks_upserted == 0


def _resp(body: dict, status: int = 200):
    """httpx.Response 흉내 (mock helper)."""
    class _R:
        status_code = status
        def json(self):
            return body
        def raise_for_status(self):
            if not (200 <= status < 300):
                raise Exception(f"HTTP {status}")
    return _R()


@pytest.mark.asyncio
async def test_fetch_breaks_when_cursor_does_not_advance():
    """API가 같은 cursor를 두 번 보내면 무한 루프 방지를 위해 중단."""
    http = AsyncMock()
    # 두 페이지 모두 같은 cursor를 next로 반환 (정상이라면 절대 없음)
    page = {
        "data": [{"id": "t1", "type": "tracks", "attributes": {}}],
        "included": [{"id": "t1", "type": "tracks", "attributes": {"isrc": "AAA111111111"}}],
        "links": {"next": "https://x?page%5Bcursor%5D=STUCK"},
    }
    page2 = {
        "data": [{"id": "t1", "type": "tracks", "attributes": {}}],
        "included": [{"id": "t1", "type": "tracks", "attributes": {"isrc": "AAA111111111"}}],
        "links": {"next": "https://x?page%5Bcursor%5D=STUCK"},  # 같음
    }
    http.get = AsyncMock(side_effect=[_resp(page), _resp(page2)])
    importer = _make_importer(http)
    tracks = await importer.fetch_liked_tracks(user_id="u_123")
    # 첫 페이지 + cursor 진전 없음 감지 → 두 번째 페이지까지만 호출
    assert http.get.call_count == 2
    # dedup이 동작해서 t1은 1개만 (실제로 같은 트랙)
    assert len(tracks) == 1
