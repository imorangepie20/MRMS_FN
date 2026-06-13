"""PGT 섹션 API 테스트."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from mrms.api.main import app

client = TestClient(app)


@pytest.fixture
def set_session_cookie(login):
    """공용 login + cookie set factory. user_id 반환."""
    def _make(email: str) -> str:
        user_id, session_id = login(email)
        client.cookies.set("mrms_session", session_id)
        return user_id

    return _make


def test_pgt_sections_endpoint(db_conn, set_session_cookie):
    """GET /api/pgt/sections — 인증된 유저가 6개 키 응답 받는지 확인."""
    set_session_cookie("pgt-api@test.com")
    r = client.get("/api/pgt/sections")
    client.cookies.clear()
    assert r.status_code == 200
    body = r.json()
    for key in ("liked", "pct", "albums", "artists", "imported_playlists", "user_playlists"):
        assert key in body
