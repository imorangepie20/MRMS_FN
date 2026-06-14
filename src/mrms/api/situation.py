"""상황 텍스트 → LLM 무드 해석 → 취향-우선 추천 API. 웰니스 프레이밍(치료 표방 금지)."""
from __future__ import annotations

import psycopg
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from mrms.api.deps import db_conn, get_current_user_id
from mrms.llm.situation import SituationLLMError, interpret_situation
from mrms.recsys.taste_mood import recommend_by_taste_mood

router = APIRouter(prefix="/api/situation", tags=["situation"])

_MAX_TEXT = 400


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, float(v)))


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
    valence = _clamp(interp.valence, 0.0, 1.0)
    energy = _clamp(interp.energy, 0.0, 1.0)
    tempo = _clamp(interp.tempo_bpm, 40.0, 200.0)
    tracks = recommend_by_taste_mood(conn, user_id, valence, energy, tempo, n=20)
    return {
        "interpretation": interp.interpretation,
        "mood_label": interp.mood_label,
        "features": {"valence": valence, "energy": energy, "tempo_bpm": tempo},
        "tracks": tracks,
    }
