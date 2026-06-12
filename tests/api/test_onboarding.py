"""Onboarding API 테스트."""
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from mrms.api.main import app


client = TestClient(app)


def _setup_session(db_conn, email: str) -> str:
    from mrms.db.user_track import get_or_create_user
    import uuid as _u
    user_id = get_or_create_user(db_conn, email)
    session_id = _u.uuid4().hex
    expires = datetime.now(timezone.utc) + timedelta(days=30)
    with db_conn.cursor() as cur:
        cur.execute(
            'INSERT INTO "AuthSession" (id, "userId", "expiresAt") VALUES (%s, %s, %s)',
            (session_id, user_id, expires),
        )
    db_conn.commit()
    client.cookies.set("mrms_session", session_id)
    return user_id


def test_status_returns_idle_initially(db_conn):
    """init 전 status는 idle."""
    user_id = _setup_session(db_conn, "ob_status@example.com")
    # 이전 테스트에서 다른 user_id로 쌓였을 수 있으니 — store reset
    from mrms.onboarding.status import reset_status
    reset_status(user_id)
    r = client.get("/api/onboarding/status")
    client.cookies.clear()
    assert r.status_code == 200
    body = r.json()
    assert body["step"] == "idle"
    assert body["progress"] == 0


def test_status_returns_401_without_session(db_conn):
    """Cookie 없으면 401."""
    r = client.get("/api/onboarding/status")
    assert r.status_code == 401


def test_start_returns_ok_and_idempotent(db_conn):
    """start 호출 → ok. 두 번 불러도 idempotent (이미 진행 중이면 무시)."""
    user_id = _setup_session(db_conn, "ob_start@example.com")
    from mrms.onboarding.status import reset_status
    reset_status(user_id)
    r1 = client.post("/api/onboarding/start")
    r2 = client.post("/api/onboarding/start")
    client.cookies.clear()
    assert r1.status_code == 200
    assert r2.status_code == 200


# ─── precheck — action 분기 ─────────────────────────────────────────


def _precheck_action(email: str, db_conn) -> str:
    user_id = _setup_session(db_conn, email)
    try:
        r = client.get("/api/onboarding/precheck")
        assert r.status_code == 200, r.text
        return r.json()["action"]
    finally:
        client.cookies.clear()
        with db_conn.cursor() as cur:
            cur.execute('DELETE FROM "PlaylistHistory" WHERE "userId" = %s', (user_id,))
            cur.execute('DELETE FROM "UserTrack" WHERE "userId" = %s', (user_id,))
            cur.execute('DELETE FROM "UserOAuth" WHERE "userId" = %s', (user_id,))
            cur.execute('DELETE FROM "AuthSession" WHERE "userId" = %s', (user_id,))
            cur.execute('DELETE FROM "User" WHERE id = %s', (user_id,))
        db_conn.commit()


def test_precheck_requires_auth(db_conn):
    r = client.get("/api/onboarding/precheck")
    assert r.status_code == 401


def test_precheck_connect_when_nothing(db_conn):
    """oauth·데이터 없음 → connect."""
    assert _precheck_action("pc_connect@example.com", db_conn) == "connect"


def test_precheck_import_when_youtube_only_no_tracks(db_conn):
    """youtube 연결 + UserTrack 0 → import (picker 먼저)."""
    user_id = _setup_session(db_conn, "pc_import@example.com")
    from mrms.db.user_track import upsert_oauth
    from datetime import datetime as _dt
    expires = _dt.now(timezone.utc) + timedelta(hours=1)
    upsert_oauth(
        db_conn, user_id=user_id, platform="youtube",
        access_token="t", refresh_token="r", expires_at=expires,
        scopes=["youtube.readonly"],
    )
    db_conn.commit()
    try:
        r = client.get("/api/onboarding/precheck")
        assert r.status_code == 200
        assert r.json()["action"] == "import"
    finally:
        client.cookies.clear()
        with db_conn.cursor() as cur:
            cur.execute('DELETE FROM "UserOAuth" WHERE "userId" = %s', (user_id,))
            cur.execute('DELETE FROM "AuthSession" WHERE "userId" = %s', (user_id,))
            cur.execute('DELETE FROM "User" WHERE id = %s', (user_id,))
        db_conn.commit()


