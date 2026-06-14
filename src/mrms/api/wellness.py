"""Wellness 무드 추천 API. 웰니스 프레이밍(치료 표방 금지)."""
from __future__ import annotations

import psycopg
from fastapi import APIRouter, Depends, HTTPException

from mrms.api.deps import db_conn, get_current_user_id
from mrms.recsys.wellness import MOOD_PRESETS, recommend_wellness

router = APIRouter(prefix="/api/wellness", tags=["wellness"])


@router.get("/recommendations")
def recommendations(
    mood: str,
    user_id: str = Depends(get_current_user_id),
    conn: psycopg.Connection = Depends(db_conn),
):
    if mood not in MOOD_PRESETS:
        raise HTTPException(400, f"mood must be one of {sorted(MOOD_PRESETS)}")
    tracks = recommend_wellness(conn, user_id, mood, n=20)
    return {"mood": mood, "tracks": tracks}
