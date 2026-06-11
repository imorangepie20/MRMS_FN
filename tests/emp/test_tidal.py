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


def test_normalize_track_extracts_album_cover():
    """트랙 album.cover(UUID) → CDN URL이 트랙 cover_url로 추출됨."""
    tr = {
        "id": 12345,
        "title": "A Track",
        "isrc": "USABC1234567",
        "duration": 200,
        "artists": [{"name": "AR"}],
        "album": {
            "title": "An Album",
            "cover": "b48a8d6f-1234-5678-abcd-ef0123456789",
        },
    }
    t = TidalEMPImporter._normalize_track(tr)
    assert t["album_title"] == "An Album"
    assert t["cover_url"] == (
        "https://resources.tidal.com/images/"
        "b48a8d6f/1234/5678/abcd/ef0123456789/320x320.jpg"
    )


def test_normalize_track_cover_none_when_no_album_image():
    """album에 cover 필드가 없으면 cover_url None (하위호환)."""
    tr = {
        "id": 999,
        "title": "B Track",
        "isrc": "USXYZ7654321",
        "duration": 100,
        "artists": [{"name": "BR"}],
        "album": {"title": "Bare Album"},
    }
    t = TidalEMPImporter._normalize_track(tr)
    assert t["cover_url"] is None


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


async def test_import_all_recovers_from_sql_error(db_conn, cleanup):
    """트랙 upsert가 SQL 에러로 트랜잭션을 깨도 rollback 후 다음 트랙 진행
    (InFailedSqlTransaction 연쇄실패 — prod 좀비 run 근본 원인 — 재발 방지)."""
    from unittest.mock import patch

    import psycopg

    from mrms.db.settings import set_setting
    from mrms.emp import tidal as tidal_mod

    set_setting(db_conn, SOURCES_SETTING_KEY, "mix/testmix1234567890abcdef")
    cleanup('DELETE FROM "Setting" WHERE key = %s', (SOURCES_SETTING_KEY,))
    cleanup("DELETE FROM \"EMPSource\" WHERE source_id = 'mix:testmix1234567890abcdef'")
    cleanup("DELETE FROM \"TrackPlatform\" WHERE \"platformTrackId\" IN ('rb_t1', 'rb_t2')")
    cleanup("DELETE FROM \"Track\" WHERE isrc IN ('emp_tidal_rb_t1', 'emp_tidal_rb_t2')")

    fake_tracks = [
        {"platform_track_id": "rb_t1", "title": "T1", "isrc": None,
         "artist": "RB A1", "album_title": None, "duration_ms": 1000},
        {"platform_track_id": "rb_t2", "title": "T2", "isrc": None,
         "artist": "RB A2", "album_title": None, "duration_ms": 1000},
    ]

    async def fake_fetch_mix(self, http, mix_id):
        return fake_tracks

    real_upsert = tidal_mod.upsert_track_and_emp_source
    calls = {"n": 0}

    def flaky_upsert(conn, **kw):
        calls["n"] += 1
        if calls["n"] == 1:
            # 진짜 SQL 에러로 트랜잭션 abort 재현
            try:
                with conn.cursor() as cur:
                    cur.execute('SELECT no_such_column FROM "Track"')
            except psycopg.Error:
                pass  # rollback 없이 — 깨진 상태 유지
            raise psycopg.errors.UndefinedColumn("simulated abort")
        return real_upsert(conn, **kw)

    importer = TidalEMPImporter(conn=db_conn, token="fake")
    with patch.object(TidalEMPImporter, "_fetch_mix_tracks", fake_fetch_mix), \
         patch.object(tidal_mod, "upsert_track_and_emp_source", flaky_upsert):
        summary = await importer.import_all(db_conn)

    # 1번 트랙은 에러, 2번 트랙은 rollback 덕에 정상 적재
    assert len(summary["errors"]) == 1
    assert "rb_t1" in summary["errors"][0]
    assert summary["tracks_new"] == 1
