"""YoutubeEMPImporter — ytmusicapi 공식 차트 플레이리스트."""
import json
from unittest.mock import AsyncMock, patch

from mrms.db.ids import stable_id
from mrms.emp.youtube import (
    AUTH_SETTING_KEY,
    DEFAULT_SOURCES,
    SOURCES_SETTING_KEY,
    YoutubeEMPImporter,
    _best_thumbnail,
    _duration_to_ms,
    _migrate_synthetic_mapping,
    parse_playlist,
)


# ----- _duration_to_ms (순수) -----


def test_duration_to_ms_minutes_seconds():
    assert _duration_to_ms("3:25") == (3 * 60 + 25) * 1000


def test_duration_to_ms_hours():
    assert _duration_to_ms("1:02:03") == (3600 + 2 * 60 + 3) * 1000


def test_duration_to_ms_invalid():
    assert _duration_to_ms(None) is None
    assert _duration_to_ms("") is None
    assert _duration_to_ms("abc") is None
    assert _duration_to_ms("1:2:3:4") is None


# ----- _best_thumbnail (순수) -----


def test_best_thumbnail_picks_largest_width():
    thumbs = [
        {"url": "https://img/sm.jpg", "width": 60, "height": 60},
        {"url": "https://img/lg.jpg", "width": 544, "height": 544},
        {"url": "https://img/md.jpg", "width": 226, "height": 226},
    ]
    assert _best_thumbnail(thumbs) == "https://img/lg.jpg"


def test_best_thumbnail_none_when_empty():
    assert _best_thumbnail([]) is None
    assert _best_thumbnail(None) is None


def test_best_thumbnail_missing_width_defaults_zero():
    thumbs = [
        {"url": "https://img/a.jpg"},
        {"url": "https://img/b.jpg", "width": 100},
    ]
    assert _best_thumbnail(thumbs) == "https://img/b.jpg"


# ----- parse_playlist (순수) -----


def _track(title, artist_name, *, video_id=None, duration="3:25", thumb="https://img/x.jpg"):
    t = {
        "title": title,
        "artists": [{"name": artist_name}] if artist_name else [],
        "duration": duration,
        "thumbnails": [{"url": thumb, "width": 544, "height": 544}],
    }
    if video_id is not None:
        t["videoId"] = video_id
    return t


def test_parse_playlist_uses_videoid_when_present():
    pl = {
        "title": "YT TEST Chart",
        "tracks": [_track("YT TEST Song", "YT Test Artist", video_id="vid123")],
    }
    title, tracks = parse_playlist(pl)
    assert title == "YT TEST Chart"
    assert len(tracks) == 1
    assert tracks[0]["track_id"] == "vid123"
    assert tracks[0]["title"] == "YT TEST Song"
    assert tracks[0]["artist"] == "YT Test Artist"
    assert tracks[0]["cover_url"] == "https://img/x.jpg"
    assert tracks[0]["duration_ms"] == (3 * 60 + 25) * 1000


def test_parse_playlist_synthesizes_id_when_videoid_missing():
    pl = {"title": "C", "tracks": [_track("Synth Song", "Synth Artist", video_id=None)]}
    _, tracks = parse_playlist(pl)
    expected = f"yt_{stable_id('Synth Song|Synth Artist')[:16]}"
    assert tracks[0]["track_id"] == expected
    # 합성 id는 일관적 — 같은 입력이면 같은 결과
    _, tracks2 = parse_playlist(pl)
    assert tracks2[0]["track_id"] == expected


def test_parse_playlist_video_id_passthrough():
    """video_id 키 — real videoId면 보존, 없으면 None (마이그레이션 판단용)."""
    pl = {
        "title": "C",
        "tracks": [
            _track("Real Song", "A", video_id="vidREAL"),
            _track("Synth Song", "A", video_id=None),
        ],
    }
    _, tracks = parse_playlist(pl)
    assert tracks[0]["video_id"] == "vidREAL"
    assert tracks[1]["video_id"] is None


def test_parse_playlist_artist_fallback_unknown():
    pl = {"title": "C", "tracks": [_track("S", None, video_id="v")]}
    _, tracks = parse_playlist(pl)
    assert tracks[0]["artist"] == "Unknown"


def test_parse_playlist_skips_track_without_title():
    pl = {"title": "C", "tracks": [{"artists": [{"name": "A"}], "videoId": "v"}]}
    _, tracks = parse_playlist(pl)
    assert tracks == []


def test_parse_playlist_non_dict():
    assert parse_playlist(None) == (None, [])


