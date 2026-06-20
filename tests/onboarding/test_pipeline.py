"""Onboarding pipeline 함수 테스트."""
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import pytest

import mrms.recsys.mrt as _mrt_mod
from mrms.onboarding.pipeline import run_onboarding
from mrms.onboarding.status import OnboardingStatus


@pytest.fixture(autouse=True)
def _stub_discovery():
    """온보딩 테스트에서 generate_user_mrt 내부 discovery를 no-op으로 — 실제 Gemini/
    ytmusicapi 호출·discovery 잔여물 방지(.env에 GEMINI_API_KEY 있음)."""
    with patch.object(_mrt_mod, "generate_user_discovery", lambda *a, **k: 0):
        yield


def test_create_imported_playlists_full_import(db_conn, cleanup):
    """전곡 import — 미매칭 트랙도 upsert_platform_track으로 카탈로그 생성. 순서·dedup·sourceRef."""
    from mrms.db.ids import stable_id as _id
    from mrms.db.playlist import get_playlist_tracks
    from mrms.db.user_track import get_or_create_user
    from mrms.onboarding.pipeline import _create_imported_playlists

    uid = get_or_create_user(db_conn, "imppl_full@test.com")
    db_conn.commit()
    # 등록 역순 실행 → 자식 먼저
    cleanup('DELETE FROM "User" WHERE id = %s', (uid,))
    cleanup('DELETE FROM "Artist" WHERE id = %s', (_id("artist|imp artist"),))
    cleanup('DELETE FROM "Track" WHERE isrc = ANY(%s)', (["IMPTST001", "IMPTST002"],))
    cleanup('DELETE FROM "Playlist" WHERE "userId" = %s', (uid,))
    cleanup('DELETE FROM "TrackPlatform" WHERE "platformTrackId" = ANY(%s)',
            (["imptst_1", "imptst_2"],))
    cleanup(
        'DELETE FROM "PlaylistTrack" WHERE "playlistId" IN '
        '(SELECT id FROM "Playlist" WHERE "userId" = %s)', (uid,))

    # 전부 미매칭(새 isrc) → 카탈로그에 생성됨. 순서 보존 + dup id 제거.
    per_playlist = [("PLX", "My Mix", [
        {"id": "imptst_1", "title": "T1", "artist": "Imp Artist", "isrc": "IMPTST001"},
        {"id": "imptst_2", "title": "T2", "artist": "Imp Artist", "isrc": "IMPTST002"},
        {"id": "imptst_1", "title": "T1", "artist": "Imp Artist", "isrc": "IMPTST001"},  # dup
    ])]
    _create_imported_playlists(db_conn, uid, "spotify", per_playlist)

    with db_conn.cursor() as cur:
        cur.execute('SELECT id, name, "sourceRef" FROM "Playlist" WHERE "userId" = %s', (uid,))
        rows = cur.fetchall()
    assert len(rows) == 1
    pid, name, sref = rows[0]
    assert name == "My Mix" and sref == "spotify:PLX"
    # 미매칭 2곡 카탈로그 생성 + 순서, dup 제거
    t1 = _id("track|IMPTST001")
    t2 = _id("track|IMPTST002")
    assert [t["track_id"] for t in get_playlist_tracks(db_conn, pid)] == [t1, t2]


@pytest.mark.asyncio
async def test_pipeline_no_data_sets_error(db_conn):
    """Tidal favorites + playlists 모두 0이면 error 상태."""
    from mrms.db.user_track import get_or_create_user, upsert_oauth

    import base64
    import json
    payload = base64.urlsafe_b64encode(json.dumps({"uid": 99999}).encode()).decode().rstrip("=")
    fake_token = f"hdr.{payload}.sig"

    user_id = get_or_create_user(db_conn, "tidal-99999@auto.local")
    expires = datetime.now(timezone.utc) + timedelta(hours=1)
    upsert_oauth(
        db_conn, user_id=user_id, platform="tidal",
        access_token=fake_token, refresh_token="fake_refresh",
        expires_at=expires, scopes=["r_usr", "w_usr"],
    )
    db_conn.commit()

    status = OnboardingStatus()
    with patch(
        "mrms.onboarding.pipeline.fetch_tidal_favorite_tracks",
        new=AsyncMock(return_value=[]),
    ), patch(
        "mrms.onboarding.pipeline.fetch_tidal_user_playlists",
        new=AsyncMock(return_value=[]),
    ):
        await run_onboarding(user_id=user_id, status=status, conn=db_conn)
    assert status.step == "error"
    assert "트랙이 없습니다" in (status.error or "")


