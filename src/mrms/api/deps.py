"""FastAPI dependency providers — DB connection, settings."""
from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Iterator

import psycopg
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, Request
from pgvector.psycopg import register_vector


load_dotenv(override=True)


def get_dsn() -> str:
    return os.environ.get("DATABASE_URL", "postgresql://mrms:mrms@localhost:5433/mrms")


def get_default_user_email() -> str:
    email = os.environ.get("DEFAULT_USER_EMAIL")
    if not email:
        raise RuntimeError("DEFAULT_USER_EMAIL 환경변수 필수")
    return email


def db_conn() -> Iterator[psycopg.Connection]:
    """FastAPI Depends — 요청당 connection."""
    with psycopg.connect(get_dsn(), autocommit=False) as conn:
        register_vector(conn)
        yield conn


def get_current_user_id(
    request: Request,
    conn: psycopg.Connection = Depends(db_conn),
) -> str:
    """Cookie 기반 session에서 user_id 추출. 미인증/만료 시 401."""
    session_id = request.cookies.get("mrms_session")
    if not session_id:
        raise HTTPException(401, "Not authenticated")

    with conn.cursor() as cur:
        cur.execute(
            'SELECT "userId", "expiresAt" FROM "AuthSession" WHERE id = %s',
            (session_id,),
        )
        row = cur.fetchone()
    if not row:
        raise HTTPException(401, "Invalid session")

    user_id, expires_at = row
    if expires_at is not None:
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < datetime.now(timezone.utc):
            raise HTTPException(401, "Session expired")
    return user_id
