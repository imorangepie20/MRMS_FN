"""Onboarding pipeline 함수 테스트."""
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import pytest

from mrms.onboarding.pipeline import run_onboarding
from mrms.onboarding.status import OnboardingStatus


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
        new=AsyncMock(return_value=spotify_track_ids),
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
