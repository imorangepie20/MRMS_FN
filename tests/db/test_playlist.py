"""Playlist DB helpers."""
import uuid as _uuid

import psycopg
import pytest

from mrms.db.playlist import (
    add_tracks_to_playlist,
    create_imported_playlist,
    create_playlist,
    delete_playlist,
    get_playlist,
    get_playlist_by_share_id,
    get_playlist_tracks,
    list_user_playlists,
    remove_track_from_playlist,
    reorder_playlist_tracks,
    set_playlist_share,
    update_playlist_meta,
)
from mrms.db.user_track import get_or_create_user, upsert_user_track


def test_create_playlist_inserts_rows(db_conn: psycopg.Connection):
    """create_playlist는 Playlist + PlaylistTrack 행 생성."""
    user_id = get_or_create_user(db_conn, "playlist@test.com")
    db_conn.commit()

    with db_conn.cursor() as cur:
        cur.execute('SELECT id FROM "Track" LIMIT 3')
        track_ids = [r[0] for r in cur.fetchall()]
    if len(track_ids) < 3:
        pytest.skip("Track 데이터 부족")

    pid = create_playlist(
        db_conn,
        user_id=user_id,
        name="Test PL",
        description="desc",
        track_ids=track_ids,
    )
    assert pid

    with db_conn.cursor() as cur:
        cur.execute('SELECT name, description FROM "Playlist" WHERE id = %s', (pid,))
        row = cur.fetchone()
    assert row == ("Test PL", "desc")

    tracks = get_playlist_tracks(db_conn, pid)
    assert [t["track_id"] for t in tracks] == track_ids
    # 각 track row가 album_cover 키를 가져야 함 (값은 None 허용)
    for t in tracks:
        assert "album_cover" in t


def test_list_user_playlists(db_conn: psycopg.Connection):
    user_id = get_or_create_user(db_conn, "list@test.com")
    db_conn.commit()

    with db_conn.cursor() as cur:
        cur.execute('SELECT id FROM "Track" LIMIT 1')
        track_ids = [r[0] for r in cur.fetchall()]
    if not track_ids:
        pytest.skip("Track 데이터 부족")

    create_playlist(db_conn, user_id=user_id, name="A", description=None, track_ids=track_ids)
    create_playlist(db_conn, user_id=user_id, name="B", description=None, track_ids=track_ids)

    playlists = list_user_playlists(db_conn, user_id)
    names = {p["name"] for p in playlists}
    assert {"A", "B"}.issubset(names)


def test_get_playlist_returns_meta(db_conn: psycopg.Connection):
    user_id = get_or_create_user(db_conn, "meta@test.com")
    db_conn.commit()

    with db_conn.cursor() as cur:
        cur.execute('SELECT id FROM "Track" LIMIT 1')
        track_ids = [r[0] for r in cur.fetchall()]
    if not track_ids:
        pytest.skip("Track 데이터 부족")

    pid = create_playlist(db_conn, user_id=user_id, name="M", description="d", track_ids=track_ids)
    pl = get_playlist(db_conn, pid)
    assert pl["id"] == pid
    assert pl["name"] == "M"
    assert pl["user_id"] == user_id


def test_set_playlist_share_creates_and_clears_token(db_conn: psycopg.Connection):
    """on=True → 토큰 생성(재호출 시 유지), on=False → None. get_playlist에 반영."""
    user_id = get_or_create_user(db_conn, "share-db@test.com")
    db_conn.commit()
    with db_conn.cursor() as cur:
        cur.execute('SELECT id FROM "Track" LIMIT 1')
        track_ids = [r[0] for r in cur.fetchall()]
    if not track_ids:
        pytest.skip("Track 데이터 부족")

    pid = create_playlist(
        db_conn, user_id=user_id, name="ShareDB", description=None, track_ids=track_ids
    )

    token = set_playlist_share(db_conn, pid, True)
    assert token
    # idempotent — 재호출 시 기존 토큰 유지
    assert set_playlist_share(db_conn, pid, True) == token
    # get_playlist에 share_id 반영
    assert get_playlist(db_conn, pid)["share_id"] == token
    # 해제 → None
    assert set_playlist_share(db_conn, pid, False) is None
    assert get_playlist(db_conn, pid)["share_id"] is None


def test_get_playlist_by_share_id(db_conn: psycopg.Connection):
    """공유 토큰으로 메타(+owner_name) 조회. 없는 토큰은 None."""
    user_id = get_or_create_user(db_conn, "share-lookup@test.com")
    db_conn.commit()
    with db_conn.cursor() as cur:
        cur.execute('SELECT id FROM "Track" LIMIT 1')
        track_ids = [r[0] for r in cur.fetchall()]
    if not track_ids:
        pytest.skip("Track 데이터 부족")

    pid = create_playlist(
        db_conn, user_id=user_id, name="Lookup", description="d", track_ids=track_ids
    )
    token = set_playlist_share(db_conn, pid, True)

    found = get_playlist_by_share_id(db_conn, token)
    assert found["id"] == pid
    assert found["name"] == "Lookup"
    assert "owner_name" in found  # displayName 미설정이면 None 허용
    assert get_playlist_by_share_id(db_conn, "nonexistent-token") is None