@pytest.mark.asyncio
async def test_pipeline_progresses_through_steps(db_conn):
    """정상 case: 단계가 fetching → ... → done으로 진행."""
    from mrms.db.user_track import get_or_create_user, upsert_oauth
    import base64
    import json

    user_id = get_or_create_user(db_conn, "tidal-pipeline_ok@auto.local")

    # JWT with valid uid claim
    payload = base64.urlsafe_b64encode(json.dumps({"uid": 12345}).encode()).decode().rstrip("=")
    fake_token = f"hdr.{payload}.sig"

    expires = datetime.now(timezone.utc) + timedelta(hours=1)
    upsert_oauth(
        db_conn, user_id=user_id, platform="tidal",
        access_token=fake_token, refresh_token="fake_refresh",
        expires_at=expires, scopes=["r_usr"],
    )
    db_conn.commit()

    # DB에서 Tidal-available 트랙 sample (with embedding)
    with db_conn.cursor() as cur:
        cur.execute(
            '''SELECT tp."platformTrackId"
               FROM "TrackPlatform" tp
               JOIN "TrackEmbedding" te ON te."trackId" = tp."trackId"
               WHERE tp.platform = 'tidal' AND te."modelVersion" = 'our-v1.0'
               LIMIT 30'''
        )
        tidal_track_ids = [r[0] for r in cur.fetchall()]
    if len(tidal_track_ids) < 10:
        pytest.skip("필요한 Tidal + TrackEmbedding 데이터 부족")

    status = OnboardingStatus()
    with patch(
        "mrms.onboarding.pipeline.fetch_tidal_favorite_tracks",
        new=AsyncMock(return_value=tidal_track_ids),
    ), patch(
        "mrms.onboarding.pipeline.fetch_tidal_user_playlists",
        new=AsyncMock(return_value=[]),  # 플레이리스트 없음, 즐겨찾기로만 진행
    ):
        await run_onboarding(user_id=user_id, status=status, conn=db_conn)

    assert status.step == "done", f"step={status.step} error={status.error}"
    assert status.progress == 100
    with db_conn.cursor() as cur:
        cur.execute('SELECT COUNT(*) FROM "UserTrack" WHERE "userId" = %s', (user_id,))
        assert cur.fetchone()[0] >= 10
        cur.execute('SELECT COUNT(*) FROM "PlaylistHistory" WHERE "userId" = %s', (user_id,))
        assert cur.fetchone()[0] >= 1


@pytest.mark.asyncio
async def test_pipeline_dispatches_to_spotify_when_only_spotify_oauth(db_conn):
    """Spotify oauth만 있으면 Spotify fetcher 사용 + UserTrack platform='spotify'."""
    from mrms.db.user_track import get_or_create_user, upsert_oauth

    user_id = get_or_create_user(db_conn, "spotify_pipeline@example.com")
    expires = datetime.now(timezone.utc) + timedelta(hours=1)
    upsert_oauth(
        db_conn, user_id=user_id, platform="spotify",
        access_token="fake_spotify_token", refresh_token="fake_refresh",
        expires_at=expires, scopes=["user-read-email"],
    )
    db_conn.commit()

    # Spotify-가용 트랙 sample (with embedding)
    with db_conn.cursor() as cur:
        cur.execute(
            '''SELECT tp."platformTrackId"
               FROM "TrackPlatform" tp
               JOIN "TrackEmbedding" te ON te."trackId" = tp."trackId"
               WHERE tp.platform = 'spotify' AND te."modelVersion" = 'our-v1.0'
               LIMIT 30'''
        )
        spotify_track_ids = [r[0] for r in cur.fetchall()]
    if len(spotify_track_ids) < 10:
        pytest.skip("Spotify + TrackEmbedding 데이터 부족")

    status = OnboardingStatus()
    with patch(
        "mrms.onboarding.pipeline.fetch_spotify_favorite_tracks",
        new=AsyncMock(return_value={sid: None for sid in spotify_track_ids}),
    ), patch(
        "mrms.onboarding.pipeline.fetch_spotify_user_playlists",
        new=AsyncMock(return_value=[]),
    ):
        await run_onboarding(user_id=user_id, status=status, conn=db_conn)

    assert status.step == "done", f"step={status.step} error={status.error}"
    with db_conn.cursor() as cur:
        cur.execute(
            'SELECT COUNT(*) FROM "UserTrack" WHERE "userId" = %s AND platform = %s',
            (user_id, "spotify"),
        )
        assert cur.fetchone()[0] >= 10


