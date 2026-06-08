"""공통 pytest fixture."""
from __future__ import annotations

import os

import psycopg
import pytest
from dotenv import load_dotenv

load_dotenv()


@pytest.fixture
def db_conn():
    """로컬 PG 연결 + 트랜잭션 자동 롤백.

    각 테스트가 변경한 데이터는 RELEASE 안 됨.
    Track 등 기존 데이터 SELECT만 가능, INSERT/UPDATE는 함수 종료시 사라짐.
    """
    dsn = os.environ.get("DATABASE_URL", "postgresql://mrms:mrms@localhost:5433/mrms")
    with psycopg.connect(dsn, autocommit=False) as conn:
        yield conn
        conn.rollback()
