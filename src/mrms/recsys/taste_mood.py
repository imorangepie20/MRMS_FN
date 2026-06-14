"""취향-우선 임베딩 추천 — 유저 취향 임베딩 최근접 풀에서 무드(valence/energy/tempo)로 재정렬.

망가진 오디오 피처(acousticness 등)를 무드 점수에서 배제한다. 후보가 '취향 이웃'이라
유저가 안 듣는 장르(예: 클래식)는 애초에 풀에 들어오지 않는다. situation·wellness 공용 엔진.
"""
from __future__ import annotations

import math
import re
from typing import Any

import numpy as np
import psycopg

from mrms.config import EMBEDDING_MODEL_VERSION
from mrms.db.user_embedding import _ensure_vector_registered, fetch_user_embedding
from mrms.recsys.mrt import MODEL_VERSION as USER_MV

CATALOG_MV = EMBEDDING_MODEL_VERSION  # TrackEmbedding/TAF 공용 ('our-v1.0')

# 무드 재정렬 축의 가우시안 폭(σ). valence/energy/tempo만 — 신뢰 가능한 축.
_MOOD_SIGMA = {"valence": 0.18, "energy": 0.18, "tempo": 28.0}


def mood_fit_vet(
    valence: float, energy: float, tempo: float,
    cv: float, ce: float, ct: float,
) -> float:
    """무드 적합도(0~1) — valence/energy/tempo 가우시안. acousticness/instrumentalness 안 씀."""
    return math.exp(-0.5 * (
        ((valence - cv) / _MOOD_SIGMA["valence"]) ** 2
        + ((energy - ce) / _MOOD_SIGMA["energy"]) ** 2
        + ((tempo - ct) / _MOOD_SIGMA["tempo"]) ** 2
    ))


def taste_vector(conn: psycopg.Connection, user_id: str) -> np.ndarray | None:
    """유저 취향 벡터 — UserTrack 임베딩 평균(라이브러리 센트로이드) 우선.

    트랙이 없으면 persona UserEmbedding, 둘 다 없으면 None(취향 신호 없음).
    """
    with conn.cursor() as cur:
        cur.execute(
            '''SELECT avg(e.embedding) FROM "TrackEmbedding" e
               JOIN "UserTrack" ut ON ut."trackId" = e."trackId"
               WHERE ut."userId" = %s AND e."modelVersion" = %s''',
            (user_id, CATALOG_MV),
        )
        row = cur.fetchone()
    if row is not None and row[0] is not None:
        return np.asarray(row[0], dtype=np.float32)
    ue = fetch_user_embedding(conn, user_id, USER_MV)
    if ue is not None:
        return np.asarray(ue["embedding"], dtype=np.float32)
    return None


_SUFFIX_DASH = re.compile(r"\s+-\s.*$")      # " - From ...", " - Single Version"
_SUFFIX_PAREN = re.compile(r"\s*[(\[].*$")   # "(English Ver.)", "[Remastered]"
_NONWORD = re.compile(r"[^a-z0-9가-힣]+")


def _song_key(artist: str, title: str) -> str:
    """같은 곡의 버전/릴리즈를 한 키로 — 같은 곡이 여러 track_id로 있어 중복 노출되는 것 방지.

    공백-하이픈-공백 접미사(' - From …')와 괄호 접미사('(English Ver.)')를 떼고 비단어 제거.
    'Spider-Man'처럼 공백 없는 하이픈은 보존(다른 곡 오병합 방지).
    """
    t = title.lower()
    t = _SUFFIX_DASH.sub("", t)
    t = _SUFFIX_PAREN.sub("", t)
    t = _NONWORD.sub("", t)
    return f"{artist.strip().lower()}|{t}"


def recommend_by_taste_mood(
    conn: psycopg.Connection,
    user_id: str,
    valence: float,
    energy: float,
    tempo: float,
    n: int = 20,
    pool_size: int = 500,
) -> list[dict[str, Any]]:
    """취향 임베딩 최근접 pool_size곡(보유/차단 제외)을 무드(v/e/t)로 재정렬한 top-n.

    취향 신호가 없으면 빈 리스트. 반환 dict 형태는 기존 추천과 동일(프론트 무수정).
    """
    _ensure_vector_registered(conn)
    tvec = taste_vector(conn, user_id)
    if tvec is None:
        return []

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
    sql = f'''
      SELECT t.id, t.title, ar.name AS artist, t."albumId",
             taf.valence, taf.energy, taf.tempo,
             tp_t."platformTrackId" AS tidal_id,
             tp_s."platformTrackId" AS spotify_id,
             1 - (e.embedding <=> %(tvec)s) AS taste_sim
      FROM "TrackEmbedding" e
      JOIN "Track"  t  ON t.id = e."trackId"
      JOIN "Artist" ar ON ar.id = t."artistId"
      JOIN "TrackAudioFeatures" taf ON taf."trackId" = t.id AND taf."modelVersion" = %(mv)s
      LEFT JOIN "TrackPlatform" tp_t ON tp_t."trackId" = t.id AND tp_t.platform = 'tidal'
      LEFT JOIN "TrackPlatform" tp_s ON tp_s."trackId" = t.id AND tp_s.platform = 'spotify'
      WHERE e."modelVersion" = %(mv)s AND {exclude}
      ORDER BY e.embedding <=> %(tvec)s
      LIMIT %(pool)s'''
    params: dict[str, Any] = {
        "uid": user_id, "tvec": tvec, "mv": CATALOG_MV, "pool": pool_size,
    }
    with conn.cursor() as cur:
        cur.execute(sql, params)
        rows = cur.fetchall()

    out = []
    for r in rows:
        mf = mood_fit_vet(float(r[4]), float(r[5]), float(r[6]), valence, energy, tempo)
        out.append({
            "track_id": r[0], "title": r[1], "artist": r[2], "album_id": r[3],
            "valence": float(r[4]), "energy": float(r[5]), "tempo": float(r[6]),
            "mood_fit": mf, "taste_sim": float(r[9]), "score": mf,
            "tidal_track_id": r[7], "spotify_track_id": r[8],
        })
    out.sort(key=lambda d: d["score"], reverse=True)
    # 같은 곡(버전/릴리즈 중복)은 점수 높은 1개만 — 정렬 후 dedup
    deduped: list[dict[str, Any]] = []
    seen: set[str] = set()
    for d in out:
        k = _song_key(d["artist"], d["title"])
        if k in seen:
            continue
        seen.add(k)
        deduped.append(d)
    return deduped[:n]
