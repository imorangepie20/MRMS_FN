"""
MERT-95M 임베딩 추출 (frozen, mean-pooled 768d).

182k 오디오 파일을 MERT로 인코딩해 각 트랙당 단일 768d 벡터로 저장.
이후 head 학습 단계에서는 이 캐시 위에서 빠르게 반복 가능 (오디오 재로드 X).

Output:
    data/embeddings/mert_v1_95m/{key}.npy   (각 트랙 768d float32)

Resumable: 이미 추출된 .npy는 skip.

Usage:
    python3 scripts/03_extract_embeddings.py
    python3 scripts/03_extract_embeddings.py --batch-size 4 --precision fp16
    python3 scripts/03_extract_embeddings.py --limit 1000      # smoke test
    python3 scripts/03_extract_embeddings.py --device cpu      # MPS 이슈시
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

import numpy as np
import torch
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
from mrms.models.encoder import MERTEncoder, SAMPLE_RATE

console = Console()


def load_audio_ffmpeg(path: Path, duration: float) -> np.ndarray | None:
    """ffmpeg subprocess로 직접 디코딩 — fallback only."""
    cmd = [
        "ffmpeg",
        "-i", str(path),
        "-f", "f32le",
        "-acodec", "pcm_f32le",
        "-ac", "1",
        "-ar", str(SAMPLE_RATE),
        "-t", str(duration),
        "-loglevel", "quiet",
        "-nostdin",
        "-",
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, check=True, timeout=15)
        audio = np.frombuffer(result.stdout, dtype=np.float32)
        if len(audio) < SAMPLE_RATE:
            return None
        return audio.copy()
    except Exception:
        return None


def load_audio_cached(npy_path: Path) -> np.ndarray | None:
    """사전 디코딩된 float16 npy → float32 array."""
    try:
        audio = np.load(npy_path).astype(np.float32)
        if len(audio) < SAMPLE_RATE:
            return None
        return audio
    except Exception:
        return None




def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--audio-dir", type=Path, default=settings.audio_dir)
    parser.add_argument(
        "--cache-dir",
        type=Path,
        default=settings.data_root / "audio_decoded",
        help="03a 사전 디코딩 npy 캐시 디렉토리",
    )
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=settings.embed_dir / "mert_v1_95m",
    )
    parser.add_argument("--device", type=str, default="mps")
    parser.add_argument("--precision", type=str, default="fp16", choices=["fp32", "fp16"])
    parser.add_argument("--batch-size", type=int, default=8)
    parser.add_argument("--duration", type=float, default=30.0)
    parser.add_argument("--limit", type=int, default=0, help="0 = 전체")
    parser.add_argument(
        "--decoder-workers",
        type=int,
        default=6,
        help="ffmpeg 디코딩 process 수 (M1 8코어 기준 6 추천)",
    )
    args = parser.parse_args()

    args.out_dir.mkdir(parents=True, exist_ok=True)

    # 캐시 사용 가능 여부 — 03a 결과가 있으면 npy 우선
    use_cache = args.cache_dir.exists() and any(args.cache_dir.glob("*.npy"))
    if use_cache:
        console.print(f"[green]✓ npy 캐시 사용[/green]: {args.cache_dir}")
        cached_keys = {p.stem for p in args.cache_dir.glob("*.npy")}
        all_files = [args.cache_dir / f"{k}.npy" for k in sorted(cached_keys)]
    else:
        console.print(
            "[yellow]캐시 없음 — m4a 직접 디코딩 (느림). 권장: scripts/03a_predecode.py 먼저 실행[/yellow]"
        )
        all_files = sorted(args.audio_dir.glob("*.m4a"))
    console.print(f"audio sources: [bold]{len(all_files):,}[/bold]")

    done = {p.stem for p in args.out_dir.glob("*.npy")}
    todo = [p for p in all_files if p.stem not in done]
    if args.limit:
        todo = todo[: args.limit]
    console.print(
        f"already extracted: [green]{len(done):,}[/green]  "
        f"todo: [yellow]{len(todo):,}[/yellow]"
    )
    if not todo:
        console.print("[green]Nothing to do.[/green]")
        return

    # 모델 로드 — device는 머신 가용성에 따라 fallback될 수 있음 (mps→cuda→cpu)
    encoder = MERTEncoder(
        device=args.device,
        precision=args.precision,
        max_audio_seconds=args.duration,
    )
    resolved_device = encoder.device.type  # fallback 반영된 실제 device
    console.print(
        f"loading MERT-v1-95M on [cyan]{resolved_device}[/cyan] ({args.precision})..."
    )
    console.print(f"  hidden_dim = {encoder.hidden_dim}")

    fail_count = 0
    BATCH = args.batch_size

    with Progress(
        SpinnerColumn(),
        TextColumn("[bold blue]{task.description}"),
        BarColumn(),
        MofNCompleteColumn(),
        TextColumn("[cyan]{task.percentage:>3.1f}%"),
        TimeRemainingColumn(),
        console=console,
    ) as progress:
        task = progress.add_task("MERT 임베딩 추출", total=len(todo))

        buffer: list[tuple[str, np.ndarray]] = []
        # 요청 device가 아니라 fallback 반영된 실제 device 기준 —
        # Linux에서 args.device='mps'여도 cpu로 떨어졌으면 mps cache 호출 금지
        is_mps = resolved_device == "mps" and torch.backends.mps.is_available()
        is_cuda = resolved_device == "cuda" and torch.cuda.is_available()

        def flush_batch() -> None:
            """버퍼의 트랙들을 batch 단위로 MERT에 통과시킴."""
            nonlocal fail_count
            if not buffer:
                return
            keys = [k for k, _ in buffer]
            audios = [a for _, a in buffer]
            try:
                with torch.inference_mode():
                    embs = encoder.encode_batch(audios)
                for k, e in zip(keys, embs):
                    np.save(args.out_dir / f"{k}.npy", e.numpy().astype(np.float32))
                del embs
            except Exception as e:
                console.print(f"[red]MERT batch failed[/red]: {str(e)[:200]}")
                for k, a in zip(keys, audios):
                    try:
                        with torch.inference_mode():
                            emb = encoder.encode_audio(a)
                        np.save(args.out_dir / f"{k}.npy", emb.numpy().astype(np.float32))
                        del emb
                    except Exception:
                        fail_count += 1
            buffer.clear()
            # GPU 메모리 누적 방지
            if is_mps:
                torch.mps.empty_cache()
            elif is_cuda:
                torch.cuda.empty_cache()

        # Sequential 로딩 — 캐시 npy는 ~5ms로 매우 빠름, 멀티프로세스 불필요
        for p in todo:
            if use_cache:
                audio = load_audio_cached(p)
            else:
                audio = load_audio_ffmpeg(p, args.duration)
            if audio is None:
                fail_count += 1
                progress.advance(task)
                continue
            buffer.append((p.stem, audio))
            progress.advance(task)
            if len(buffer) >= BATCH:
                flush_batch()
        flush_batch()

    console.print()
    console.print(f"[green]✓ 완료[/green]")
    console.print(f"실패: [red]{fail_count:,}[/red]")
    total_done = len(list(args.out_dir.glob("*.npy")))
    console.print(f"전체 임베딩: [bold]{total_done:,}[/bold] 개")


if __name__ == "__main__":
    main()