# ----- _load_sources + 기본값 -----


def test_load_sources_default(monkeypatch):
    importer = YoutubeEMPImporter()
    monkeypatch.setattr("mrms.emp.youtube.get_setting", lambda conn, key: None)
    pids = importer._load_sources(conn=None)
    expected = [s.partition("/")[2] for s in DEFAULT_SOURCES]
    assert pids == expected


def test_load_sources_parses_setting(monkeypatch):
    importer = YoutubeEMPImporter()
    raw = "# comment\nplaylist/ABC123\n\nchannel/ignored\nplaylist/DEF456\n"
    monkeypatch.setattr("mrms.emp.youtube.get_setting", lambda conn, key: raw)
    pids = importer._load_sources(conn=None)
    assert pids == ["ABC123", "DEF456"]


# ----- import_all DB 통합 -----


# 합성 이름 — 실제 차트/seed/타 테스트 잔여물과 Artist/Track dedup 충돌 회피.
PID = "PLYTTEST00000000000000000000000000"
SAMPLE_PL = {
    "title": "YT TEST Top 100",
    "tracks": [
        _track("YT TEST AAA", "YT Test Artist 1", video_id=None, thumb="https://img/1.jpg"),
        _track("YT TEST BBB", "YT Test Artist 2", video_id=None, thumb="https://img/2.jpg"),
    ],
}


async def test_import_all_saves_section_and_tracks(db_conn, cleanup):
    """patch _fetch_playlist → EMPSection 1개 + chart 아이템 + 트랙 EMPSource(chart:{pid})."""
    tid1 = f"yt_{stable_id('YT TEST AAA|YT Test Artist 1')[:16]}"
    tid2 = f"yt_{stable_id('YT TEST BBB|YT Test Artist 2')[:16]}"
    source_id = f"chart:{PID}"

    # cleanup은 역순 실행 — 부모(Artist/Track) 먼저 등록.
    cleanup(
        'DELETE FROM "Artist" WHERE name IN (%s, %s)',
        ("YT Test Artist 1", "YT Test Artist 2"),
    )
    cleanup(
        'DELETE FROM "Track" WHERE isrc IN (%s, %s)',
        (f"emp_youtube_{tid1}", f"emp_youtube_{tid2}"),
    )
    cleanup(
        'DELETE FROM "TrackPlatform" WHERE "platformTrackId" IN (%s, %s)',
        (tid1, tid2),
    )
    cleanup('DELETE FROM "EMPSource" WHERE source_id = %s', (source_id,))
    cleanup(
        'DELETE FROM "EMPSection" WHERE platform = %s AND "sectionKey" = %s',
        ("youtube", f"playlist:{PID}"),
    )  # EMPSectionItem은 ON DELETE CASCADE

    importer = YoutubeEMPImporter()
    with patch.object(
        YoutubeEMPImporter,
        "_load_sources",
        return_value=[PID],
    ), patch.object(
        YoutubeEMPImporter,
        "_fetch_playlist",
        AsyncMock(return_value=SAMPLE_PL),
    ):
        summary = await importer.import_all(db_conn)

    assert summary["errors"] == []
    assert summary["playlists_processed"] == 1
    assert summary["tracks_new"] + summary["tracks_existing"] == 2

    with db_conn.cursor() as cur:
        cur.execute(
            'SELECT id, "displayTitle" FROM "EMPSection" '
            'WHERE platform = %s AND "sectionKey" = %s',
            ("youtube", f"playlist:{PID}"),
        )
        sec = cur.fetchone()
        assert sec is not None
        assert sec[1] == "YT TEST Top 100"

        # 차트 단일 컨테이너 아이템 1개, 대표 커버 = 첫 트랙 커버
        cur.execute(
            'SELECT "itemType", "itemId", "coverUrl" FROM "EMPSectionItem" '
            'WHERE "sectionId" = %s',
            (sec[0],),
        )
        items = cur.fetchall()
        assert len(items) == 1
        assert items[0][0] == "chart"
        assert items[0][1] == PID
        assert items[0][2] == "https://img/1.jpg"

        # 트랙 EMPSource — source_id chart:{pid}, 2곡
        cur.execute(
            'SELECT COUNT(*) FROM "EMPSource" '
            "WHERE platform = %s AND source_type = %s AND source_id = %s",
            ("youtube", "chart", source_id),
        )
        assert cur.fetchone()[0] == 2

        # 합성 platform_track_id 매핑 확인 (videoId None → 합성)
        cur.execute(
            'SELECT COUNT(*) FROM "TrackPlatform" '
            'WHERE platform = %s AND "platformTrackId" IN (%s, %s)',
            ("youtube", tid1, tid2),
        )
        assert cur.fetchone()[0] == 2


