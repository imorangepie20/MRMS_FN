"""MRT (Model Recommendation Tracks) — 페르소나별 pgvector 검색 + derive."""
from __future__ import annotations

from collections import defaultdict
from typing import Any

import numpy as np
import psycopg
from pgvector.psycopg import register_vector


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
    catalog_model_version: str = "our-v1.0",
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
                 AND t.id NOT IN (
                   SELECT "trackId" FROM "UserTrack" WHERE "userId" = %s
                 )
               ORDER BY e.embedding <=> %s
               LIMIT %s''',
            (centroid_np, catalog_model_version, user_id, centroid_np, candidate_pool),
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
