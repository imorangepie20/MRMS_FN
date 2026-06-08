"""Tidal 인증 endpoint 테스트."""
import uuid as _uuid_helper
from datetime import datetime, timedelta, timezone
from datetime import datetime as _dt_helper, timedelta as _td_helper, timezone as _tz_helper

from fastapi.testclient import TestClient

from mrms.api.main import app


client = TestClient(app)


def _set_session_cookie(db_conn, email: str) -> str:
    """테스트용 — User 생성 + AuthSession + cookie set. user_id 반환."""
    from mrms.db.user_track import get_or_create_user
    user_id = get_or_create_user(db_conn, email)
    session_id = _uuid_helper.uuid4().hex
    expires_at = _dt_helper.now(_tz_helper.utc) + _td_helper(days=30)
    with db_conn.cursor() as cur:
        cur.execute(
            'INSERT INTO "AuthSession" (id, "userId", "expiresAt") VALUES (%s, %s, %s)',
            (session_id, user_id, expires_at),
        )
    db_conn.commit()
    client.cookies.set("mrms_session", session_id)
    return user_id


def test_tidal_token_returns_existing_valid_token(db_conn):
    """UserOAuth에 유효한 토큰 있으면 그대로 반환 + premium 필드."""
    from mrms.db.user_track import upsert_oauth

    user_id = _set_session_cookie(db_conn, "tidal_auth@example.com")

    expires = datetime.now(timezone.utc) + timedelta(hours=1)
    upsert_oauth(
        db_conn, user_id, "tidal",
        access_token="VALID_ACCESS",
        refresh_token="VALID_REFRESH",
        expires_at=expires,
        scopes=["user.read", "collection.read"],
    )
    db_conn.commit()

    # /v2/users/me 호출하면 외부 네트워크 — 일단 None 또는 bool 반환되는지만 검증
    r = client.get("/api/auth/tidal/token")
    client.cookies.clear()
    assert r.status_code == 200
    body = r.json()
    assert body["access_token"] == "VALID_ACCESS"
    assert "expires_at" in body
    assert "premium" in body  # bool or None


def test_tidal_token_404_when_no_oauth(db_conn):
    """UserOAuth 없으면 404."""
    _set_session_cookie(db_conn, "tidal_auth_b@example.com")

    r = client.get("/api/auth/tidal/token")
    client.cookies.clear()
    assert r.status_code == 404
