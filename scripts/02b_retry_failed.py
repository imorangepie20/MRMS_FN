"""
02 다운로드에서 실패한 트랙만 재시도 — 더 공격적인 검색 전략.

전략:
    1. 제목 정리: "(Official Video)", "(feat. ...)", "[Audio]" 등 제거
    2. 다양한 query variation: 원본 / 정리본 / 첫 단어만
    3. iTunes 국가코드 확장: US, KR, JP, GB
    4. Deezer simple search (advanced operator 없이)
    5. fail-fast on 4xx (02와 동일)

Input:
    logs/download_failed.csv (02에서 생성됨)
    data/csv/ems_enriched.parquet (메타 참조용)

Output:
    data/audio/{key}.m4a (성공한 트랙 추가)
    logs/retry_success.csv
    logs/retry_still_failed.csv

Usage:
    python3 scripts/02b_retry_failed.py
    python3 scripts/02b_retry_failed.py --concurrency 50
"""

from __future__ import annotations

import argparse
import asyncio
import re
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

from mrms.config import settings
from mrms.data.catalog import load_catalog
from mrms.ingest.deezer import lookup_by_isrc as deezer_lookup_isrc
from mrms.ingest.deezer import search_by_text as deezer_search_text

console = Console()

ITUNES_COUNTRIES = ("US", "KR", "JP", "GB")


# ─── 타이틀 정리 ────────────────────────────────────────
PAREN_RE = re.compile(r"\s*[\(\[]([^)\]]*)[\)\]]\s*")
DASH_SUFFIX_RE = re.compile(r"\s+-\s+.*$")
FEAT_RE = re.compile(r"\s*(feat\.|featuring|ft\.|with)\s+.+$", re.IGNORECASE)

NOISE_KEYWORDS = (
    "official", "video", "audio", "live", "remaster", "remastered",
    "lyric", "lyrics", "music video", "mv", "performance", "version",
    "ver.", "explicit", "clean", "edit", "radio", "extended",
    "instrumental", "karaoke", "demo", "commentary", "closed caption",
)


def strip_noise_paren(title: str) -> str:
    """괄호 안에 'official', 'video' 같은 노이즈가 있으면 그 괄호만 제거."""
    def repl(m):
        inner = m.group(1).lower()
        if any(kw in inner for kw in NOISE_KEYWORDS):
            return " "
        return m.group(0)
    return PAREN_RE.sub(repl, title).strip()


