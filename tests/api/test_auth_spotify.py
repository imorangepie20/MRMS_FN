"""Spotify auth endpoints 테스트."""
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient

from mrms.api.main import app

client = TestClient(app)


def test_authorize_returns_302_with_state_cookie(db_conn):
    """GET /authorize → 302 to spotify + state cookie set."""
    r = client.get("/api/auth/spotify/authorize", follow_redirects=False)
    assert r.status_code in (302, 307)
    location = r.headers.get("location", "")
    assert "accounts.spotify.com/authorize" in location
    assert "state=" in location
    assert "client_id=" in location
    # state cookie set
    assert "mrms_oauth_state" in r.cookies


def test_callback_state_mismatch_returns_400(db_conn):
    """state cookie와 query param 불일치 → 400."""
    client.cookies.set("mrms_oauth_state", "EXPECTED_STATE")
    r = client.get(
        "/api/auth/spotify/callback?code=CODE_XYZ&state=DIFFERENT_STATE",
        follow_redirects=False,
    )
    client.cookies.clear()
    assert r.status_code == 400


def test_callback_denied_redirects_to_login_with_error(db_conn):
    """error=access_denied → 302 to /login?error=spotify_denied."""
    client.cookies.set("mrms_oauth_state", "S1")
    r = client.get(
        "/api/auth/spotify/callback?error=access_denied&state=S1",
        follow_redirects=False,
    )
    client.cookies.clear()
    assert r.status_code in (302, 307)
    assert "/login" in r.headers.get("location", "")
    assert "spotify_denied" in r.headers.get("location", "")


def test_callback_success_creates_session_and_redirects(db_conn):
    """code 교환 + /me → User+UserOAuth+AuthSession + 302 to /onboarding."""
    token_response = MagicMock()
    token_response.status_code = 200
    token_response.json = MagicMock(return_value={
        "access_token": "AT_xyz",
        "refresh_token": "RT_xyz",
        "expires_in": 3600,
        "scope": "user-read-email user-library-read",
        "token_type": "Bearer",
    })
    me_response = MagicMock()
    me_response.status_code = 200
    me_response.json = MagicMock(return_value={
        "id": "sp_user_12345",
        "email": "alice@example.com",
        "display_name": "Alice",
        "country": "KR",
        "product": "premium",
    })

    fake_client = MagicMock()
    fake_client.__aenter__ = AsyncMock(return_value=fake_client)
    fake_client.__aexit__ = AsyncMock(return_value=None)
    fake_client.post = AsyncMock(return_value=token_response)
    fake_client.get = AsyncMock(return_value=me_response)

    client.cookies.set("mrms_oauth_state", "S2")
    with patch("httpx.AsyncClient", return_value=fake_client):
        r = client.get(
            "/api/auth/spotify/callback?code=CODE_XYZ&state=S2",
            follow_redirects=False,
        )
    client.cookies.clear()
    assert r.status_code in (302, 307)
    assert r.headers["location"] in ("/onboarding", "/mrt")
    assert "mrms_session" in r.cookies

    # DB 검증
    with db_conn.cursor() as cur:
        cur.execute('SELECT id, "primaryPlatform" FROM "User" WHERE email = %s', ("alice@example.com",))
        user_row = cur.fetchone()
        assert user_row is not None
        user_id, primary = user_row
        assert primary == "spotify"
        cur.execute('SELECT COUNT(*) FROM "UserOAuth" WHERE "userId" = %s AND platform = %s', (user_id, "spotify"))
        assert cur.fetchone()[0] == 1
        cur.execute('SELECT COUNT(*) FROM "AuthSession" WHERE "userId" = %s', (user_id,))
        assert cur.fetchone()[0] >= 1


def test_authorize_sets_next_cookie_for_safe_path(db_conn):
    """?next=/p/... 안전한 내부 경로면 mrms_oauth_next 쿠키 설정 (URL-encoded)."""
    from urllib.parse import unquote

    client.cookies.clear()
    r = client.get("/api/auth/spotify/authorize?next=/p/abc123", follow_redirects=False)
    client.cookies.clear()
    assert r.status_code in (302, 307)
    assert unquote(r.cookies.get("mrms_oauth_next") or "") == "/p/abc123"


def test_authorize_ignores_unsafe_next(db_conn):
    """오픈 리다이렉트 후보(//evil.com)는 next 쿠키 미설정."""
    client.cookies.clear()
    r = client.get("/api/auth/spotify/authorize?next=//evil.com", follow_redirects=False)
    client.cookies.clear()
    assert r.status_code in (302, 307)
    assert "mrms_oauth_next" not in r.cookies


def test_callback_redirects_to_next_when_set(db_conn):
    """next 쿠키가 있으면 콜백이 그 페이지로 복귀(공유 페이지 퍼널)."""
    token_response = MagicMock()
    token_response.status_code = 200
    token_response.json = MagicMock(return_value={
        "access_token": "AT_next", "refresh_token": "RT_next",
        "expires_in": 3600, "scope": "user-read-email", "token_type": "Bearer",
    })
    me_response = MagicMock()
    me_response.status_code = 200
    me_response.json = MagicMock(return_value={
        "id": "sp_next_1", "email": "bob_next@example.com",
        "display_name": "Bob", "country": "KR", "product": "premium",
    })
    fake_client = MagicMock()
    fake_client.__aenter__ = AsyncMock(return_value=fake_client)
    fake_client.__aexit__ = AsyncMock(return_value=None)
    fake_client.post = AsyncMock(return_value=token_response)
    fake_client.get = AsyncMock(return_value=me_response)

    client.cookies.set("mrms_oauth_state", "S_NEXT")
    client.cookies.set("mrms_oauth_next", "/p/share-token-xyz")
    with patch("httpx.AsyncClient", return_value=fake_client):
        r = client.get(
            "/api/auth/spotify/callback?code=CODE_XYZ&state=S_NEXT",
            follow_redirects=False,
        )
    client.cookies.clear()
    assert r.status_code in (302, 307)
    assert r.headers["location"] == "/p/share-token-xyz"
    assert "mrms_session" in r.cookies


def test_spotify_token_returns_access_token_with_valid_session(db_conn):
    """/token → 유효 cookie + spotify UserOAuth → access_token 반환."""
    import uuid as _u

    from mrms.db.user_track import get_or_create_user, upsert_oauth

    user_id = get_or_create_user(db_conn, "alice_token@example.com")
    expires = datetime.now(timezone.utc) + timedelta(hours=1)
    upsert_oauth(
        db_conn, user_id=user_id, platform="spotify",
        access_token="VALID_SPOTIFY_AT",
        refresh_token="VALID_SPOTIFY_RT",
        expires_at=expires,
        scopes=["user-read-email"],
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
    r = client.get("/api/auth/spotify/token")
    client.cookies.clear()
    assert r.status_code == 200
    body = r.json()
    assert body["access_token"] == "VALID_SPOTIFY_AT"
    assert "expires_at" in body
