"""YouTube auth endpoints 테스트 (auth_spotify 미러 + PKCE)."""
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from mrms.api.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def _yt_env(monkeypatch):
    """라우트의 _client()가 읽는 YOUTUBE_* env 보장."""
    monkeypatch.setenv("YOUTUBE_CLIENT_ID", "test_yt_cid")
    monkeypatch.setenv("YOUTUBE_CLIENT_SECRET", "test_yt_secret")
    monkeypatch.setenv(
        "YOUTUBE_REDIRECT_URI",
        "http://localhost:8000/api/auth/youtube/callback",
    )
    yield


def test_authorize_returns_302_with_state_and_verifier_cookies(db_conn):
    """GET /authorize → 302 to Google + state·code_verifier 쿠키 set."""
    r = client.get("/api/auth/youtube/authorize", follow_redirects=False)
    assert r.status_code in (302, 307)
    location = r.headers.get("location", "")
    assert "accounts.google.com/o/oauth2/v2/auth" in location
    assert "state=" in location
    assert "client_id=test_yt_cid" in location
    assert "code_challenge=" in location
    assert "code_challenge_method=S256" in location
    assert "access_type=offline" in location
    assert "prompt=consent" in location
    # 쿠키 set
    assert "mrms_yt_oauth_state" in r.cookies
    assert "mrms_yt_pkce_verifier" in r.cookies
    client.cookies.clear()


def test_callback_state_mismatch_returns_400(db_conn):
    """state 쿠키와 query param 불일치 → 400 (CSRF)."""
    client.cookies.set("mrms_yt_oauth_state", "EXPECTED_STATE")
    client.cookies.set("mrms_yt_pkce_verifier", "VERIFIER")
    r = client.get(
        "/api/auth/youtube/callback?code=CODE_XYZ&state=DIFFERENT_STATE",
        follow_redirects=False,
    )
    client.cookies.clear()
    assert r.status_code == 400


def test_callback_denied_redirects_to_login_with_error(db_conn):
    """error=access_denied → 302 to /login?error=youtube_denied."""
    client.cookies.set("mrms_yt_oauth_state", "S1")
    r = client.get(
        "/api/auth/youtube/callback?error=access_denied&state=S1",
        follow_redirects=False,
    )
    client.cookies.clear()
    assert r.status_code in (302, 307)
    loc = r.headers.get("location", "")
    assert "/login" in loc
    assert "youtube_denied" in loc


def test_callback_success_creates_session_and_redirects(db_conn):
    """code 교환 + userinfo → User+UserOAuth+AuthSession + redirect."""
    token_response = MagicMock()
    token_response.status_code = 200
    token_response.json = MagicMock(return_value={
        "access_token": "AT_yt",
        "refresh_token": "RT_yt",
        "expires_in": 3600,
        "scope": "https://www.googleapis.com/auth/youtube.readonly",
        "token_type": "Bearer",
    })
    userinfo_response = MagicMock()
    userinfo_response.status_code = 200
    userinfo_response.json = MagicMock(return_value={
        "id": "g_user_12345",
        "email": "bob_yt@example.com",
        "name": "Bob YT",
    })

    fake_client = MagicMock()
    fake_client.__aenter__ = AsyncMock(return_value=fake_client)
    fake_client.__aexit__ = AsyncMock(return_value=None)
    fake_client.post = AsyncMock(return_value=token_response)
    fake_client.get = AsyncMock(return_value=userinfo_response)

    client.cookies.set("mrms_yt_oauth_state", "S2")
    client.cookies.set("mrms_yt_pkce_verifier", "VERIFIER_S2")
    with patch("httpx.AsyncClient", return_value=fake_client):
        r = client.get(
            "/api/auth/youtube/callback?code=CODE_XYZ&state=S2",
            follow_redirects=False,
        )
    client.cookies.clear()
    assert r.status_code in (302, 307)
    assert r.headers["location"] in ("/onboarding", "/mrt")
    assert "mrms_session" in r.cookies

    # token 교환 body에 code_verifier 전달됐는지
    _, kwargs = fake_client.post.call_args
    assert kwargs["data"]["code_verifier"] == "VERIFIER_S2"

    # DB 검증
    with db_conn.cursor() as cur:
        cur.execute(
            'SELECT id, "primaryPlatform" FROM "User" WHERE email = %s',
            ("bob_yt@example.com",),
        )
        user_row = cur.fetchone()
        assert user_row is not None
        user_id, primary = user_row
        assert primary == "youtube"
        cur.execute(
            'SELECT COUNT(*) FROM "UserOAuth" WHERE "userId" = %s AND platform = %s',
            (user_id, "youtube"),
        )
        assert cur.fetchone()[0] == 1
        cur.execute('SELECT COUNT(*) FROM "AuthSession" WHERE "userId" = %s', (user_id,))
        assert cur.fetchone()[0] >= 1

    # cleanup (헬퍼들이 내부 commit하므로 잔여물 제거)
    with db_conn.cursor() as cur:
        cur.execute('DELETE FROM "AuthSession" WHERE "userId" = %s', (user_id,))
        cur.execute('DELETE FROM "UserOAuth" WHERE "userId" = %s', (user_id,))
        cur.execute('DELETE FROM "User" WHERE id = %s', (user_id,))
    db_conn.commit()


