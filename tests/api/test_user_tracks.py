"""user_tracks API — like/pct toggle + state."""
import pytest
from fastapi.testclient import TestClient

from mrms.api.main import app


client = TestClient(app)


@pytest.fixture
def login_clean(db_conn, login):
    """공용 login + 이전 run의 UserTrack 잔여물 정리 (commit 후 rollback 안 됨)."""
    def _make(email: str) -> tuple[str, str]:
        user_id, session_id = login(email)
        with db_conn.cursor() as cur:
            cur.execute('DELETE FROM "UserTrack" WHERE "userId" = %s', (user_id,))
        db_conn.commit()
        return user_id, session_id

    return _make


def _pick_track(db_conn) -> str | None:
    with db_conn.cursor() as cur:
        cur.execute('SELECT id FROM "Track" LIMIT 1')
        row = cur.fetchone()
    return row[0] if row else None


def test_like_toggle_adds_then_removes(db_conn, login_clean):
    _, session_id = login_clean("like-toggle@test.com")
    track_id = _pick_track(db_conn)
    if not track_id:
        pytest.skip("Track 데이터 부족")
    client.cookies.set("mrms_session", session_id)

    r1 = client.post(f"/api/user/tracks/{track_id}/like")
    assert r1.status_code == 200
    assert r1.json() == {"liked": True}

    r2 = client.post(f"/api/user/tracks/{track_id}/like")
    assert r2.status_code == 200
    assert r2.json() == {"liked": False}

    client.cookies.clear()


def test_pct_toggle(db_conn, login_clean):
    _, session_id = login_clean("pct-toggle@test.com")
    track_id = _pick_track(db_conn)
    if not track_id:
        pytest.skip("Track 데이터 부족")
    client.cookies.set("mrms_session", session_id)

    r1 = client.post(f"/api/user/tracks/{track_id}/pct")
    assert r1.status_code == 200
    assert r1.json() == {"pct": True}

    r2 = client.post(f"/api/user/tracks/{track_id}/pct")
    assert r2.status_code == 200
    assert r2.json() == {"pct": False}

    client.cookies.clear()


def test_track_state_returns_current(db_conn, login_clean):
    _, session_id = login_clean("state@test.com")
    track_id = _pick_track(db_conn)
    if not track_id:
        pytest.skip("Track 데이터 부족")
    client.cookies.set("mrms_session", session_id)

    r0 = client.get(f"/api/user/tracks/{track_id}/state")
    assert r0.status_code == 200
    assert r0.json() == {"liked": False, "pct": False}

    client.post(f"/api/user/tracks/{track_id}/like")
    r1 = client.get(f"/api/user/tracks/{track_id}/state")
    assert r1.json() == {"liked": True, "pct": False}

    client.cookies.clear()


def test_no_auth_returns_401(db_conn):
    client.cookies.clear()
    track_id = _pick_track(db_conn) or "fake"
    r = client.post(f"/api/user/tracks/{track_id}/like")
    assert r.status_code == 401
