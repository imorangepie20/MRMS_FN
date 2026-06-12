"""Onboarding API — start + status endpoints."""
from __future__ import annotations

import asyncio
import os

import psycopg
from fastapi import APIRouter, BackgroundTasks, Depends

from mrms.api.deps import db_conn, get_current_user_id
from mrms.onboarding.pipeline import (
    DEFAULT_K,
    count_embedding_user_tracks,
    run_onboarding,
)
from mrms.onboarding.status import get_or_create_status, reset_status


router = APIRouter(prefix="/api/onboarding", tags=["onboarding"])


@router.get("/status")
def status_endpoint(
    user_id: str = Depends(get_current_user_id),
) -> dict:
    """현재 user의 onboarding 진행 상태."""
    status = get_or_create_status(user_id)
    return status.to_dict()


@router.get("/precheck")
def precheck_endpoint(
    user_id: str = Depends(get_current_user_id),
    conn: psycopg.Connection = Depends(db_conn),
) -> dict:
    """프론트 onboarding 진입 분기 — {action} 반환.

    - "ready":   이미 MRT(PlaylistHistory) 존재 → 결과 페이지로.
    - "run":     Tidal/Spotify 연결됨 OR 임베딩 보유 UserTrack≥K → 바로 /start.
    - "import":  youtube 연결됨 + 임베딩 보유 UserTrack<K → playlist picker 먼저.
    - "connect": 아무 연결·데이터 없음 → 플랫폼 연결 유도.

    판정 우선순위: ready > run > import > connect.

    핵심: has_tracks는 step 2 게이트(_fetch_user_track_matrix)와 동일하게 임베딩
    보유 UserTrack만 센다. 미스(임베딩 없는 videoId Track)로만 채워진 YouTube
    사용자는 0이 나와 "run"이 아니라 "import"로 가야 한다 — 그러지 않으면
    precheck="run" → /start → 게이트 fail("import 필요") → reload 시 또 "run"으로
    영구 루프(blocker #1). K 미만(클러스터링 불가)도 같은 이유로 import로 보낸다.
    """
    with conn.cursor() as cur:
        cur.execute(
            'SELECT 1 FROM "PlaylistHistory" WHERE "userId" = %s LIMIT 1',
            (user_id,),
        )
        has_mrt = cur.fetchone() is not None

        cur.execute(
            '''SELECT platform FROM "UserOAuth"
               WHERE "userId" = %s AND platform = ANY(%s)''',
            (user_id, ["tidal", "spotify", "youtube"]),
        )
        connected = {r[0] for r in cur.fetchall()}

    # 게이트와 동일 조건(임베딩 보유 + CATALOG_MODEL_VERSION)으로 카운트.
    # 클러스터링 K개가 필요하므로 K 미만이면 분석을 돌릴 수 없다 → 부족으로 본다.
    embedding_track_count = count_embedding_user_tracks(conn, user_id)
    has_runnable_tracks = embedding_track_count >= DEFAULT_K

    has_streaming = bool(connected & {"tidal", "spotify"})
    has_youtube = "youtube" in connected

    if has_mrt:
        action = "ready"
    elif has_streaming or has_runnable_tracks:
        # Tidal/Spotify는 /start에서 수집이 트랙을 채우므로 트랙 0이어도 run.
        action = "run"
    elif has_youtube:
        # youtube 연결인데 분석 가능한(임베딩 보유 ≥K) 트랙이 없음 → 재-import 유도.
        action = "import"
    else:
        action = "connect"
    return {"action": action}


@router.post("/start")
def start_endpoint(
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id),
) -> dict:
    """Onboarding job 시작. 이미 진행 중이면 idempotent."""
    status = get_or_create_status(user_id)
    if status.step not in ("idle", "error", "done"):
        return {"status": "already_running", "step": status.step}

    # Reset status + 백그라운드 실행
    new_status = reset_status(user_id)

    async def _runner():
        dsn = os.environ.get("DATABASE_URL", "postgresql://mrms:mrms@localhost:5433/mrms")
        loop = asyncio.get_event_loop()
        async_conn = await loop.run_in_executor(
            None, lambda: psycopg.connect(dsn, autocommit=False)
        )
        try:
            await run_onboarding(user_id=user_id, status=new_status, conn=async_conn)
        finally:
            async_conn.close()

    background_tasks.add_task(_runner)
    return {"status": "started"}
