"""공통 pytest fixture."""
from __future__ import annotations

import os

import psycopg
import pytest
from dotenv import load_dotenv

load_dotenv()


@pytest.fixture
def db_conn():
    """로컬 PG 연결. 커밋 안 된 변경은 함수 종료시 롤백.

    단, mrms.db.* / mrms.emp.base 헬퍼는 내부에서 conn.commit()을 호출하므로
    그 경로로 들어간 데이터는 롤백 보호가 안 됨 — 그런 테스트는 명시적
    cleanup 필요 (cleanup fixture 참고).
    """
    dsn = os.environ.get("DATABASE_URL", "postgresql://mrms:mrms@localhost:5433/mrms")
    with psycopg.connect(dsn, autocommit=False) as conn:
        yield conn
        conn.rollback()


@pytest.fixture
def cleanup(db_conn):
    """실패-안전 cleanup — DELETE문을 등록하면 teardown에서 역순 실행 + commit.

    헬퍼들이 내부 commit하는 탓에 assert 실패 시 테스트 본문 끝의 인라인
    cleanup이 실행되지 않아 잔여 데이터가 영구히 남던 문제 방지.

    사용: cleanup('DELETE FROM "Track" WHERE isrc = %s', (fake_isrc,))
    """
    stmts: list[tuple[str, tuple]] = []

    def _register(sql: str, params: tuple = ()) -> None:
        stmts.append((sql, params))

    yield _register

    if stmts:
        db_conn.rollback()  # 실패한 statement가 트랜잭션을 abort했어도 cleanup은 수행
        failed: list[str] = []
        for sql, params in reversed(stmts):
            # statement별 독립 실행 — 하나가 FK 등으로 실패해도 나머지는 정리
            try:
                with db_conn.cursor() as cur:
                    cur.execute(sql, params)
                db_conn.commit()
            except Exception as e:
                db_conn.rollback()
                failed.append(f"{sql} — {type(e).__name__}")
        if failed:
            pytest.fail(
                "cleanup 일부 실패 (테스트 DB 잔여물 가능):\n  " + "\n  ".join(failed),
                pytrace=False,
            )
