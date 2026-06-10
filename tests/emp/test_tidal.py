"""TidalEMPImporter — X-Tidal-Token via api.tidal.com."""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from mrms.emp.tidal import DISCOVERY_PAGES, TOKEN_SETTING_KEY, TidalEMPImporter


@pytest.mark.asyncio
async def test_no_token_returns_empty(db_conn, monkeypatch):
    """토큰 없으면 fetch_editorial_playlists는 빈 리스트."""
    # Setting 비어있는 상태 가정 (혹시 있으면 지움)
    with db_conn.cursor() as cur:
        cur.execute('DELETE FROM "Setting" WHERE key = %s', (TOKEN_SETTING_KEY,))
    db_conn.commit()

    importer = TidalEMPImporter(conn=db_conn)
    assert importer.token is None
    result = await importer.fetch_editorial_playlists()
    assert result == []
    tracks = await importer.fetch_playlist_tracks("some_uuid")
    assert tracks == []


@pytest.mark.asyncio
async def test_token_explicit_arg(db_conn):
    """생성자에 token 직접 전달 가능."""
    importer = TidalEMPImporter(conn=db_conn, token="abc")
    assert importer.token == "abc"


@pytest.mark.asyncio
async def test_fetch_editorial_playlists_walks_response(db_conn):
    """/pages/explore 응답에서 uuid + title 가진 객체 다 추출."""
    importer = TidalEMPImporter(conn=db_conn, token="fake_token_xx")

    fake_resp = MagicMock()
    fake_resp.status_code = 200
    fake_resp.json = MagicMock(
        return_value={
            "rows": [
                {
                    "modules": [
                        {
                            "type": "PLAYLIST_LIST",
                            "pagedList": {
                                "items": [
                                    {"uuid": "1234567890abcdef-uuid-a", "title": "Tidal Rising"},
                                    {"uuid": "1234567890abcdef-uuid-b", "title": "Tidal Discovery"},
                                ]
                            },
                        }
                    ]
                },
                {
                    "modules": [
                        {
                            "type": "ALBUM_LIST",
                            "pagedList": {
                                "items": [
                                    {"id": 123, "title": "An Album"},  # no uuid → skipped
                                ]
                            },
                        }
                    ]
                },
            ]
        }
    )
    fake_client = MagicMock()
    fake_client.__aenter__ = AsyncMock(return_value=fake_client)
    fake_client.__aexit__ = AsyncMock(return_value=None)
    fake_client.get = AsyncMock(return_value=fake_resp)

    with patch("httpx.AsyncClient", return_value=fake_client):
        result = await importer.fetch_editorial_playlists()

    ids = {p["id"] for p in result}
    assert "1234567890abcdef-uuid-a" in ids
    assert "1234567890abcdef-uuid-b" in ids


@pytest.mark.asyncio
async def test_fetch_playlist_tracks_parses_item_wrapper(db_conn):
    importer = TidalEMPImporter(conn=db_conn, token="fake_token_xx")

    fake_resp = MagicMock()
    fake_resp.status_code = 200
    fake_resp.json = MagicMock(
        return_value={
            "items": [
                {
                    "item": {
                        "id": 100,
                        "title": "Track A",
                        "duration": 180,
                        "isrc": "USRC10000001",
                        "artists": [{"name": "Artist A"}],
                        "album": {"title": "Album A"},
                    }
                },
                {
                    "item": {
                        "id": 200,
                        "title": "Track B",
                        "duration": 200,
                        "isrc": None,
                        "artists": [{"name": "Artist B"}],
                        "album": {"title": "Album B"},
                    }
                },
            ],
            "totalNumberOfItems": 2,
        }
    )
    fake_client = MagicMock()
    fake_client.__aenter__ = AsyncMock(return_value=fake_client)
    fake_client.__aexit__ = AsyncMock(return_value=None)
    fake_client.get = AsyncMock(return_value=fake_resp)

    with patch("httpx.AsyncClient", return_value=fake_client):
        tracks = await importer.fetch_playlist_tracks("some_uuid")

    assert len(tracks) == 2
    assert tracks[0]["platform_track_id"] == "100"
    assert tracks[0]["isrc"] == "USRC10000001"
    assert tracks[0]["duration_ms"] == 180_000
    assert tracks[1]["isrc"] is None


@pytest.mark.asyncio
async def test_load_sources_parses_lines(db_conn):
    """tidal_emp_sources setting parses page + playlist lines."""
    from mrms.db.settings import set_setting

    importer = TidalEMPImporter(conn=db_conn, token="fake")
    set_setting(
        db_conn,
        "tidal_emp_sources",
        "pages/explore\npages/genre_jazz\nplaylist/abc-uuid-1234-5678\n#comment\n\n",
    )
    db_conn.commit()
    try:
        sources = importer._load_sources_from_setting()
        assert ("pages", "explore") in sources
        assert ("pages", "genre_jazz") in sources
        assert ("playlist", "abc-uuid-1234-5678") in sources
        assert len(sources) == 3
    finally:
        set_setting(db_conn, "tidal_emp_sources", None)
        db_conn.commit()


@pytest.mark.asyncio
async def test_load_sources_default_when_empty(db_conn):
    """setting unset → DISCOVERY_PAGES default."""
    from mrms.db.settings import set_setting

    set_setting(db_conn, "tidal_emp_sources", None)
    db_conn.commit()

    importer = TidalEMPImporter(conn=db_conn, token="fake")
    sources = importer._load_sources_from_setting()
    assert len(sources) == len(DISCOVERY_PAGES)
    assert all(kind == "pages" for kind, _ in sources)