def test_token_returns_access_token_with_valid_session(db_conn):
    """/token → 유효 cookie + youtube UserOAuth → access_token 반환."""
    import uuid as _u

    from mrms.db.user_track import get_or_create_user, upsert_oauth

    user_id = get_or_create_user(db_conn, "yt_token@example.com")
    expires = datetime.now(timezone.utc) + timedelta(hours=1)
    upsert_oauth(
        db_conn, user_id=user_id, platform="youtube",
        access_token="VALID_YT_AT", refresh_token="VALID_YT_RT",
        expires_at=expires, scopes=["https://www.googleapis.com/auth/youtube.readonly"],
    )
    session_id = _u.uuid4().hex
    session_expires = datetime.now(timezone.utc) + timedelta(days=30)
    with db_conn.cursor() as cur:
        cur.execute(
            'INSERT INTO "AuthSession" (id, "userId", "expiresAt") VALUES (%s, %s, %s)',
            (session_id, user_id, session_expires),
        )
    db_conn.commit()

    client.cookies.set("mrms_session", session_id)
    r = client.get("/api/auth/youtube/token")
    client.cookies.clear()
    assert r.status_code == 200
    body = r.json()
    assert body["access_token"] == "VALID_YT_AT"
    assert "expires_at" in body

    with db_conn.cursor() as cur:
        cur.execute('DELETE FROM "AuthSession" WHERE id = %s', (session_id,))
        cur.execute('DELETE FROM "UserOAuth" WHERE "userId" = %s', (user_id,))
        cur.execute('DELETE FROM "User" WHERE id = %s', (user_id,))
    db_conn.commit()


def test_token_auto_refreshes_when_expired(db_conn):
    """만료 임박 시 refresh → 새 access_token으로 upsert + 반환."""
    import uuid as _u

    from mrms.db.user_track import get_oauth, get_or_create_user, upsert_oauth

    user_id = get_or_create_user(db_conn, "yt_refresh@example.com")
    # 이미 만료된 토큰
    expires = datetime.now(timezone.utc) - timedelta(minutes=5)
    upsert_oauth(
        db_conn, user_id=user_id, platform="youtube",
        access_token="OLD_AT", refresh_token="REFRESH_ME",
        expires_at=expires, scopes=["https://www.googleapis.com/auth/youtube.readonly"],
    )
    session_id = _u.uuid4().hex
    session_expires = datetime.now(timezone.utc) + timedelta(days=30)
    with db_conn.cursor() as cur:
        cur.execute(
            'INSERT INTO "AuthSession" (id, "userId", "expiresAt") VALUES (%s, %s, %s)',
            (session_id, user_id, session_expires),
        )
    db_conn.commit()

    refresh_resp = MagicMock()
    refresh_resp.status_code = 200
    refresh_resp.json = MagicMock(return_value={
        "access_token": "FRESH_AT",
        "expires_in": 3600,
        "scope": "https://www.googleapis.com/auth/youtube.readonly",
        "token_type": "Bearer",
    })
    fake_client = MagicMock()
    fake_client.__aenter__ = AsyncMock(return_value=fake_client)
    fake_client.__aexit__ = AsyncMock(return_value=None)
    fake_client.post = AsyncMock(return_value=refresh_resp)

    client.cookies.set("mrms_session", session_id)
    with patch("httpx.AsyncClient", return_value=fake_client):
        r = client.get("/api/auth/youtube/token")
    client.cookies.clear()
    assert r.status_code == 200
    assert r.json()["access_token"] == "FRESH_AT"

    # DB에도 새 토큰 반영 + refresh_token 유지
    oauth = get_oauth(db_conn, user_id, "youtube")
    assert oauth["accessToken"] == "FRESH_AT"
    assert oauth["refreshToken"] == "REFRESH_ME"

    with db_conn.cursor() as cur:
        cur.execute('DELETE FROM "AuthSession" WHERE id = %s', (session_id,))
        cur.execute('DELETE FROM "UserOAuth" WHERE "userId" = %s', (user_id,))
        cur.execute('DELETE FROM "User" WHERE id = %s', (user_id,))
    db_conn.commit()
