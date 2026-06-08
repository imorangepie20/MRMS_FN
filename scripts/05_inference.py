"""
학습된 heads로 모든 트랙의 features + projection embedding 산출.

Input:
    data/embeddings/mert_v1_95m/*.npy       (768d MERT)
    checkpoints/heads_v1.0/best.ckpt        (학습된 heads)

Output:
    data/features/our_model_v1.0.parquet    (key, 12 Spotify features + 확장)
    data/projection/v1.0.parquet            (key, 256d projection embedding)

이 두 파일이 06 FAISS + 07 DB load의 입력.

Usage:
    python3 scripts/05_inference.py
    python3 scripts/05_inference.py --ckpt checkpoints/heads_v1.0/best.ckpt
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

import numpy as np
import pandas as pd
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
from mrms.models.heads import (
    BOUNDED_FEATURES,
    IDX_TO_TIME_SIG,
)
from mrms.training.trainer import MRMSHeadModule

console = Console()


def load_checkpoint(ckpt_path: Path, device: str) -> MRMSHeadModule:
    console.print(f"loading checkpoint: [cyan]{ckpt_path}[/cyan]")
    module = MRMSHeadModule.load_from_checkpoint(str(ckpt_path), map_location=device)
    module.eval()
    module.to(device)
    return module


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--ckpt",
        type=Path,
        default=settings.checkpoint_dir / "heads_v1.0" / "best.ckpt",
    )
    parser.add_argument(
        "--embed-dir",
        type=Path,
        default=settings.embed_dir / "mert_v1_95m",
    )
    parser.add_argument(
        "--out-features",
        type=Path,
        default=Path("data/features/our_model_v1.0.parquet"),
    )
    parser.add_argument(
        "--out-projection",
        type=Path,
        default=Path("data/projection/v1.0.parquet"),
    )
    parser.add_argument("--device", type=str, default="mps")
    parser.add_argument("--batch-size", type=int, default=512)
    parser.add_argument("--limit", type=int, default=0)
    args = parser.parse_args()

    if not args.ckpt.exists():
        console.print(f"[red]Checkpoint not found:[/red] {args.ckpt}")
        sys.exit(1)

    # 모든 임베딩 파일 수집
    all_npy = sorted(args.embed_dir.glob("*.npy"))
    if args.limit:
        all_npy = all_npy[: args.limit]
    console.print(f"임베딩 파일: [bold]{len(all_npy):,}[/bold]")

    # 모델 로드
    module = load_checkpoint(args.ckpt, args.device)

    # ─── inference 루프 ──────────────────────
    keys: list[str] = []
    features_rows: list[dict] = []
    projection_rows: list[dict] = []

    BATCH = args.batch_size
    buffer_embs: list[np.ndarray] = []
    buffer_keys: list[str] = []

    @torch.no_grad()
    def flush() -> None:
        if not buffer_embs:
            return
        x = torch.from_numpy(np.stack(buffer_embs)).to(args.device)
        pred = module(x)
        # 결과 dict → CPU numpy
        bounded = pred["bounded"].cpu().numpy()           # (B, 7)
        tempo = pred["tempo"].cpu().numpy()               # (B,)
        loudness = pred["loudness"].cpu().numpy()
        key_logits = pred["key"].cpu().numpy()            # (B, 12)
        mode_logits = pred["mode"].cpu().numpy()
        ts_logits = pred["time_sig"].cpu().numpy()
        embedding = pred["embedding"].cpu().numpy()       # (B, 256)

        key_pred = key_logits.argmax(axis=1)
        mode_pred = mode_logits.argmax(axis=1)
        ts_pred = ts_logits.argmax(axis=1)

        for i, k in enumerate(buffer_keys):
            row = {"key": k}
            for j, name in enumerate(BOUNDED_FEATURES):
                row[name] = float(bounded[i, j])
            row["tempo"] = float(tempo[i])
            row["loudness"] = float(loudness[i])
            row["spotify_key"] = int(key_pred[i])
            row["mode"] = int(mode_pred[i])
            row["time_signature"] = IDX_TO_TIME_SIG.get(int(ts_pred[i]), 4)
            features_rows.append(row)
            projection_rows.append({"key": k, "embedding": embedding[i].astype(np.float32)})

        buffer_embs.clear()
        buffer_keys.clear()

    with Progress(
        SpinnerColumn(),
        TextColumn("[bold blue]{task.description}"),
        BarColumn(),
        MofNCompleteColumn(),
        TextColumn("[cyan]{task.percentage:>3.1f}%"),
        TimeRemainingColumn(),
        console=console,
    ) as progress:
        task = progress.add_task("inference", total=len(all_npy))

        for npy_path in all_npy:
            try:
                emb = np.load(npy_path).astype(np.float32)
                if emb.shape != (768,):
                    progress.advance(task)
                    continue
                buffer_embs.append(emb)
                buffer_keys.append(npy_path.stem)
            except Exception:
                progress.advance(task)
                continue

            if len(buffer_embs) >= BATCH:
                flush()
                progress.update(task, advance=BATCH)
            else:
                progress.advance(task)
        flush()

    console.print(
        f"\n예측 완료: [bold]{len(features_rows):,}[/bold] tracks"
    )

    # ─── 저장 ──────────────────────────────
    args.out_features.parent.mkdir(parents=True, exist_ok=True)
    args.out_projection.parent.mkdir(parents=True, exist_ok=True)

    features_df = pd.DataFrame(features_rows)
    features_df.to_parquet(args.out_features, index=False)
    console.print(f"[green]✓ features →[/green] {args.out_features}")
    console.print(f"  columns: {list(features_df.columns)}")

    # projection: 768x256 → 단일 'embedding' 컬럼에 array
    proj_df = pd.DataFrame(projection_rows)
    proj_df.to_parquet(args.out_projection, index=False)
    console.print(f"[green]✓ projection →[/green] {args.out_projection}")
    console.print(f"  shape: {len(proj_df):,} × 256")


if __name__ == "__main__":
    main()
