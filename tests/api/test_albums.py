"""Albums API."""
import pytest
from fastapi.testclient import TestClient

from mrms.api.main import app


client = TestClient(app)


def test_get_album_tracks(db_conn, login):
    """GET /api/albums/{id}/tracks → 그 앨범 트랙들."""
    _, session_id = login("album@test.com")
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
        # 사용자별 liked/pct 상태 — boolean 필수
        assert isinstance(t["liked"], bool)
        assert isinstance(t["pct"], bool)
    client.cookies.clear()


def test_album_not_found_returns_404(login):
    _, session_id = login("nf-album@test.com")
    client.cookies.set("mrms_session", session_id)
    r = client.get("/api/albums/nonexistent-album-id/tracks")
    assert r.status_code == 404
    client.cookies.clear()


def test_no_auth_returns_401(db_conn):
    client.cookies.clear()
    r = client.get("/api/albums/any/tracks")
    assert r.status_code == 401
