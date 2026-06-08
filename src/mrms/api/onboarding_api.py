"""Onboarding API — start + status endpoints."""
from __future__ import annotations

import asyncio
import os

import psycopg
from fastapi import APIRouter, BackgroundTasks, Depends

from mrms.api.deps import db_conn, get_current_user_id
from mrms.onboarding.pipeline import run_onboarding
from mrms.onboarding.status import get_or_create_status, reset_status


router = APIRouter(prefix="/api/onboarding", tags=["onboarding"])


@router.get("/status")
def status_endpoint(
    user_id: str = Depends(get_current_user_id),
) -> dict:
    """현재 user의 onboarding 진행 상태."""
    status = get_or_create_status(user_id)
    return status.to_dict()


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
