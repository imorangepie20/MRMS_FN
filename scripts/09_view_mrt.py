"""MRT 조회/검증 CLI.

사용자의 latest MRT (페르소나별 플레이리스트, 추천 트랙, 추천 앨범) 출력.

사용:
    python3 scripts/09_view_mrt.py --email me@example.com
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

import psycopg
from dotenv import load_dotenv
from rich.console import Console
from rich.table import Table

from mrms.db.user_embedding import fetch_latest_playlists
from mrms.db.user_track import get_or_create_user
from mrms.recsys.mrt import derive_recommended_albums, derive_recommended_tracks


load_dotenv(override=True)
console = Console()


def fetch_track_metadata(
    conn: psycopg.Connection,
    track_ids: list[str],
) -> dict[str, dict]:
    """track_id → {title, artist, album_id, album_title} 매핑."""
    if not track_ids:
        return {}
    with conn.cursor() as cur:
        cur.execute(
            '''SELECT t.id, t.title, a.name, t."albumId", alb.title
               FROM "Track" t
               JOIN "Artist" a ON a.id = t."artistId"
               LEFT JOIN "Album" alb ON alb.id = t."albumId"
               WHERE t.id = ANY(%s)''',
            (track_ids,),
        )
        rows = cur.fetchall()
    return {
        r[0]: {
            "title": r[1],
            "artist": r[2],
            "album_id": r[3],
            "album_title": r[4],
        }
        for r in rows
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--email", required=True)
    parser.add_argument("--top-n", type=int, default=10, help="페르소나당 표시 곡 수")
    args = parser.parse_args()

    dsn = os.environ.get("DATABASE_URL", "postgresql://mrms:mrms@localhost:5433/mrms")
    with psycopg.connect(dsn, autocommit=False) as conn:
        user_id = get_or_create_user(conn, args.email)
        conn.commit()

        playlists = fetch_latest_playlists(conn, user_id, limit=3)
        if len(playlists) < 3:
            console.print(f"[yellow]MRT 데이터 부족: {len(playlists)}개 플레이리스트만 존재. 먼저 09_generate_mrt.py 실행.[/yellow]")
            sys.exit(1)

        playlists_sorted = sorted(
            playlists,
            key=lambda p: (p.get("context") or {}).get("personaIdx", 999),
        )

        all_track_ids = list({tid for p in playlists_sorted for tid in p["trackIds"]})
        meta = fetch_track_metadata(conn, all_track_ids)

        for p in playlists_sorted:
            ctx = p.get("context") or {}
            persona_idx = ctx.get("personaIdx", "?")
            scores = ctx.get("scores", [])
            console.print(f"\n[bold cyan]━━━ 페르소나 {persona_idx} ━━━[/bold cyan]")
            table = Table(show_header=True, header_style="bold")
            table.add_column("#", width=3)
            table.add_column("title")
            table.add_column("artist")
            table.add_column("similarity", width=10)
            for i, (tid, sc) in enumerate(zip(p["trackIds"][:args.top_n], scores[:args.top_n]), 1):
                m = meta.get(tid, {})
                table.add_row(
                    str(i),
                    m.get("title", "?")[:50],
                    m.get("artist", "?")[:30],
                    f"{sc:.3f}",
                )
            console.print(table)

        playlists_with_scores = [
            {
                "context": p.get("context") or {},
                "trackIds": p["trackIds"],
                "scores": (p.get("context") or {}).get("scores", []),
            }
            for p in playlists_sorted
        ]
        rec_tracks = derive_recommended_tracks(playlists_with_scores, top_n=args.top_n)
        console.print(f"\n[bold magenta]━━━ 추천 트랙 (top-{len(rec_tracks)}) ━━━[/bold magenta]")
        rt_table = Table(show_header=True, header_style="bold")
        rt_table.add_column("#", width=3)
        rt_table.add_column("title")
        rt_table.add_column("artist")
        rt_table.add_column("from persona", width=12)
        rt_table.add_column("score", width=8)
        for i, t in enumerate(rec_tracks, 1):
            m = meta.get(t["track_id"], {})
            rt_table.add_row(
                str(i),
                m.get("title", "?")[:50],
                m.get("artist", "?")[:30],
                str(t.get("persona_idx", "?")),
                f"{t['score']:.3f}",
            )
        console.print(rt_table)

        track_to_album = {tid: m["album_id"] for tid, m in meta.items()}
        rec_albums = derive_recommended_albums(playlists_with_scores, track_to_album, top_n=5)
        console.print(f"\n[bold green]━━━ 추천 앨범 (top-{len(rec_albums)}) ━━━[/bold green]")
        album_ids = [r["album_id"] for r in rec_albums]
        album_titles = {}
        if album_ids:
            with conn.cursor() as cur:
                cur.execute(
                    'SELECT alb.id, alb.title, a.name FROM "Album" alb JOIN "Artist" a ON a.id = alb."artistId" WHERE alb.id = ANY(%s)',
                    (album_ids,),
                )
                for row in cur.fetchall():
                    album_titles[row[0]] = (row[1], row[2])
        for i, r in enumerate(rec_albums, 1):
            title, artist = album_titles.get(r["album_id"], ("?", "?"))
            console.print(f"  {i}. {title} - {artist} ({r['track_count']}곡 추천)")


if __name__ == "__main__":
    main()
