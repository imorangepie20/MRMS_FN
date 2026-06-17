"""계정 헬퍼 + signup/login 엔드포인트."""
import uuid

from mrms.db.account import (
    create_account, get_account_by_email, email_exists, nickname_exists,
)
from mrms.auth.password import hash_password


def _email():
    return f"acct-{uuid.uuid4().hex[:10]}@example.com"


def test_create_account_then_lookup(db_conn, cleanup):
    email = _email()
    cleanup('DELETE FROM "User" WHERE email = %s', (email,))
    uid = create_account(
        db_conn, nickname=f"nick_{uuid.uuid4().hex[:6]}",
        email=email, password_hash=hash_password("pw12345678"),
    )
    db_conn.commit()
    row = get_account_by_email(db_conn, email)
    assert row is not None
    assert row["id"] == uid
    assert row["password_hash"] is not None
    # displayName == nickname
    with db_conn.cursor() as cur:
        cur.execute('SELECT "displayName", nickname FROM "User" WHERE id=%s', (uid,))
        display, nick = cur.fetchone()
    assert display == nick


def test_email_and_nickname_exists_case_insensitive(db_conn, cleanup):
    email = _email()
    nick = f"Case_{uuid.uuid4().hex[:6]}"
    cleanup('DELETE FROM "User" WHERE email = %s', (email,))
    create_account(db_conn, nickname=nick, email=email,
                   password_hash=hash_password("pw12345678"))
    db_conn.commit()
    assert email_exists(db_conn, email.upper()) is True
    assert nickname_exists(db_conn, nick.upper()) is True
    assert email_exists(db_conn, _email()) is False
    assert nickname_exists(db_conn, f"absent_{uuid.uuid4().hex[:6]}") is False


def test_get_account_by_email_missing_returns_none(db_conn):
    assert get_account_by_email(db_conn, _email()) is None


from fastapi.testclient import TestClient
from mrms.api.main import app

client = TestClient(app)


def test_signup_success_sets_session_and_hashes(db_conn, cleanup):
    email = _email()
    nick = f"signup_{uuid.uuid4().hex[:6]}"
    cleanup('DELETE FROM "User" WHERE email = %s', (email.lower(),))
    client.cookies.clear()
    r = client.post("/api/auth/signup",
                    json={"nickname": nick, "email": email, "password": "pw12345678"})
    client.cookies.clear()
    assert r.status_code == 200, r.text
    assert r.json()["nickname"] == nick
    assert "mrms_session" in r.cookies
    with db_conn.cursor() as cur:
        cur.execute('SELECT "passwordHash" FROM "User" WHERE lower(email)=lower(%s)', (email,))
        ph = cur.fetchone()[0]
    assert ph and ph != "pw12345678"          # 해시됨


def test_signup_duplicate_email_409(db_conn, cleanup):
    email = _email()
    cleanup('DELETE FROM "User" WHERE email = %s', (email.lower(),))
    create_account(db_conn, nickname=f"e_{uuid.uuid4().hex[:6]}", email=email,
                   password_hash=hash_password("pw12345678"))
    db_conn.commit()
    client.cookies.clear()
    r = client.post("/api/auth/signup",
                    json={"nickname": f"new_{uuid.uuid4().hex[:6]}",
                          "email": email, "password": "pw12345678"})
    assert r.status_code == 409
    assert r.json()["detail"] == "email_taken"


def test_signup_duplicate_nickname_409_case_insensitive(db_conn, cleanup):
    nick = f"Dup_{uuid.uuid4().hex[:6]}"
    email1 = _email()
    cleanup('DELETE FROM "User" WHERE email = %s', (email1.lower(),))
    create_account(db_conn, nickname=nick, email=email1,
                   password_hash=hash_password("pw12345678"))
    db_conn.commit()
    client.cookies.clear()
    r = client.post("/api/auth/signup",
                    json={"nickname": nick.upper(), "email": _email(),
                          "password": "pw12345678"})
    assert r.status_code == 409
    assert r.json()["detail"] == "nickname_taken"


def test_signup_weak_password_422():
    client.cookies.clear()
    r = client.post("/api/auth/signup",
                    json={"nickname": f"w_{uuid.uuid4().hex[:6]}",
                          "email": _email(), "password": "short"})
    assert r.status_code == 422


def test_login_success(db_conn, cleanup):
    email = _email()
    cleanup('DELETE FROM "User" WHERE email = %s', (email.lower(),))
    create_account(db_conn, nickname=f"l_{uuid.uuid4().hex[:6]}", email=email,
                   password_hash=hash_password("pw12345678"))
    db_conn.commit()
    client.cookies.clear()
    r = client.post("/api/auth/login", json={"email": email, "password": "pw12345678"})
    client.cookies.clear()
    assert r.status_code == 200, r.text
    assert "mrms_session" in r.cookies


def test_login_wrong_password_401(db_conn, cleanup):
    email = _email()
    cleanup('DELETE FROM "User" WHERE email = %s', (email.lower(),))
    create_account(db_conn, nickname=f"lw_{uuid.uuid4().hex[:6]}", email=email,
                   password_hash=hash_password("pw12345678"))
    db_conn.commit()
    client.cookies.clear()
    r = client.post("/api/auth/login", json={"email": email, "password": "WRONG"})
    assert r.status_code == 401
    assert r.json()["detail"] == "invalid_credentials"


def test_login_unknown_email_401():
    client.cookies.clear()
    r = client.post("/api/auth/login", json={"email": _email(), "password": "whatever12"})
    assert r.status_code == 401
    assert r.json()["detail"] == "invalid_credentials"
