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
