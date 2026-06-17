"""회원·역할 관리 API — superadmin 전용."""
import uuid

from fastapi.testclient import TestClient

from mrms.api.main import app

client = TestClient(app)


def _su(login, monkeypatch, cleanup):
    """superadmin(env 루트) 세션 준비. (user_id, session_id, email) 반환."""
    email = f"su-{uuid.uuid4().hex[:8]}@test.com"
    uid, sid = login(email)
    cleanup('DELETE FROM "User" WHERE id = %s', (uid,))
    monkeypatch.setenv("ADMIN_EMAIL", email)
    return uid, sid, email


def test_list_users_superadmin_ok(login, monkeypatch, cleanup):
    _, sid, _ = _su(login, monkeypatch, cleanup)
    tgt, _ = login(f"tgt-{uuid.uuid4().hex[:8]}@test.com")
    cleanup('DELETE FROM "User" WHERE id = %s', (tgt,))
    client.cookies.set("mrms_session", sid)
    try:
        r = client.get("/api/admin/users")
        assert r.status_code == 200, r.text
        ids = [u["user_id"] for u in r.json()["users"]]
        assert tgt in ids
    finally:
        client.cookies.clear()


def test_list_users_forbidden_for_admin(login, monkeypatch, cleanup, db_conn):
    """DB role 'admin'(env 루트 아님)은 회원관리 403."""
    monkeypatch.setenv("ADMIN_EMAIL", "root_only@test.com")
    uid, sid = login(f"adm-{uuid.uuid4().hex[:8]}@test.com")
    cleanup('DELETE FROM "User" WHERE id = %s', (uid,))
    with db_conn.cursor() as cur:
        cur.execute('UPDATE "User" SET role=%s WHERE id=%s', ("admin", uid))
    db_conn.commit()
    client.cookies.set("mrms_session", sid)
    try:
        assert client.get("/api/admin/users").status_code == 403
    finally:
        client.cookies.clear()


def test_set_role_promote_and_demote(login, monkeypatch, cleanup, db_conn):
    _, sid, _ = _su(login, monkeypatch, cleanup)
    tgt, _ = login(f"tgt2-{uuid.uuid4().hex[:8]}@test.com")
    cleanup('DELETE FROM "User" WHERE id = %s', (tgt,))
    client.cookies.set("mrms_session", sid)
    try:
        r = client.patch(f"/api/admin/users/{tgt}/role", json={"role": "admin"})
        assert r.status_code == 200, r.text
        with db_conn.cursor() as cur:
            cur.execute('SELECT role FROM "User" WHERE id=%s', (tgt,))
            assert cur.fetchone()[0] == "admin"
        r2 = client.patch(f"/api/admin/users/{tgt}/role", json={"role": "user"})
        assert r2.status_code == 200
        with db_conn.cursor() as cur:
            cur.execute('SELECT role FROM "User" WHERE id=%s', (tgt,))
            assert cur.fetchone()[0] == "user"
    finally:
        client.cookies.clear()


def test_set_role_forbidden_for_non_superadmin(login, monkeypatch, cleanup):
    monkeypatch.setenv("ADMIN_EMAIL", "root_only2@test.com")
    uid, sid = login(f"u-{uuid.uuid4().hex[:8]}@test.com")
    cleanup('DELETE FROM "User" WHERE id = %s', (uid,))
    tgt, _ = login(f"t-{uuid.uuid4().hex[:8]}@test.com")
    cleanup('DELETE FROM "User" WHERE id = %s', (tgt,))
    client.cookies.set("mrms_session", sid)
    try:
        assert client.patch(f"/api/admin/users/{tgt}/role", json={"role": "admin"}).status_code == 403
    finally:
        client.cookies.clear()


def test_set_role_rejects_superadmin_value(login, monkeypatch, cleanup):
    _, sid, _ = _su(login, monkeypatch, cleanup)
    tgt, _ = login(f"t3-{uuid.uuid4().hex[:8]}@test.com")
    cleanup('DELETE FROM "User" WHERE id = %s', (tgt,))
    client.cookies.set("mrms_session", sid)
    try:
        assert client.patch(f"/api/admin/users/{tgt}/role", json={"role": "superadmin"}).status_code == 422
    finally:
        client.cookies.clear()


def test_set_role_cannot_change_root(login, monkeypatch, cleanup):
    root_uid, sid, _ = _su(login, monkeypatch, cleanup)
    client.cookies.set("mrms_session", sid)
    try:
        # env 루트 자신을 강등 시도 → 403
        assert client.patch(f"/api/admin/users/{root_uid}/role", json={"role": "user"}).status_code == 403
    finally:
        client.cookies.clear()


def test_set_role_unknown_user_404(login, monkeypatch, cleanup):
    _, sid, _ = _su(login, monkeypatch, cleanup)
    client.cookies.set("mrms_session", sid)
    try:
        assert client.patch("/api/admin/users/nope/role", json={"role": "admin"}).status_code == 404
    finally:
        client.cookies.clear()
