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

import psycopg
from dotenv import load_dotenv
from pgvector.psycopg import register_vector
from rich.console import Console

from mrms.db.user_embedding import list_all_user_emails
from mrms.db.user_track import get_or_create_user

load_dotenv(override=True)
console = Console()


def generate_for_user(conn: psycopg.Connection, email: str, k: int, top_n: int, candidate_pool: int) -> bool:
    """단일 사용자 MRT 생성. True=성공, False=skip."""
    from mrms.recsys.mrt import generate_user_mrt

    console.print(f"\n[bold]== {email} ==[/bold]")
    user_id = get_or_create_user(conn, email)
    conn.commit()

    n = generate_user_mrt(conn, user_id, k=k, top_n=top_n, candidate_pool=candidate_pool)
    if n is None:
        console.print(f"  [yellow]skip — 트랙 임베딩 < K({k})[/yellow]")
        return False
    conn.commit()
    console.print(f"  [green]✓ MRT 적재 완료 ({n}곡)[/green]")
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