def test_create_imported_playlist_idempotent(db_conn: psycopg.Connection, cleanup):
    """sourceRef로 멱등 — 같은 source 재호출 시 None(중복 생성 X). 순서·sourceRef 보존."""
    user_id = get_or_create_user(db_conn, f"plimp-{_uuid.uuid4().hex[:8]}@test.com")
    db_conn.commit()
    track_ids = _track_ids(db_conn, 3)
    if len(track_ids) < 3:
        pytest.skip("Track 데이터 부족")

    pid = create_imported_playlist(db_conn, user_id, "youtube:PL123", "My Mix", track_ids)
    cleanup('DELETE FROM "Playlist" WHERE id = %s', (pid,))
    cleanup('DELETE FROM "PlaylistTrack" WHERE "playlistId" = %s', (pid,))
    assert pid
    # 멱등 — 같은 sourceRef 두 번째 호출은 None
    assert create_imported_playlist(db_conn, user_id, "youtube:PL123", "My Mix", track_ids) is None

    # 순서 보존
    tracks = get_playlist_tracks(db_conn, pid)
    assert [t["track_id"] for t in tracks] == track_ids
    # sourceRef 저장
    with db_conn.cursor() as cur:
        cur.execute('SELECT "sourceRef" FROM "Playlist" WHERE id=%s', (pid,))
        assert cur.fetchone()[0] == "youtube:PL123"


def test_create_playlist_marks_tracks_curated(db_conn: psycopg.Connection, cleanup):
    """담은 곡을 UserTrack(source='curated')로 편입 → MRT 제외(ADR-002 '이동=UserTrack')."""
    user_id = get_or_create_user(db_conn, f"plcur-{_uuid.uuid4().hex[:8]}@test.com")
    db_conn.commit()
    cleanup('DELETE FROM "UserTrack" WHERE "userId" = %s', (user_id,))
    with db_conn.cursor() as cur:
        cur.execute('SELECT id FROM "Track" LIMIT 2')
        track_ids = [r[0] for r in cur.fetchall()]
    if not track_ids:
        pytest.skip("Track 데이터 부족")

    pid = create_playlist(
        db_conn, user_id=user_id, name="Cur PL", description=None, track_ids=track_ids
    )
    cleanup('DELETE FROM "Playlist" WHERE id = %s', (pid,))
    cleanup('DELETE FROM "PlaylistTrack" WHERE "playlistId" = %s', (pid,))

    with db_conn.cursor() as cur:
        cur.execute(
            'SELECT "trackId", source FROM "UserTrack" WHERE "userId"=%s AND "trackId"=ANY(%s)',
            (user_id, track_ids),
        )
        rows = {r[0]: r[1] for r in cur.fetchall()}
    assert set(rows) == set(track_ids)  # 담은 곡 전부 UserTrack 편입
    # source='curated' — PGT imported('playlist%') 미충돌
    assert all(s == "curated" for s in rows.values())


def test_create_playlist_keeps_liked_source(db_conn: psycopg.Connection, cleanup):
    """이미 liked인 곡을 플레이리스트에 담아도 source는 'liked' 유지(강등 안 함)."""
    user_id = get_or_create_user(db_conn, f"pllik-{_uuid.uuid4().hex[:8]}@test.com")
    db_conn.commit()
    cleanup('DELETE FROM "UserTrack" WHERE "userId" = %s', (user_id,))
    with db_conn.cursor() as cur:
        cur.execute('SELECT id FROM "Track" LIMIT 1')
        track_ids = [r[0] for r in cur.fetchall()]
    if not track_ids:
        pytest.skip("Track 데이터 부족")
    tid = track_ids[0]
    upsert_user_track(db_conn, user_id, tid, is_core=False, source="liked", platform="mrms")
    db_conn.commit()

    pid = create_playlist(
        db_conn, user_id=user_id, name="Liked PL", description=None, track_ids=[tid]
    )
    cleanup('DELETE FROM "Playlist" WHERE id = %s', (pid,))
    cleanup('DELETE FROM "PlaylistTrack" WHERE "playlistId" = %s', (pid,))

    with db_conn.cursor() as cur:
        cur.execute(
            'SELECT source FROM "UserTrack" WHERE "userId"=%s AND "trackId"=%s', (user_id, tid)
        )
        assert cur.fetchone()[0] == "liked"


