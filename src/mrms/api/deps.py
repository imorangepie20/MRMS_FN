"""FastAPI dependency providers — DB connection, settings."""
from __future__ import annotations

import os
from typing import Iterator

import psycopg
from dotenv import load_dotenv
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