# ----- 인증 (Setting 'youtube_auth_json') -----


def _auth_setting(value):
    """auth 키만 응답하는 get_setting 대역 — sources는 None (기본값 경로)."""
    return lambda conn, key: value if key == AUTH_SETTING_KEY else None


async def test_import_all_uses_auth_when_setting_present(monkeypatch):
    """Setting에 browser auth JSON 있으면 YTMusic이 auth dict로 생성됨."""
    auth = {"Cookie": "fake-cookie", "User-Agent": "ua"}
    monkeypatch.setattr(
        "mrms.emp.youtube.get_setting", _auth_setting(json.dumps(auth))
    )
    importer = YoutubeEMPImporter()
    with patch("ytmusicapi.YTMusic") as yt_cls, patch.object(
        YoutubeEMPImporter, "_load_sources", return_value=["PID_AUTH"]
    ):
        # 0 tracks → DB 미접근 (conn은 get_setting 대역만 통과)
        yt_cls.return_value.get_playlist.return_value = {"title": "X", "tracks": []}
        summary = await importer.import_all(None)

    yt_cls.assert_called_once_with(auth)
    # 0 tracks는 에러로 집계되지만 auth 관련 에러는 없어야 함
    assert summary["errors"] == ["playlist PID_AUTH: 0 tracks parsed"]


async def test_import_all_invalid_auth_falls_back_unauthenticated(monkeypatch):
    """auth JSON 파싱 실패 → 무인증 폴백, errors에 안 들어감 (차트는 무인증 동작)."""
    monkeypatch.setattr("mrms.emp.youtube.get_setting", _auth_setting("not json {"))
    importer = YoutubeEMPImporter()
    with patch("ytmusicapi.YTMusic") as yt_cls, patch.object(
        YoutubeEMPImporter, "_load_sources", return_value=["PID_NOAUTH"]
    ):
        yt_cls.return_value.get_playlist.return_value = {"title": "X", "tracks": []}
        summary = await importer.import_all(None)

    yt_cls.assert_called_once_with()  # 무인증 생성
    assert summary["errors"] == ["playlist PID_NOAUTH: 0 tracks parsed"]


# ----- synthetic→real 마이그레이션 -----


PID_MIG = "PLYTTEST11111111111111111111111111"


async def test_import_all_migrates_synthetic_to_real(db_conn, cleanup):
    """합성 매핑 상태에서 같은 title|artist + real videoId 입력 →
    같은 Track 재사용 + TrackPlatform real 갱신 + 중복 Track 미생성."""
    title, artist = "YT TEST MIG", "YT Test Artist M"
    synthetic = f"yt_{stable_id(f'{title}|{artist}')[:16]}"
    video_id = "ytTESTvid01"
    source_id = f"chart:{PID_MIG}"

    # cleanup은 역순 실행 — 부모(Artist/Track) 먼저 등록.
    cleanup('DELETE FROM "Artist" WHERE name = %s', (artist,))
    cleanup(
        'DELETE FROM "Track" WHERE isrc IN (%s, %s)',
        (f"emp_youtube_{synthetic}", f"emp_youtube_{video_id}"),
    )
    cleanup(
        'DELETE FROM "TrackPlatform" WHERE "platformTrackId" IN (%s, %s)',
        (synthetic, video_id),
    )
    cleanup('DELETE FROM "EMPSource" WHERE source_id = %s', (source_id,))
    cleanup(
        'DELETE FROM "EMPSection" WHERE platform = %s AND "sectionKey" = %s',
        ("youtube", f"playlist:{PID_MIG}"),
    )

    pl_synth = {"title": "YT TEST MIG Chart", "tracks": [_track(title, artist, video_id=None)]}
    pl_real = {"title": "YT TEST MIG Chart", "tracks": [_track(title, artist, video_id=video_id)]}

    with patch.object(YoutubeEMPImporter, "_load_sources", return_value=[PID_MIG]):
        # 1차: 무인증 시절 — videoId None → 합성 매핑 적재
        with patch.object(
            YoutubeEMPImporter, "_fetch_playlist", AsyncMock(return_value=pl_synth)
        ):
            s1 = await YoutubeEMPImporter().import_all(db_conn)
        assert s1["errors"] == []

        with db_conn.cursor() as cur:
            cur.execute(
                'SELECT "trackId" FROM "TrackPlatform" '
                'WHERE platform = %s AND "platformTrackId" = %s',
                ("youtube", synthetic),
            )
            row = cur.fetchone()
            assert row is not None
            orig_track_id = row[0]

        # 2차: 인증 시절 — 같은 곡이 real videoId와 함께 옴
        with patch.object(
            YoutubeEMPImporter, "_fetch_playlist", AsyncMock(return_value=pl_real)
        ):
            s2 = await YoutubeEMPImporter().import_all(db_conn)
        assert s2["errors"] == []
        assert s2["tracks_new"] == 0  # 같은 Track 재사용 — 신규 생성 없음

    with db_conn.cursor() as cur:
        # 합성 행은 사라지고 real 행으로 갱신 (id도 재계산, 같은 Track 유지)
        cur.execute(
            'SELECT id, "trackId", "platformTrackId" FROM "TrackPlatform" '
            'WHERE platform = %s AND "platformTrackId" IN (%s, %s)',
            ("youtube", synthetic, video_id),
        )
        rows = cur.fetchall()
        assert rows == [(stable_id(f"tp|youtube|{video_id}"), orig_track_id, video_id)]

        # 중복 Track 미생성
        cur.execute('SELECT COUNT(*) FROM "Track" WHERE title = %s', (title,))
        assert cur.fetchone()[0] == 1


