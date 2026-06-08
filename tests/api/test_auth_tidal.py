"""Tidal 인증 endpoint 테스트."""
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from mrms.api.main import app


client = TestClient(app)


def test_tidal_token_returns_existing_valid_token(db_conn, monkeypatch):
    """UserOAuth에 유효한 토큰 있으면 그대로 반환 + premium 필드."""
    from mrms.db.user_track import get_or_create_user, upsert_oauth

    monkeypatch.setenv("DEFAULT_USER_EMAIL", "tidal_auth@example.com")
    user_id = get_or_create_user(db_conn, "tidal_auth@example.com")
    db_conn.commit()

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
    assert r.status_code == 200
    body = r.json()
    assert body["access_token"] == "VALID_ACCESS"
    assert "expires_at" in body
    assert "premium" in body  # bool or None


def test_tidal_token_404_when_no_oauth(db_conn, monkeypatch):
    """UserOAuth 없으면 404."""
    from mrms.db.user_track import get_or_create_user

    monkeypatch.setenv("DEFAULT_USER_EMAIL", "tidal_auth_b@example.com")
    get_or_create_user(db_conn, "tidal_auth_b@example.com")
    db_conn.commit()

    r = client.get("/api/auth/tidal/token")
    assert r.status_code == 404
