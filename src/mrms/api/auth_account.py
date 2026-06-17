"""이메일/비밀번호 계정 — signup/login. 세션은 기존 AuthSession 쿠키 재사용."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import psycopg
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr, Field

from mrms.api.deps import db_conn
from mrms.auth.password import hash_password, verify_password
from mrms.db.account import (
    create_account,
    email_exists,
    get_account_by_email,
    nickname_exists,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

SESSION_COOKIE_NAME = "mrms_session"
SESSION_MAX_AGE = 30 * 24 * 60 * 60  # 30 days


class SignupRequest(BaseModel):
    nickname: str = Field(min_length=2, max_length=20)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


def _issue_session(
    conn: psycopg.Connection, response: Response, request: Request, user_id: str
) -> None:
    """AuthSession 1개 생성(기존 세션 삭제) + mrms_session 쿠키 set."""
    session_id = uuid.uuid4().hex
    expires = datetime.now(timezone.utc) + timedelta(seconds=SESSION_MAX_AGE)
    with conn.cursor() as cur:
        cur.execute('DELETE FROM "AuthSession" WHERE "userId" = %s', (user_id,))
        cur.execute(
            'INSERT INTO "AuthSession" (id, "userId", "expiresAt", "userAgent") '
            'VALUES (%s, %s, %s, %s)',
            (session_id, user_id, expires, request.headers.get("user-agent")),
        )
    conn.commit()
    response.set_cookie(
        key=SESSION_COOKIE_NAME, value=session_id, httponly=True,
        samesite="lax", max_age=SESSION_MAX_AGE, secure=False,  # prod는 True
    )


@router.post("/signup")
def signup(
    body: SignupRequest, request: Request, response: Response,
    conn: psycopg.Connection = Depends(db_conn),
) -> dict:
    """닉네임/이메일/비밀번호로 계정 생성 + 세션. 중복은 409."""
    if email_exists(conn, body.email):
        raise HTTPException(409, "email_taken")
    if nickname_exists(conn, body.nickname):
        raise HTTPException(409, "nickname_taken")
    user_id = create_account(
        conn, nickname=body.nickname.strip(), email=body.email,
        password_hash=hash_password(body.password),
    )
    conn.commit()
    _issue_session(conn, response, request, user_id)
    return {"user_id": user_id, "nickname": body.nickname.strip(), "email": str(body.email).lower()}


@router.post("/login")
def login(
    body: LoginRequest, request: Request, response: Response,
    conn: psycopg.Connection = Depends(db_conn),
) -> dict:
    """이메일+비밀번호 검증 → 세션. 실패는 401(이메일 존재 여부 비노출)."""
    acct = get_account_by_email(conn, body.email)
    if (
        not acct
        or not acct["password_hash"]
        or not verify_password(body.password, acct["password_hash"])
    ):
        raise HTTPException(401, "invalid_credentials")
    _issue_session(conn, response, request, acct["id"])
    return {"user_id": acct["id"], "nickname": acct["nickname"], "email": str(body.email).lower()}