@pytest.mark.asyncio
async def test_pipeline_youtube_user_with_embedding_tracks_skips_collection(db_conn):
    """Tidal/Spotify 둘 다 없고 youtube만 연결 + 임베딩 보유 UserTrack 존재 →
    수집 스킵하고 step 2(클러스터/MRT) 진입해 done.

    youtube import가 이미 임베딩 trackId에 UserTrack을 연결한 상태를 모사:
    실제 임베딩 보유 catalog 트랙으로 UserTrack을 직접 적재한다 (fetch mock 불필요 —
    else 분기는 외부 호출을 안 한다).
    """
    from mrms.db.user_track import (
        get_or_create_user,
        upsert_oauth,
        upsert_user_track,
    )
    from mrms.onboarding.pipeline import CATALOG_MODEL_VERSION

    user_id = get_or_create_user(db_conn, "yt_gate_ok@example.com")
    expires = datetime.now(timezone.utc) + timedelta(hours=1)
    # youtube oauth만 (tidal/spotify 없음)
    upsert_oauth(
        db_conn, user_id=user_id, platform="youtube",
        access_token="fake_yt_token", refresh_token="fake_refresh",
        expires_at=expires, scopes=["youtube.readonly"],
    )

    # 임베딩 보유 catalog 트랙 sample (K=3 클러스터링에 충분히)
    with db_conn.cursor() as cur:
        cur.execute(
            '''SELECT "trackId" FROM "TrackEmbedding"
               WHERE "modelVersion" = %s LIMIT 15''',
            (CATALOG_MODEL_VERSION,),
        )
        emb_track_ids = [r[0] for r in cur.fetchall()]
    if len(emb_track_ids) < 3:
        pytest.skip("임베딩 보유 catalog 트랙 부족")

    for tid in emb_track_ids:
        upsert_user_track(
            db_conn, user_id=user_id, track_id=tid,
            is_core=False, source="playlist:yt", platform="youtube",
        )
    db_conn.commit()

    status = OnboardingStatus()
    try:
        # 외부 fetch가 호출되면 안 됨 — 호출 시 폭발하도록 패치
        with patch(
            "mrms.onboarding.pipeline.fetch_tidal_favorite_tracks",
            new=AsyncMock(side_effect=AssertionError("youtube 게이트인데 tidal fetch 호출")),
        ), patch(
            "mrms.onboarding.pipeline.fetch_spotify_favorite_tracks",
            new=AsyncMock(side_effect=AssertionError("youtube 게이트인데 spotify fetch 호출")),
        ):
            await run_onboarding(user_id=user_id, status=status, conn=db_conn)

        assert status.step == "done", f"step={status.step} error={status.error}"
        with db_conn.cursor() as cur:
            cur.execute(
                'SELECT COUNT(*) FROM "PlaylistHistory" WHERE "userId" = %s',
                (user_id,),
            )
            assert cur.fetchone()[0] >= 1
    finally:
        with db_conn.cursor() as cur:
            cur.execute('DELETE FROM "PlaylistHistory" WHERE "userId" = %s', (user_id,))
            cur.execute('DELETE FROM "UserPersona" WHERE "userId" = %s', (user_id,))
            cur.execute('DELETE FROM "UserEmbedding" WHERE "userId" = %s', (user_id,))
            cur.execute('DELETE FROM "UserTrack" WHERE "userId" = %s', (user_id,))
            cur.execute('DELETE FROM "UserOAuth" WHERE "userId" = %s', (user_id,))
            cur.execute('DELETE FROM "AuthSession" WHERE "userId" = %s', (user_id,))
            cur.execute('DELETE FROM "User" WHERE id = %s', (user_id,))
        db_conn.commit()


@pytest.mark.asyncio
async def test_pipeline_no_oauth_no_tracks_fails_with_import_message(db_conn):
    """Tidal/Spotify/데이터 아무것도 없으면 'import 필요' 메시지로 fail."""
    from mrms.db.user_track import get_or_create_user

    user_id = get_or_create_user(db_conn, "yt_gate_empty@example.com")
    db_conn.commit()

    status = OnboardingStatus()
    try:
        await run_onboarding(user_id=user_id, status=status, conn=db_conn)
        assert status.step == "error"
        assert "import" in (status.error or "")
        assert "플레이리스트" in (status.error or "")
    finally:
        with db_conn.cursor() as cur:
            cur.execute('DELETE FROM "User" WHERE id = %s', (user_id,))
        db_conn.commit()
