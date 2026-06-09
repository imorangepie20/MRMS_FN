"""Playlist DB helpers."""
import psycopg
import pytest

from mrms.db.playlist import (
    create_playlist,
    get_playlist,
    get_playlist_tracks,
    list_user_playlists,
)
from mrms.db.user_track import get_or_create_user


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