def clean_aggressive(title: str) -> str:
    """모든 괄호·feat 제거 — 가장 짧은 핵심 제목."""
    t = PAREN_RE.sub(" ", title)
    t = FEAT_RE.sub("", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t


def query_variations(title: str) -> list[str]:
    """검색 시도용 타이틀 변형 후보 (중복 제거, 짧은 순)."""
    seen = set()
    out = []
    for v in [
        title,                          # 원본
        strip_noise_paren(title),       # (Video) 등 노이즈만 제거
        clean_aggressive(title),         # 괄호+feat 모두 제거
        DASH_SUFFIX_RE.sub("", title),  # " - 어쩌고" 잘라냄
    ]:
        v = v.strip()
        if v and v.lower() not in seen:
            seen.add(v.lower())
            out.append(v)
    return out


def first_artist(artists: str) -> str:
    return (artists or "").split(",")[0].strip()


# ─── HTTP ────────────────────────────────────────────────
class DeadUrl(Exception):
    pass


async def fetch_bytes(client: httpx.AsyncClient, url: str) -> bytes:
    r = await client.get(url, timeout=15.0, follow_redirects=True)
    if r.status_code >= 400:
        raise DeadUrl(f"http {r.status_code}")
    if not r.content or len(r.content) < 5_000:
        raise DeadUrl(f"too small: {len(r.content)}")
    return r.content


# ─── iTunes 직접 호출 (multi-country) ──────────────────
async def itunes_text_multi(
    client: httpx.AsyncClient,
    title: str,
    artist: str,
) -> Optional[str]:
    """4개 국가 + simple query로 광범위 검색."""
    term = f"{title} {artist}".strip()
    if not term:
        return None
    for country in ITUNES_COUNTRIES:
        try:
            r = await client.get(
                "https://itunes.apple.com/search",
                params={"term": term, "entity": "song", "country": country, "limit": 3},
                timeout=10.0,
            )
            if r.status_code != 200:
                continue
            results = r.json().get("results", [])
            for item in results:
                url = item.get("previewUrl")
                if url:
                    return url
        except Exception:
            continue
    return None


# ─── 메인 retry 함수 ────────────────────────────────────
@dataclass(slots=True)
class FailedTrack:
    key: str
    title: str
    artists: str
    isrc: Optional[str]


async def retry_one(
    client: httpx.AsyncClient,
    sem: asyncio.Semaphore,
    t: FailedTrack,
    audio_dir: Path,
) -> dict:
    out = audio_dir / f"{t.key}.m4a"
    if out.exists() and out.stat().st_size > 5_000:
        return {"key": t.key, "source": "cached", "url": None, "error": None}

    artist = first_artist(t.artists)

    async with sem:
        # 1) Deezer ISRC (한 번 더, 혹시나)
        if t.isrc:
            try:
                track = await deezer_lookup_isrc(client, t.isrc)
                if track and track.get("preview_url"):
                    try:
                        data = await fetch_bytes(client, track["preview_url"])
                        out.write_bytes(data)
                        return {"key": t.key, "source": "deezer_isrc", "url": track["preview_url"], "error": None}
                    except Exception:
                        pass
            except Exception:
                pass

        # 2) Deezer text — 여러 query variation
        for variant in query_variations(t.title):
            try:
                track = await deezer_search_text(client, variant, artist)
                if track and track.get("preview_url"):
                    try:
                        data = await fetch_bytes(client, track["preview_url"])
                        out.write_bytes(data)
                        return {"key": t.key, "source": f"deezer_text({variant[:30]})", "url": track["preview_url"], "error": None}
                    except Exception:
                        pass
            except Exception:
                continue

        # 3) iTunes multi-country — 여러 query variation
        for variant in query_variations(t.title):
            url = await itunes_text_multi(client, variant, artist)
            if url:
                try:
                    data = await fetch_bytes(client, url)
                    out.write_bytes(data)
                    return {"key": t.key, "source": f"itunes_multi({variant[:30]})", "url": url, "error": None}
                except Exception:
                    continue

        return {"key": t.key, "source": "none", "url": None, "error": "all_strategies_failed"}


async def run(
    failed_csv: Path,
    enriched_parquet: Path,
    audio_dir: Path,
    log_dir: Path,
    concurrency: int,
) -> None:
    failed_df = pd.read_csv(failed_csv)
    console.print(f"실패 목록 로드: [bold]{len(failed_df):,}[/bold]")

    # ISRC 보충: enriched parquet에서 매핑
    enriched = pd.read_parquet(enriched_parquet)
    enriched["_norm_key"] = enriched.apply(
        lambda r: r["isrc"] if pd.notna(r["isrc"]) else f"{r['source']}_{r['platform_track_id']}",
        axis=1,
    )
    key_to_isrc = dict(zip(enriched["_norm_key"], enriched["isrc"]))

    # FailedTrack 리스트
    targets: list[FailedTrack] = []
    seen: set[str] = set()
    for row in failed_df.itertuples():
        key = str(row.key)
        if key in seen:
            continue
        seen.add(key)
        isrc = key_to_isrc.get(key)
        if isinstance(isrc, float):  # NaN
            isrc = None
        targets.append(FailedTrack(
            key=key,
            title=str(row.title) if pd.notna(row.title) else "",
            artists=str(row.artists) if pd.notna(row.artists) else "",
            isrc=isrc if isrc and isinstance(isrc, str) else None,
        ))

    # 이미 받은 것 제외
    already = {p.stem for p in audio_dir.glob("*.m4a") if p.stat().st_size > 5_000}
    todo = [t for t in targets if t.key not in already]
    console.print(f"이미 캐시: [green]{len(targets) - len(todo):,}[/green]  retry 대상: [yellow]{len(todo):,}[/yellow]")

    if not todo:
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
            task = progress.add_task("retrying", total=len(todo))

            async def runner(t: FailedTrack) -> None:
                r = await retry_one(client, sem, t, audio_dir)
                r["title"] = t.title
                r["artists"] = t.artists
                results.append(r)
                progress.advance(task)

            await asyncio.gather(*[runner(t) for t in todo])

    success = [r for r in results if r["error"] is None and r["source"] != "none"]
    still_failed = [r for r in results if r["source"] == "none"]

    log_dir.mkdir(parents=True, exist_ok=True)
    if success:
        pd.DataFrame(
            [{"key": r["key"], "source": r["source"], "url": r["url"]} for r in success]
        ).to_csv(log_dir / "retry_success.csv", index=False)
    if still_failed:
        pd.DataFrame(
            [{"key": r["key"], "title": r["title"], "artists": r["artists"]} for r in still_failed]
        ).to_csv(log_dir / "retry_still_failed.csv", index=False)

    console.print()
    console.print(f"[green]✓ recovered:[/green] {len(success):,}")
    console.print(f"[red]✗ still failed:[/red] {len(still_failed):,}")

    by_src: dict[str, int] = {}
    for r in success:
        # 'deezer_text(Watoba)' 같은 라벨에서 prefix만
        prefix = r["source"].split("(")[0]
        by_src[prefix] = by_src.get(prefix, 0) + 1
    for src, n in sorted(by_src.items(), key=lambda x: -x[1]):
        console.print(f"  {src:>16}: {n:,}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Retry failed downloads with aggressive search")
    parser.add_argument("--failed", type=Path, default=Path("logs/download_failed.csv"))
    parser.add_argument("--enriched", type=Path, default=Path("data/csv/ems_enriched.parquet"))
    parser.add_argument("--audio-dir", type=Path, default=settings.audio_dir)
    parser.add_argument("--log-dir", type=Path, default=settings.log_dir)
    parser.add_argument("--concurrency", type=int, default=30)
    args = parser.parse_args()

    if not args.failed.exists():
        console.print(f"[red]Failed CSV not found:[/red] {args.failed}")
        sys.exit(1)

    asyncio.run(run(args.failed, args.enriched, args.audio_dir, args.log_dir, args.concurrency))


if __name__ == "__main__":
    main()
