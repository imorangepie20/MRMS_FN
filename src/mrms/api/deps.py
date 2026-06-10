"""FastAPI dependency providers — DB connection pool, settings."""
from __future__ import annotations

import os
import threading
from datetime import datetime, timezone
from typing import Iterator

import psycopg
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, Request
from pgvector.psycopg import register_vector
from psycopg_pool import ConnectionPool


load_dotenv(override=True)


def get_dsn() -> str:
    return os.environ.get("DATABASE_URL", "postgresql://mrms:mrms@localhost:5433/mrms")


def get_default_user_email() -> str:
    email = os.environ.get("DEFAULT_USER_EMAIL")
    if not email:
        raise RuntimeError("DEFAULT_USER_EMAIL 환경변수 필수")
    return email


def _configure_conn(conn: psycopg.Connection) -> None:
    """풀에서 connection 생성 시 1회 — pgvector 타입 등록."""
    register_vector(conn)
    conn.autocommit = False


_pool: ConnectionPool | None = None
_pool_lock = threading.Lock()


def get_pool() -> ConnectionPool:
    """프로세스당 1개 lazy 생성. DSN 변경 (테스트의 monkeypatch 등) 시 재생성."""
    global _pool
    dsn = get_dsn()
    with _pool_lock:
        if _pool is None or _pool.conninfo != dsn:
            if _pool is not None:
                _pool.close()
            _pool = ConnectionPool(
                dsn,
                min_size=1,
                max_size=10,
                configure=_configure_conn,
                open=True,
            )
        return _pool


def db_conn() -> Iterator[psycopg.Connection]:
    """FastAPI Depends — 풀에서 connection 대여 (요청 끝나면 반환)."""
    with get_pool().connection() as conn:
        yield conn
        # 반환 전 정리: 커밋 안 된 트랜잭션은 rollback (pool이 기본 수행하지만 명시)
        if conn.info.transaction_status != psycopg.pq.TransactionStatus.IDLE:
            conn.rollback()


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
