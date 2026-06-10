"""Admin EMP API tests."""
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from mrms.api.main import app
from mrms.db.user_track import get_or_create_user


client = TestClient(app)


def _login(db_conn, email: str) -> str:
    """Create (or reuse) user + insert a valid session. Returns session_id."""
    user_id = get_or_create_user(db_conn, email)
    session_id = uuid.uuid4().hex
    expires_at = datetime.now(timezone.utc) + timedelta(days=30)
    with db_conn.cursor() as cur:
        cur.execute(
            'INSERT INTO "AuthSession" (id, "userId", "expiresAt") VALUES (%s, %s, %s)',
            (session_id, user_id, expires_at),
        )
    db_conn.commit()
    return session_id


def test_admin_emp_stats(db_conn, monkeypatch):
    admin_email = "admin_emp_test@example.com"
    session_id = _login(db_conn, admin_email)
    monkeypatch.setenv("ADMIN_EMAIL", admin_email)
    client.cookies.set("mrms_session", session_id)
    r = client.get("/api/admin/emp/stats")
    assert r.status_code == 200, r.text
    data = r.json()
    assert "total_tracks" in data
    assert "in_emp" in data
    assert "by_platform" in data
    client.cookies.clear()


def test_admin_emp_runs_returns_list(db_conn, monkeypatch):
    admin_email = "admin_runs_test@example.com"
    session_id = _login(db_conn, admin_email)
    monkeypatch.setenv("ADMIN_EMAIL", admin_email)
    client.cookies.set("mrms_session", session_id)
    r = client.get("/api/admin/emp/runs?limit=5")
    assert r.status_code == 200, r.text
    assert isinstance(r.json()["runs"], list)
    client.cookies.clear()


def test_non_admin_returns_403(db_conn, monkeypatch):
    non_admin_email = "regular_emp_test@example.com"
    session_id = _login(db_conn, non_admin_email)
    monkeypatch.setenv("ADMIN_EMAIL", "actual_admin@example.com")
    client.cookies.set("mrms_session", session_id)
    r = client.get("/api/admin/emp/stats")
    assert r.status_code == 403
    client.cookies.clear()


def test_no_auth_returns_401():
    client.cookies.clear()
    r = client.get("/api/admin/emp/stats")
    assert r.status_code == 401


def test_admin_settings_get(db_conn, monkeypatch):
    admin_email = "admin_settings_get@example.com"
    session_id = _login(db_conn, admin_email)
    monkeypatch.setenv("ADMIN_EMAIL", admin_email)
    client.cookies.set("mrms_session", session_id)

    r = client.get("/api/admin/emp/settings")
    assert r.status_code == 200, r.text
    data = r.json()
    assert "settings" in data
    assert "tidal_x_token" in data["settings"]
    assert data["settings"]["tidal_x_token"]["present"] in (True, False)
    client.cookies.clear()


def test_admin_settings_put_and_mask(db_conn, monkeypatch):
    admin_email = "admin_settings_put@example.com"
    session_id = _login(db_conn, admin_email)
    monkeypatch.setenv("ADMIN_EMAIL", admin_email)
    client.cookies.set("mrms_session", session_id)

    r = client.put(
        "/api/admin/emp/settings",
        json={"key": "tidal_x_token", "value": "abc1234567890XYZ"},
    )
    assert r.status_code == 200, r.text

    r2 = client.get("/api/admin/emp/settings")
    assert r2.status_code == 200
    s = r2.json()["settings"]["tidal_x_token"]
    assert s["present"] is True
    assert s["preview"] == "…0XYZ"

    # cleanup
    client.put("/api/admin/emp/settings", json={"key": "tidal_x_token", "value": None})
    client.cookies.clear()


def test_admin_settings_disallowed_key(db_conn, monkeypatch):
    admin_email = "admin_settings_bad@example.com"
    session_id = _login(db_conn, admin_email)
    monkeypatch.setenv("ADMIN_EMAIL", admin_email)
    client.cookies.set("mrms_session", session_id)

    r = client.put(
        "/api/admin/emp/settings",
        json={"key": "evil_key", "value": "x"},
    )
    assert r.status_code == 400
    client.cookies.clear()
