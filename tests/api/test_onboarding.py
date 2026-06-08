"""Onboarding API 테스트."""
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from mrms.api.main import app


client = TestClient(app)


def _setup_session(db_conn, email: str) -> str:
    from mrms.db.user_track import get_or_create_user
    import uuid as _u
    user_id = get_or_create_user(db_conn, email)
    session_id = _u.uuid4().hex
    expires = datetime.now(timezone.utc) + timedelta(days=30)
    with db_conn.cursor() as cur:
        cur.execute(
            'INSERT INTO "AuthSession" (id, "userId", "expiresAt") VALUES (%s, %s, %s)',
            (session_id, user_id, expires),
        )
    db_conn.commit()
    client.cookies.set("mrms_session", session_id)
    return user_id


def test_status_returns_idle_initially(db_conn):
    """init 전 status는 idle."""
    user_id = _setup_session(db_conn, "ob_status@example.com")
    # 이전 테스트에서 다른 user_id로 쌓였을 수 있으니 — store reset
    from mrms.onboarding.status import reset_status
    reset_status(user_id)
    r = client.get("/api/onboarding/status")
    client.cookies.clear()
    assert r.status_code == 200
    body = r.json()
    assert body["step"] == "idle"
    assert body["progress"] == 0


def test_status_returns_401_without_session(db_conn):
    """Cookie 없으면 401."""
    r = client.get("/api/onboarding/status")
    assert r.status_code == 401


def test_start_returns_ok_and_idempotent(db_conn):
    """start 호출 → ok. 두 번 불러도 idempotent (이미 진행 중이면 무시)."""
    user_id = _setup_session(db_conn, "ob_start@example.com")
    from mrms.onboarding.status import reset_status
    reset_status(user_id)
    r1 = client.post("/api/onboarding/start")
    r2 = client.post("/api/onboarding/start")
    client.cookies.clear()
    assert r1.status_code == 200
    assert r2.status_code == 200
