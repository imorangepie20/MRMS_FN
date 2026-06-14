"""상황 텍스트 → LLM 해석 → 추천 API. 웰니스 프레이밍(치료 표방 금지)."""
from __future__ import annotations

import psycopg
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from mrms.api.deps import db_conn, get_current_user_id
from mrms.llm.situation import SituationLLMError, build_preset, interpret_situation
from mrms.recsys.wellness import recommend_by_preset

router = APIRouter(prefix="/api/situation", tags=["situation"])

_MAX_TEXT = 400


class SituationRequest(BaseModel):
    text: str


@router.post("/recommendations")
def recommendations(
    body: SituationRequest,
    user_id: str = Depends(get_current_user_id),
    conn: psycopg.Connection = Depends(db_conn),
):
    text = body.text.strip()[:_MAX_TEXT]
    if not text:
        raise HTTPException(400, "text must not be empty")
    try:
        interp = interpret_situation(text)
    except SituationLLMError as e:
        raise HTTPException(502, f"LLM 해석 실패: {e}")
    preset = build_preset(interp)
    tracks = recommend_by_preset(conn, user_id, preset, n=20)
    features = {
        "valence": preset["valence"][0],
        "energy": preset["energy"][0],
        "tempo_bpm": preset["tempo"][0],
        "acousticness": preset["acousticness"][0],
        "instrumentalness": preset["instrumentalness"][0],
    }
    return {
        "interpretation": interp.interpretation,
        "mood_label": interp.mood_label,
        "features": features,
        "tracks": tracks,
    }
