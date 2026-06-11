"""FloEMPImporter — music-flo.com 공개 API."""
import httpx
import respx

from mrms.db.settings import set_setting
from mrms.emp.flo import (
    DEFAULT_SOURCES,
    SOURCES_SETTING_KEY,
    FloEMPImporter,
    _classify_item,
    _format_cover,
    _normalize_track,
    _parse_play_time,
)

CURATIONS_URL = "https://www.music-flo.com/api/personal/v1/curations/contents"


def _playlist_url(num_id: str) -> str:
    return f"https://www.music-flo.com/api/personal/v1/playlist/{num_id}"


def _channel_url(num_id: str) -> str:
    return f"https://www.music-flo.com/api/meta/v1/channel/{num_id}"


def _flo_track(tid, name, artists, album_title, play_time, rep_artist=None):
    """FLO track object 모양."""
    tr = {
        "id": tid,
        "name": name,
        "artistList": [{"name": a} for a in artists],
        "album": {
            "title": album_title,
            "img": {"urlFormat": "https://cdn.music-flo.com/cover/{size}.jpg"},
            "releaseYmd": "20260601",
        },
        "playTime": play_time,
    }
    if rep_artist is not None:
        tr["representationArtist"] = {"name": rep_artist}
    return tr


# ----- 소스 파싱 -----


def test_load_sources_parses(db_conn):
    """special + playlist + channel 파싱, 주석/빈 줄/모르는 kind 무시."""
    set_setting(
        db_conn,
        SOURCES_SETTING_KEY,
        "# comment\n"
        "special\n"
        "playlist/12345\n"
        "channel/67890\n"
        "bogus/xyz\n"
        "\n",
    )
    try:
        importer = FloEMPImporter()
        sources = importer._load_sources(db_conn)
        assert sources == [
            ("special", ""),
            ("playlist", "12345"),
            ("channel", "67890"),
        ]
    finally:
        set_setting(db_conn, SOURCES_SETTING_KEY, None)


def test_load_sources_default(db_conn):
    """비어 있으면 DEFAULT_SOURCES = ['special']."""
    set_setting(db_conn, SOURCES_SETTING_KEY, None)
    importer = FloEMPImporter()
    sources = importer._load_sources(db_conn)
    assert DEFAULT_SOURCES == ["special"]
    assert sources == [("special", "")]


# ----- cover urlFormat 치환 -----


def test_format_cover_replaces_size():
    """urlFormat '{size}' → 500 치환."""
    assert (
        _format_cover({"urlFormat": "https://cdn.flo.com/x/{size}.jpg"})
        == "https://cdn.flo.com/x/500.jpg"
    )
    assert _format_cover(None) is None
    assert _format_cover({}) is None


# ----- 아이템 분류 (PLAYLIST/CHNL) -----


def test_classify_item_playlist():
    """PLAYLIST → ('playlist', id, name, cover). gridImg 우선."""
    r = _classify_item({
        "type": "PLAYLIST",
        "id": 111,
        "name": "여름 드라이브",
        "gridImg": {"urlFormat": "https://cdn.flo.com/grid/{size}.jpg"},
        "img": {"urlFormat": "https://cdn.flo.com/img/{size}.jpg"},
    })
    assert r == (
        "playlist",
        "111",
        "여름 드라이브",
        "https://cdn.flo.com/grid/500.jpg",
    )


def test_classify_item_channel():
    """CHNL → ('channel', id, name, cover). gridImg 없으면 img fallback."""
    r = _classify_item({
        "type": "CHNL",
        "id": 222,
        "name": "K-힙합",
        "img": {"urlFormat": "https://cdn.flo.com/img/{size}.jpg"},
    })
    assert r == (
        "channel",
        "222",
        "K-힙합",
        "https://cdn.flo.com/img/500.jpg",
    )


def test_classify_item_unknown_type_returns_none():
    assert _classify_item({"type": "TRACK", "id": 1, "name": "x"}) is None
    assert _classify_item({"type": "PLAYLIST", "name": "no id"}) is None


# ----- playTime → ms -----


def test_parse_play_time():
    assert _parse_play_time("3:45") == (3 * 60 + 45) * 1000  # 225000
    assert _parse_play_time("0:30") == 30000
    assert _parse_play_time("10:00") == 600000
    assert _parse_play_time("1:02:03") == (62 * 60 + 3) * 1000  # h:m:s
    assert _parse_play_time(None) is None
    assert _parse_play_time("bad") is None


# ----- 트랙 정규화 -----


def test_normalize_track_artist_list_join():
    """artistList[].name ', ' join + playTime ms + album.title."""
    t = _normalize_track(
        _flo_track("t1", "노래", ["데이브레이크", "원슈타인"], "앨범A", "4:05")
    )
    assert t["platform_track_id"] == "t1"
    assert t["title"] == "노래"
    assert t["isrc"] is None
    assert t["artist"] == "데이브레이크, 원슈타인"
    assert t["album_title"] == "앨범A"
    assert t["duration_ms"] == (4 * 60 + 5) * 1000


def test_normalize_track_falls_back_to_representation_artist():
    """artistList 비었으면 representationArtist.name."""
    tr = {
        "id": "t2",
        "name": "솔로곡",
        "artistList": [],
        "representationArtist": {"name": "won.e"},
        "album": {"title": "B"},
        "playTime": "2:10",
    }
    t = _normalize_track(tr)
    assert t["artist"] == "won.e"
    assert t["duration_ms"] == 130000


def test_normalize_track_missing_id_or_name():
    assert _normalize_track({"name": "x"}) is None
    assert _normalize_track({"id": "1"}) is None
    assert _normalize_track("not a dict") is None


# ----- import_all 통합 (curations → 섹션 + 아이템 + 트랙) -----


