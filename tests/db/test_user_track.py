"""User / UserOAuth / UserTrack / Track 매칭 DB ops 테스트.

전제: 로컬 PG (port 5433)에 V1 적재 완료된 상태 (Track row 166k 존재).
각 테스트는 트랜잭션 롤백되어 영구 변경 없음.
"""
from datetime import datetime, timedelta, timezone

import pytest

from mrms.db.user_track import (
    get_or_create_user,
    upsert_oauth,
    get_oauth,
    resolve_primary_platform,
    find_track_id_by_isrc,
    upsert_user_track,
)


def _connect_oauth(db_conn, user_id, platform):
    """테스트용 UserOAuth 연결 헬퍼 (롤백 보호 — commit 안 함)."""
    expires = datetime.now(timezone.utc) + timedelta(hours=1)
    upsert_oauth(db_conn, user_id, platform, "AT", "RT", expires, ["scope"])


def test_resolve_primary_none_when_no_oauth(db_conn):
    """아무 플랫폼도 연결 안 됨 → None."""
    user_id = get_or_create_user(db_conn, email="prim_none@example.com")
    assert resolve_primary_platform(db_conn, user_id) is None


def test_resolve_primary_youtube_only(db_conn):
    """youtube만 연결 → 'youtube'."""
    user_id = get_or_create_user(db_conn, email="prim_yt@example.com")
    _connect_oauth(db_conn, user_id, "youtube")
    assert resolve_primary_platform(db_conn, user_id) == "youtube"


def test_resolve_primary_spotify_beats_youtube(db_conn):
    """spotify+youtube → 우선순위상 'spotify'."""
    user_id = get_or_create_user(db_conn, email="prim_sp@example.com")
    _connect_oauth(db_conn, user_id, "youtube")
    _connect_oauth(db_conn, user_id, "spotify")
    assert resolve_primary_platform(db_conn, user_id) == "spotify"


def test_resolve_primary_tidal_beats_all(db_conn):
    """tidal+youtube → 우선순위상 'tidal' (가장 premium)."""
    user_id = get_or_create_user(db_conn, email="prim_td@example.com")
    _connect_oauth(db_conn, user_id, "youtube")
    _connect_oauth(db_conn, user_id, "tidal")
    assert resolve_primary_platform(db_conn, user_id) == "tidal"


def test_resolve_primary_tidal_over_spotify(db_conn):
    """tidal+spotify+youtube 모두 → 'tidal'. 우선순위 tidal>spotify>youtube."""
    user_id = get_or_create_user(db_conn, email="prim_all@example.com")
    _connect_oauth(db_conn, user_id, "youtube")
    _connect_oauth(db_conn, user_id, "spotify")
    _connect_oauth(db_conn, user_id, "tidal")
    assert resolve_primary_platform(db_conn, user_id) == "tidal"


def test_create_user(db_conn):
    user_id = get_or_create_user(db_conn, email="test_a@example.com")
    assert user_id.startswith("c")  # cuid prefix
    # 같은 email 다시 → 같은 id
    user_id2 = get_or_create_user(db_conn, email="test_a@example.com")
    assert user_id == user_id2


def test_upsert_and_get_oauth(db_conn):
    user_id = get_or_create_user(db_conn, email="test_b@example.com")
    expires = datetime.now(timezone.utc) + timedelta(hours=1)
    upsert_oauth(
        db_conn,
        user_id=user_id,
        platform="tidal",
        access_token="ACCESS_AAA",
        refresh_token="REFRESH_BBB",
        expires_at=expires,
        scopes=["user.read", "collection.read"],
    )
    row = get_oauth(db_conn, user_id=user_id, platform="tidal")
    assert row is not None
    assert row["accessToken"] == "ACCESS_AAA"
    assert row["refreshToken"] == "REFRESH_BBB"
    assert "user.read" in row["scope"]


