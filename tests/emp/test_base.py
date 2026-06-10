"""EMPImporter base — Track + EMPSource upsert 로직."""
import pytest

from mrms.emp.base import upsert_track_and_emp_source


def test_upsert_existing_track_by_isrc_adds_only_emp_source(db_conn):
    """ISRC로 기존 Track 발견 → Track 신규 안 만들고 EMPSource만."""
    with db_conn.cursor() as cur:
        cur.execute('SELECT id, isrc FROM "Track" WHERE isrc IS NOT NULL LIMIT 1')
        row = cur.fetchone()
    if not row:
        pytest.skip("Track with ISRC 부족")
    existing_id, existing_isrc = row

    result = upsert_track_and_emp_source(
        db_conn,
        isrc=existing_isrc,
        title="ignored",
        artist="ignored",
        album_title=None,
        duration_ms=None,
        platform="tidal",
        platform_track_id="tidal_xxx_test_existing",
        source_type="editorial_playlist",
        source_id="pl_test",
        source_name="Test Playlist",
    )
    assert result["track_id"] == existing_id
    assert result["new"] is False

    with db_conn.cursor() as cur:
        cur.execute(
            '''SELECT COUNT(*) FROM "EMPSource"
               WHERE "trackId" = %s AND platform = 'tidal' AND source_id = 'pl_test' ''',
            (existing_id,),
        )
        assert cur.fetchone()[0] == 1

    # cleanup
    with db_conn.cursor() as cur:
        cur.execute(
            '''DELETE FROM "EMPSource" WHERE "trackId" = %s AND source_id = 'pl_test' ''',
            (existing_id,),
        )
        cur.execute(
            '''DELETE FROM "TrackPlatform"
               WHERE "trackId" = %s AND "platformTrackId" = 'tidal_xxx_test_existing' ''',
            (existing_id,),
        )
    db_conn.commit()


def test_upsert_new_isrc_creates_track_and_emp_source(db_conn):
    """ISRC가 새로우면 Track + Artist + TrackPlatform + EMPSource 모두 생성."""
    fake_isrc = "TEST99999999"  # 충돌 가능성 거의 없음
    result = upsert_track_and_emp_source(
        db_conn,
        isrc=fake_isrc,
        title="Test Title Z",
        artist="Test Artist Z",
        album_title="Test Album Z",
        duration_ms=180000,
        platform="spotify",
        platform_track_id="spotify_xxx_test_new",
        source_type="editorial_playlist",
        source_id="pl_test2",
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

    # cleanup — Track CASCADE deletes EMPSource + TrackPlatform
    with db_conn.cursor() as cur:
        cur.execute('DELETE FROM "Track" WHERE id = %s', (result["track_id"],))
        if album_id:
            cur.execute('DELETE FROM "Album" WHERE id = %s', (album_id,))
        if artist_id:
            cur.execute('DELETE FROM "Artist" WHERE id = %s', (artist_id,))
    db_conn.commit()


async def test_import_all_dispatches_per_track(db_conn):
    """EMPImporter.import_all() should iterate playlists and call upsert per track."""
    from mrms.emp.base import EMPImporter

    class Fake(EMPImporter):
        platform = "tidal"

        async def fetch_editorial_playlists(self):
            return [{"id": "pl_a", "name": "A", "source_type": "editorial_playlist"}]

        async def fetch_playlist_tracks(self, playlist_id):
            assert playlist_id == "pl_a"
            return [
                {
                    "platform_track_id": "tt_xxx_imp_1",
                    "title": "T1",
                    "isrc": None,
                    "artist": "A1",
                    "album_title": None,
                    "duration_ms": 100000,
                },
            ]

    importer = Fake()
    summary = await importer.import_all(db_conn)
    assert summary["tracks_new"] + summary["tracks_existing"] >= 1
    assert summary["playlists_processed"] == 1
    assert summary["errors"] == []

    # cleanup new rows — Track CASCADE deletes EMPSource + TrackPlatform
    with db_conn.cursor() as cur:
        # look up artist_id before deleting track
        cur.execute(
            '''SELECT t."artistId" FROM "Track" t
               WHERE t.isrc = 'emp_tidal_tt_xxx_imp_1' ''',
        )
        row = cur.fetchone()
        artist_id = row[0] if row else None

        cur.execute(
            '''DELETE FROM "Track" WHERE isrc = 'emp_tidal_tt_xxx_imp_1' '''
        )
        if artist_id:
            cur.execute('DELETE FROM "Artist" WHERE id = %s', (artist_id,))
    db_conn.commit()
