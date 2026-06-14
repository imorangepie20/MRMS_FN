"""Wellness 무드 추천 — 오디오 피처 무드 적합(소프트) × 취향 임베딩 결합.

새 학습 없음: 기존 TrackAudioFeatures + TrackEmbedding + UserEmbedding 조합.
후보 = 임베딩∩피처 전 카탈로그(inEmp 아님). 제외 = MRT와 동일(UserTrack/UserBlocked).
"""
from __future__ import annotations

import math
from typing import Any

import numpy as np
import psycopg

from mrms.config import EMBEDDING_MODEL_VERSION
from mrms.db.user_embedding import _ensure_vector_registered, fetch_user_embedding
from mrms.recsys.mrt import MODEL_VERSION as USER_MV

CATALOG_MV = EMBEDDING_MODEL_VERSION  # features·catalog 공용 ('our-v1.0')

# 축: (center, sigma, weight). weight 0 → 무시.
MOOD_PRESETS: dict[str, dict[str, tuple[float, float, float]]] = {
    "calm":     {"valence": (0.40, 0.18, 1.0), "energy": (0.25, 0.18, 1.0), "tempo": (85.0, 28.0, 1.0), "acousticness": (0.70, 0.25, 0.6), "instrumentalness": (0.0, 0.30, 0.0)},
    "energize": {"valence": (0.78, 0.18, 1.0), "energy": (0.80, 0.18, 1.0), "tempo": (135.0, 30.0, 1.0), "acousticness": (0.0, 0.25, 0.0), "instrumentalness": (0.0, 0.30, 0.0)},
    "focus":    {"valence": (0.50, 0.20, 1.0), "energy": (0.45, 0.18, 1.0), "tempo": (110.0, 28.0, 1.0), "acousticness": (0.0, 0.25, 0.0), "instrumentalness": (0.70, 0.30, 0.6)},
    "sleep":    {"valence": (0.28, 0.20, 1.0), "energy": (0.12, 0.12, 1.0), "tempo": (68.0, 22.0, 1.0), "acousticness": (0.80, 0.25, 0.6), "instrumentalness": (0.50, 0.30, 0.4)},
}
_FEATURE_COL = {
    "valence": 'taf.valence', "energy": 'taf.energy', "tempo": 'taf.tempo',
    "acousticness": 'taf.acousticness', "instrumentalness": 'taf.instrumentalness',
}
W_MOOD, W_TASTE = 0.6, 0.4


def mood_fit(feats: dict[str, float], preset: dict[str, tuple[float, float, float]]) -> float:
    """정규화 가우시안 무드 적합 (0~1). weight 0 축은 무시."""
    s = 0.0
    for axis, (center, sigma, weight) in preset.items():
        if weight == 0:
            continue
        x = feats[axis]
        s += weight * ((x - center) / sigma) ** 2
    return math.exp(-0.5 * s)


def _mood_fit_sql(preset: dict[str, tuple[float, float, float]]) -> str:
    """mood_fit과 동일 공식의 SQL 식(상수 인라인 — 우리 상수라 안전)."""
    terms = []
    for axis, (center, sigma, weight) in preset.items():
        if weight == 0:
            continue
        col = _FEATURE_COL[axis]
        terms.append(f"{weight} * power(({col} - {center})/{sigma}, 2)")
    return "exp(-0.5 * (" + " + ".join(terms) + "))"
