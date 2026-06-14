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


def recommend_by_preset(
    conn: psycopg.Connection,
    user_id: str,
    preset: dict[str, tuple[float, float, float]],
    n: int = 20,
) -> list[dict[str, Any]]:
    """소프트 무드 적합(preset) × 취향(UserEmbedding cosine) 결합 top-n. 학습 없음.

    preset = {축: (center, sigma, weight)} (= MOOD_PRESETS[mood] 형태).
    값은 Python float이어야 함 — SQL에 인라인되므로 호출자가 검증·클램핑 책임.
    UserEmbedding 있으면 score=W_MOOD·mood_fit+W_TASTE·taste_sim, 없으면 mood_fit만.
    제외: UserTrack 보유 + UserBlocked disliked(track+album). 후보=임베딩∩피처 전 카탈로그.

    SELECT column order:
      0=t.id, 1=title, 2=artist, 3=albumId,
      4=valence, 5=energy, 6=tempo,
      7=mood_fit, 8=tidal_id, 9=spotify_id, 10=taste_sim
    """
    unknown = set(preset) - set(_FEATURE_COL)
    if unknown:
        raise ValueError(f"preset contains unsupported axes: {sorted(unknown)}")
    _ensure_vector_registered(conn)
    fit_sql = _mood_fit_sql(preset)
    ue = fetch_user_embedding(conn, user_id, USER_MV)

    exclude = '''
      t.id NOT IN (SELECT "trackId" FROM "UserTrack" WHERE "userId" = %(uid)s)
      AND t.id NOT IN (
        SELECT "targetId" FROM "UserBlocked"
          WHERE "userId" = %(uid)s AND "targetType" = 'track' AND reason = 'disliked'
        UNION
        SELECT tt.id FROM "Track" tt JOIN "UserBlocked" ub
          ON ub."targetId" = tt."albumId" AND ub."targetType" = 'album'
          WHERE ub."userId" = %(uid)s AND ub.reason = 'disliked'
      )'''
    # Columns 0-9 from select_cols, then taste_sim appended as column 10
    select_cols = f'''
        t.id, t.title, ar.name AS artist, t."albumId",
        taf.valence, taf.energy, taf.tempo,
        {fit_sql} AS mood_fit,
        tp_t."platformTrackId" AS tidal_id,
        tp_s."platformTrackId" AS spotify_id'''
    joins = '''
      FROM "TrackAudioFeatures" taf
      JOIN "Track"  t  ON t.id = taf."trackId"
      JOIN "Artist" ar ON ar.id = t."artistId"
      JOIN "TrackEmbedding" e ON e."trackId" = t.id AND e."modelVersion" = %(catmv)s
      LEFT JOIN "TrackPlatform" tp_t ON tp_t."trackId" = t.id AND tp_t.platform = 'tidal'
      LEFT JOIN "TrackPlatform" tp_s ON tp_s."trackId" = t.id AND tp_s.platform = 'spotify' '''
    params: dict[str, Any] = {"uid": user_id, "catmv": CATALOG_MV, "featmv": CATALOG_MV, "n": n}

    if ue is not None:
        params["uvec"] = np.asarray(ue["embedding"], dtype=np.float32)
        sql = f'''SELECT {select_cols}, 1 - (e.embedding <=> %(uvec)s) AS taste_sim {joins}
                  WHERE taf."modelVersion" = %(featmv)s AND {exclude}
                  ORDER BY ({W_MOOD} * ({fit_sql}) + {W_TASTE} * (1 - (e.embedding <=> %(uvec)s))) DESC
                  LIMIT %(n)s'''
    else:
        sql = f'''SELECT {select_cols}, NULL::double precision AS taste_sim {joins}
                  WHERE taf."modelVersion" = %(featmv)s AND {exclude}
                  ORDER BY ({fit_sql}) DESC
                  LIMIT %(n)s'''

    with conn.cursor() as cur:
        cur.execute(sql, params)
        rows = cur.fetchall()
    out = []
    for r in rows:
        # Indices: 0=id,1=title,2=artist,3=albumId,4=valence,5=energy,6=tempo,
        #          7=mood_fit, 8=tidal_id, 9=spotify_id, 10=taste_sim
        mf = float(r[7])
        ts = float(r[10]) if r[10] is not None else None
        score = (W_MOOD * mf + W_TASTE * ts) if ts is not None else mf
        out.append({
            "track_id": r[0], "title": r[1], "artist": r[2], "album_id": r[3],
            "valence": float(r[4]), "energy": float(r[5]), "tempo": float(r[6]),
            "mood_fit": mf, "taste_sim": ts, "score": score,
            "tidal_track_id": r[8], "spotify_track_id": r[9],
        })
    return out


def recommend_wellness(
    conn: psycopg.Connection, user_id: str, mood: str, n: int = 20
) -> list[dict[str, Any]]:
    """무드명 → MOOD_PRESETS preset → recommend_by_preset 위임. 알 수 없는 무드는 ValueError."""
    if mood not in MOOD_PRESETS:
        raise ValueError(f"unknown mood: {mood}")
    return recommend_by_preset(conn, user_id, MOOD_PRESETS[mood], n)
