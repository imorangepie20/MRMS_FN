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


def test_mrt_latest_returns_personas_and_derives(db_conn, monkeypatch):
    """MRT latest endpoint — 페르소나 + 추천 트랙/앨범 derive."""
    import os
    import numpy as np
    from mrms.db.user_track import get_or_create_user
    from mrms.db import user_embedding as ue

    monkeypatch.setenv("DEFAULT_USER_EMAIL", "test_mrt@example.com")
    user_id = get_or_create_user(db_conn, "test_mrt@example.com")
    db_conn.commit()

    # 3 personas + 3 playlist history (각 persona 당 1)
    rng = np.random.default_rng(123)
    for idx in range(3):
        v = rng.standard_normal(256).astype(np.float32)
        v /= np.linalg.norm(v)
        ue.upsert_user_persona(db_conn, user_id, idx, v, track_count=50 + idx * 10)

    # 실제 Track id 3개 fetch
    with db_conn.cursor() as cur:
        cur.execute('SELECT id FROM "Track" LIMIT 3')
        track_rows = cur.fetchall()
    if not track_rows or len(track_rows) < 3:
        import pytest
        pytest.skip("Track 데이터 부족")

    track_ids = [r[0] for r in track_rows]
    for idx in range(3):
        ue.insert_playlist_history(
            db_conn, user_id,
            [track_ids[idx]], "our-v1.0+persona-K3",
            context={"personaIdx": idx, "kind": "persona", "scores": [0.9 - idx * 0.1]},
        )
    db_conn.commit()

    r = client.get("/api/mrt/latest")
    assert r.status_code == 200
    body = r.json()
    assert body["model_version"] == "our-v1.0+persona-K3"
    assert len(body["personas"]) == 3
    assert len(body["recommended_tracks"]) >= 1
    # personas 정렬 by persona_idx
    idxs = [p["persona_idx"] for p in body["personas"]]
    assert idxs == sorted(idxs)
    # 페르소나 playlist 트랙 메타 채워짐
    assert "title" in body["personas"][0]["playlist"][0]
    assert "artist" in body["personas"][0]["playlist"][0]
