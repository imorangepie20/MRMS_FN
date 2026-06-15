"""Playlist DB helpers."""
import uuid as _uuid

import psycopg
import pytest

from mrms.db.playlist import (
    create_playlist,
    get_playlist,
    get_playlist_by_share_id,
    get_playlist_tracks,
    list_user_playlists,
    set_playlist_share,
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


def test_create_playlist_marks_tracks_curated(db_conn: psycopg.Connection, cleanup):
    """담은 곡을 UserTrack(source='curated')로 편입 → MRT 제외(ADR-002 '이동=UserTrack')."""
    user_id = get_or_create_user(db_conn, f"plcur-{_uuid.uuid4().hex[:8]}@test.com")
    db_conn.commit()
    cleanup('DELETE FROM "UserTrack" WHERE "userId" = %s', (user_id,))
    with db_conn.cursor() as cur:
        cur.execute('SELECT id FROM "Track" LIMIT 2')
        track_ids = [r[0] for r in cur.fetchall()]
    if len(track_ids) < 1:
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
