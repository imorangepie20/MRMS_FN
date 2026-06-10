"""api 테스트 공통 fixture."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest

from mrms.db.user_track import get_or_create_user


@pytest.fixture
def login(db_conn):
    """User + AuthSession 생성 factory. (user_id, session_id) 반환.

    email 생략 시 per-test 고유 email 자동 생성.
    """
    def _make(email: str | None = None) -> tuple[str, str]:
        email = email or f"t-{uuid.uuid4().hex[:8]}@test.com"
        user_id = get_or_create_user(db_conn, email)
        session_id = uuid.uuid4().hex
        expires_at = datetime.now(timezone.utc) + timedelta(days=30)
        with db_conn.cursor() as cur:
            cur.execute(
                'INSERT INTO "AuthSession" (id, "userId", "expiresAt") VALUES (%s, %s, %s)',
                (session_id, user_id, expires_at),
            )
        db_conn.commit()
        return user_id, session_id

    return _make
