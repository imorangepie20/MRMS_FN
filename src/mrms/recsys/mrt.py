"""MRT (Model Recommendation Tracks) — 페르소나별 pgvector 검색 + derive."""
from __future__ import annotations

import logging
from collections import defaultdict
from typing import Any

import numpy as np
import psycopg
from pgvector.psycopg import register_vector

from mrms.config import EMBEDDING_MODEL_VERSION, settings
from mrms.db.user_embedding import (
    insert_playlist_history,
    upsert_user_embedding,
    upsert_user_persona,
)
from mrms.recsys.persona import aggregate_user_vector, cluster_user_tracks

log = logging.getLogger(__name__)

MODEL_VERSION = f"{EMBEDDING_MODEL_VERSION}+persona-K3"
from mrms.recsys.discover import (  # noqa: E402,I001 — after MODEL_VERSION (circular-import guard)
    generate_user_discovery,
)
from mrms.recsys.newrelease import (  # noqa: E402,I001 — after MODEL_VERSION (circular-import guard)
    generate_user_newrelease,
)
CATALOG_MODEL_VERSION = EMBEDDING_MODEL_VERSION
DEFAULT_K = 3
DEFAULT_TOP_N = 20
DEFAULT_CANDIDATE_POOL = 30


def _ensure_vector_registered(conn: psycopg.Connection) -> None:
    """idempotent register_vector."""
    if getattr(conn, "_mrms_vector_registered", False):
        return
    register_vector(conn)
    setattr(conn, "_mrms_vector_registered", True)


def search_for_persona(
    conn: psycopg.Connection,
    user_id: str,
    centroid: np.ndarray,
    catalog_model_version: str = EMBEDDING_MODEL_VERSION,
    candidate_pool: int = 30,
    top_n: int = 20,
) -> list[dict[str, Any]]:
    """페르소나 centroid로 카탈로그 코사인 검색. UserTrack 제외.

    반환: [{track_id, title, artist, album_id, similarity}, ...] sorted desc.
    """
    _ensure_vector_registered(conn)
    centroid_np = np.asarray(centroid, dtype=np.float32)
    with conn.cursor() as cur:
        cur.execute(
            '''SELECT t.id, t.title, a.name AS artist, t."albumId",
                      1 - (e.embedding <=> %s) AS similarity
               FROM "TrackEmbedding" e
               JOIN "Track" t ON t.id = e."trackId"
               JOIN "Artist" a ON a.id = t."artistId"
               WHERE e."modelVersion" = %s
                 AND t."inEmp" = TRUE
                 AND t.id NOT IN (
                   SELECT "trackId" FROM "UserTrack" WHERE "userId" = %s
                 )
                 AND t.id NOT IN (
                   SELECT "targetId" FROM "UserBlocked"
                     WHERE "userId" = %s AND "targetType" = 'track' AND reason IN ('disliked', 'dismissed')
                   UNION
                   SELECT tt.id FROM "Track" tt
                     JOIN "UserBlocked" ub
                       ON ub."targetId" = tt."albumId" AND ub."targetType" = 'album'
                     WHERE ub."userId" = %s AND ub.reason IN ('disliked', 'dismissed')
                 )
               ORDER BY e.embedding <=> %s
               LIMIT %s''',
            (centroid_np, catalog_model_version, user_id, user_id, user_id, centroid_np, candidate_pool),
        )
        rows = cur.fetchall()
    results = [
        {
            "track_id": r[0],
            "title": r[1],
            "artist": r[2],
            "album_id": r[3],
            "similarity": float(r[4]),
        }
        for r in rows
    ]
    return results[:top_n]


def fetch_user_track_matrix(
    conn: psycopg.Connection,
    user_id: str,
    catalog_model_version: str = CATALOG_MODEL_VERSION,
) -> tuple[list[str], np.ndarray]:
    """UserTrack의 256d 임베딩 행렬 (track_ids, X(N,256))."""
    _ensure_vector_registered(conn)
    with conn.cursor() as cur:
        cur.execute(
            '''SELECT ut."trackId", e.embedding
               FROM "UserTrack" ut
               JOIN "TrackEmbedding" e ON e."trackId" = ut."trackId"
               WHERE ut."userId" = %s AND e."modelVersion" = %s''',
            (user_id, catalog_model_version),
        )
        rows = cur.fetchall()
    if not rows:
        return [], np.zeros((0, settings.embedding_dim), dtype=np.float32)
    track_ids = [r[0] for r in rows]
    embs: list[np.ndarray] = []
    for r in rows:
        v = r[1]
        if isinstance(v, str):
            v = np.fromstring(v.strip("[]"), sep=",", dtype=np.float32)
        embs.append(np.asarray(v, dtype=np.float32))
    return track_ids, np.vstack(embs)


