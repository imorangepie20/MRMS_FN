"""FastAPI endpoint 테스트 (TestClient)."""
import uuid as _uuid_helper
from datetime import datetime as _dt_helper, timedelta as _td_helper, timezone as _tz_helper

from fastapi.testclient import TestClient

from mrms.api.main import app


client = TestClient(app)


def _set_session_cookie(db_conn, email: str) -> str:
    """테스트용 — User 생성 + AuthSession + cookie set. user_id 반환."""
    from mrms.db.user_track import get_or_create_user
    user_id = get_or_create_user(db_conn, email)
    session_id = _uuid_helper.uuid4().hex
    expires_at = _dt_helper.now(_tz_helper.utc) + _td_helper(days=30)
    with db_conn.cursor() as cur:
        cur.execute(
            'INSERT INTO "AuthSession" (id, "userId", "expiresAt") VALUES (%s, %s, %s)',
            (session_id, user_id, expires_at),
        )
    db_conn.commit()
    client.cookies.set("mrms_session", session_id)
    return user_id


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_user_endpoint_returns_default_user(db_conn):
    """Session에서 user_id 추출 → 사용자 정보 반환."""
    from mrms.db import user_embedding as ue

    user_id = _set_session_cookie(db_conn, "test_api@example.com")
    # 3 personas
    import numpy as np
    rng = np.random.default_rng(99)
    for idx in range(3):
        v = rng.standard_normal(256).astype(np.float32)
        v /= np.linalg.norm(v)
        ue.upsert_user_persona(db_conn, user_id, idx, v, track_count=100)
    db_conn.commit()

    r = client.get("/api/user")
    client.cookies.clear()
    assert r.status_code == 200
    body = r.json()
    assert body["email"] == "test_api@example.com"
    assert body["personas_count"] == 3
    assert "user_id" in body
    assert "user_tracks_count" in body  # 0 이상


def test_mrt_latest_returns_personas_and_derives(db_conn):
    """MRT latest endpoint — 페르소나 + 추천 트랙/앨범 derive."""
    import numpy as np
    from mrms.db import user_embedding as ue

    user_id = _set_session_cookie(db_conn, "test_mrt@example.com")

    # 3 personas + 3 playlist history (각 persona 당 1)
    rng = np.random.default_rng(123)
    for idx in range(3):
        v = rng.standard_normal(256).astype(np.float32)
        v /= np.linalg.norm(v)
        ue.upsert_user_persona(db_conn, user_id, idx, v, track_count=50 + idx * 10)

    # 실제 Track id 3개 fetch (Tidal 가용한 것만 — _fetch_track_metadata가 INNER JOIN)
    with db_conn.cursor() as cur:
        cur.execute(
            '''SELECT DISTINCT t.id FROM "Track" t
               JOIN "TrackPlatform" tp ON tp."trackId" = t.id AND tp.platform = 'tidal'
               LIMIT 3'''
        )
        track_rows = cur.fetchall()
    if not track_rows or len(track_rows) < 3:
        import pytest
        client.cookies.clear()
        pytest.skip("Tidal Track 데이터 부족")

    track_ids = [r[0] for r in track_rows]
    for idx in range(3):
        ue.insert_playlist_history(
            db_conn, user_id,
            [track_ids[idx]], "our-v1.0+persona-K3",
            context={"personaIdx": idx, "kind": "persona", "scores": [0.9 - idx * 0.1]},
        )
    db_conn.commit()

    r = client.get("/api/mrt/latest")
    client.cookies.clear()
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


def test_mrt_latest_includes_tidal_track_id_and_filters(db_conn):
    """Tidal-only filter — Tidal 가용 트랙만 반환 + tidal_track_id 필드 포함."""
    import numpy as np
    from mrms.db import user_embedding as ue

    user_id = _set_session_cookie(db_conn, "tidal_filter@example.com")

    rng = np.random.default_rng(456)
    for idx in range(3):
        v = rng.standard_normal(256).astype(np.float32)
        v /= np.linalg.norm(v)
        ue.upsert_user_persona(db_conn, user_id, idx, v, track_count=50)

    # Tidal platform이 있는 트랙 ID 2개 + Tidal 없는 트랙 ID 1개 가져옴
    with db_conn.cursor() as cur:
        cur.execute('''
            SELECT DISTINCT t.id, tp."platformTrackId"
            FROM "Track" t
            JOIN "TrackPlatform" tp ON tp."trackId" = t.id AND tp.platform = 'tidal'
            LIMIT 2
        ''')
        tidal_rows = cur.fetchall()
        cur.execute('''
            SELECT t.id FROM "Track" t
            WHERE NOT EXISTS (
                SELECT 1 FROM "TrackPlatform" tp
                WHERE tp."trackId" = t.id AND tp.platform = 'tidal'
            )
            LIMIT 1
        ''')
        non_tidal_row = cur.fetchone()
    if not tidal_rows or len(tidal_rows) < 2 or not non_tidal_row:
        import pytest
        client.cookies.clear()
        pytest.skip("필요 데이터 부족 (Tidal 트랙 + non-Tidal 트랙)")

    tidal_ids = [r[0] for r in tidal_rows]
    tidal_platform_ids = [r[1] for r in tidal_rows]
    non_tidal_id = non_tidal_row[0]

    # 페르소나 0의 playlist에 Tidal+Non-Tidal 섞어서 넣음
    for idx in range(3):
        if idx == 0:
            track_ids_for_persona = [tidal_ids[0], non_tidal_id, tidal_ids[1]]
            scores = [0.9, 0.8, 0.7]
        else:
            track_ids_for_persona = [tidal_ids[0]]
            scores = [0.6]
        ue.insert_playlist_history(
            db_conn, user_id, track_ids_for_persona, "our-v1.0+persona-K3",
            context={"personaIdx": idx, "kind": "persona", "scores": scores},
        )
    db_conn.commit()

    r = client.get("/api/mrt/latest")
    client.cookies.clear()
    assert r.status_code == 200
    body = r.json()

    # 페르소나 0의 playlist에 non_tidal_id 제외됐는지
    persona_0 = next(p for p in body["personas"] if p["persona_idx"] == 0)
    playlist_ids = [t["track_id"] for t in persona_0["playlist"]]
    assert non_tidal_id not in playlist_ids, "non-Tidal 트랙이 필터링 안 됐음"

    # tidal_track_id 필드 채워져 있음
    assert all(t["tidal_track_id"] is not None for t in persona_0["playlist"])
    assert any(t["tidal_track_id"] == tidal_platform_ids[0] for t in persona_0["playlist"])

    # 추천 트랙도 모두 tidal_track_id 채워졌는지
    if body["recommended_tracks"]:
        assert all(t["tidal_track_id"] for t in body["recommended_tracks"])


def test_user_endpoint_includes_primary_platform(db_conn):
    """/api/user 응답에 primary_platform 필드 포함."""
    user_id = _set_session_cookie(db_conn, "primary_main@example.com")
    with db_conn.cursor() as cur:
        cur.execute(
            'UPDATE "User" SET "primaryPlatform" = %s WHERE id = %s',
            ("tidal", user_id),
        )
    db_conn.commit()
    r = client.get("/api/user")
    client.cookies.clear()
    assert r.status_code == 200
    assert r.json()["primary_platform"] == "tidal"
