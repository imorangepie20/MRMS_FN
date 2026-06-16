"""아티스트 곡 조회 — ModalTrack shape + 커버/플랫폼."""
import uuid as _uuid

from mrms.db.artist import artist_tracks_by_name
from mrms.db.user_track import get_or_create_user
from mrms.emp.base import upsert_track_and_emp_source


def test_artist_tracks_by_name_shape(db_conn, cleanup):
    artist = f"Cov Artist {_uuid.uuid4().hex[:6]}"
    r = upsert_track_and_emp_source(
        db_conn, isrc=None, title="A Song", artist=artist,
        album_title="Alb", duration_ms=180000, platform="youtube",
        platform_track_id="YTART1", source_type="station",
        source_id="station:art", source_name="S",
        cover_url="https://c/x.jpg",
    )
    tid = r["track_id"]
    db_conn.commit()
    # cleanup은 등록 역순으로 실행 → 자식(EMPSource/TrackPlatform/Track/Album)을
    # 먼저 지우고 부모(Artist)를 마지막에 지우도록 Artist를 가장 먼저 등록.
    # album_title="Alb"가 Album(→Artist FK)을 생성하므로 Album cleanup도 등록.
    cleanup('DELETE FROM "Artist" WHERE "nameNormalized" = %s', (artist.lower().strip(),))
    cleanup(
        'DELETE FROM "Album" WHERE "artistId" IN '
        '(SELECT id FROM "Artist" WHERE "nameNormalized" = %s)',
        (artist.lower().strip(),),
    )
    cleanup('DELETE FROM "Track" WHERE id = %s', (tid,))
    cleanup('DELETE FROM "TrackPlatform" WHERE "trackId" = %s', (tid,))
    cleanup('DELETE FROM "EMPSource" WHERE source_id = %s', ("station:art",))

    out = artist_tracks_by_name(db_conn, artist.lower().strip())
    rows = [t for t in out if t["track_id"] == tid]
    assert len(rows) == 1
    t = rows[0]
    assert t["artist"] == artist and t["title"] == "A Song"
    assert t["youtube_track_id"] == "YTART1"
    assert t["album_cover"] == "https://c/x.jpg"
    # ModalTrack 필수 키
    for k in ("tidal_track_id", "spotify_track_id", "duration_ms"):
        assert k in t


def test_artist_tracks_liked_pct_when_user(db_conn, cleanup):
    artist = f"Liked Artist {_uuid.uuid4().hex[:6]}"
    uid = get_or_create_user(db_conn, f"al-{_uuid.uuid4().hex[:8]}@t.com")
    r = upsert_track_and_emp_source(
        db_conn, isrc=None, title="Liked Song", artist=artist,
        album_title=None, duration_ms=1, platform="youtube",
        platform_track_id="YTLIKED", source_type="station",
        source_id="station:liked", source_name="S",
    )
    tid = r["track_id"]
    with db_conn.cursor() as cur:
        cur.execute(
            'INSERT INTO "UserTrack" (id,"userId","trackId","isCore",source,platform) '
            'VALUES (%s,%s,%s,TRUE,%s,%s) ON CONFLICT DO NOTHING',
            ("ut_" + _uuid.uuid4().hex[:12], uid, tid, "liked", "youtube"),
        )
    db_conn.commit()
    # cleanup은 등록 역순 실행 → 부모(Artist/User)를 먼저 등록해 마지막에 삭제.
    # album_title=None이라 Album은 생성되지 않음. User는 UserTrack 삭제 후 지워야 하므로
    # UserTrack보다 먼저 등록(역순 실행 시 나중에 삭제)해 매 실행마다 고아 User가 안 남게.
    cleanup('DELETE FROM "Artist" WHERE "nameNormalized" = %s', (artist.lower().strip(),))
    cleanup('DELETE FROM "User" WHERE id = %s', (uid,))
    cleanup('DELETE FROM "Track" WHERE id = %s', (tid,))
    cleanup('DELETE FROM "UserTrack" WHERE "userId" = %s', (uid,))
    cleanup('DELETE FROM "TrackPlatform" WHERE "trackId" = %s', (tid,))
    cleanup('DELETE FROM "EMPSource" WHERE source_id = %s', ("station:liked",))

    out = artist_tracks_by_name(db_conn, artist.lower().strip(), user_id=uid)
    t = next(x for x in out if x["track_id"] == tid)
    assert t["liked"] is True and t["pct"] is True
