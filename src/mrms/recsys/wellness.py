"""Wellness 무드 추천 — 취향-우선 임베딩 엔진(recommend_by_taste_mood) 위의 무드 프리셋.

각 무드는 (valence, energy, tempo) 타겟. 후보가 유저 취향 이웃이라 안 듣는 장르(클래식 등)는
애초에 들어오지 않는다. situation desk와 동일 엔진을 공유한다.
"""
from __future__ import annotations

from typing import Any

import psycopg

from mrms.recsys.taste_mood import recommend_by_taste_mood

# 무드 → (valence, energy, tempo BPM). 신뢰 가능한 축만 — 망가진 acousticness/instrumentalness 폐기.
MOOD_PRESETS: dict[str, tuple[float, float, float]] = {
    "calm":     (0.40, 0.25, 85.0),
    "energize": (0.78, 0.80, 135.0),
    "focus":    (0.50, 0.45, 110.0),
    "sleep":    (0.28, 0.15, 70.0),
}


def recommend_wellness(
    conn: psycopg.Connection, user_id: str, mood: str, n: int = 20
) -> list[dict[str, Any]]:
    """무드명 → (valence, energy, tempo) → 취향-우선 추천. 알 수 없는 무드는 ValueError."""
    if mood not in MOOD_PRESETS:
        raise ValueError(f"unknown mood: {mood}")
    valence, energy, tempo = MOOD_PRESETS[mood]
    return recommend_by_taste_mood(conn, user_id, valence, energy, tempo, n=n)
