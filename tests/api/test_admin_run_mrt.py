"""Admin run-mrt — 특정/전체 추천 강제 재생성."""
import uuid as _uuid
from unittest.mock import MagicMock

from fastapi.testclient import TestClient

import mrms.api.admin_emp as _admin
from mrms.api.main import app
from mrms.db.user_track import get_or_create_user

client = TestClient(app)


def _login_admin(login, monkeypatch):
    admin_email = f"admin-{_uuid.uuid4().hex[:8]}@example.com"
    _, session_id = login(admin_email)
    monkeypatch.setenv("ADMIN_EMAIL", admin_email)
    client.cookies.set("mrms_session", session_id)
    return admin_email


def test_run_mrt_user_success(login, monkeypatch, db_conn, cleanup):
    _login_admin(login, monkeypatch)
    target_email = f"target-{_uuid.uuid4().hex[:8]}@example.com"
    get_or_create_user(db_conn, target_email)
    db_conn.commit()
    cleanup('DELETE FROM "User" WHERE email = %s', (target_email,))
    # 함수-로컬 import되는 심볼을 소스 모듈에서 패치 (호출 시 모듈 속성 재참조됨)
    monkeypatch.setattr("mrms.recsys.mrt.generate_user_mrt", lambda c, u, **k: 7)
    monkeypatch.setattr("mrms.recsys.discover.read_discovery", lambda c, u, **k: [{}, {}])
    monkeypatch.setattr("mrms.db.user_embedding.prune_playlist_history", lambda *a, **k: 0)
    monkeypatch.setattr("mrms.db.user_blocked.clear_dismissed", lambda *a, **k: 0)
    try:
        r = client.post("/api/admin/emp/run-mrt", json={"target": "user", "email": target_email})
        assert r.status_code == 200, r.text
        assert r.json() == {
            "mode": "user", "regenerated": True, "tracks_used": 7, "discovery_count": 2,
        }
    finally:
        client.cookies.clear()


def test_run_mrt_user_insufficient_tracks(login, monkeypatch, db_conn, cleanup):
    _login_admin(login, monkeypatch)
    target_email = f"target-{_uuid.uuid4().hex[:8]}@example.com"
    get_or_create_user(db_conn, target_email)
    db_conn.commit()
    cleanup('DELETE FROM "User" WHERE email = %s', (target_email,))
    monkeypatch.setattr("mrms.recsys.mrt.generate_user_mrt", lambda c, u, **k: None)
    try:
        r = client.post("/api/admin/emp/run-mrt", json={"target": "user", "email": target_email})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["mode"] == "user" and d["regenerated"] is False and "reason" in d
    finally:
        client.cookies.clear()


def test_run_mrt_user_not_found(login, monkeypatch):
    _login_admin(login, monkeypatch)
    try:
        r = client.post(
            "/api/admin/emp/run-mrt",
            json={"target": "user", "email": "nobody-xyz@example.com"},
        )
        assert r.status_code == 404
    finally:
        client.cookies.clear()


def test_run_mrt_user_email_required(login, monkeypatch):
    _login_admin(login, monkeypatch)
    try:
        r = client.post("/api/admin/emp/run-mrt", json={"target": "user"})
        assert r.status_code == 400
    finally:
        client.cookies.clear()


def test_run_mrt_all_queues_background(login, monkeypatch):
    _login_admin(login, monkeypatch)
    # 백그라운드 실제 실행 차단 (TestClient는 BackgroundTasks를 동기 실행) — 호출만 확인
    fake = MagicMock()
    monkeypatch.setattr(_admin, "_regenerate_all_mrt", fake)
    try:
        r = client.post("/api/admin/emp/run-mrt", json={"target": "all"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["mode"] == "all" and isinstance(d["queued"], int)
        assert fake.called  # 백그라운드 등록·실행됨
    finally:
        client.cookies.clear()


def test_run_mrt_requires_admin(login, monkeypatch):
    # admin 아님: ADMIN_EMAIL을 다른 값으로
    _, session_id = login(f"notadmin-{_uuid.uuid4().hex[:8]}@example.com")
    monkeypatch.setenv("ADMIN_EMAIL", "someone-else@example.com")
    client.cookies.set("mrms_session", session_id)
    try:
        r = client.post("/api/admin/emp/run-mrt", json={"target": "all"})
        assert r.status_code == 403
    finally:
        client.cookies.clear()
