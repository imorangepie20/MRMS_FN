"""
Deezer Search/Lookup을 통해 카탈로그를 enrichment.

수행 작업:
    - ISRC 누락 행: 텍스트로 검색 → ISRC + preview URL 채움
    - ISRC 있는 행 (preview URL 없으면): ISRC lookup → preview URL 채움
    - 이미 preview URL 있는 행: skip

장점:
    - 무료, OAuth 불필요, quota 제한 없음
    - 한 번의 API 호출로 ISRC + preview URL 동시 획득
    - Spotify dev mode 차단 우회

Output:
    data/csv/ems_enriched.parquet   (전체 카탈로그, deezer_id/isrc/preview_url 채워짐)
    logs/enrich_deezer_summary.txt  (통계)

Usage:
    python3 scripts/01_enrich_via_deezer.py
    python3 scripts/01_enrich_via_deezer.py --limit 1000    # smoke test
    python3 scripts/01_enrich_via_deezer.py --concurrency 30
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

import httpx
import pandas as pd
from rich.console import Console
from rich.progress import (
    BarColumn,
    MofNCompleteColumn,
    Progress,
    SpinnerColumn,
    TextColumn,
    TimeRemainingColumn,
)

from mrms.config import settings
from mrms.data.catalog import load_catalog
from mrms.ingest.deezer import DeezerTrack, enrich_one

console = Console()


async def enrich(
    catalog_path: Path,
    out_path: Path,
    concurrency: int,
    limit: int = 0,
) -> None:
    df = load_catalog(catalog_path)
    console.print(f"Loaded [bold]{len(df):,}[/bold] rows from [cyan]{catalog_path}[/cyan]")

    # preview URL 없는 모든 행이 대상 (ISRC 유무 무관)
    target_mask = df["preview_url"].isna()
    target_indices = df.index[target_mask].tolist()
    if limit:
        target_indices = target_indices[:limit]
        console.print(f"[yellow]LIMIT MODE: only {limit} rows[/yellow]")
    console.print(f"Enrichment targets: [yellow]{len(target_indices):,}[/yellow]")

    if not target_indices:
        console.print("[green]Nothing to enrich.[/green]")
        df.to_parquet(out_path, index=False)
        return

    # 결과 저장용 — 인덱스별 enrichment 결과
    isrc_updates: dict[int, str] = {}
    preview_updates: dict[int, str] = {}
    deezer_id_updates: dict[int, int] = {}
    success_count = 0

    sem = asyncio.Semaphore(concurrency)

    async with httpx.AsyncClient(
        timeout=httpx.Timeout(15.0),
        limits=httpx.Limits(max_connections=concurrency * 2),
    ) as client:
        with Progress(
            SpinnerColumn(),
            TextColumn("[bold blue]{task.description}"),
            BarColumn(),
            MofNCompleteColumn(),
            TextColumn("[cyan]{task.percentage:>3.1f}%"),
            TimeRemainingColumn(),
            console=console,
        ) as progress:
            task = progress.add_task("deezer enrichment", total=len(target_indices))

            async def worker(idx: int) -> None:
                nonlocal success_count
                async with sem:
                    row = df.loc[idx]
                    isrc = row["isrc"] if pd.notna(row["isrc"]) else None
                    title = str(row["title"]) if pd.notna(row["title"]) else ""
                    artist = str(row["artists"]) if pd.notna(row["artists"]) else ""
                    try:
                        result: DeezerTrack | None = await enrich_one(
                            client, isrc, title, artist
                        )
                    except Exception:
                        result = None
                    if result:
                        if result.get("isrc") and not isrc:
                            isrc_updates[idx] = result["isrc"]
                        if result.get("preview_url"):
                            preview_updates[idx] = result["preview_url"]
                            success_count += 1
                        if result.get("deezer_id"):
                            deezer_id_updates[idx] = result["deezer_id"]
                progress.advance(task)

            await asyncio.gather(*[worker(idx) for idx in target_indices])

    # DataFrame 업데이트
    if "deezer_id" not in df.columns:
        df["deezer_id"] = pd.NA
    for idx, isrc in isrc_updates.items():
        df.at[idx, "isrc"] = isrc
    for idx, url in preview_updates.items():
        df.at[idx, "preview_url"] = url
    for idx, did in deezer_id_updates.items():
        df.at[idx, "deezer_id"] = did

    out_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(out_path, index=False)

    # 요약
    total_isrc = df["isrc"].notna().sum()
    total_preview = df["preview_url"].notna().sum()
    total_deezer = df["deezer_id"].notna().sum()

    console.print()
    console.print(f"[green]✓ Saved →[/green] {out_path}")
    console.print()
    console.print(f"새로 채워진 ISRC:        [green]{len(isrc_updates):,}[/green]")
    console.print(f"새로 채워진 preview URL: [green]{len(preview_updates):,}[/green]")
    console.print(f"새로 채워진 deezer_id:   [green]{len(deezer_id_updates):,}[/green]")
    console.print()
    console.print(
        f"전체 ISRC 커버리지:        [bold]{total_isrc:,}[/bold] / {len(df):,} "
        f"([cyan]{total_isrc / len(df) * 100:.1f}%[/cyan])"
    )
    console.print(
        f"전체 preview URL 커버리지: [bold]{total_preview:,}[/bold] / {len(df):,} "
        f"([cyan]{total_preview / len(df) * 100:.1f}%[/cyan])"
    )
    console.print(
        f"Enrichment 성공률:         [bold]{success_count:,}[/bold] / {len(target_indices):,} "
        f"([cyan]{success_count / max(len(target_indices), 1) * 100:.1f}%[/cyan])"
    )

    summary = (
        f"Total rows:               {len(df):,}\n"
        f"Enrichment targets:       {len(target_indices):,}\n"
        f"New ISRCs added:          {len(isrc_updates):,}\n"
        f"New preview URLs added:   {len(preview_updates):,}\n"
        f"New deezer_ids added:     {len(deezer_id_updates):,}\n"
        f"Total ISRC coverage:      {total_isrc:,}\n"
        f"Total preview coverage:   {total_preview:,}\n"
        f"Enrichment success rate:  {success_count / max(len(target_indices), 1) * 100:.1f}%\n"
    )
    settings.log_dir.mkdir(parents=True, exist_ok=True)
    (settings.log_dir / "enrich_deezer_summary.txt").write_text(summary)


def main() -> None:
    parser = argparse.ArgumentParser(description="Enrich catalog via Deezer Search")
    parser.add_argument(
        "--catalog",
        type=Path,
        default=Path("data/csv/ems_collected_track.csv"),
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=Path("data/csv/ems_enriched.parquet"),
    )
    parser.add_argument("--concurrency", type=int, default=20)
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="테스트 모드: 첫 N개만 enrichment",
    )
    args = parser.parse_args()

    asyncio.run(enrich(args.catalog, args.out, args.concurrency, args.limit))


if __name__ == "__main__":
    main()
