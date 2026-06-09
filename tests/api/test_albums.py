"""Albums API."""
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


def test_get_album_tracks(db_conn):
    """GET /api/albums/{id}/tracks → 그 앨범 트랙들."""
    _, session_id = _login(db_conn, "album@test.com")
    client.cookies.set("mrms_session", session_id)

    with db_conn.cursor() as cur:
        cur.execute(
            'SELECT "albumId" FROM "Track" WHERE "albumId" IS NOT NULL LIMIT 1'
        )
        row = cur.fetchone()
    if not row:
        pytest.skip("Album 데이터 부족")
    album_id = row[0]

    r = client.get(f"/api/albums/{album_id}/tracks")
    assert r.status_code == 200, r.text
    data = r.json()
    assert "album" in data
    assert "tracks" in data
    assert data["album"]["id"] == album_id
    assert len(data["tracks"]) >= 1
    # 모든 트랙이 그 album에 속함
    with db_conn.cursor() as cur:
        cur.execute(
            'SELECT id FROM "Track" WHERE "albumId" = %s ORDER BY id',
            (album_id,),
        )
        expected_ids = sorted(r[0] for r in cur.fetchall())
    returned_ids = sorted(t["track_id"] for t in data["tracks"])
    assert returned_ids == expected_ids
    # album_cover 키 존재 (값은 None 허용 — coverUrl 컬럼 없음)
    for t in data["tracks"]:
        assert "album_cover" in t
    client.cookies.clear()


def test_album_not_found_returns_404(db_conn):
    _, session_id = _login(db_conn, "nf-album@test.com")
    client.cookies.set("mrms_session", session_id)
    r = client.get("/api/albums/nonexistent-album-id/tracks")
    assert r.status_code == 404
    client.cookies.clear()


def test_no_auth_returns_401(db_conn):
    client.cookies.clear()
    r = client.get("/api/albums/any/tracks")
    assert r.status_code == 401
