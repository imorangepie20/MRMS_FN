"""VibeEMPImporter — apis.naver.com/vibeWeb/musicapiweb 공개 API."""
import httpx
import respx

from mrms.db.settings import set_setting
from mrms.emp.vibe import (
    DEFAULT_SOURCES,
    SOURCES_SETTING_KEY,
    VibeEMPImporter,
    _normalize_track,
    _parse_play_time,
    _parse_tracks,
)

STATION_LIST_URL = (
    "https://apis.naver.com/vibeWeb/musicapiweb/vibe/v1/dj/station"
)
THEME_URL = (
    "https://apis.naver.com/vibeWeb/musicapiweb/vibe/v1/today/timethemepl"
)


def _station_tracks_url(station_no: str) -> str:
    return f"https://apis.naver.com/vibeWeb/musicapiweb/v1/station/{station_no}/tracks"


def _playlist_url(pl_id: str) -> str:
    return f"https://apis.naver.com/vibeWeb/musicapiweb/vibe/v3/playlist/{pl_id}"


def _vibe_track(track_id, title, artists, album_title, play_time, cover=None):
    """VIBE track object 모양 (스테이션/플리 공통)."""
    return {
        "trackId": track_id,
        "trackTitle": title,
        "artists": [{"artistId": i, "artistName": a} for i, a in enumerate(artists)],
        "album": {
            "albumId": 1,
            "albumTitle": album_title,
            "imageUrl": cover or "https://cdn.vibe.test/album.jpg",
            "releaseDate": "2026.06.01",
        },
        "playTime": play_time,
    }


# ----- 소스 파싱 -----


def test_load_sources_parses(db_conn):
    """stations + theme + station/{no} + playlist/{plId} 파싱, 주석/빈 줄/모르는 kind 무시."""
    set_setting(
        db_conn,
        SOURCES_SETTING_KEY,
        "# comment\n"
        "stations\n"
        "theme\n"
        "station/10000010\n"
        "playlist/mood_genz_0009\n"
        "bogus/xyz\n"
        "\n",
    )
    try:
        importer = VibeEMPImporter()
        sources = importer._load_sources(db_conn)
        assert sources == [
            ("stations", ""),
            ("theme", ""),
            ("station", "10000010"),
            ("playlist", "mood_genz_0009"),
        ]
    finally:
        set_setting(db_conn, SOURCES_SETTING_KEY, None)


def test_load_sources_default(db_conn):
    """비어 있으면 DEFAULT_SOURCES = ['stations', 'theme']."""
    set_setting(db_conn, SOURCES_SETTING_KEY, None)
    importer = VibeEMPImporter()
    sources = importer._load_sources(db_conn)
    assert DEFAULT_SOURCES == ["stations", "theme"]
    assert sources == [("stations", ""), ("theme", "")]


# ----- playTime → ms -----


def test_parse_play_time():
    assert _parse_play_time("04:07") == (4 * 60 + 7) * 1000  # 247000
    assert _parse_play_time("03:14") == (3 * 60 + 14) * 1000
    assert _parse_play_time("00:30") == 30000
    assert _parse_play_time("1:02:03") == (62 * 60 + 3) * 1000  # h:m:s
    assert _parse_play_time(None) is None
    assert _parse_play_time("bad") is None


# ----- 트랙 정규화 -----


def test_normalize_track_artist_join():
    """artists[].artistName ', ' join + playTime ms + album.albumTitle/imageUrl."""
    t = _normalize_track(
        _vibe_track(
            58681967,
            "Windows",
            ["Revel Day", "MIA MOR"],
            "Windows",
            "03:49",
            cover="https://cdn.vibe.test/w.jpg",
        )
    )
    assert t["platform_track_id"] == "58681967"
    assert t["title"] == "Windows"
    assert t["isrc"] is None
    assert t["artist"] == "Revel Day, MIA MOR"
    assert t["album_title"] == "Windows"
    assert t["cover_url"] == "https://cdn.vibe.test/w.jpg"
    assert t["duration_ms"] == (3 * 60 + 49) * 1000


def test_normalize_track_no_artists_falls_back_to_unknown():
    tr = {
        "trackId": 1,
        "trackTitle": "Instrumental",
        "artists": [],
        "album": {"albumTitle": "X"},
        "playTime": "02:10",
    }
    t = _normalize_track(tr)
    assert t["artist"] == "Unknown"
    assert t["duration_ms"] == 130000


def test_normalize_track_missing_id_or_title():
    assert _normalize_track({"trackTitle": "x"}) is None
    assert _normalize_track({"trackId": 1}) is None
    assert _normalize_track("not a dict") is None


def test_parse_tracks_drops_invalid():
    raw = [
        _vibe_track(1, "A", ["X"], "Al", "03:00"),
        {"trackId": 2},  # no title → dropped
        "garbage",
    ]
    out = _parse_tracks(raw)
    assert len(out) == 1
    assert out[0]["title"] == "A"
    assert _parse_tracks("not a list") == []


# ----- import_all 통합 (dj/station → 섹션 + 아이템 + 트랙) -----