def test_get_playlist_tracks_includes_album_cover(db_conn, cleanup):
    """get_playlist_tracks가 EMPSource.cover_url을 album_cover로 채운다(공유 페이지/OG용)."""
    from mrms.emp.base import upsert_track_and_emp_source

    user_id = get_or_create_user(db_conn, f"plcov-{_uuid.uuid4().hex[:8]}@test.com")
    r = upsert_track_and_emp_source(
        db_conn, isrc=None, title="Cov Song", artist="Cov Artist",
        album_title="Cov Album", duration_ms=180000, platform="youtube",
        platform_track_id="YTPLCOV", source_type="station",
        source_id="station:plcov", source_name="Station",
        cover_url="https://example.com/plcov600.jpg",
    )
    tid = r["track_id"]
    db_conn.commit()
    cleanup('DELETE FROM "EMPSource" WHERE source_id = %s', ("station:plcov",))
    cleanup('DELETE FROM "TrackPlatform" WHERE "trackId" = %s', (tid,))
    cleanup('DELETE FROM "Track" WHERE id = %s', (tid,))
    cleanup('DELETE FROM "UserTrack" WHERE "userId" = %s', (user_id,))

    pid = create_playlist(
        db_conn, user_id=user_id, name="Cov PL", description=None, track_ids=[tid]
    )
    cleanup('DELETE FROM "Playlist" WHERE id = %s', (pid,))
    cleanup('DELETE FROM "PlaylistTrack" WHERE "playlistId" = %s', (pid,))

    tracks = get_playlist_tracks(db_conn, pid)
    assert len(tracks) == 1
    assert tracks[0]["album_cover"] == "https://example.com/plcov600.jpg"


# ── 플레이리스트 관리(DnD) 신규 ops ───────────────────────────────
def _track_ids(db_conn, n):
    with db_conn.cursor() as cur:
        cur.execute('SELECT id FROM "Track" LIMIT %s', (n,))
        return [r[0] for r in cur.fetchall()]


def _seed_user_pl(db_conn, cleanup, name="PL", n=2):
    import uuid as _u
    uid = get_or_create_user(db_conn, f"plops-{_u.uuid4().hex[:8]}@t.com")
    tids = _track_ids(db_conn, n)
    pid = create_playlist(db_conn, user_id=uid, name=name, description=None, track_ids=tids)
    # cleanup은 역순 실행 → 자식(PlaylistTrack/UserTrack) 먼저, 부모(Playlist/User) 나중
    cleanup('DELETE FROM "User" WHERE id = %s', (uid,))
    cleanup('DELETE FROM "Playlist" WHERE "userId" = %s', (uid,))
    cleanup('DELETE FROM "UserTrack" WHERE "userId" = %s', (uid,))
    cleanup('DELETE FROM "PlaylistTrack" WHERE "playlistId" = %s', (pid,))
    return uid, pid, tids


def test_add_tracks_appends_and_skips_dupes(db_conn, cleanup):
    uid, pid, tids = _seed_user_pl(db_conn, cleanup, n=2)
    more = _track_ids(db_conn, 4)  # 처음 2개는 이미 있음(중복), 뒤 2개는 신규
    res = add_tracks_to_playlist(db_conn, pid, more, uid)
    assert res["added"] == 2 and res["skipped"] == 2
    with db_conn.cursor() as cur:
        cur.execute('SELECT COUNT(*) FROM "PlaylistTrack" WHERE "playlistId"=%s', (pid,))
        assert cur.fetchone()[0] == 4  # 2 기존 + 2 신규
        # 신규 곡이 curated UserTrack으로 편입됐는지
        cur.execute('SELECT COUNT(*) FROM "UserTrack" WHERE "userId"=%s', (uid,))
        assert cur.fetchone()[0] >= 4


def test_remove_track(db_conn, cleanup):
    uid, pid, tids = _seed_user_pl(db_conn, cleanup, n=2)
    remove_track_from_playlist(db_conn, pid, tids[0])
    with db_conn.cursor() as cur:
        cur.execute('SELECT "trackId" FROM "PlaylistTrack" WHERE "playlistId"=%s', (pid,))
        remaining = {r[0] for r in cur.fetchall()}
    assert tids[0] not in remaining and tids[1] in remaining


def test_reorder_match_and_mismatch(db_conn, cleanup):
    uid, pid, tids = _seed_user_pl(db_conn, cleanup, n=2)
    ok = reorder_playlist_tracks(db_conn, pid, [tids[1], tids[0]])  # 뒤집기
    assert ok is True
    with db_conn.cursor() as cur:
        cur.execute(
            'SELECT "trackId" FROM "PlaylistTrack" WHERE "playlistId"=%s ORDER BY position',
            (pid,),
        )
        order = [r[0] for r in cur.fetchall()]
    assert order == [tids[1], tids[0]]
    # 집합 불일치 → False, 변경 없음
    assert reorder_playlist_tracks(db_conn, pid, [tids[0]]) is False


def test_update_meta_and_delete(db_conn, cleanup):
    uid, pid, tids = _seed_user_pl(db_conn, cleanup, n=1)
    update_playlist_meta(db_conn, pid, "새이름", "새설명")
    with db_conn.cursor() as cur:
        cur.execute('SELECT name, description FROM "Playlist" WHERE id=%s', (pid,))
        assert cur.fetchone() == ("새이름", "새설명")
    delete_playlist(db_conn, pid)
    with db_conn.cursor() as cur:
        cur.execute('SELECT COUNT(*) FROM "Playlist" WHERE id=%s', (pid,))
        assert cur.fetchone()[0] == 0
        cur.execute('SELECT COUNT(*) FROM "PlaylistTrack" WHERE "playlistId"=%s', (pid,))
        assert cur.fetchone()[0] == 0
