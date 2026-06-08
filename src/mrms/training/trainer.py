"""PyTorch Lightning module — frozen MERT 위 multi-task heads 학습.

학습 흐름:
    Input: (B, 768) MERT 임베딩 (사전 추출됨)
    Forward: heads(emb) → predictions dict
    Loss: MultiTaskLoss(predictions, targets)
    Optim: AdamW + cosine schedule
"""

from __future__ import annotations

from typing import Optional

import lightning as L
import torch
import torch.nn as nn

from mrms.models.heads import MultiTaskHeads
from mrms.training.losses import (
    MultiTaskLoss,
    classification_accuracy,
    regression_r2,
)


class MRMSHeadModule(L.LightningModule):
    def __init__(
        self,
        in_dim: int = 768,
        embedding_dim: int = 256,
        hidden_dim: int = 256,
        dropout: float = 0.1,
        lr: float = 1e-3,
        weight_decay: float = 1e-4,
        warmup_steps: int = 500,
        total_steps: int = 10_000,
        loss_weights: Optional[dict[str, float]] = None,
    ):
        super().__init__()
        self.save_hyperparameters()

        self.heads = MultiTaskHeads(
            in_dim=in_dim,
            embedding_dim=embedding_dim,
            hidden_dim=hidden_dim,
            dropout=dropout,
        )
        self.loss_fn = MultiTaskLoss(weights=loss_weights)

    # ─── Forward ─────────────────────────────────
    def forward(self, embedding: torch.Tensor) -> dict[str, torch.Tensor]:
        return self.heads(embedding)

    # ─── Step ────────────────────────────────────
    def _step(self, batch: dict, stage: str) -> torch.Tensor:
        emb = batch["embedding"]
        pred = self.heads(emb)
        loss, breakdown = self.loss_fn(pred, batch)

        bs = emb.size(0)
        self.log(f"{stage}/loss", loss, batch_size=bs, prog_bar=True)
        for k, v in breakdown.items():
            self.log(f"{stage}/loss_{k}", v, batch_size=bs)

        # 핵심 metric — validation에서만 (계산 비용)
        if stage == "val":
            with torch.no_grad():
                mb = batch.get("mask_bounded")
                if mb is not None and mb.any():
                    for i, name in enumerate(
                        ["dance", "energy", "valence", "acoust", "instr", "live", "speech"]
                    ):
                        p = pred["bounded"][mb, i]
                        t = batch["bounded"][mb, i]
                        if len(p) > 1:
                            self.log(f"val/r2_{name}", regression_r2(p, t), batch_size=bs)

                for k in ("key", "mode", "time_sig"):
                    mk = batch.get(f"mask_{k}")
                    if mk is not None and mk.any():
                        self.log(
                            f"val/acc_{k}",
                            classification_accuracy(pred[k][mk], batch[k][mk]),
                            batch_size=bs,
                        )

        return loss

    def training_step(self, batch: dict, batch_idx: int) -> torch.Tensor:
        return self._step(batch, "train")

    def validation_step(self, batch: dict, batch_idx: int) -> torch.Tensor:
        return self._step(batch, "val")

    def test_step(self, batch: dict, batch_idx: int) -> torch.Tensor:
        return self._step(batch, "test")

    # ─── Optimizer ───────────────────────────────
    def configure_optimizers(self):
        optim = torch.optim.AdamW(
            self.heads.parameters(),
            lr=self.hparams.lr,
            weight_decay=self.hparams.weight_decay,
        )

        def lr_lambda(step: int) -> float:
            # linear warmup → cosine
            warmup = self.hparams.warmup_steps
            total = self.hparams.total_steps
            if step < warmup:
                return float(step) / max(1, warmup)
            progress = (step - warmup) / max(1, total - warmup)
            import math
            return 0.5 * (1.0 + math.cos(math.pi * progress))

        scheduler = torch.optim.lr_scheduler.LambdaLR(optim, lr_lambda)
        return {
            "optimizer": optim,
            "lr_scheduler": {"scheduler": scheduler, "interval": "step"},
        }