def _seed_track(db_conn, cleanup, key: str) -> str:
    """Artist + Track 시드 (raw SQL) — track_id 반환. cleanup 자동 등록."""
    artist = f"YT Mig Artist {key}"
    artist_id = stable_id(f"artist|{artist.lower()}")
    isrc = f"emp_ytmig_{key}"
    track_id = stable_id(f"track|{isrc}")
    # 역순 실행: TrackPlatform → Track → Artist (FK 순서)
    cleanup('DELETE FROM "Artist" WHERE id = %s', (artist_id,))
    cleanup('DELETE FROM "Track" WHERE id = %s', (track_id,))
    cleanup('DELETE FROM "TrackPlatform" WHERE "trackId" = %s', (track_id,))
    with db_conn.cursor() as cur:
        cur.execute(
            '''INSERT INTO "Artist" (id, name, "nameNormalized")
               VALUES (%s, %s, %s) ON CONFLICT (id) DO NOTHING''',
            (artist_id, artist, artist.lower()),
        )
        cur.execute(
            '''INSERT INTO "Track"
                 (id, isrc, title, "titleNormalized", "durationMs", "artistId")
               VALUES (%s, %s, %s, %s, 0, %s) ON CONFLICT (id) DO NOTHING''',
            (track_id, isrc, f"YT Mig Song {key}", f"yt mig song {key}", artist_id),
        )
    db_conn.commit()
    return track_id


def test_migrate_deletes_synthetic_when_real_exists(db_conn, cleanup):
    """real 매핑이 다른 Track에 이미 있으면 합성 행은 DELETE (UPDATE 시
    ("trackId", platform) unique와 무관하게 잔여 합성 행 제거)."""
    title, artist = "YT Mig Dup", "YT Mig Artist Dup"
    synthetic = f"yt_{stable_id(f'{title}|{artist}')[:16]}"
    video_id = "ytTESTvid02"

    t_synth = _seed_track(db_conn, cleanup, "dupsynth")
    t_real = _seed_track(db_conn, cleanup, "dupreal")
    with db_conn.cursor() as cur:
        cur.execute(
            '''INSERT INTO "TrackPlatform" (id, "trackId", platform, "platformTrackId")
               VALUES (%s, %s, 'youtube', %s), (%s, %s, 'youtube', %s)''',
            (
                stable_id(f"tp|youtube|{synthetic}|{t_synth}"), t_synth, synthetic,
                stable_id(f"tp|youtube|{video_id}|{t_real}"), t_real, video_id,
            ),
        )
    db_conn.commit()

    _migrate_synthetic_mapping(db_conn, title, artist, video_id)

    with db_conn.cursor() as cur:
        cur.execute(
            'SELECT "trackId", "platformTrackId" FROM "TrackPlatform" '
            'WHERE platform = %s AND "platformTrackId" IN (%s, %s)',
            ("youtube", synthetic, video_id),
        )
        rows = cur.fetchall()
    # 합성 행은 삭제, real 행은 원래 Track 그대로
    assert rows == [(t_real, video_id)]