@respx.mock
async def test_import_all_special_saves_section_items_and_tracks(db_conn, cleanup):
    """special 소스 → 큐레이션 섹션 1개 + playlist/channel 아이템 + 양쪽 트랙 적재."""
    section_key = "special:9001"
    set_setting(db_conn, SOURCES_SETTING_KEY, "special")

    # cleanup 역순 실행 — 자식(Track)→부모(Album)→조부모(Artist) 순으로 지우려면
    # 등록은 Artist → Album → Track 순 (FK: Track→Album→Artist)
    cleanup(
        'DELETE FROM "Artist" WHERE name IN (%s, %s)',
        ("FLO Test A1", "FLO Test A2"),
    )
    cleanup(
        'DELETE FROM "Album" WHERE title IN (%s, %s)',
        ("PL Album", "CH Album"),
    )
    cleanup(
        'DELETE FROM "Track" WHERE isrc IN (%s, %s)',
        ("emp_flo_flo_pl_t1", "emp_flo_flo_ch_t1"),
    )
    cleanup(
        'DELETE FROM "TrackPlatform" WHERE "platformTrackId" IN (%s, %s)',
        ("flo_pl_t1", "flo_ch_t1"),
    )
    cleanup(
        'DELETE FROM "EMPSource" WHERE source_id IN (%s, %s)',
        ("playlist:111", "channel:222"),
    )
    cleanup(
        'DELETE FROM "EMPSection" WHERE platform = %s AND "sectionKey" = %s',
        ("flo", section_key),
    )  # EMPSectionItem은 ON DELETE CASCADE
    cleanup('DELETE FROM "Setting" WHERE key = %s', (SOURCES_SETTING_KEY,))

    curations = {
        "code": "2000000",
        "data": {
            "list": [
                {
                    "type": "CURATION2",
                    "content": {
                        "id": 9001,
                        "title": "예감 좋은 행운을 드려요",
                        "list": [
                            {
                                "type": "PLAYLIST",
                                "id": 111,
                                "name": "행운 플레이리스트",
                                "gridImg": {
                                    "urlFormat": "https://cdn.flo.com/pl/{size}.jpg"
                                },
                            },
                            {
                                "type": "CHNL",
                                "id": 222,
                                "name": "K-힙합 채널",
                                "img": {
                                    "urlFormat": "https://cdn.flo.com/ch/{size}.jpg"
                                },
                            },
                        ],
                    },
                }
            ]
        },
    }
    respx.get(CURATIONS_URL).mock(
        return_value=httpx.Response(200, json=curations)
    )
    respx.get(_playlist_url("111")).mock(
        return_value=httpx.Response(
            200,
            json={
                "code": "2000000",
                "data": {
                    "track": {
                        "list": [
                            _flo_track(
                                "flo_pl_t1", "PL Song", ["FLO Test A1"], "PL Album", "3:00"
                            )
                        ]
                    }
                },
            },
        )
    )
    respx.get(_channel_url("222")).mock(
        return_value=httpx.Response(
            200,
            json={
                "code": "2000000",
                "data": {
                    "trackList": [
                        _flo_track(
                            "flo_ch_t1", "CH Song", ["FLO Test A2"], "CH Album", "4:30"
                        )
                    ]
                },
            },
        )
    )

    importer = FloEMPImporter()
    summary = await importer.import_all(db_conn)

    assert summary["errors"] == []
    assert summary["playlists_processed"] == 2  # playlist + channel
    assert summary["tracks_new"] + summary["tracks_existing"] == 2

    with db_conn.cursor() as cur:
        cur.execute(
            'SELECT id, "displayTitle" FROM "EMPSection" '
            'WHERE platform = %s AND "sectionKey" = %s',
            ("flo", section_key),
        )
        sec = cur.fetchone()
        assert sec is not None
        assert sec[1] == "예감 좋은 행운을 드려요"

        cur.execute(
            'SELECT "itemType", "itemId", title, "coverUrl" FROM "EMPSectionItem" '
            'WHERE "sectionId" = %s ORDER BY "displayOrder"',
            (sec[0],),
        )
        sec_items = cur.fetchall()
        assert [(r[0], r[1]) for r in sec_items] == [
            ("playlist", "111"),
            ("channel", "222"),
        ]
        assert sec_items[0][3] == "https://cdn.flo.com/pl/500.jpg"
        assert sec_items[1][3] == "https://cdn.flo.com/ch/500.jpg"

        # 트랙 EMPSource — source_type/source_id 검증
        cur.execute(
            'SELECT COUNT(*) FROM "EMPSource" '
            "WHERE platform = %s AND source_type = %s AND source_id = %s",
            ("flo", "flo_curation", "playlist:111"),
        )
        assert cur.fetchone()[0] == 1
        cur.execute(
            'SELECT COUNT(*) FROM "EMPSource" '
            "WHERE platform = %s AND source_type = %s AND source_id = %s",
            ("flo", "flo_curation", "channel:222"),
        )
        assert cur.fetchone()[0] == 1


@respx.mock
async def test_import_all_special_bad_code_records_error(db_conn):
    """curations code != 2000000 → 에러 기록 + skip (예외 없음)."""
    set_setting(db_conn, SOURCES_SETTING_KEY, "special")
    respx.get(CURATIONS_URL).mock(
        return_value=httpx.Response(200, json={"code": "4000000", "data": {}})
    )
    try:
        importer = FloEMPImporter()
        summary = await importer.import_all(db_conn)
    finally:
        set_setting(db_conn, SOURCES_SETTING_KEY, None)
    assert summary["tracks_new"] == 0
    assert summary["playlists_processed"] == 0
    assert any("4000000" in e for e in summary["errors"])