def test_precheck_run_when_streaming_connected(db_conn):
    """tidal 연결 → run (바로 분석 가능)."""
    user_id = _setup_session(db_conn, "pc_run_stream@example.com")
    from mrms.db.user_track import upsert_oauth
    from datetime import datetime as _dt
    expires = _dt.now(timezone.utc) + timedelta(hours=1)
    upsert_oauth(
        db_conn, user_id=user_id, platform="tidal",
        access_token="t", refresh_token="r", expires_at=expires, scopes=["r_usr"],
    )
    db_conn.commit()
    try:
        r = client.get("/api/onboarding/precheck")
        assert r.status_code == 200
        assert r.json()["action"] == "run"
    finally:
        client.cookies.clear()
        with db_conn.cursor() as cur:
            cur.execute('DELETE FROM "UserOAuth" WHERE "userId" = %s', (user_id,))
            cur.execute('DELETE FROM "AuthSession" WHERE "userId" = %s', (user_id,))
            cur.execute('DELETE FROM "User" WHERE id = %s', (user_id,))
        db_conn.commit()


def test_precheck_import_when_youtube_tracks_lack_embedding(db_conn):
    """youtube 연결 + UserTrack은 있으나 전부 임베딩 없음(all-miss import) → import.

    blocker #1: 예전 precheck는 ANY UserTrack을 "run"으로 보냈으나, step 2
    게이트는 임베딩 보유 UserTrack만 센다. 임베딩 없는 videoId Track으로만 채워진
    YouTube 사용자가 "run"으로 가면 게이트가 fail하고 reload 시 또 "run" →
    영구 루프. precheck가 게이트와 동일 조건(임베딩 보유)을 보고 "import"로
    보내야 picker로 돌아가 다시 매칭을 시도할 수 있다.
    """
    user_id = _setup_session(db_conn, "pc_run_tracks@example.com")
    from mrms.db.ids import stable_id as _sid
    from mrms.db.user_track import upsert_oauth, upsert_user_track
    from datetime import datetime as _dt

    expires = _dt.now(timezone.utc) + timedelta(hours=1)
    upsert_oauth(
        db_conn, user_id=user_id, platform="youtube",
        access_token="t", refresh_token="r", expires_at=expires,
        scopes=["youtube.readonly"],
    )
    # 임의의 1곡 UserTrack (Track FK 필요) — 임베딩 없는 catalog 트랙 seed
    # (all-miss import로 생긴 videoId Track을 모사).
    art_id = _sid("artist|pc run tracks art")
    trk_id = _sid("track|pc_run_tracks_isrc")
    with db_conn.cursor() as cur:
        cur.execute(
            '''INSERT INTO "Artist" (id, name, "nameNormalized")
               VALUES (%s, %s, %s) ON CONFLICT (id) DO NOTHING''',
            (art_id, "PC Art", "pc art"),
        )
        cur.execute(
            '''INSERT INTO "Track"
                 (id, isrc, title, "titleNormalized", "durationMs", "artistId")
               VALUES (%s, %s, %s, %s, %s, %s) ON CONFLICT (id) DO NOTHING''',
            (trk_id, "PC_RUN_TRACKS_ISRC", "S", "s", 0, art_id),
        )
    upsert_user_track(
        db_conn, user_id=user_id, track_id=trk_id,
        is_core=True, source="liked", platform="youtube",
    )
    db_conn.commit()
    try:
        r = client.get("/api/onboarding/precheck")
        assert r.status_code == 200
        # 임베딩 없는 트랙뿐 → 게이트를 통과 못 하므로 "import"로 보낸다.
        assert r.json()["action"] == "import"
    finally:
        client.cookies.clear()
        with db_conn.cursor() as cur:
            cur.execute('DELETE FROM "UserTrack" WHERE "userId" = %s', (user_id,))
            cur.execute('DELETE FROM "UserOAuth" WHERE "userId" = %s', (user_id,))
            cur.execute('DELETE FROM "AuthSession" WHERE "userId" = %s', (user_id,))
            cur.execute('DELETE FROM "Track" WHERE id = %s', (trk_id,))
            cur.execute('DELETE FROM "Artist" WHERE id = %s', (art_id,))
            cur.execute('DELETE FROM "User" WHERE id = %s', (user_id,))
        db_conn.commit()


