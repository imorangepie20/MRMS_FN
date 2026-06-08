"""AuthSession + get_current_user_id 테스트."""
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from mrms.api.main import app


client = TestClient(app)


def test_no_cookie_returns_401(db_conn):
    """Cookie 없으면 401."""
    r = client.get("/api/user")
    assert r.status_code == 401


def test_invalid_session_id_returns_401(db_conn):
    """존재하지 않는 session_id면 401."""
    client.cookies.set("mrms_session", "nonexistent-session-id")
    r = client.get("/api/user")
    assert r.status_code == 401
    client.cookies.clear()


def test_valid_session_returns_user(db_conn):
    """유효한 session_id면 user 데이터 반환."""
    from mrms.db.user_track import get_or_create_user
    import uuid

    user_id = get_or_create_user(db_conn, "session_user@example.com")
    session_id = uuid.uuid4().hex
    expires_at = datetime.now(timezone.utc) + timedelta(days=30)
    with db_conn.cursor() as cur:
        cur.execute(
            'INSERT INTO "AuthSession" (id, "userId", "expiresAt") VALUES (%s, %s, %s)',
            (session_id, user_id, expires_at),
        )
    db_conn.commit()

    client.cookies.set("mrms_session", session_id)
    r = client.get("/api/user")
    client.cookies.clear()
    assert r.status_code == 200
    assert r.json()["email"] == "session_user@example.com"


def test_expired_session_returns_401(db_conn):
    """만료된 session이면 401."""
    from mrms.db.user_track import get_or_create_user
    import uuid

    user_id = get_or_create_user(db_conn, "expired_user@example.com")
    session_id = uuid.uuid4().hex
    expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    with db_conn.cursor() as cur:
        cur.execute(
            'INSERT INTO "AuthSession" (id, "userId", "expiresAt") VALUES (%s, %s, %s)',
            (session_id, user_id, expires_at),
        )
    db_conn.commit()

    client.cookies.set("mrms_session", session_id)
    r = client.get("/api/user")
    client.cookies.clear()
    assert r.status_code == 401