@respx.mock
async def test_import_all_stations_saves_sections_items_and_tracks(db_conn, cleanup):
    """stations 소스 → MOOD/GENRE 섹션 + station 아이템 + 트랙 적재.

    synthetic 이름 사용 (실제 차트명과 dedup FK 충돌 방지 — melon 테스트 교훈)."""
    set_setting(db_conn, SOURCES_SETTING_KEY, "stations")

    # cleanup 등록 (자식→부모 역순은 conftest가 처리; FK: Track→Album→Artist)
    cleanup(
        'DELETE FROM "Artist" WHERE name IN (%s, %s)',
        ("VIBE Test Artist M", "VIBE Test Artist G"),
    )
    cleanup(
        'DELETE FROM "Album" WHERE title IN (%s, %s)',
        ("VIBE Test Album M", "VIBE Test Album G"),
    )
    cleanup(
        'DELETE FROM "Track" WHERE isrc IN (%s, %s)',
        ("emp_vibe_vibe_mood_t1", "emp_vibe_vibe_genre_t1"),
    )
    cleanup(
        'DELETE FROM "TrackPlatform" WHERE "platformTrackId" IN (%s, %s)',
        ("vibe_mood_t1", "vibe_genre_t1"),
    )
    cleanup(
        'DELETE FROM "EMPSource" WHERE source_id IN (%s, %s)',
        ("station:90001", "station:90002"),
    )
    cleanup(
        'DELETE FROM "EMPSection" WHERE platform = %s AND "sectionKey" IN (%s, %s)',
        ("vibe", "station:MOOD", "station:GENRE"),
    )  # EMPSectionItem은 ON DELETE CASCADE
    cleanup('DELETE FROM "Setting" WHERE key = %s', (SOURCES_SETTING_KEY,))

    station_list = {
        "response": {
            "result": {
                "stationContentTotalCount": 2,
                "stationContentList": [
                    {
                        "contentType": "MOOD",
                        "djStationList": [
                            {
                                "stationNo": 90001,
                                "stationName": "VIBE Test Mood Station",
                                "imageUrl": "https://cdn.vibe.test/mood.png",
                            }
                        ],
                    },
                    {
                        "contentType": "GENRE",
                        "djStationList": [
                            {
                                "stationNo": 90002,
                                "stationName": "VIBE Test Genre Station",
                                "imageUrl": "https://cdn.vibe.test/genre.png",
                            }
                        ],
                    },
                ],
            }
        }
    }
    respx.get(STATION_LIST_URL).mock(
        return_value=httpx.Response(200, json=station_list)
    )
    respx.get(_station_tracks_url("90001")).mock(
        return_value=httpx.Response(
            200,
            json={
                "response": {
                    "result": {
                        "stationList": [
                            {
                                "stationNo": 90001,
                                "tracks": [
                                    _vibe_track(
                                        "vibe_mood_t1",
                                        "VIBE Mood Song",
                                        ["VIBE Test Artist M"],
                                        "VIBE Test Album M",
                                        "03:14",
                                    )
                                ],
                            }
                        ]
                    }
                }
            },
        )
    )
    respx.get(_station_tracks_url("90002")).mock(
        return_value=httpx.Response(
            200,
            json={
                "response": {
                    "result": {
                        "stationList": [
                            {
                                "stationNo": 90002,
                                "tracks": [
                                    _vibe_track(
                                        "vibe_genre_t1",
                                        "VIBE Genre Song",
                                        ["VIBE Test Artist G"],
                                        "VIBE Test Album G",
                                        "04:07",
                                    )
                                ],
                            }
                        ]
                    }
                }
            },
        )
    )

    importer = VibeEMPImporter()
    summary = await importer.import_all(db_conn)

    assert summary["errors"] == []
    assert summary["playlists_processed"] == 2  # 2 stations
    assert summary["tracks_new"] + summary["tracks_existing"] == 2

    with db_conn.cursor() as cur:
        # MOOD 섹션 + station 아이템
        cur.execute(
            'SELECT id, "displayTitle" FROM "EMPSection" '
            'WHERE platform = %s AND "sectionKey" = %s',
            ("vibe", "station:MOOD"),
        )
        mood_sec = cur.fetchone()
        assert mood_sec is not None
        assert mood_sec[1] == "MOOD"

        cur.execute(
            'SELECT "itemType", "itemId", title, "coverUrl" FROM "EMPSectionItem" '
            'WHERE "sectionId" = %s ORDER BY "displayOrder"',
            (mood_sec[0],),
        )
        mood_items = cur.fetchall()
        assert [(r[0], r[1]) for r in mood_items] == [("station", "90001")]
        assert mood_items[0][2] == "VIBE Test Mood Station"
        assert mood_items[0][3] == "https://cdn.vibe.test/mood.png"

        # GENRE 섹션
        cur.execute(
            'SELECT id FROM "EMPSection" '
            'WHERE platform = %s AND "sectionKey" = %s',
            ("vibe", "station:GENRE"),
        )
        genre_sec = cur.fetchone()
        assert genre_sec is not None

        # 트랙 EMPSource — source_type/source_id 검증
        cur.execute(
            'SELECT COUNT(*) FROM "EMPSource" '
            "WHERE platform = %s AND source_type = %s AND source_id = %s",
            ("vibe", "vibe_station", "station:90001"),
        )
        assert cur.fetchone()[0] == 1
        cur.execute(
            'SELECT COUNT(*) FROM "EMPSource" '
            "WHERE platform = %s AND source_type = %s AND source_id = %s",
            ("vibe", "vibe_station", "station:90002"),
        )
        assert cur.fetchone()[0] == 1


@respx.mock
async def test_import_all_stations_bad_status_records_error(db_conn):
    """dj/station HTTP 500 → 에러 기록 + skip (예외 없음)."""
    set_setting(db_conn, SOURCES_SETTING_KEY, "stations")
    respx.get(STATION_LIST_URL).mock(return_value=httpx.Response(500))
    try:
        importer = VibeEMPImporter()
        summary = await importer.import_all(db_conn)
    finally:
        set_setting(db_conn, SOURCES_SETTING_KEY, None)
    assert summary["tracks_new"] == 0
    assert summary["playlists_processed"] == 0
    assert any("stations" in e for e in summary["errors"])
