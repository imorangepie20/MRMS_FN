"""Admin EMP API tests."""
from fastapi.testclient import TestClient

from mrms.api.main import app


client = TestClient(app)


def test_admin_emp_stats(login, monkeypatch):
    admin_email = "admin_emp_test@example.com"
    _, session_id = login(admin_email)
    monkeypatch.setenv("ADMIN_EMAIL", admin_email)
    client.cookies.set("mrms_session", session_id)
    try:
        r = client.get("/api/admin/emp/stats")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "total_tracks" in data
        assert "in_emp" in data
        assert "by_platform" in data
    finally:
        client.cookies.clear()


def test_admin_emp_runs_returns_list(login, monkeypatch):
    admin_email = "admin_runs_test@example.com"
    _, session_id = login(admin_email)
    monkeypatch.setenv("ADMIN_EMAIL", admin_email)
    client.cookies.set("mrms_session", session_id)
    try:
        r = client.get("/api/admin/emp/runs?limit=5")
        assert r.status_code == 200, r.text
        assert isinstance(r.json()["runs"], list)
    finally:
        client.cookies.clear()


def test_non_admin_returns_403(login, monkeypatch):
    _, session_id = login("regular_emp_test@example.com")
    monkeypatch.setenv("ADMIN_EMAIL", "actual_admin@example.com")
    client.cookies.set("mrms_session", session_id)
    try:
        r = client.get("/api/admin/emp/stats")
        assert r.status_code == 403
    finally:
        client.cookies.clear()


def test_no_auth_returns_401():
    client.cookies.clear()
    r = client.get("/api/admin/emp/stats")
    assert r.status_code == 401


def test_admin_settings_get(login, monkeypatch):
    admin_email = "admin_settings_get@example.com"
    _, session_id = login(admin_email)
    monkeypatch.setenv("ADMIN_EMAIL", admin_email)
    client.cookies.set("mrms_session", session_id)
    try:
        r = client.get("/api/admin/emp/settings")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "settings" in data
        assert "tidal_x_token" in data["settings"]
        assert data["settings"]["tidal_x_token"]["present"] in (True, False)
    finally:
        client.cookies.clear()


def test_admin_settings_put_and_mask(login, monkeypatch):
    admin_email = "admin_settings_put@example.com"
    _, session_id = login(admin_email)
    monkeypatch.setenv("ADMIN_EMAIL", admin_email)
    client.cookies.set("mrms_session", session_id)
    try:
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
    finally:
        client.cookies.clear()


def test_admin_settings_disallowed_key(login, monkeypatch):
    admin_email = "admin_settings_bad@example.com"
    _, session_id = login(admin_email)
    monkeypatch.setenv("ADMIN_EMAIL", admin_email)
    client.cookies.set("mrms_session", session_id)
    try:
        r = client.put(
            "/api/admin/emp/settings",
            json={"key": "evil_key", "value": "x"},
        )
        assert r.status_code == 400
    finally:
        client.cookies.clear()
