"""YouTube 미스곡(videoId 보유·임베딩 없음) → 훅 30초 오디오 저장.

저장 경로: {AUDIO_DIR}/youtube_{videoId}.m4a

이후 기존 파이프라인으로 임베딩:
    python scripts/03_extract_embeddings.py
    python scripts/10_load_emp_embeddings.py

스로틀: 다운로드 간 sleep(기본 3초) + 동시성 1. YouTube IP 차단 방지.
실패(차단/삭제/지역제한)는 logs/youtube_download_failed.csv 기록 후 스킵.
"""
from __future__ import annotations

import argparse
import csv
import os
import random
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

import psycopg
from rich.console import Console

from mrms.config import settings
from mrms.ingest.youtube_audio import download_and_clip

console = Console()

MISS_SQL = """
    SELECT DISTINCT t.id, tp."platformTrackId" AS video_id, t.title, ar.name AS artist
    FROM "Track" t
    JOIN "TrackPlatform" tp ON tp."trackId" = t.id AND tp.platform = 'youtube'
    JOIN "Artist" ar ON ar.id = t."artistId"
    WHERE tp."platformTrackId" NOT LIKE 'yt\\_%%'
      AND (EXISTS (SELECT 1 FROM "UserTrack" ut WHERE ut."trackId" = t.id)
           OR EXISTS (SELECT 1 FROM "EMPSource" es
                      WHERE es."trackId" = t.id
                        AND es.source_type IN ('discovery', 'new_release')))
      AND NOT EXISTS (SELECT 1 FROM "TrackEmbedding" e WHERE e."trackId" = t.id)
    LIMIT %s
"""


def fetch_youtube_misses(conn: psycopg.Connection, limit: int) -> list[dict]:
    with conn.cursor() as cur:
        cur.execute(MISS_SQL, (limit,))
        return [
            {"track_id": r[0], "video_id": r[1], "title": r[2], "artist": r[3]}
            for r in cur.fetchall()
        ]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=200)
    ap.add_argument("--sleep", type=float, default=3.0, help="다운로드 간 평균 대기(초)")
    ap.add_argument("--audio-dir", type=Path, default=settings.audio_dir)
    args = ap.parse_args()

    conn = psycopg.connect(os.environ["DATABASE_URL"])
    try:
        misses = fetch_youtube_misses(conn, args.limit)
    finally:
        conn.close()
    console.print(f"미스곡: [bold]{len(misses)}[/bold] (limit={args.limit})")

    log_dir = settings.log_dir
    log_dir.mkdir(parents=True, exist_ok=True)
    failed: list[dict] = []
    ok = 0
    for i, m in enumerate(misses, 1):
        dest = args.audio_dir / f"youtube_{m['video_id']}.m4a"
        if dest.exists() and dest.stat().st_size > 5_000:
            ok += 1
            continue
        try:
            download_and_clip(
                m["video_id"], dest,
                offset_ratio=settings.youtube_clip_offset_ratio,
            )
            ok += 1
        except Exception as e:  # 차단/삭제/지역제한 — 스킵
            failed.append({**m, "error": str(e)[:200]})
        console.print(f"  [{i}/{len(misses)}] {m['artist']} — {m['title']}: "
                      f"{'ok' if dest.exists() else 'fail'}")
        time.sleep(args.sleep + random.uniform(0, args.sleep))

    if failed:
        with open(log_dir / "youtube_download_failed.csv", "w", newline="") as f:
            w = csv.DictWriter(
                f, fieldnames=["track_id", "video_id", "title", "artist", "error"]
            )
            w.writeheader()
            w.writerows(failed)
    console.print(f"[green]✓ 오디오 확보:[/green] {ok}  [red]✗ 실패:[/red] {len(failed)}")
    console.print(
        "다음: python scripts/03_extract_embeddings.py && "
        "python scripts/10_load_emp_embeddings.py"
    )


if __name__ == "__main__":
    main()
