"""MRT 생성/갱신 CLI.

본인 (또는 모든) 사용자의 UserTrack을 K-means로 클러스터링,
UserEmbedding + UserPersona UPSERT, 페르소나별 추천 검색,
PlaylistHistory 3행 INSERT.

사용:
    python3 scripts/09_generate_mrt.py --email me@example.com
    python3 scripts/09_generate_mrt.py --all
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

import numpy as np
import psycopg
from dotenv import load_dotenv
from pgvector.psycopg import register_vector
from rich.console import Console

from mrms.config import EMBEDDING_MODEL_VERSION
from mrms.db.user_embedding import (
    upsert_user_embedding,
    upsert_user_persona,
    insert_playlist_history,
    list_all_user_emails,
)
from mrms.db.user_track import get_or_create_user
from mrms.recsys.mrt import search_for_persona
from mrms.recsys.persona import (
    NotEnoughTracksError,
    aggregate_user_vector,
    cluster_user_tracks,
)


MODEL_VERSION = f"{EMBEDDING_MODEL_VERSION}+persona-K3"
CATALOG_MODEL_VERSION = EMBEDDING_MODEL_VERSION

load_dotenv(override=True)
console = Console()


def fetch_user_track_matrix(
    conn: psycopg.Connection,
    user_id: str,
    catalog_model_version: str = CATALOG_MODEL_VERSION,
) -> tuple[list[str], np.ndarray]:
    """UserTrack의 256d 임베딩 행렬 반환."""
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
        return [], np.zeros((0, 256), dtype=np.float32)
    track_ids = [r[0] for r in rows]
    # register_vector가 호출됐다면 ndarray, 아니면 string
    embeddings = []
    for r in rows:
        v = r[1]
        if isinstance(v, str):
            v = np.fromstring(v.strip("[]"), sep=",", dtype=np.float32)
        embeddings.append(np.asarray(v, dtype=np.float32))
    X = np.vstack(embeddings)
    return track_ids, X


def generate_for_user(conn: psycopg.Connection, email: str, k: int, top_n: int, candidate_pool: int) -> bool:
    """단일 사용자 MRT 생성. True=성공, False=skip."""
    console.print(f"\n[bold]== {email} ==[/bold]")
    user_id = get_or_create_user(conn, email)
    conn.commit()

    track_ids, X = fetch_user_track_matrix(conn, user_id)
    console.print(f"  UserTrack 임베딩: [bold]{len(track_ids)}[/bold]")
    if len(track_ids) < k:
        console.print(f"  [yellow]skip — 트랙 수 < K({k})[/yellow]")
        return False

    try:
        result = cluster_user_tracks(X, k=k)
    except NotEnoughTracksError as e:
        console.print(f"  [yellow]skip — {e}[/yellow]")
        return False
    console.print(f"  K-means 클러스터 크기: {result.weights.tolist()}")

    user_vec = aggregate_user_vector(result.centroids, result.weights)
    upsert_user_embedding(conn, user_id, MODEL_VERSION, user_vec, computed_from=len(track_ids))

    for idx in range(k):
        upsert_user_persona(
            conn, user_id, persona_idx=idx,
            embedding=result.centroids[idx],
            track_count=int(result.weights[idx]),
        )

    for idx in range(k):
        recs = search_for_persona(
            conn, user_id, result.centroids[idx],
            catalog_model_version=CATALOG_MODEL_VERSION,
            candidate_pool=candidate_pool,
            top_n=top_n,
        )
        track_id_list = [r["track_id"] for r in recs]
        score_list = [r["similarity"] for r in recs]
        insert_playlist_history(
            conn, user_id, track_id_list, MODEL_VERSION,
            context={"personaIdx": idx, "kind": "persona", "scores": score_list},
        )
        console.print(f"  페르소나 {idx} 추천: {len(track_id_list)}곡")

    conn.commit()
    console.print("  [green]✓ MRT 적재 완료[/green]")
    return True


def main() -> None:
    parser = argparse.ArgumentParser()
    grp = parser.add_mutually_exclusive_group(required=True)
    grp.add_argument("--email", type=str)
    grp.add_argument("--all", action="store_true")
    parser.add_argument("--k", type=int, default=3)
    parser.add_argument("--persona-top-n", type=int, default=20)
    parser.add_argument("--candidate-pool", type=int, default=30)
    args = parser.parse_args()

    dsn = os.environ.get("DATABASE_URL", "postgresql://mrms:mrms@localhost:5433/mrms")
    with psycopg.connect(dsn, autocommit=False) as conn:
        register_vector(conn)  # 모든 vector fetch에 영향
        if args.email:
            ok = generate_for_user(conn, args.email, args.k, args.persona_top_n, args.candidate_pool)
            sys.exit(0 if ok else 1)
        # --all
        emails = list_all_user_emails(conn)
        console.print(f"전체 사용자: [bold]{len(emails)}[/bold]")
        success = 0
        for email in emails:
            try:
                if generate_for_user(conn, email, args.k, args.persona_top_n, args.candidate_pool):
                    success += 1
            except Exception as e:
                console.print(f"  [red]사용자 {email} 실패: {e}[/red]")
                conn.rollback()
        console.print(f"\n[bold]총 {success}/{len(emails)} 사용자 MRT 적재[/bold]")


if __name__ == "__main__":
    main()
