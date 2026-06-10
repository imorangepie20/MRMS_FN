"""EMPImporter base — Track + EMPSource upsert 로직."""
import uuid

import pytest

from mrms.emp.base import upsert_track_and_emp_source


def test_upsert_existing_track_by_isrc_adds_only_emp_source(db_conn, cleanup):
    """ISRC로 기존 Track 발견 → Track 신규 안 만들고 EMPSource만."""
    with db_conn.cursor() as cur:
        cur.execute('SELECT id, isrc FROM "Track" WHERE isrc IS NOT NULL LIMIT 1')
        row = cur.fetchone()
    if not row:
        pytest.skip("Track with ISRC 부족")
    existing_id, existing_isrc = row

    sfx = uuid.uuid4().hex[:8]
    source_id = f"pl_test_{sfx}"
    platform_track_id = f"tidal_xxx_test_existing_{sfx}"
    # 헬퍼가 내부 commit하므로 assert 실패에도 안전하게 cleanup 등록
    cleanup(
        'DELETE FROM "EMPSource" WHERE "trackId" = %s AND source_id = %s',
        (existing_id, source_id),
    )
    cleanup(
        'DELETE FROM "TrackPlatform" WHERE "trackId" = %s AND "platformTrackId" = %s',
        (existing_id, platform_track_id),
    )

    result = upsert_track_and_emp_source(
        db_conn,
        isrc=existing_isrc,
        title="ignored",
        artist="ignored",
        album_title=None,
        duration_ms=None,
        platform="tidal",
        platform_track_id=platform_track_id,
        source_type="editorial_playlist",
        source_id=source_id,
        source_name="Test Playlist",
    )
    assert result["track_id"] == existing_id
    assert result["new"] is False

    with db_conn.cursor() as cur:
        cur.execute(
            '''SELECT COUNT(*) FROM "EMPSource"
               WHERE "trackId" = %s AND platform = 'tidal' AND source_id = %s''',
            (existing_id, source_id),
        )
        assert cur.fetchone()[0] == 1


def test_upsert_new_isrc_creates_track_and_emp_source(db_conn, cleanup):
    """ISRC가 새로우면 Track + Artist + TrackPlatform + EMPSource 모두 생성."""
    sfx = uuid.uuid4().hex[:8].upper()
    fake_isrc = f"TEST{sfx}"  # per-test 고유 — 잔여 데이터/병렬 충돌 방지
    artist_name = f"Test Artist Z {sfx}"
    album_title = f"Test Album Z {sfx}"
    # Track CASCADE가 EMPSource + TrackPlatform 삭제; Album → Artist 순서로 정리
    cleanup('DELETE FROM "Artist" WHERE name = %s', (artist_name,))
    cleanup('DELETE FROM "Album" WHERE title = %s', (album_title,))
    cleanup('DELETE FROM "Track" WHERE isrc = %s', (fake_isrc,))

    result = upsert_track_and_emp_source(
        db_conn,
        isrc=fake_isrc,
        title="Test Title Z",
        artist=artist_name,
        album_title=album_title,
        duration_ms=180000,
        platform="spotify",
        platform_track_id=f"spotify_xxx_test_new_{sfx}",
        source_type="editorial_playlist",
        source_id=f"pl_test2_{sfx}",
        source_name="Test Featured",
    )
    assert result["new"] is True
    assert result["track_id"]

    with db_conn.cursor() as cur:
        cur.execute(
            'SELECT title, "inEmp", "albumId", "artistId" FROM "Track" WHERE id = %s',
            (result["track_id"],),
        )
        title, in_emp, album_id, artist_id = cur.fetchone()
        assert title == "Test Title Z"
        assert in_emp is True

        cur.execute(
            '''SELECT platform FROM "TrackPlatform" WHERE "trackId" = %s''',
            (result["track_id"],),
        )
        platforms = [r[0] for r in cur.fetchall()]
        assert "spotify" in platforms


