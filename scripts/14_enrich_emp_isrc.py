"""EMP 합성-ISRC 트랙 enrichment — Deezer real ISRC 역해결 → 머지/re-key.

합성 ISRC(언더스코어 포함) EMP 트랙을 Deezer 텍스트로 real ISRC 해결한 뒤:
  - real ISRC가 카탈로그에 있으면 머지(중복 제거, 임베딩 재사용)
  - 신곡이면 isrc 갱신 → 02(ISRC)→03→10 임베딩

Usage:
    python scripts/14_enrich_emp_isrc.py --dry-run --limit 50
    python scripts/14_enrich_emp_isrc.py --limit 5000
    python scripts/14_enrich_emp_isrc.py --concurrency 20
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

import httpx
import psycopg
from rich.console import Console
from rich.progress import (
    BarColumn,
    MofNCompleteColumn,
    Progress,
    SpinnerColumn,
    TextColumn,
    TimeRemainingColumn,
)

from mrms.emp.isrc_enrich import (
    apply_with_recheck,
    classify_one,
    fetch_synthetic_emp_tracks,
)

console = Console()


def _progress() -> Progress:
    return Progress(
        SpinnerColumn(),
        TextColumn("[bold blue]{task.description}"),
        BarColumn(),
        MofNCompleteColumn(),
        TextColumn("[cyan]{task.percentage:>3.0f}%"),
        TimeRemainingColumn(),
        console=console,
    )


async def run(conn: psycopg.Connection, limit: int, dry_run: bool, concurrency: int) -> None:
    tracks = fetch_synthetic_emp_tracks(conn, limit=limit)
    console.print(f"합성-ISRC EMP 트랙: [bold]{len(tracks):,}[/bold] "
                  f"({'DRY-RUN' if dry_run else 'LIVE'}, concurrency={concurrency})")
    if not tracks:
        console.print("[green]대상 없음.[/green]")
        return

    sem = asyncio.Semaphore(concurrency)

    # 1) classify (Deezer 역해결) — 동시 실행, 진행바
    with _progress() as progress:
        task = progress.add_task("Deezer 역해결(classify)", total=len(tracks))

        async with httpx.AsyncClient(
            timeout=15.0, headers={"User-Agent": "MRMS/0.1 (+research)"}
        ) as client:
            async def classify(t):
                async with sem:
                    r = await classify_one(conn, client, t)
                progress.advance(task)
                return t, r

            results = await asyncio.gather(*[classify(t) for t in tracks])

    # classify는 읽기 전용 — 누적된 읽기 트랜잭션 닫기(stale snapshot/long-open tx 방지)
    conn.rollback()

    counts: Counter = Counter()
    samples: list[str] = []

    def _sample(action: str, real_isrc: str | None, t) -> None:
        if len(samples) < 15:
            samples.append(
                f"  {action:5} {t.isrc} → {real_isrc or '-'}  | {t.artist} — {t.title}"
            )

    if dry_run:
        for t, (action, real_isrc, _canon) in results:
            _sample(action, real_isrc, t)
            counts[action] += 1
    else:
        # 2) apply (merge/rekey) — 순차(같은 conn 보호), 진행바 + 라이브 카운트
        with _progress() as progress:
            task = progress.add_task("apply", total=len(results))
            for t, (action, real_isrc, canonical_id) in results:
                _sample(action, real_isrc, t)
                # 트랙별 격리(spec §7): 1건 실패가 전체 run을 오염시키지 않게 rollback 후 계속
                try:
                    final = apply_with_recheck(conn, t, action, real_isrc, canonical_id)
                    counts[final] += 1
                except Exception as e:  # noqa: BLE001 — per-track isolation per spec §7
                    conn.rollback()
                    console.print(
                        f"[red]apply 실패[/red] {t.isrc} {t.artist} — {t.title}: {e}"
                    )
                    counts["error"] += 1
                progress.update(
                    task, advance=1,
                    description=(f"apply m{counts['merge']} r{counts['rekey']} "
                                 f"s{counts['skip']}"),
                )

    console.print("\n".join(samples))
    verb = "would" if dry_run else "did"
    console.print(
        f"\n[bold]{verb}[/bold]: merge {counts['merge']:,} / "
        f"rekey {counts['rekey']:,} / skip {counts['skip']:,} / error {counts['error']:,}"
    )


def main() -> None:
    ap = argparse.ArgumentParser(description="EMP 합성-ISRC enrichment")
    ap.add_argument("--limit", type=int, default=0, help="0 = 전체")
    ap.add_argument("--dry-run", action="store_true", help="변형 없이 분류만")
    ap.add_argument("--concurrency", type=int, default=8,
                    help="Deezer rate-limit 고려 — 너무 높이면 429 재시도로 오히려 느려짐")
    args = ap.parse_args()

    conn = psycopg.connect(os.environ["DATABASE_URL"])
    try:
        asyncio.run(run(conn, args.limit, args.dry_run, args.concurrency))
    finally:
        conn.close()


if __name__ == "__main__":
    main()
