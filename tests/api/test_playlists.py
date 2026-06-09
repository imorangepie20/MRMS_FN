"""Playlists API — create + list + get tracks."""
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from mrms.api.main import app
from mrms.db.user_track import get_or_create_user


client = TestClient(app)


def _login(db_conn, email: str) -> tuple[str, str]:
    user_id = get_or_create_user(db_conn, email)
    session_id = uuid.uuid4().hex
    expires_at = datetime.now(timezone.utc) + timedelta(days=30)
    with db_conn.cursor() as cur:
        cur.execute(
            'INSERT INTO "AuthSession" (id, "userId", "expiresAt") VALUES (%s, %s, %s)',
            (session_id, user_id, expires_at),
        )
    db_conn.commit()
    return user_id, session_id


def _pick_track_ids(db_conn, n: int) -> list[str]:
    with db_conn.cursor() as cur:
        cur.execute('SELECT id FROM "Track" LIMIT %s', (n,))
        return [r[0] for r in cur.fetchall()]


def test_create_playlist_returns_playlist_meta(db_conn):
    """POST /api/user/playlists → 새 playlist 생성, meta 반환."""
    _, session_id = _login(db_conn, "create-pl@test.com")
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


def test_create_playlist_rejects_empty_name(db_conn):
    """이름 비어있으면 400."""
    _, session_id = _login(db_conn, "no-name@test.com")
    client.cookies.set("mrms_session", session_id)
    r = client.post("/api/user/playlists", json={"name": "  ", "track_ids": []})
    assert r.status_code == 400
    client.cookies.clear()


def test_list_user_playlists(db_conn):
    """GET /api/user/playlists → 본인 playlist 목록."""
    _, session_id = _login(db_conn, "list-pl@test.com")
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


def test_get_playlist_tracks_returns_tracks(db_conn):
    """GET /api/playlists/{id}/tracks → 안 트랙 + playlist meta."""
    _, session_id = _login(db_conn, "get-pl@test.com")
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
    client.cookies.clear()


def test_get_playlist_other_user_forbidden(db_conn):
    """다른 사용자 playlist 접근 → 403."""
    _, session_a = _login(db_conn, "owner@test.com")
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
    _, session_b = _login(db_conn, "stranger@test.com")
    client.cookies.set("mrms_session", session_b)
    r = client.get(f"/api/playlists/{pid}/tracks")
    assert r.status_code == 403
    client.cookies.clear()


def test_no_auth_returns_401(db_conn):
    client.cookies.clear()
    r = client.get("/api/user/playlists")
    assert r.status_code == 401