async def test_import_all_dispatches_per_track(db_conn, cleanup):
    """PlaylistEMPImporter.import_all() should iterate playlists and call upsert per track."""
    from mrms.emp.base import PlaylistEMPImporter

    sfx = uuid.uuid4().hex[:8]
    platform_track_id = f"tt_xxx_imp_1_{sfx}"
    artist_name = f"A1 {sfx}"
    # isrc 없는 트랙 → 'emp_{platform}_{platform_track_id}'로 생성됨
    cleanup('DELETE FROM "Artist" WHERE name = %s', (artist_name,))
    cleanup(
        'DELETE FROM "Track" WHERE isrc = %s',
        (f"emp_tidal_{platform_track_id}",),
    )

    class Fake(PlaylistEMPImporter):
        platform = "tidal"

        async def fetch_editorial_playlists(self):
            return [{"id": "pl_a", "name": "A", "source_type": "editorial_playlist"}]

        async def fetch_playlist_tracks(self, playlist_id):
            assert playlist_id == "pl_a"
            return [
                {
                    "platform_track_id": platform_track_id,
                    "title": "T1",
                    "isrc": None,
                    "artist": artist_name,
                    "album_title": None,
                    "duration_ms": 100000,
                },
            ]

    importer = Fake()
    summary = await importer.import_all(db_conn)
    assert summary["tracks_new"] + summary["tracks_existing"] >= 1
    assert summary["playlists_processed"] == 1
    assert summary["errors"] == []


def test_upsert_same_platform_id_with_and_without_isrc_reuses_track(db_conn, cleanup):
    """같은 플랫폼 트랙이 ISRC 있는 응답(playlist)과 없는 응답(mix)으로
    두 번 와도 내부 Track은 1개 — UniqueViolation 재발 방지."""
    import uuid

    suffix = uuid.uuid4().hex[:8]
    isrc = f"TST{suffix[:9].upper()}"
    ptid = f"tidal_dup_{suffix}"

    cleanup('DELETE FROM "EMPSource" WHERE source_id IN (%s, %s)',
            (f"pl_dup_{suffix}", f"mix_dup_{suffix}"))
    cleanup('DELETE FROM "TrackPlatform" WHERE "platformTrackId" = %s', (ptid,))
    cleanup('DELETE FROM "Track" WHERE isrc IN (%s, %s)',
            (isrc, f"emp_tidal_{ptid}"))

    # 1차: playlist 경로 (ISRC 있음)
    r1 = upsert_track_and_emp_source(
        db_conn, isrc=isrc, title=f"Dup Song {suffix}", artist=f"Dup Artist {suffix}",
        album_title=None, duration_ms=1000,
        platform="tidal", platform_track_id=ptid,
        source_type="editorial_playlist", source_id=f"pl_dup_{suffix}", source_name="PL",
    )
    assert r1["new"] is True

    # 2차: mix 경로 (ISRC 없음 — 합성 키로 빠질 뻔한 경우)
    r2 = upsert_track_and_emp_source(
        db_conn, isrc=None, title=f"Dup Song {suffix}", artist=f"Dup Artist {suffix}",
        album_title=None, duration_ms=1000,
        platform="tidal", platform_track_id=ptid,
        source_type="editorial_mix", source_id=f"mix_dup_{suffix}", source_name="MIX",
    )
    assert r2["new"] is False
    assert r2["track_id"] == r1["track_id"]  # 같은 트랙 재사용

    with db_conn.cursor() as cur:
        cur.execute(
            'SELECT COUNT(*) FROM "TrackPlatform" WHERE "platformTrackId" = %s',
            (ptid,),
        )
        assert cur.fetchone()[0] == 1  # TrackPlatform도 1개
        cur.execute(
            'SELECT COUNT(*) FROM "EMPSource" WHERE "trackId" = %s',
            (r1["track_id"],),
        )
        assert cur.fetchone()[0] == 2  # 출처는 2개 (playlist + mix)