def generate_user_mrt(
    conn: psycopg.Connection,
    user_id: str,
    *,
    k: int = DEFAULT_K,
    top_n: int = DEFAULT_TOP_N,
    candidate_pool: int = DEFAULT_CANDIDATE_POOL,
) -> int | None:
    """UserTrack 임베딩 → cluster → UserEmbedding/UserPersona → search → PlaylistHistory.

    반환: 사용한 트랙 수(성공) / None(트랙<k → skip). **커밋은 호출자 책임.**
    run_onboarding·scripts/09·regenerate_mrt 스테이지가 공유한다 (단일 출처).
    주의: MODEL_VERSION이 "+persona-K3"로 고정이므로 모든 호출자는 k=DEFAULT_K(3)를 쓴다. k를 바꾸려면 MODEL_VERSION 상수도 함께 수정해야 modelVersion 태그가 어긋나지 않는다.
    """
    track_ids, X = fetch_user_track_matrix(conn, user_id)
    if len(track_ids) < k:
        return None

    result = cluster_user_tracks(X, k=k)
    user_vec = aggregate_user_vector(result.centroids, result.weights)
    upsert_user_embedding(conn, user_id, MODEL_VERSION, user_vec, computed_from=len(track_ids))
    for idx in range(k):
        upsert_user_persona(
            conn, user_id, persona_idx=idx,
            embedding=result.centroids[idx], track_count=int(result.weights[idx]),
        )
    for idx in range(k):
        recs = search_for_persona(
            conn, user_id, result.centroids[idx],
            catalog_model_version=CATALOG_MODEL_VERSION,
            candidate_pool=candidate_pool, top_n=top_n,
        )
        insert_playlist_history(
            conn, user_id, [r["track_id"] for r in recs], MODEL_VERSION,
            context={"personaIdx": idx, "kind": "persona",
                     "scores": [r["similarity"] for r in recs]},
        )

    # EMP-밖 discovery (best-effort) — 실패해도 MRT 생성/커밋을 막지 않는다.
    # rollback 금지(위 persona 쓰기를 같은 트랜잭션에서 잃음). discovery는 EMPSource에만 적재.
    try:
        generate_user_discovery(conn, user_id)
    except Exception as e:  # noqa: BLE001 — best-effort
        log.warning("discovery skipped for %s: %r", user_id, e)

    # 취향 맞춤 신보 (best-effort) — discovery와 동일 규약. EMPSource(new_release)에만 적재.
    try:
        generate_user_newrelease(conn, user_id)
    except Exception as e:  # noqa: BLE001 — best-effort
        log.warning("new_release skipped for %s: %r", user_id, e)

    return len(track_ids)


def select_stale_mrt_users(conn: psycopg.Connection, *, k: int = DEFAULT_K) -> list[str]:
    """MRT 재생성 대상 유저: 현재 임베딩 보유 UserTrack 수가 k 이상이고,
    그 수가 마지막 MRT 계산 시점(UserEmbedding.computedFrom, 없으면 0)보다 큰 유저.

    신규 유저(UserEmbedding 없음=baseline 0) + 미스곡 임베딩으로 카운트 오른
    기존 유저 둘 다 포착. computedFrom == 현재 수면 MRT가 최신 → 제외.
    """
    with conn.cursor() as cur:
        cur.execute(
            '''SELECT u.id
               FROM "User" u
               JOIN LATERAL (
                 SELECT count(*) AS cnt
                 FROM "UserTrack" ut
                 JOIN "TrackEmbedding" e ON e."trackId" = ut."trackId"
                 WHERE ut."userId" = u.id AND e."modelVersion" = %s
               ) c ON TRUE
               LEFT JOIN "UserEmbedding" ue
                 ON ue."userId" = u.id AND ue."modelVersion" = %s
               WHERE c.cnt >= %s
                 AND c.cnt > COALESCE(ue."computedFrom", 0)''',
            (CATALOG_MODEL_VERSION, MODEL_VERSION, k),
        )
        return [r[0] for r in cur.fetchall()]


def derive_recommended_tracks(
    playlists: list[dict[str, Any]],
    top_n: int = 20,
) -> list[dict[str, Any]]:
    """페르소나 플레이리스트들에서 dedup + max score.

    playlists 각 항목: {context: {personaIdx}, trackIds, scores}
    반환: [{track_id, score, persona_idx}, ...] sorted desc — 총 top_n개.
    """
    best: dict[str, dict[str, Any]] = {}
    for pl in playlists:
        persona_idx = (pl.get("context") or {}).get("personaIdx")
        track_ids = pl.get("trackIds") or []
        scores = pl.get("scores") or [0.0] * len(track_ids)
        for tid, sc in zip(track_ids, scores):
            existing = best.get(tid)
            if existing is None or sc > existing["score"]:
                best[tid] = {
                    "track_id": tid,
                    "score": float(sc),
                    "persona_idx": persona_idx,
                }
    items = list(best.values())
    items.sort(key=lambda r: -r["score"])
    return items[:top_n]


def derive_recommended_albums(
    playlists: list[dict[str, Any]],
    track_to_album: dict[str, str | None],
    top_n: int = 15,
) -> list[dict[str, Any]]:
    """페르소나 플레이리스트들에서 album별 추천 트랙 수 집계.

    track_to_album: track_id → album_id (None 가능, skip)
    반환: [{album_id, track_count}, ...] sorted desc.
    """
    counts: dict[str, int] = defaultdict(int)
    seen_pairs: set[tuple[str, str]] = set()
    for pl in playlists:
        for tid in (pl.get("trackIds") or []):
            album_id = track_to_album.get(tid)
            if not album_id:
                continue
            pair = (album_id, tid)
            if pair in seen_pairs:
                continue
            seen_pairs.add(pair)
            counts[album_id] += 1
    items = [{"album_id": aid, "track_count": cnt} for aid, cnt in counts.items()]
    items.sort(key=lambda r: -r["track_count"])
    return items[:top_n]
