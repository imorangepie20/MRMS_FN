"""UserEmbedding / UserPersona / PlaylistHistory DB ops.

pgvector vector(256) 타입은 list[float]로 넘김 (psycopg가 자동 변환).
fetch 결과는 numpy array로 변환.
"""
from __future__ import annotations

import hashlib
import json
import secrets
from typing import Any

import numpy as np
import psycopg
from pgvector.psycopg import register_vector


def _id(value: str) -> str:
    h = hashlib.sha1(value.encode()).hexdigest()[:24]
    return f"c{h}"


def _ensure_vector_registered(conn: psycopg.Connection) -> None:
    """idempotent register_vector — 같은 connection에 반복 호출 안전."""
    if getattr(conn, "_mrms_vector_registered", False):
        return
    register_vector(conn)
    conn._mrms_vector_registered = True  # type: ignore[attr-defined]


def upsert_user_embedding(
    conn: psycopg.Connection,
    user_id: str,
    model_version: str,
    embedding: np.ndarray,
    computed_from: int,
) -> None:
    _ensure_vector_registered(conn)
    with conn.cursor() as cur:
        cur.execute(
            '''INSERT INTO "UserEmbedding"
                 ("userId", "modelVersion", embedding, "computedFrom", "updatedAt")
               VALUES (%s, %s, %s, %s, NOW())
               ON CONFLICT ("userId", "modelVersion") DO UPDATE SET
                 embedding = EXCLUDED.embedding,
                 "computedFrom" = EXCLUDED."computedFrom",
                 "updatedAt" = NOW()''',
            (user_id, model_version, np.asarray(embedding, dtype=np.float32), computed_from),
        )


def fetch_user_embedding(
    conn: psycopg.Connection,
    user_id: str,
    model_version: str,
) -> dict[str, Any] | None:
    _ensure_vector_registered(conn)
    with conn.cursor() as cur:
        cur.execute(
            '''SELECT embedding, "computedFrom", "updatedAt"
               FROM "UserEmbedding"
               WHERE "userId" = %s AND "modelVersion" = %s''',
            (user_id, model_version),
        )
        row = cur.fetchone()
    if row is None:
        return None
    return {
        "embedding": np.asarray(row[0], dtype=np.float32),
        "computedFrom": row[1],
        "updatedAt": row[2],
    }


def upsert_user_persona(
    conn: psycopg.Connection,
    user_id: str,
    persona_idx: int,
    embedding: np.ndarray,
    track_count: int,
) -> str:
    _ensure_vector_registered(conn)
    row_id = _id(f"persona|{user_id}|{persona_idx}")
    with conn.cursor() as cur:
        cur.execute(
            '''INSERT INTO "UserPersona"
                 (id, "userId", "personaIdx", embedding, "trackCount")
               VALUES (%s, %s, %s, %s, %s)
               ON CONFLICT ("userId", "personaIdx") DO UPDATE SET
                 embedding = EXCLUDED.embedding,
                 "trackCount" = EXCLUDED."trackCount"''',
            (row_id, user_id, persona_idx, np.asarray(embedding, dtype=np.float32), track_count),
        )
    return row_id


def list_user_personas(
    conn: psycopg.Connection,
    user_id: str,
) -> list[dict[str, Any]]:
    _ensure_vector_registered(conn)
    with conn.cursor() as cur:
        cur.execute(
            '''SELECT id, "personaIdx", embedding, "trackCount"
               FROM "UserPersona"
               WHERE "userId" = %s
               ORDER BY "personaIdx"''',
            (user_id,),
        )
        rows = cur.fetchall()
    return [
        {
            "id": r[0],
            "personaIdx": r[1],
            "embedding": np.asarray(r[2], dtype=np.float32),
            "trackCount": r[3],
        }
        for r in rows
    ]


def insert_playlist_history(
    conn: psycopg.Connection,
    user_id: str,
    track_ids: list[str],
    model_version: str,
    context: dict[str, Any],
) -> str:
    # generation별 고유 ID — random salt
    row_id = "c" + hashlib.sha1(
        f"{user_id}|{model_version}|{secrets.token_hex(8)}".encode()
    ).hexdigest()[:24]
    with conn.cursor() as cur:
        # clock_timestamp() — 같은 transaction 내 statement별로 다른 시각.
        # NOW()(=transaction_timestamp)는 동일 transaction에서 동일 값.
        cur.execute(
            '''INSERT INTO "PlaylistHistory"
                 (id, "userId", "trackIds", "modelVersion", context, "generatedAt")
               VALUES (%s, %s, %s, %s, %s::jsonb, clock_timestamp())''',
            (row_id, user_id, track_ids, model_version, json.dumps(context)),
        )
    return row_id


def fetch_latest_playlists(
    conn: psycopg.Connection,
    user_id: str,
    limit: int = 3,
) -> list[dict[str, Any]]:
    with conn.cursor() as cur:
        cur.execute(
            '''SELECT id, "trackIds", "modelVersion", context, "generatedAt"
               FROM "PlaylistHistory"
               WHERE "userId" = %s
               ORDER BY "generatedAt" DESC
               LIMIT %s''',
            (user_id, limit),
        )
        rows = cur.fetchall()
    return [
        {
            "id": r[0],
            "trackIds": list(r[1]),
            "modelVersion": r[2],
            "context": r[3] if r[3] else {},
            "generatedAt": r[4],
        }
        for r in rows
    ]


def list_all_user_emails(conn: psycopg.Connection) -> list[str]:
    with conn.cursor() as cur:
        cur.execute('SELECT email FROM "User" ORDER BY "createdAt"')
        rows = cur.fetchall()
    return [r[0] for r in rows]
