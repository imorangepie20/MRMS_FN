"""유효역할 계산 단위."""
import uuid

from mrms.auth.roles import get_effective_role


def _set_role(db_conn, user_id, role):
    with db_conn.cursor() as cur:
        cur.execute('UPDATE "User" SET role=%s WHERE id=%s', (role, user_id))
    db_conn.commit()


def test_env_root_is_superadmin(login, monkeypatch, db_conn, cleanup):
    email = f"root-{uuid.uuid4().hex[:8]}@test.com"
    user_id, _ = login(email)
    cleanup('DELETE FROM "User" WHERE id = %s', (user_id,))
    monkeypatch.setenv("ADMIN_EMAIL", email)
    # DB role은 default 'user'지만 env 루트라 superadmin
    assert get_effective_role(db_conn, user_id) == "superadmin"


def test_db_admin_role(login, monkeypatch, db_conn, cleanup):
    user_id, _ = login()
    cleanup('DELETE FROM "User" WHERE id = %s', (user_id,))
    monkeypatch.setenv("ADMIN_EMAIL", "someone-else@test.com")
    _set_role(db_conn, user_id, "admin")
    assert get_effective_role(db_conn, user_id) == "admin"


def test_default_user_role(login, monkeypatch, db_conn, cleanup):
    user_id, _ = login()
    cleanup('DELETE FROM "User" WHERE id = %s', (user_id,))
    monkeypatch.setenv("ADMIN_EMAIL", "someone-else@test.com")
    assert get_effective_role(db_conn, user_id) == "user"
