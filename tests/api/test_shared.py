"""공유 플레이리스트 공개 조회 — 무인증."""
import pytest
from fastapi.testclient import TestClient

from mrms.api.main import app

client = TestClient(app)


def _pick_track_ids(db_conn, n: int) -> list[str]:
    with db_conn.cursor() as cur:
        cur.execute('SELECT id FROM "Track" LIMIT %s', (n,))
        return [r[0] for r in cur.fetchall()]


def test_shared_playlist_public_no_auth(db_conn, login):
    """공유한 플레이리스트는 무인증 방문자도 조회 가능."""
    _, session_id = login("shared-pub@test.com")
    track_ids = _pick_track_ids(db_conn, 2)
    if len(track_ids) < 2:
        pytest.skip("Track 데이터 부족")
    client.cookies.set("mrms_session", session_id)
    pid = client.post(
        "/api/user/playlists", json={"name": "Pub", "track_ids": track_ids}
    ).json()["playlist"]["id"]
    share_id = client.post(
        f"/api/user/playlists/{pid}/share", json={"enabled": True}
    ).json()["share_id"]
    client.cookies.clear()  # 무인증 방문자

    r = client.get(f"/api/shared/{share_id}")
    assert r.status_code == 200, r.text
    assert r.json()["playlist"]["name"] == "Pub"
    assert [t["track_id"] for t in r.json()["tracks"]] == track_ids


def test_shared_unknown_token_404(db_conn):
    """없는/해제된 토큰 → 404."""
    client.cookies.clear()
    r = client.get("/api/shared/does-not-exist")
    assert r.status_code == 404
