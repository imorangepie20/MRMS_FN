"""TidalEMPImporter — Tidal Web API."""
import pytest

from mrms.db.settings import set_setting
from mrms.emp.tidal import (
    DEFAULT_SOURCES,
    SOURCES_SETTING_KEY,
    TOKEN_SETTING_KEY,
    TidalEMPImporter,
    _classify_item,
)


@pytest.mark.asyncio
async def test_no_token_returns_empty(db_conn):
    """토큰 없으면 import_all 빈 summary."""
    with db_conn.cursor() as cur:
        cur.execute('DELETE FROM "Setting" WHERE key = %s', (TOKEN_SETTING_KEY,))
    db_conn.commit()

    importer = TidalEMPImporter(conn=db_conn)
    summary = await importer.import_all(db_conn)
    assert summary["tracks_new"] == 0
    assert summary["tracks_existing"] == 0
    assert "no tidal_x_token" in summary["errors"]


def test_classify_playlist():
    """uuid + title → playlist (4-tuple, cover None when no cover field)."""
    r = _classify_item({"uuid": "31885f0b-96dc-41e1-8e1b-f83372043208", "title": "Rising"})
    assert r == ("playlist", "31885f0b-96dc-41e1-8e1b-f83372043208", "Rising", None)


def test_classify_album():
    """numeric id + title + artists → album (4-tuple)."""
    r = _classify_item({"id": 500612897, "title": "An Album", "artists": [{"name": "A"}]})
    assert r == ("album", "500612897", "An Album", None)


def test_classify_mix():
    """string id (long) + mixType → mix (4-tuple)."""
    r = _classify_item({"id": "00042cc52d0397491c4b9a4a87286a", "title": "My Mix", "mixType": "ARTIST"})
    assert r == ("mix", "00042cc52d0397491c4b9a4a87286a", "My Mix", None)


def test_classify_track_returns_none():
    """ISRC있는 트랙은 classify 안 됨 (item-level discovery용 함수)."""
    r = _classify_item({"id": 100, "title": "Track", "isrc": "USRC1", "artists": [{"name": "A"}]})
    assert r is None  # because no uuid, no releaseDate, no mixType


def test_classify_returns_cover_from_image_url():
    """imageUrl 필드가 있으면 cover_url에 반영."""
    r = _classify_item({
        "uuid": "31885f0b-96dc-41e1-8e1b-f83372043208",
        "title": "Rising",
        "image": "https://cdn.tidal.com/cover_a.jpg",
    })
    assert r == (
        "playlist",
        "31885f0b-96dc-41e1-8e1b-f83372043208",
        "Rising",
        "https://cdn.tidal.com/cover_a.jpg",
    )


def test_classify_cover_from_tidal_cover_id():
    """cover 필드가 UUID 형식이면 CDN URL로 변환."""
    r = _classify_item({
        "uuid": "31885f0b-96dc-41e1-8e1b-f83372043208",
        "title": "Rising",
        "cover": "b48a8d6f-1234-5678-abcd-ef0123456789",
    })
    assert r is not None
    assert r[0] == "playlist"
    assert r[3] == "https://resources.tidal.com/images/b48a8d6f/1234/5678/abcd/ef0123456789/640x640.jpg"


def test_classify_cover_from_images_dict():
    """images dict (MEDIUM/LARGE 등 키) 에서 URL 추출."""
    r = _classify_item({
        "uuid": "31885f0b-96dc-41e1-8e1b-f83372043208",
        "title": "Rising",
        "images": {"MEDIUM": {"url": "https://resources.tidal.com/img/med.jpg"}},
    })
    assert r is not None
    assert r[3] == "https://resources.tidal.com/img/med.jpg"


def test_load_sources_parses(db_conn):
    """tidal_emp_sources 4종 kind 다 파싱."""
    set_setting(
        db_conn,
        SOURCES_SETTING_KEY,
        "home/THE_HITS\nplaylist/abc-1234567890abcdef\nalbum/500612897\nmix/00042cc52d0397491c4b9a4a87286a",
    )
    try:
        importer = TidalEMPImporter(conn=db_conn, token="fake")
        sources = importer._load_sources()
        kinds = {kind for kind, _ in sources}
        assert kinds == {"home", "playlist", "album", "mix"}
        assert len(sources) == 4
    finally:
        set_setting(db_conn, SOURCES_SETTING_KEY, None)


def test_load_sources_default(db_conn):
    """비어 있으면 DEFAULT_SOURCES."""
    set_setting(db_conn, SOURCES_SETTING_KEY, None)
    importer = TidalEMPImporter(conn=db_conn, token="fake")
    sources = importer._load_sources()
    assert len(sources) == len(DEFAULT_SOURCES)
    assert all(kind == "home" for kind, _ in sources)
