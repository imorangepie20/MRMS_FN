"""이메일/비밀번호 계정 DB ops. commit은 호출부 책임(get_or_create_user 패턴)."""
from __future__ import annotations

import psycopg

from mrms.db.ids import stable_id as _id


def create_account(
    conn: psycopg.Connection, *, nickname: str, email: str, password_hash: str
) -> str:
    """User insert(이메일은 소문자 정규화). displayName=nickname. user_id 반환.

    이메일/닉네임 중복 시 psycopg UniqueViolation 전파 — 호출부에서 사전 검증 권장.
    """
    email_norm = email.strip().lower()
    user_id = _id(f"user|{email_norm}")
    with conn.cursor() as cur:
        cur.execute(
            '''INSERT INTO "User"
                 (id, email, nickname, "passwordHash", "displayName", "createdAt")
               VALUES (%s, %s, %s, %s, %s, NOW())''',
            (user_id, email_norm, nickname, password_hash, nickname),
        )
    return user_id


def get_account_by_email(conn: psycopg.Connection, email: str) -> dict | None:
    """로그인용 — id/passwordHash/nickname 반환(이메일 대소문자 무시). 없으면 None."""
    with conn.cursor() as cur:
        cur.execute(
            'SELECT id, "passwordHash", nickname FROM "User" WHERE lower(email) = lower(%s)',
            (email.strip(),),
        )
        row = cur.fetchone()
    if row is None:
        return None
    return {"id": row[0], "password_hash": row[1], "nickname": row[2]}


def email_exists(conn: psycopg.Connection, email: str) -> bool:
    with conn.cursor() as cur:
        cur.execute('SELECT 1 FROM "User" WHERE lower(email) = lower(%s)', (email.strip(),))
        return cur.fetchone() is not None


def nickname_exists(conn: psycopg.Connection, nickname: str) -> bool:
    with conn.cursor() as cur:
        cur.execute('SELECT 1 FROM "User" WHERE lower(nickname) = lower(%s)', (nickname.strip(),))
        return cur.fetchone() is not None
