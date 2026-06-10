"""
다중 소스 audio preview 다운로더 (재개 가능).

Source 우선순위:
    1. 직접 preview_url (CSV에 이미 있음)
    2. iTunes Search by ISRC
    3. iTunes Search by 제목+아티스트 (fallback)

Output:
    {AUDIO_DIR}/{key}.m4a         key = ISRC or '{source}_{platform_track_id}'
    logs/download_success.csv     (key, source, url) 매핑
    logs/download_failed.csv      (key, title, artists, error) 실패 로그

Usage:
    python scripts/02_download_audio.py
    python scripts/02_download_audio.py --limit 100   # 테스트 모드
    python scripts/02_download_audio.py --emp-only --limit 50  # EMP 풀 DB에서 직접
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

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
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from mrms.config import settings
from mrms.data.catalog import derive_track_key, load_catalog
from mrms.db.emp import EMBEDDING_MODEL_VERSION
from mrms.ingest.deezer import lookup_by_isrc as deezer_lookup_isrc
from mrms.ingest.deezer import search_by_text as deezer_search_text
from mrms.ingest.itunes import search_by_isrc as itunes_isrc
from mrms.ingest.itunes import search_by_text as itunes_text

console = Console()


# ─── EMP DB 쿼리 ────────────────────────────────────────
def fetch_emp_pending(limit: int) -> list[dict]:
    """DB에서 EMP 풀 중 아직 임베딩 없는 트랙을 조회해 DataFrame-호환 dict 목록 반환.

    반환 dict 컬럼: title, artists, isrc, preview_url, source, platform_track_id
    (build_targets / derive_track_key 가 기대하는 형태와 동일)
    """
    import psycopg  # 런타임 import — CSV 경로에선 불필요

    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        console.print("[red]DATABASE_URL 환경변수가 설정되지 않았습니다.[/red]")
        sys.exit(1)

    sql = """
        SELECT t.id, t.title, ar.name AS artist, t.isrc,
               tp_tidal."platformTrackId" AS tidal_id,
               tp_spotify."platformTrackId" AS spotify_id
        FROM "Track" t
        JOIN "Artist" ar ON ar.id = t."artistId"
        LEFT JOIN "TrackPlatform" tp_tidal
          ON tp_tidal."trackId" = t.id AND tp_tidal.platform = 'tidal'
        LEFT JOIN "TrackPlatform" tp_spotify
          ON tp_spotify."trackId" = t.id AND tp_spotify.platform = 'spotify'
        WHERE t."inEmp" = TRUE
          AND NOT EXISTS (
            SELECT 1 FROM "TrackEmbedding" te
            WHERE te."trackId" = t.id AND te."modelVersion" = %s
          )
        ORDER BY t."createdAt" DESC
        LIMIT %s
    """

    rows: list[dict] = []
    conn = psycopg.connect(db_url)
    try:
        with conn.cursor() as cur:
            cur.execute(sql, (EMBEDDING_MODEL_VERSION, limit))
            for track_id, title, artist, isrc, tidal_id, spotify_id in cur.fetchall():
                # platform_track_id / source: tidal 우선, spotify 차선, DB id 최후
                if tidal_id:
                    source = "tidal"
                    platform_track_id = tidal_id
                elif spotify_id:
                    source = "spotify"
                    platform_track_id = spotify_id
                else:
                    source = "db"
                    platform_track_id = track_id
                rows.append(
                    {
                        "title": title or "",
                        "artists": artist or "",
                        "isrc": isrc,
                        "preview_url": None,  # DB엔 없음 — fallback chain 사용
                        "source": source,
                        "platform_track_id": platform_track_id,
                    }
                )
    finally:
        conn.close()

    return rows


# ─── Target row 정규화 ──────────────────────────────────
@dataclass(slots=True)
class TrackTarget:
    key: str
    preview_url: Optional[str]
    isrc: Optional[str]
    title: str
    artists: str


def build_targets(df: pd.DataFrame) -> list[TrackTarget]:
    """중복 dedupe + 정규화."""
    targets: list[TrackTarget] = []
    seen: set[str] = set()
    for row in df.itertuples():
        key = derive_track_key(row)
        if key in seen:
            continue
        seen.add(key)
        targets.append(
            TrackTarget(
                key=key,
                preview_url=(row.preview_url if pd.notna(row.preview_url) else None),
                isrc=(row.isrc if pd.notna(row.isrc) else None),
                title=str(row.title) if pd.notna(row.title) else "",
                artists=str(row.artists) if pd.notna(row.artists) else "",
            )
        )
    return targets


# ─── HTTP 다운로드 ──────────────────────────────────────
class DeadUrl(Exception):
    """4xx — 재시도해도 의미 없는 영구 실패."""


@retry(
    # 5xx/network/timeout만 재시도. 4xx는 즉시 fail (다음 source로 빠르게)
    retry=retry_if_exception_type(
        (httpx.TimeoutException, httpx.ConnectError, httpx.ReadError, httpx.RemoteProtocolError)
    ),
    stop=stop_after_attempt(2),
    wait=wait_exponential(multiplier=1, min=1, max=5),
    reraise=True,
)
async def fetch_bytes(client: httpx.AsyncClient, url: str) -> bytes:
    r = await client.get(url, timeout=15.0, follow_redirects=True)
    if r.status_code == 429:
        # rate limit — 1초 대기 후 한 번만 재시도 (구조적으로 막힌 거 아님)
        await asyncio.sleep(1.0)
        r = await client.get(url, timeout=15.0, follow_redirects=True)
    if r.status_code >= 400:
        raise DeadUrl(f"http {r.status_code}")
    if not r.content or len(r.content) < 5_000:
        raise DeadUrl(f"too small: {len(r.content)}")
    return r.content


# ─── 소스별 URL 해결자 (lazy, fallback chain) ───────────
async def _try_direct(_client, t) -> Optional[str]:
    return t.preview_url if t.preview_url else None


async def _try_deezer_isrc(client, t) -> Optional[str]:
    if not t.isrc:
        return None
    track = await deezer_lookup_isrc(client, t.isrc)
    return track.get("preview_url") if track else None


async def _try_deezer_text(client, t) -> Optional[str]:
    if not t.title:
        return None
    track = await deezer_search_text(client, t.title, t.artists)
    return track.get("preview_url") if track else None


async def _try_itunes_isrc(client, t) -> Optional[str]:
    if not t.isrc:
        return None
    return await itunes_isrc(client, t.isrc)


async def _try_itunes_text(client, t) -> Optional[str]:
    if not t.title:
        return None
    return await itunes_text(client, t.title, t.artists)


# 우선순위: 빠르고 정확한 것부터
SOURCE_CHAIN = [
    ("direct", _try_direct),
    ("deezer_isrc", _try_deezer_isrc),
    ("deezer_text", _try_deezer_text),
    ("itunes_isrc", _try_itunes_isrc),
    ("itunes_text", _try_itunes_text),
]


# ─── 단일 트랙 처리 (fallback chain) ────────────────────
async def process_one(
    client: httpx.AsyncClient,
    sem: asyncio.Semaphore,
    t: TrackTarget,
    audio_dir: Path,
) -> dict:
    out = audio_dir / f"{t.key}.m4a"
    if out.exists() and out.stat().st_size > 5_000:
        return {"key": t.key, "source": "cached", "url": None, "error": None}

    async with sem:
        errors: list[str] = []
        for src_name, resolver in SOURCE_CHAIN:
            try:
                url = await resolver(client, t)
            except Exception as e:
                errors.append(f"{src_name}_resolve:{str(e)[:80]}")
                continue
            if not url:
                continue
            try:
                data = await fetch_bytes(client, url)
                out.write_bytes(data)
                return {"key": t.key, "source": src_name, "url": url, "error": None}
            except Exception as e:
                errors.append(f"{src_name}:{str(e)[:80]}")
                continue

        return {
            "key": t.key,
            "source": "none",
            "url": None,
            "error": " | ".join(errors) if errors else "no_url_resolved",
            }


# ─── 메인 ───────────────────────────────────────────────
async def run(
    df: pd.DataFrame,
    audio_dir: Path,
    log_dir: Path,
    concurrency: int,
) -> None:
    audio_dir.mkdir(parents=True, exist_ok=True)
    log_dir.mkdir(parents=True, exist_ok=True)

    targets = build_targets(df)
    console.print(f"unique track keys: [bold]{len(targets):,}[/bold]")

    already = {
        p.stem for p in audio_dir.glob("*.m4a") if p.stat().st_size > 5_000
    }
    todo = [t for t in targets if t.key not in already]
    console.print(
        f"already cached: [green]{len(already):,}[/green]  "
        f"todo: [yellow]{len(todo):,}[/yellow]"
    )
    if not todo:
        console.print("[green]Nothing to do.[/green]")
        return

    sem = asyncio.Semaphore(concurrency)
    results: list[dict] = []

    async with httpx.AsyncClient(
        timeout=httpx.Timeout(30.0, connect=10.0),
        limits=httpx.Limits(max_connections=concurrency * 2),
        headers={"User-Agent": "MRMS/0.1 (+research)"},
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
            task = progress.add_task("downloading", total=len(todo))

            async def runner(t: TrackTarget) -> None:
                r = await process_one(client, sem, t, audio_dir)
                # 메모리 보호 — title/artists는 실패 분석용으로만 별도 저장
                r["title"] = t.title
                r["artists"] = t.artists
                results.append(r)
                progress.advance(task)

            await asyncio.gather(*[runner(t) for t in todo])

    success = [r for r in results if r["error"] is None and r["source"] != "none"]
    failed = [r for r in results if r["error"] is not None or r["source"] == "none"]

    if success:
        pd.DataFrame(
            [{"key": r["key"], "source": r["source"], "url": r["url"]} for r in success]
        ).to_csv(log_dir / "download_success.csv", index=False)
    if failed:
        pd.DataFrame(
            [
                {
                    "key": r["key"],
                    "title": r["title"],
                    "artists": r["artists"],
                    "error": r["error"] or "no_url",
                }
                for r in failed
            ]
        ).to_csv(log_dir / "download_failed.csv", index=False)

    console.print()
    console.print(f"[green]✓ downloaded:[/green] {len(success):,}")
    console.print(f"[red]✗ failed:[/red]     {len(failed):,}")
    # source 분포
    by_src: dict[str, int] = {}
    for r in success:
        by_src[r["source"]] = by_src.get(r["source"], 0) + 1
    for src, n in sorted(by_src.items(), key=lambda x: -x[1]):
        console.print(f"  {src:>14}: {n:,}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Multi-source audio preview downloader")
    parser.add_argument(
        "--catalog",
        type=Path,
        default=Path("data/csv/ems_enriched.parquet"),
        help="01_enrich_isrc.py 출력 (없으면 원본 CSV 사용)",
    )
    parser.add_argument(
        "--fallback-catalog",
        type=Path,
        default=Path("data/csv/ems_collected_track.csv"),
        help="enriched가 없을 때 사용할 원본",
    )
    parser.add_argument("--audio-dir", type=Path, default=settings.audio_dir)
    parser.add_argument("--log-dir", type=Path, default=settings.log_dir)
    parser.add_argument("--concurrency", type=int, default=settings.download_concurrency)
    parser.add_argument(
        "--limit", type=int, default=0, help="테스트 모드: 첫 N개만 (--emp-only 시 DB LIMIT)"
    )
    parser.add_argument(
        "--emp-only",
        action="store_true",
        help="CSV 대신 DB에서 EMP 풀 미임베딩 트랙을 직접 조회",
    )
    args = parser.parse_args()

    console.print(f"Audio out:  [cyan]{args.audio_dir}[/cyan]")
    console.print(f"Concurrent: [cyan]{args.concurrency}[/cyan]")

    if args.emp_only:
        limit = args.limit if args.limit else 1000
        console.print(f"[bold yellow]EMP-ONLY MODE[/bold yellow] — DB 조회 (limit={limit})")
        rows = fetch_emp_pending(limit)
        console.print(f"EMP pending: [bold]{len(rows):,}[/bold] 트랙")
        if not rows:
            console.print("[green]EMP 풀에 미처리 트랙이 없습니다.[/green]")
            return
        df = pd.DataFrame(rows)
    else:
        catalog = args.catalog if args.catalog.exists() else args.fallback_catalog
        if not catalog.exists():
            console.print(f"[red]Catalog not found:[/red] {catalog}")
            sys.exit(1)
        console.print(f"Catalog:    [cyan]{catalog}[/cyan]")
        df = load_catalog(catalog)
        if args.limit:
            df = df.head(args.limit)
            console.print(f"[yellow]LIMIT MODE: only {args.limit} rows[/yellow]")

    asyncio.run(run(df, args.audio_dir, args.log_dir, args.concurrency))


if __name__ == "__main__":
    main()
