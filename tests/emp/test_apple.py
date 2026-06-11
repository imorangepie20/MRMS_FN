"""AppleEMPImporter — rss.marketingtools.apple.com 공개 RSS (토큰 0)."""
import httpx
import respx

from mrms.db.settings import set_setting
from mrms.emp.apple import (
    DEFAULT_SOURCES,
    RSS_BASE,
    SOURCES_SETTING_KEY,
    AppleEMPImporter,
    _upsize_artwork,
    parse_feed,
)


def _feed(title: str, songs: list[dict]) -> dict:
    return {"feed": {"title": title, "results": songs}}


def _song(sid, name, artist, album=None, art="https://x/100x100bb.jpg"):
    return {
        "id": sid, "name": name, "artistName": artist,
        "collectionName": album, "artworkUrl100": art,
    }


# ----- 순수 함수 -----


def test_upsize_artwork():
    assert _upsize_artwork("https://x/100x100bb.jpg") == "https://x/600x600bb.jpg"
    assert _upsize_artwork(None) is None


def test_parse_feed_extracts_tracks():
    title, tracks = parse_feed(_feed("인기곡", [
        _song("1", "REDRED", "코르티스", "GREENGREEN"),
        _song("2", "Solo", "Artist"),
    ]))
    assert title == "인기곡"
    assert len(tracks) == 2
    assert tracks[0]["track_id"] == "1"
    assert tracks[0]["title"] == "REDRED"
    assert tracks[0]["artist"] == "코르티스"
    assert tracks[0]["album"] == "GREENGREEN"
    assert tracks[0]["cover_url"] == "https://x/600x600bb.jpg"
    assert tracks[1]["album"] is None


def test_parse_feed_skips_incomplete():
    _, tracks = parse_feed(_feed("x", [
        {"id": "1", "name": "ok", "artistName": "a"},
        {"id": "2", "name": "no artist"},        # skip
        {"name": "no id", "artistName": "a"},    # skip
    ]))
    assert len(tracks) == 1


def test_parse_feed_empty():
    _, tracks = parse_feed({"feed": {"results": []}})
    assert tracks == []
    _, tracks2 = parse_feed({})
    assert tracks2 == []


# ----- 소스 파싱 -----


def test_load_sources_parses(db_conn):
    set_setting(
        db_conn, SOURCES_SETTING_KEY,
        "# comment\nsongs/kr   # Korea\nsongs/jp\nalbums/us\nbogus\n",
    )
    try:
        importer = AppleEMPImporter()
        sources = importer._load_sources(db_conn)
        # albums/bogus는 제외 (songs만 트랙 담음)
        assert sources == [("songs", "kr"), ("songs", "jp")]
    finally:
        set_setting(db_conn, SOURCES_SETTING_KEY, None)


def test_load_sources_default(db_conn):
    set_setting(db_conn, SOURCES_SETTING_KEY, None)
    importer = AppleEMPImporter()
    sources = importer._load_sources(db_conn)
    assert len(sources) == len(DEFAULT_SOURCES)
    assert all(kind == "songs" for kind, _ in sources)


# ----- import_all 통합 -----


@respx.mock
async def test_import_all_saves_section_and_tracks(db_conn, cleanup):
    """songs/kr 소스 1개 → 섹션 1 + chart 아이템 1 + 트랙 upsert."""
    set_setting(db_conn, SOURCES_SETTING_KEY, "songs/kr")
    section_key = "songs:kr"
    source_id = "chart:kr-songs"

    cleanup('DELETE FROM "Artist" WHERE name IN (%s, %s)', ("AP A1", "AP A2"))
    cleanup('DELETE FROM "Album" WHERE title = %s', ("AP Album",))
    cleanup('DELETE FROM "Track" WHERE isrc IN (%s, %s)',
            ("emp_apple_ap1", "emp_apple_ap2"))
    cleanup('DELETE FROM "TrackPlatform" WHERE "platformTrackId" IN (%s, %s)',
            ("ap1", "ap2"))
    cleanup('DELETE FROM "EMPSource" WHERE source_id = %s', (source_id,))
    cleanup('DELETE FROM "EMPSection" WHERE platform = %s AND "sectionKey" = %s',
            ("apple", section_key))
    cleanup('DELETE FROM "Setting" WHERE key = %s', (SOURCES_SETTING_KEY,))

    feed = _feed("인기곡", [
        _song("ap1", "AP Song 1", "AP A1", "AP Album"),
        _song("ap2", "AP Song 2", "AP A2"),
    ])
    respx.get(f"{RSS_BASE}/kr/music/most-played/50/songs.json").mock(
        return_value=httpx.Response(200, json=feed)
    )

    importer = AppleEMPImporter()
    summary = await importer.import_all(db_conn)

    assert summary["errors"] == []
    assert summary["playlists_processed"] == 1
    assert summary["tracks_new"] + summary["tracks_existing"] == 2

    with db_conn.cursor() as cur:
        cur.execute(
            'SELECT id, "displayTitle" FROM "EMPSection" '
            'WHERE platform = %s AND "sectionKey" = %s',
            ("apple", section_key),
        )
        sec = cur.fetchone()
        assert sec is not None
        assert sec[1] == "인기곡"
        cur.execute(
            'SELECT "itemType", "itemId" FROM "EMPSectionItem" WHERE "sectionId" = %s',
            (sec[0],),
        )
        assert cur.fetchall() == [("chart", "kr-songs")]
        cur.execute(
            'SELECT COUNT(*) FROM "EMPSource" WHERE platform = %s AND source_id = %s',
            ("apple", source_id),
        )
        assert cur.fetchone()[0] == 2


@respx.mock
async def test_import_all_fetch_failure_recorded(db_conn):
    set_setting(db_conn, SOURCES_SETTING_KEY, "songs/zz")
    respx.get(f"{RSS_BASE}/zz/music/most-played/50/songs.json").mock(
        return_value=httpx.Response(404)
    )
    try:
        importer = AppleEMPImporter()
        summary = await importer.import_all(db_conn)
        assert summary["tracks_new"] == 0
        assert any("zz" in e for e in summary["errors"])
    finally:
        set_setting(db_conn, SOURCES_SETTING_KEY, None)
