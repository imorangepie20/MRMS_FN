"""Multi-task loss + 측정 metric.

Target dict keys:
    bounded     : (B, 7) float [0,1]
    tempo       : (B,)   float (BPM, log-MSE)
    loudness    : (B,)   float (dB)
    key         : (B,)   long  [0..11]
    mode        : (B,)   long  [0,1]
    time_sig    : (B,)   long  [0..4]
    mask_*      : (B,)   bool  — 해당 라벨 유효한 트랙만 학습에 포함
"""

from __future__ import annotations

from typing import Optional

import torch
import torch.nn as nn
import torch.nn.functional as F


DEFAULT_WEIGHTS = {
    "bounded": 1.0,
    "tempo": 0.5,
    "loudness": 0.3,
    "key": 0.4,
    "mode": 0.2,
    "time_sig": 0.2,
    "embedding_aux": 0.0,  # V2에서 contrastive 추가 가능
}


class MultiTaskLoss(nn.Module):
    def __init__(
        self,
        weights: Optional[dict[str, float]] = None,
        tempo_log: bool = True,
    ):
        super().__init__()
        self.w = {**DEFAULT_WEIGHTS, **(weights or {})}
        self.tempo_log = tempo_log

    def forward(
        self,
        pred: dict[str, torch.Tensor],
        target: dict[str, torch.Tensor],
    ) -> tuple[torch.Tensor, dict[str, torch.Tensor]]:
        breakdown: dict[str, torch.Tensor] = {}

        # ─── Spotify-12 ────────────────────────────────
        # bounded (B, 7) — 모두 mask 적용
        mask_b = target.get("mask_bounded")
        if mask_b is not None and mask_b.any():
            l_b = F.mse_loss(
                pred["bounded"][mask_b], target["bounded"][mask_b], reduction="mean"
            )
            breakdown["bounded"] = l_b
        else:
            breakdown["bounded"] = pred["bounded"].new_zeros(())

        # tempo (B,) — log scale 학습이 안정적
        mask_t = target.get("mask_tempo")
        if mask_t is not None and mask_t.any():
            t_pred = pred["tempo"][mask_t]
            t_targ = target["tempo"][mask_t]
            if self.tempo_log:
                t_pred = torch.log(t_pred.clamp_min(1e-3) + 1.0)
                t_targ = torch.log(t_targ.clamp_min(1e-3) + 1.0)
            breakdown["tempo"] = F.mse_loss(t_pred, t_targ)
        else:
            breakdown["tempo"] = pred["tempo"].new_zeros(())

        # loudness (B,)
        mask_l = target.get("mask_loudness")
        if mask_l is not None and mask_l.any():
            breakdown["loudness"] = F.mse_loss(
                pred["loudness"][mask_l], target["loudness"][mask_l]
            )
        else:
            breakdown["loudness"] = pred["loudness"].new_zeros(())

        # 분류 — key/mode/time_sig
        for k in ("key", "mode", "time_sig"):
            mask = target.get(f"mask_{k}")
            if mask is not None and mask.any():
                breakdown[k] = F.cross_entropy(pred[k][mask], target[k][mask])
            else:
                breakdown[k] = pred[k].new_zeros(())

        # ─── 합산 ──────────────────────────────────────
        total = sum(self.w.get(k, 0.0) * v for k, v in breakdown.items())
        return total, breakdown


# ─── Metric (학습 중 monitor용) ────────────────────────
@torch.no_grad()
def regression_r2(pred: torch.Tensor, target: torch.Tensor) -> float:
    """간단 R² (회귀 head 평가)."""
    ss_res = ((pred - target) ** 2).sum()
    ss_tot = ((target - target.mean()) ** 2).sum().clamp_min(1e-8)
    return 1.0 - (ss_res / ss_tot).item()


@torch.no_grad()
def classification_accuracy(logits: torch.Tensor, target: torch.Tensor) -> float:
    return (logits.argmax(dim=-1) == target).float().mean().item()
