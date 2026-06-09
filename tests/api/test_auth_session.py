"""AuthSession + get_current_user_id 테스트."""
import base64
import json
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

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


def _make_tidal_jwt(uid: int = 99999) -> str:
    """가짜 Tidal JWT (서명 X, payload만 디코드 가능하게)."""
    header = base64.urlsafe_b64encode(b'{"alg":"none"}').decode().rstrip("=")
    payload = base64.urlsafe_b64encode(
        json.dumps({"uid": uid, "scope": "r_usr w_usr w_sub"}).encode()
    ).decode().rstrip("=")
    sig = base64.urlsafe_b64encode(b"fake").decode().rstrip("=")
    return f"{header}.{payload}.{sig}"


def test_device_code_init_returns_user_code(db_conn):
    """init endpoint → Tidal mock 응답 → user_code + verification_uri 반환."""
    fake_response = AsyncMock()
    fake_response.status_code = 200
    fake_response.json = lambda: {
        "userCode": "ABC123",
        "deviceCode": "DEVICE_XYZ",
        "verificationUri": "link.tidal.com",
        "verificationUriComplete": "https://link.tidal.com/ABC123",
        "expiresIn": 300,
        "interval": 5,
    }
    with patch("httpx.AsyncClient.post", return_value=fake_response):
        r = client.post("/api/auth/tidal/device-code/init")
    assert r.status_code == 200
    body = r.json()
    assert body["user_code"] == "ABC123"
    assert body["device_code"] == "DEVICE_XYZ"
    assert "link.tidal.com" in body["verification_uri_complete"]


def test_device_code_poll_pending_returns_pending(db_conn):
    """Tidal이 authorization_pending 400 → {status: pending}."""
    fake_response = AsyncMock()
    fake_response.status_code = 400
    fake_response.json = lambda: {"error": "authorization_pending"}
    with patch("httpx.AsyncClient.post", return_value=fake_response):
        r = client.post(
            "/api/auth/tidal/device-code/poll",
            json={"device_code": "DEVICE_XYZ"},
        )
    assert r.status_code == 200
    assert r.json()["status"] == "pending"


def test_device_code_poll_success_creates_session(db_conn):
    """성공 응답 → User+UserOAuth+AuthSession 생성 + cookie set."""
    jwt = _make_tidal_jwt(uid=12345)
    fake_response = AsyncMock()
    fake_response.status_code = 200
    fake_response.json = lambda: {
        "access_token": jwt,
        "refresh_token": "refresh_xyz",
        "expires_in": 86400,
    }
    with patch("httpx.AsyncClient.post", return_value=fake_response):
        r = client.post(
            "/api/auth/tidal/device-code/poll",
            json={"device_code": "DEVICE_XYZ"},
        )
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "success"
    assert body["has_mrt"] is False
    assert "mrms_session" in r.cookies

    # DB 검증
    with db_conn.cursor() as cur:
        cur.execute('SELECT id FROM "User" WHERE email = %s', ("tidal-12345@auto.local",))
        user_row = cur.fetchone()
        assert user_row is not None
        user_id = user_row[0]
        cur.execute('SELECT COUNT(*) FROM "AuthSession" WHERE "userId" = %s', (user_id,))
        assert cur.fetchone()[0] == 1
        cur.execute(
            'SELECT "accessToken" FROM "UserOAuth" WHERE "userId" = %s AND platform = %s',
            (user_id, "tidal"),
        )
        token_row = cur.fetchone()
        assert token_row is not None
        assert token_row[0] == jwt
    client.cookies.clear()


def test_device_code_poll_expired_returns_expired(db_conn):
    """Tidal이 expired_token → {status: expired}."""
    fake_response = AsyncMock()
    fake_response.status_code = 400
    fake_response.json = lambda: {"error": "expired_token"}
    with patch("httpx.AsyncClient.post", return_value=fake_response):
        r = client.post(
            "/api/auth/tidal/device-code/poll",
            json={"device_code": "DEVICE_XYZ"},
        )
    assert r.status_code == 200
    assert r.json()["status"] == "expired"


def test_me_returns_user_with_valid_session(db_conn):
    """/me는 session에서 user 정보 반환."""
    from mrms.db.user_track import get_or_create_user
    import uuid as _uuid

    user_id = get_or_create_user(db_conn, "me_test@example.com")
    session_id = _uuid.uuid4().hex
    expires_at = datetime.now(timezone.utc) + timedelta(days=30)
    with db_conn.cursor() as cur:
        cur.execute(
            'INSERT INTO "AuthSession" (id, "userId", "expiresAt") VALUES (%s, %s, %s)',
            (session_id, user_id, expires_at),
        )
    db_conn.commit()

    client.cookies.set("mrms_session", session_id)
    r = client.get("/api/auth/me")
    client.cookies.clear()
    assert r.status_code == 200
    assert r.json()["email"] == "me_test@example.com"


def test_me_returns_401_without_session(db_conn):
    """Cookie 없으면 401."""
    r = client.get("/api/auth/me")
    assert r.status_code == 401


def test_logout_deletes_session(db_conn):
    """/logout은 AuthSession 삭제 + cookie clear."""
    from mrms.db.user_track import get_or_create_user
    import uuid as _uuid

    user_id = get_or_create_user(db_conn, "logout_test@example.com")
    session_id = _uuid.uuid4().hex
    expires_at = datetime.now(timezone.utc) + timedelta(days=30)
    with db_conn.cursor() as cur:
        cur.execute(
            'INSERT INTO "AuthSession" (id, "userId", "expiresAt") VALUES (%s, %s, %s)',
            (session_id, user_id, expires_at),
        )
    db_conn.commit()

    client.cookies.set("mrms_session", session_id)
    r = client.post("/api/auth/logout")
    client.cookies.clear()
    assert r.status_code == 200

    with db_conn.cursor() as cur:
        cur.execute('SELECT COUNT(*) FROM "AuthSession" WHERE id = %s', (session_id,))
        assert cur.fetchone()[0] == 0


def test_me_response_includes_primary_platform(db_conn):
    """/me 응답에 primary_platform 필드 포함."""
    from mrms.db.user_track import get_or_create_user
    import uuid as _u

    user_id = get_or_create_user(db_conn, "primary_test@example.com")
    with db_conn.cursor() as cur:
        cur.execute(
            'UPDATE "User" SET "primaryPlatform" = %s WHERE id = %s',
            ("spotify", user_id),
        )
    session_id = _u.uuid4().hex
    expires = datetime.now(timezone.utc) + timedelta(days=30)
    with db_conn.cursor() as cur:
        cur.execute(
            'INSERT INTO "AuthSession" (id, "userId", "expiresAt") VALUES (%s, %s, %s)',
            (session_id, user_id, expires),
        )
    db_conn.commit()

    client.cookies.set("mrms_session", session_id)
    r = client.get("/api/auth/me")
    client.cookies.clear()
    assert r.status_code == 200
    body = r.json()
    assert body["primary_platform"] == "spotify"
