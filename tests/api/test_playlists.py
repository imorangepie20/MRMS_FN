"""Playlists API — create + list + get tracks."""
import pytest
from fastapi.testclient import TestClient

from mrms.api.main import app

client = TestClient(app)


def _pick_track_ids(db_conn, n: int) -> list[str]:
    with db_conn.cursor() as cur:
        cur.execute('SELECT id FROM "Track" LIMIT %s', (n,))
        return [r[0] for r in cur.fetchall()]


def test_create_playlist_returns_playlist_meta(db_conn, login):
    """POST /api/user/playlists → 새 playlist 생성, meta 반환."""
    _, session_id = login("create-pl@test.com")
    track_ids = _pick_track_ids(db_conn, 3)
    if len(track_ids) < 3:
        pytest.skip("Track 데이터 부족")
    client.cookies.set("mrms_session", session_id)

    r = client.post(
        "/api/user/playlists",
        json={"name": "My PL", "description": "test", "track_ids": track_ids},
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["playlist"]["name"] == "My PL"
    assert data["playlist"]["description"] == "test"
    assert "id" in data["playlist"]
    client.cookies.clear()


def test_create_playlist_rejects_empty_name(login):
    """이름 비어있으면 400."""
    _, session_id = login("no-name@test.com")
    client.cookies.set("mrms_session", session_id)
    r = client.post("/api/user/playlists", json={"name": "  ", "track_ids": []})
    assert r.status_code == 400
    client.cookies.clear()


def test_list_user_playlists(db_conn, login):
    """GET /api/user/playlists → 본인 playlist 목록."""
    _, session_id = login("list-pl@test.com")
    track_ids = _pick_track_ids(db_conn, 1)
    if not track_ids:
        pytest.skip("Track 데이터 부족")
    client.cookies.set("mrms_session", session_id)
    client.post("/api/user/playlists", json={"name": "A", "track_ids": track_ids})
    client.post("/api/user/playlists", json={"name": "B", "track_ids": track_ids})

    r = client.get("/api/user/playlists")
    assert r.status_code == 200
    names = {p["name"] for p in r.json()["playlists"]}
    assert {"A", "B"}.issubset(names)
    client.cookies.clear()


def test_get_playlist_tracks_returns_tracks(db_conn, login):
    """GET /api/playlists/{id}/tracks → 안 트랙 + playlist meta."""
    _, session_id = login("get-pl@test.com")
    track_ids = _pick_track_ids(db_conn, 2)
    if len(track_ids) < 2:
        pytest.skip("Track 데이터 부족")
    client.cookies.set("mrms_session", session_id)

    create_r = client.post(
        "/api/user/playlists",
        json={"name": "Z", "track_ids": track_ids},
    )
    pid = create_r.json()["playlist"]["id"]

    r = client.get(f"/api/playlists/{pid}/tracks")
    assert r.status_code == 200
    tracks = r.json()["tracks"]
    assert [t["track_id"] for t in tracks] == track_ids
    assert r.json()["playlist"]["name"] == "Z"
    # 사용자별 liked/pct 상태 — boolean 필수
    for t in tracks:
        assert isinstance(t["liked"], bool)
        assert isinstance(t["pct"], bool)
    client.cookies.clear()


def test_playlist_tracks_reflect_liked_state(db_conn, login, cleanup):
    """좋아요한 트랙만 liked=True, 나머지는 False."""
    user_id, session_id = login()  # per-test 고유 email → UserTrack 잔여물 없음
    cleanup('DELETE FROM "UserTrack" WHERE "userId" = %s', (user_id,))
    track_ids = _pick_track_ids(db_conn, 2)
    if len(track_ids) < 2:
        pytest.skip("Track 데이터 부족")
    client.cookies.set("mrms_session", session_id)

    create_r = client.post(
        "/api/user/playlists",
        json={"name": "LikedState", "track_ids": track_ids},
    )
    pid = create_r.json()["playlist"]["id"]
    like_r = client.post(f"/api/user/tracks/{track_ids[0]}/like")
    assert like_r.status_code == 200, like_r.text

    r = client.get(f"/api/playlists/{pid}/tracks")
    assert r.status_code == 200
    by_id = {t["track_id"]: t for t in r.json()["tracks"]}
    assert by_id[track_ids[0]]["liked"] is True
    assert by_id[track_ids[1]]["liked"] is False
    assert by_id[track_ids[0]]["pct"] is False
    assert by_id[track_ids[1]]["pct"] is False
    client.cookies.clear()


def test_get_playlist_other_user_forbidden(db_conn, login):
    """다른 사용자 playlist 접근 → 403."""
    _, session_a = login("owner@test.com")
    track_ids = _pick_track_ids(db_conn, 1)
    if not track_ids:
        pytest.skip("Track 데이터 부족")
    client.cookies.set("mrms_session", session_a)
    create_r = client.post(
        "/api/user/playlists",
        json={"name": "Private", "track_ids": track_ids},
    )
    pid = create_r.json()["playlist"]["id"]

    # 다른 사용자
    _, session_b = login("stranger@test.com")
    client.cookies.set("mrms_session", session_b)
    r = client.get(f"/api/playlists/{pid}/tracks")
    assert r.status_code == 403
    client.cookies.clear()


def test_no_auth_returns_401(db_conn):
    client.cookies.clear()
    r = client.get("/api/user/playlists")
    assert r.status_code == 401


def test_toggle_playlist_share(db_conn, login):
    """POST .../share enabled=true → share_id + share_url, false → null."""
    _, session_id = login("share-toggle@test.com")
    track_ids = _pick_track_ids(db_conn, 1)
    if not track_ids:
        pytest.skip("Track 데이터 부족")
    client.cookies.set("mrms_session", session_id)
    pid = client.post(
        "/api/user/playlists", json={"name": "S", "track_ids": track_ids}
    ).json()["playlist"]["id"]

    on = client.post(f"/api/user/playlists/{pid}/share", json={"enabled": True})
    assert on.status_code == 200, on.text
    share_id = on.json()["share_id"]
    assert share_id
    assert on.json()["share_url"] == f"/p/{share_id}"

    off = client.post(f"/api/user/playlists/{pid}/share", json={"enabled": False})
    assert off.status_code == 200
    assert off.json()["share_id"] is None
    assert off.json()["share_url"] is None
    client.cookies.clear()


def test_share_other_user_forbidden(db_conn, login):
    """다른 사용자 playlist 공유 토글 → 403."""
    _, session_a = login("share-owner@test.com")
    track_ids = _pick_track_ids(db_conn, 1)
    if not track_ids:
        pytest.skip("Track 데이터 부족")
    client.cookies.set("mrms_session", session_a)
    pid = client.post(
        "/api/user/playlists", json={"name": "P", "track_ids": track_ids}
    ).json()["playlist"]["id"]

    _, session_b = login("share-stranger@test.com")
    client.cookies.set("mrms_session", session_b)
    r = client.post(f"/api/user/playlists/{pid}/share", json={"enabled": True})
    assert r.status_code == 403
    client.cookies.clear()


def test_share_requires_auth(db_conn):
    """미인증 → 401."""
    client.cookies.clear()
    r = client.post("/api/user/playlists/whatever/share", json={"enabled": True})
    assert r.status_code == 401


def _make_pl(db_conn, login, cleanup, name="PL", n=2):
    user_id, session_id = login()
    tids = _pick_track_ids(db_conn, n)
    client.cookies.set("mrms_session", session_id)
    r = client.post("/api/user/playlists", json={"name": name, "track_ids": tids})
    pid = r.json()["playlist"]["id"]
    # login()/create는 내부 commit이라 db_conn 롤백으로 보호 안 됨 → 명시적 정리.
    # cleanup은 역순 실행 → 자식(PlaylistTrack/UserTrack) 먼저, 부모(Playlist/User) 나중.
    cleanup('DELETE FROM "User" WHERE id = %s', (user_id,))
    cleanup('DELETE FROM "Playlist" WHERE "userId" = %s', (user_id,))
    cleanup('DELETE FROM "UserTrack" WHERE "userId" = %s', (user_id,))
    cleanup('DELETE FROM "PlaylistTrack" WHERE "playlistId" = %s', (pid,))
    return user_id, session_id, pid, tids


def test_add_tracks_endpoint(db_conn, login, cleanup):
    uid, sid, pid, tids = _make_pl(db_conn, login, cleanup, n=2)
    more = _pick_track_ids(db_conn, 4)
    r = client.post(f"/api/playlists/{pid}/tracks", json={"track_ids": more})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["added"] == 2 and body["skipped"] == 2
    client.cookies.clear()


def test_remove_track_endpoint(db_conn, login, cleanup):
    uid, sid, pid, tids = _make_pl(db_conn, login, cleanup, n=2)
    r = client.delete(f"/api/playlists/{pid}/tracks/{tids[0]}")
    assert r.status_code == 200, r.text
    t = client.get(f"/api/playlists/{pid}/tracks").json()["tracks"]
    assert tids[0] not in [x["track_id"] for x in t]
    client.cookies.clear()


def test_reorder_endpoint_and_mismatch(db_conn, login, cleanup):
    uid, sid, pid, tids = _make_pl(db_conn, login, cleanup, n=2)
    r = client.patch(f"/api/playlists/{pid}/tracks/order", json={"track_ids": [tids[1], tids[0]]})
    assert r.status_code == 200, r.text
    order = [x["track_id"] for x in client.get(f"/api/playlists/{pid}/tracks").json()["tracks"]]
    assert order == [tids[1], tids[0]]
    bad = client.patch(f"/api/playlists/{pid}/tracks/order", json={"track_ids": [tids[0]]})
    assert bad.status_code == 400
    client.cookies.clear()


def test_update_and_delete_endpoint(db_conn, login, cleanup):
    uid, sid, pid, tids = _make_pl(db_conn, login, cleanup, n=1)
    r = client.patch(f"/api/playlists/{pid}", json={"name": "renamed", "description": "d"})
    assert r.status_code == 200 and r.json()["playlist"]["name"] == "renamed"
    d = client.delete(f"/api/playlists/{pid}")
    assert d.status_code == 200
    assert client.get(f"/api/playlists/{pid}/tracks").status_code == 404
    client.cookies.clear()


def test_ownership_forbidden(db_conn, login, cleanup):
    uid, sid, pid, tids = _make_pl(db_conn, login, cleanup, n=1)
    client.cookies.clear()
    other_uid, other_sid = login("other-owner@test.com")
    cleanup('DELETE FROM "User" WHERE id = %s', (other_uid,))
    client.cookies.set("mrms_session", other_sid)
    r = client.delete(f"/api/playlists/{pid}")
    assert r.status_code == 403
    client.cookies.clear()