def test_upsert_oauth_replaces(db_conn):
    user_id = get_or_create_user(db_conn, email="test_c@example.com")
    expires = datetime.now(timezone.utc) + timedelta(hours=1)
    upsert_oauth(db_conn, user_id, "tidal", "T1", "R1", expires, ["user.read"])
    upsert_oauth(db_conn, user_id, "tidal", "T2", "R2", expires, ["user.read"])
    row = get_oauth(db_conn, user_id, "tidal")
    assert row["accessToken"] == "T2"


def test_find_track_id_by_isrc_hit(db_conn):
    """V1 적재된 실제 ISRC 하나 골라 검색."""
    with db_conn.cursor() as cur:
        cur.execute('SELECT isrc FROM "Track" LIMIT 1')
        row = cur.fetchone()
    if row is None:
        pytest.skip("Track 테이블 비어 있음 - V1 적재 선행 필요")
    isrc = row[0]
    track_id = find_track_id_by_isrc(db_conn, isrc)
    assert track_id is not None


def test_find_track_id_by_isrc_miss(db_conn):
    assert find_track_id_by_isrc(db_conn, "ZZZZ99999999") is None


def test_upsert_user_track_insert(db_conn):
    user_id = get_or_create_user(db_conn, email="test_d@example.com")
    with db_conn.cursor() as cur:
        cur.execute('SELECT id FROM "Track" LIMIT 1')
        row = cur.fetchone()
    if row is None:
        pytest.skip("Track 비어 있음")
    track_id = row[0]
    upsert_user_track(db_conn, user_id, track_id, is_core=True, source="liked", platform="tidal")
    with db_conn.cursor() as cur:
        cur.execute(
            'SELECT "isCore", source, platform FROM "UserTrack" WHERE "userId"=%s AND "trackId"=%s',
            (user_id, track_id),
        )
        ut = cur.fetchone()
    assert ut == (True, "liked", "tidal")


def test_upsert_user_track_conflict_liked_beats_playlist(db_conn):
    """playlist로 먼저 들어온 트랙이 liked로 재import되면 source='liked'로 승격."""
    user_id = get_or_create_user(db_conn, email="test_e@example.com")
    with db_conn.cursor() as cur:
        cur.execute('SELECT id FROM "Track" LIMIT 1')
        row = cur.fetchone()
    if row is None:
        pytest.skip("Track 비어 있음")
    track_id = row[0]
    upsert_user_track(db_conn, user_id, track_id, is_core=False, source="playlist:foo", platform="tidal")
    upsert_user_track(db_conn, user_id, track_id, is_core=True, source="liked", platform="tidal")
    with db_conn.cursor() as cur:
        cur.execute(
            'SELECT "isCore", source FROM "UserTrack" WHERE "userId"=%s AND "trackId"=%s',
            (user_id, track_id),
        )
        ut = cur.fetchone()
    assert ut == (True, "liked")


def test_upsert_user_track_conflict_playlist_does_not_demote(db_conn):
    """liked로 들어온 트랙은 playlist 재import로 source 'playlist:...'으로 안 바뀜."""
    user_id = get_or_create_user(db_conn, email="test_f@example.com")
    with db_conn.cursor() as cur:
        cur.execute('SELECT id FROM "Track" LIMIT 1')
        row = cur.fetchone()
    if row is None:
        pytest.skip("Track 비어 있음")
    track_id = row[0]
    upsert_user_track(db_conn, user_id, track_id, is_core=True, source="liked", platform="tidal")
    upsert_user_track(db_conn, user_id, track_id, is_core=False, source="playlist:bar", platform="tidal")
    with db_conn.cursor() as cur:
        cur.execute(
            'SELECT "isCore", source FROM "UserTrack" WHERE "userId"=%s AND "trackId"=%s',
            (user_id, track_id),
        )
        ut = cur.fetchone()
    # isCore=true 유지, source='liked' 유지
    assert ut == (True, "liked")
