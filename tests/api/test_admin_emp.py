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
        body = r.json()
        assert isinstance(body["runs"], list)
        # 페이징 메타
        assert "total" in body
        assert body["limit"] == 5
        assert body["offset"] == 0
    finally:
        client.cookies.clear()


def test_admin_emp_run_delete_and_prune(login, monkeypatch, db_conn):
    """단건 삭제 + prune. running run은 삭제 거부."""
    from mrms.db.emp import create_run, finish_run

    admin_email = "admin_del_test@example.com"
    _, session_id = login(admin_email)
    monkeypatch.setenv("ADMIN_EMAIL", admin_email)
    client.cookies.set("mrms_session", session_id)

    # 완료된 run 1 + 진행중 run 1
    done_id = create_run(db_conn, platform="all", triggered_by="test_del")
    finish_run(db_conn, run_id=done_id, status="success")
    running_id = create_run(db_conn, platform="all", triggered_by="test_del")  # status='running'

    try:
        # 완료 run 삭제 OK
        r = client.request("DELETE", f"/api/admin/emp/runs/{done_id}")
        assert r.status_code == 200, r.text
        assert r.json()["deleted"] == done_id

        # 진행중 run 삭제 거부 (404)
        r2 = client.request("DELETE", f"/api/admin/emp/runs/{running_id}")
        assert r2.status_code == 404

        # 없는 run 삭제 404
        r3 = client.request("DELETE", "/api/admin/emp/runs/nope")
        assert r3.status_code == 404

        # prune (keep=0 방어 → 최소 1)
        r4 = client.post("/api/admin/emp/runs/prune", json={"keep": 1})
        assert r4.status_code == 200, r4.text
        assert "deleted" in r4.json()
    finally:
        client.cookies.clear()
        with db_conn.cursor() as cur:
            cur.execute('DELETE FROM "IngestionRun" WHERE "triggeredBy" = %s', ("test_del",))
        db_conn.commit()


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


def test_admin_emp_stats_forbidden_for_non_admin(login, monkeypatch):
    """ADMIN_EMAIL과 다른 이메일(일반 유저)은 EMP stats 403."""
    user_email = "plain_user_emp@example.com"
    _, session_id = login(user_email)
    monkeypatch.setenv("ADMIN_EMAIL", "different_admin@example.com")
    client.cookies.set("mrms_session", session_id)
    try:
        r = client.get("/api/admin/emp/stats")
        assert r.status_code == 403
    finally:
        client.cookies.clear()
