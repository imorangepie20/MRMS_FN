"""FastAPI endpoint 테스트 (TestClient)."""
from fastapi.testclient import TestClient

from mrms.api.main import app


client = TestClient(app)


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_user_endpoint_returns_default_user(db_conn, monkeypatch):
    """DEFAULT_USER_EMAIL 환경변수의 사용자 정보 반환."""
    import os
    from mrms.db.user_track import get_or_create_user
    from mrms.db import user_embedding as ue

    monkeypatch.setenv("DEFAULT_USER_EMAIL", "test_api@example.com")
    user_id = get_or_create_user(db_conn, "test_api@example.com")
    db_conn.commit()
    # 3 personas
    import numpy as np
    rng = np.random.default_rng(99)
    for idx in range(3):
        v = rng.standard_normal(256).astype(np.float32)
        v /= np.linalg.norm(v)
        ue.upsert_user_persona(db_conn, user_id, idx, v, track_count=100)
    db_conn.commit()

    r = client.get("/api/user")
    assert r.status_code == 200
    body = r.json()
    assert body["email"] == "test_api@example.com"
    assert body["personas_count"] == 3
    assert "user_id" in body
    assert "user_tracks_count" in body  # 0 이상
