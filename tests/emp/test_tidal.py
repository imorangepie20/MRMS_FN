"""TidalEMPImporter — Tidal Web API."""
from mrms.db.settings import set_setting
from mrms.emp.tidal import (
    DEFAULT_SOURCES,
    SOURCES_SETTING_KEY,
    TOKEN_SETTING_KEY,
    TidalEMPImporter,
    _classify_item,
)


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
    """dash 없는 16자+ string id → mix (4-tuple). 현재 분류 기준은 id 휴리스틱."""
    r = _classify_item({"id": "00042cc52d0397491c4b9a4a87286a", "title": "My Mix"})
    assert r == ("mix", "00042cc52d0397491c4b9a4a87286a", "My Mix", None)


def test_classify_track_returns_none():
    """ISRC있는 트랙은 classify 안 됨 (item-level discovery용 함수)."""
    r = _classify_item({"id": 100, "title": "Track", "isrc": "USRC1", "artists": [{"name": "A"}]})
    assert r is None  # isrc 존재 가드 때문 — 트랙은 항상 isrc를 들고 와서 album으로 오분류 안 됨


def test_classify_returns_cover_from_image_url():
    """image 필드(직접 URL 문자열)가 있으면 cover_url에 반영."""
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
    assert r[3] == "https://resources.tidal.com/images/b48a8d6f/1234/5678/abcd/ef0123456789/320x320.jpg"


def test_classify_cover_from_images_dict():
    """images dict (MEDIUM/LARGE 등 키) 에서 URL 추출."""
    r = _classify_item({
        "uuid": "31885f0b-96dc-41e1-8e1b-f83372043208",
        "title": "Rising",
        "images": {"MEDIUM": {"url": "https://resources.tidal.com/img/med.jpg"}},
    })
    assert r is not None
    assert r[3] == "https://resources.tidal.com/img/med.jpg"


def test_classify_mix_wrapper():
    """Real Tidal MIX wrapper shape from POPULAR_MIXES."""
    node = {
        "type": "MIX",
        "data": {
            "type": "TRACK_MIX",
            "id": "001cf67080308c21cb4d36b2f95ecc",
            "titleTextInfo": {"text": "Raindance"},
            "subtitleTextInfo": {"text": "Dave, Tems"},
            "mixImages": [
                {"size": "SMALL", "url": "https://x/sm.jpg"},
                {"size": "MEDIUM", "url": "https://x/md.jpg"},
                {"size": "LARGE", "url": "https://x/lg.jpg"},
            ],
        },
    }
    r = _classify_item(node)
    assert r == ("mix", "001cf67080308c21cb4d36b2f95ecc", "Raindance", "https://x/md.jpg")


def test_classify_playlist_wrapper():
    node = {
        "type": "PLAYLIST",
        "data": {
            "uuid": "31885f0b-96dc-41e1-8e1b-f83372043208",
            "title": "Pop Hits",
            "squareImages": [
                {"size": "MEDIUM", "url": "https://x/pl.jpg"},
            ],
        },
    }
    r = _classify_item(node)
    assert r == ("playlist", "31885f0b-96dc-41e1-8e1b-f83372043208", "Pop Hits", "https://x/pl.jpg")


def test_classify_album_wrapper():
    node = {
        "type": "ALBUM",
        "data": {
            "id": 500612897,
            "title": "Some Album",
            "squareImages": [
                {"size": "LARGE", "url": "https://x/al.jpg"},
            ],
        },
    }
    r = _classify_item(node)
    assert r == ("album", "500612897", "Some Album", "https://x/al.jpg")


def test_classify_flat_playlist_still_works():
    """Backwards-compat — flat shape with uuid + title."""
    r = _classify_item({"uuid": "31885f0b-96dc-41e1-8e1b-f83372043208", "title": "X"})
    assert r is not None
    assert r[0] == "playlist"


def test_walk_classify_doesnt_recurse_after_match():
    """Once a wrapper is classified, don't continue into data to find nested items."""
    node = {
        "items": [
            {
                "type": "MIX",
                "data": {
                    "id": "abc1234567890xyz",
                    "titleTextInfo": {"text": "Mix"},
                    # nested: pretend there's a playlist UUID embedded somewhere
                    "track": {"uuid": "99999999-9999-9999-9999-999999999999", "title": "decoy"},
                },
            }
        ]
    }
    results = list(TidalEMPImporter._walk_classify(node))
    assert len(results) == 1
    assert results[0][0] == "mix"


def test_load_sources_parses(db_conn):
    """tidal_emp_sources 4종 kind 다 파싱."""
    set_setting(
        db_conn,
        SOURCES_SETTING_KEY,
        "home/THE_HITS\nplaylist/abc-1234567890abcdef\nalbum/500612897\nmix/00042cc52d0397491c4b9a4a87286a",
    )
    try:
        importer = TidalEMPImporter(conn=db_conn, token="fake")
        sources = importer._load_sources(db_conn)
        kinds = {kind for kind, _ in sources}
        assert kinds == {"home", "playlist", "album", "mix"}
        assert len(sources) == 4
    finally:
        set_setting(db_conn, SOURCES_SETTING_KEY, None)


def test_load_sources_default(db_conn):
    """비어 있으면 DEFAULT_SOURCES."""
    set_setting(db_conn, SOURCES_SETTING_KEY, None)
    importer = TidalEMPImporter(conn=db_conn, token="fake")
    sources = importer._load_sources(db_conn)
    assert len(sources) == len(DEFAULT_SOURCES)
    assert all(kind == "home" for kind, _ in sources)