def test_precheck_run_when_youtube_user_has_embedding_tracks(db_conn):
    """youtube 연결 + 임베딩 보유 UserTrack≥K(매칭 성공) → run (게이트 통과 가능)."""
    user_id = _setup_session(db_conn, "pc_run_emb@example.com")
    from mrms.db.ids import stable_id as _sid
    from mrms.db.user_track import upsert_oauth, upsert_user_track
    from mrms.onboarding.pipeline import CATALOG_MODEL_VERSION, DEFAULT_K
    from datetime import datetime as _dt

    expires = _dt.now(timezone.utc) + timedelta(hours=1)
    upsert_oauth(
        db_conn, user_id=user_id, platform="youtube",
        access_token="t", refresh_token="r", expires_at=expires,
        scopes=["youtube.readonly"],
    )
    # 임베딩 보유 catalog 트랙을 K개 잡아 UserTrack 연결 (매칭 성공 모사).
    with db_conn.cursor() as cur:
        cur.execute(
            '''SELECT "trackId" FROM "TrackEmbedding"
               WHERE "modelVersion" = %s LIMIT %s''',
            (CATALOG_MODEL_VERSION, DEFAULT_K),
        )
        emb_track_ids = [r[0] for r in cur.fetchall()]
    if len(emb_track_ids) < DEFAULT_K:
        client.cookies.clear()
        with db_conn.cursor() as cur:
            cur.execute('DELETE FROM "UserOAuth" WHERE "userId" = %s', (user_id,))
            cur.execute('DELETE FROM "AuthSession" WHERE "userId" = %s', (user_id,))
            cur.execute('DELETE FROM "User" WHERE id = %s', (user_id,))
        db_conn.commit()
        import pytest as _pt
        _pt.skip("임베딩 보유 catalog 트랙 부족")
    for tid in emb_track_ids:
        upsert_user_track(
            db_conn, user_id=user_id, track_id=tid,
            is_core=False, source="playlist:yt", platform="youtube",
        )
    db_conn.commit()
    try:
        r = client.get("/api/onboarding/precheck")
        assert r.status_code == 200
        assert r.json()["action"] == "run"
    finally:
        client.cookies.clear()
        with db_conn.cursor() as cur:
            cur.execute('DELETE FROM "UserTrack" WHERE "userId" = %s', (user_id,))
            cur.execute('DELETE FROM "UserOAuth" WHERE "userId" = %s', (user_id,))
            cur.execute('DELETE FROM "AuthSession" WHERE "userId" = %s', (user_id,))
            cur.execute('DELETE FROM "User" WHERE id = %s', (user_id,))
        db_conn.commit()


def test_precheck_ready_when_mrt_exists(db_conn):
    """PlaylistHistory 있으면 ready (다른 조건보다 우선)."""
    user_id = _setup_session(db_conn, "pc_ready@example.com")
    with db_conn.cursor() as cur:
        cur.execute(
            '''INSERT INTO "PlaylistHistory" (id, "userId", "trackIds", "modelVersion")
               VALUES (%s, %s, %s, %s)''',
            ("pc_ready_ph", user_id, [], "test-v1"),
        )
    db_conn.commit()
    try:
        r = client.get("/api/onboarding/precheck")
        assert r.status_code == 200
        assert r.json()["action"] == "ready"
    finally:
        client.cookies.clear()
        with db_conn.cursor() as cur:
            cur.execute('DELETE FROM "PlaylistHistory" WHERE "userId" = %s', (user_id,))
            cur.execute('DELETE FROM "AuthSession" WHERE "userId" = %s', (user_id,))
            cur.execute('DELETE FROM "User" WHERE id = %s', (user_id,))
        db_conn.commit()
