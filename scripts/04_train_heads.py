"""
Frozen MERT 임베딩 위에 multi-task heads 학습.

사전 조건:
    1. 03a_predecode.py 실행 완료 (data/audio_decoded/*.npy)
    2. 03_extract_embeddings.py 실행 완료 (data/embeddings/mert_v1_95m/*.npy)
    3. data/csv/ems_enriched.parquet 존재

Output:
    checkpoints/heads_v1.0/best.ckpt
    checkpoints/heads_v1.0/last.ckpt
    checkpoints/heads_v1.0/tb_logs/

Usage:
    python3 scripts/04_train_heads.py
    python3 scripts/04_train_heads.py --epochs 30 --batch-size 256
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

import lightning as L
import torch
from lightning.pytorch.callbacks import EarlyStopping, ModelCheckpoint, RichProgressBar
from lightning.pytorch.loggers import TensorBoardLogger
from rich.console import Console
from torch.utils.data import DataLoader

from mrms.config import settings
from mrms.data.dataset import (
    EmbeddingDataset,
    artist_stratified_split,
    build_index,
    collate,
)
from mrms.training.trainer import MRMSHeadModule

console = Console()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--catalog",
        type=Path,
        default=Path("data/csv/ems_enriched.parquet"),
    )
    parser.add_argument(
        "--embed-dir",
        type=Path,
        default=settings.embed_dir / "mert_v1_95m",
    )
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=settings.checkpoint_dir / "heads_v1.0",
    )
    parser.add_argument("--epochs", type=int, default=30)
    parser.add_argument("--batch-size", type=int, default=256)
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--weight-decay", type=float, default=1e-4)
    parser.add_argument("--embedding-dim", type=int, default=256)
    parser.add_argument("--hidden-dim", type=int, default=256)
    parser.add_argument("--dropout", type=float, default=0.1)
    parser.add_argument("--num-workers", type=int, default=4)
    parser.add_argument("--accelerator", type=str, default="mps")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    L.seed_everything(args.seed, workers=True)

    # ─── 데이터 인덱스 ──────────────────────────
    console.print("[bold cyan]Indexing training data...[/bold cyan]")
    index_df = build_index(args.catalog, args.embed_dir)
    console.print(f"학습 가능 트랙: [bold]{len(index_df):,}[/bold]")

    if len(index_df) < 1000:
        console.print("[red]Too few tracks for training[/red]")
        return

    # ─── Split ──────────────────────────────────
    train_df, val_df, test_df = artist_stratified_split(
        index_df, val_pct=0.10, test_pct=0.10, seed=args.seed
    )
    console.print(
        f"  train: [green]{len(train_df):,}[/green]  "
        f"val: [cyan]{len(val_df):,}[/cyan]  "
        f"test: [yellow]{len(test_df):,}[/yellow]"
    )

    # ─── Dataset / Loader ───────────────────────
    train_ds = EmbeddingDataset(train_df, in_memory=False)
    val_ds = EmbeddingDataset(val_df, in_memory=False)
    test_ds = EmbeddingDataset(test_df, in_memory=False)

    train_loader = DataLoader(
        train_ds,
        batch_size=args.batch_size,
        shuffle=True,
        num_workers=args.num_workers,
        collate_fn=collate,
        persistent_workers=args.num_workers > 0,
    )
    val_loader = DataLoader(
        val_ds,
        batch_size=args.batch_size * 2,
        num_workers=args.num_workers,
        collate_fn=collate,
        persistent_workers=args.num_workers > 0,
    )
    test_loader = DataLoader(
        test_ds,
        batch_size=args.batch_size * 2,
        num_workers=args.num_workers,
        collate_fn=collate,
    )

    # ─── Module ─────────────────────────────────
    total_steps = args.epochs * len(train_loader)
    module = MRMSHeadModule(
        in_dim=768,
        embedding_dim=args.embedding_dim,
        hidden_dim=args.hidden_dim,
        dropout=args.dropout,
        lr=args.lr,
        weight_decay=args.weight_decay,
        warmup_steps=min(500, total_steps // 20),
        total_steps=total_steps,
    )

    # ─── Trainer ────────────────────────────────
    args.out_dir.mkdir(parents=True, exist_ok=True)
    logger = TensorBoardLogger(save_dir=str(args.out_dir), name="tb_logs")

    callbacks = [
        ModelCheckpoint(
            dirpath=str(args.out_dir),
            filename="best",
            monitor="val/loss",
            mode="min",
            save_last=True,
            save_top_k=1,
        ),
        EarlyStopping(monitor="val/loss", patience=5, mode="min"),
        RichProgressBar(),
    ]

    trainer = L.Trainer(
        max_epochs=args.epochs,
        accelerator=args.accelerator,
        devices=1,
        precision="16-mixed" if args.accelerator != "cpu" else "32",
        logger=logger,
        callbacks=callbacks,
        log_every_n_steps=20,
        gradient_clip_val=1.0,
    )

    # ─── Train ──────────────────────────────────
    trainer.fit(module, train_loader, val_loader)

    # ─── Test ───────────────────────────────────
    console.print("[bold cyan]Testing on held-out split...[/bold cyan]")
    trainer.test(module, test_loader, ckpt_path="best")

    console.print()
    console.print(f"[green]✓ 학습 완료[/green] — 체크포인트: {args.out_dir}")


if __name__ == "__main__":
    main()
