"""
m4a → float16 npy 사전 디코딩 (1회만 실행).

이후 03_extract_embeddings.py는 이 캐시를 numpy.load로 빠르게 읽음.
ffmpeg subprocess 오버헤드 제거 + MERT 추출 시 디코딩 시간 0.

Output:
    data/audio_decoded/{key}.npy  (float16, mono, 24kHz)

크기:
    파일당 30초 × 24kHz × 2bytes(float16) = ~1.4MB
    166k tracks → ~240GB (외장 SSD에 여유 충분)

Resumable: 이미 .npy 있는 트랙 skip.

Usage:
    python3 scripts/03a_predecode.py
    python3 scripts/03a_predecode.py --workers 8
    python3 scripts/03a_predecode.py --limit 100
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

import numpy as np
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

console = Console()

SAMPLE_RATE = 24_000
DURATION = 30.0


def decode_one(args: tuple[str, str]) -> tuple[str, bool, str]:
    """ffmpeg → float16 npy. 워커 프로세스에서 실행."""
    src_str, out_str = args
    src = Path(src_str)
    out = Path(out_str)
    if out.exists() and out.stat().st_size > 1000:
        return src.stem, True, "cached"
    cmd = [
        "ffmpeg",
        "-i", src_str,
        "-f", "f32le",
        "-acodec", "pcm_f32le",
        "-ac", "1",
        "-ar", str(SAMPLE_RATE),
        "-t", str(DURATION),
        "-loglevel", "quiet",
        "-nostdin",
        "-",
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, check=True, timeout=15)
        audio = np.frombuffer(result.stdout, dtype=np.float32)
        if len(audio) < SAMPLE_RATE:
            return src.stem, False, "too_short"
        # float16으로 다운캐스트 (저장 공간 절반)
        np.save(out, audio.astype(np.float16))
        return src.stem, True, "ok"
    except subprocess.TimeoutExpired:
        return src.stem, False, "timeout"
    except subprocess.CalledProcessError as e:
        return src.stem, False, f"ffmpeg_err:{e.returncode}"
    except Exception as e:
        return src.stem, False, f"err:{str(e)[:60]}"


def main() -> None:
    parser = argparse.ArgumentParser(description="Pre-decode m4a → npy cache")
    parser.add_argument("--audio-dir", type=Path, default=settings.audio_dir)
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=settings.data_root / "audio_decoded",
    )
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--limit", type=int, default=0)
    args = parser.parse_args()

    args.out_dir.mkdir(parents=True, exist_ok=True)

    all_files = sorted(args.audio_dir.glob("*.m4a"))
    console.print(f"audio files: [bold]{len(all_files):,}[/bold]")

    done = {p.stem for p in args.out_dir.glob("*.npy") if p.stat().st_size > 1000}
    todo = [p for p in all_files if p.stem not in done]
    if args.limit:
        todo = todo[: args.limit]
    console.print(
        f"already decoded: [green]{len(done):,}[/green]  "
        f"todo: [yellow]{len(todo):,}[/yellow]"
    )
    if not todo:
        return

    worker_args = [(str(p), str(args.out_dir / f"{p.stem}.npy")) for p in todo]

    fail = 0
    fail_reasons: dict[str, int] = {}

    with Progress(
        SpinnerColumn(),
        TextColumn("[bold blue]{task.description}"),
        BarColumn(),
        MofNCompleteColumn(),
        TextColumn("[cyan]{task.percentage:>3.1f}%"),
        TimeRemainingColumn(),
        console=console,
    ) as progress:
        task = progress.add_task(f"디코딩 ({args.workers} workers)", total=len(todo))

        with ProcessPoolExecutor(max_workers=args.workers) as pool:
            futures = [pool.submit(decode_one, wa) for wa in worker_args]
            for fut in as_completed(futures):
                _, ok, reason = fut.result()
                if not ok:
                    fail += 1
                    fail_reasons[reason] = fail_reasons.get(reason, 0) + 1
                progress.advance(task)

    console.print()
    console.print(f"[green]✓ 디코딩 완료[/green]")
    console.print(f"실패: [red]{fail:,}[/red]")
    for reason, n in sorted(fail_reasons.items(), key=lambda x: -x[1]):
        console.print(f"  {reason:>16}: {n:,}")

    total = len(list(args.out_dir.glob("*.npy")))
    console.print(f"전체 npy 캐시: [bold]{total:,}[/bold]")


if __name__ == "__main__":
    main()
