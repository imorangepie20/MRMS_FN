"""Tidal 인증 endpoint 테스트."""
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from mrms.api.main import app


client = TestClient(app)


@pytest.fixture
def set_session_cookie(login):
    """공용 login + cookie set factory. user_id 반환."""
    def _make(email: str) -> str:
        user_id, session_id = login(email)
        client.cookies.set("mrms_session", session_id)
        return user_id

    return _make


def test_tidal_token_returns_existing_valid_token(db_conn, set_session_cookie):
    """UserOAuth에 유효한 토큰 있으면 그대로 반환 + premium 필드."""
    from mrms.db.user_track import upsert_oauth

    user_id = set_session_cookie("tidal_auth@example.com")

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


def test_tidal_token_404_when_no_oauth(set_session_cookie):
    """UserOAuth 없으면 404."""
    set_session_cookie("tidal_auth_b@example.com")

    r = client.get("/api/auth/tidal/token")
    client.cookies.clear()
    assert r.status_code == 404
