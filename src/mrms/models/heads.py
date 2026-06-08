"""Multi-task heads on top of frozen MERT embedding.

Input:  (B, 768) MERT mean-pooled embedding
Output: dict of predictions
    - bounded_7 : (B, 7)  sigmoid-activated [0,1]
        order: dance, energy, valence, acoust, instr, live, speech
    - tempo     : (B,)    BPM, log-MSE 학습
    - loudness  : (B,)    dB, MSE
    - key       : (B, 12) softmax (CE loss)
    - mode      : (B, 2)  softmax (CE)
    - time_sig  : (B, 5)  softmax (CE; 3~7 → 0~4)
    - embedding : (B, 256) L2-normalized, retrieval용

또 확장:
    - genre     : (B, N_GENRES) multi-label (옵션, V2)
    - kpop_mood : (B, N_MOODS)  classification (옵션)
"""

from __future__ import annotations

import torch
import torch.nn as nn
import torch.nn.functional as F


# ─── 차원/카테고리 상수 ──────────────────────────────────
BOUNDED_FEATURES = (
    "danceability",
    "energy",
    "valence",
    "acousticness",
    "instrumentalness",
    "liveness",
    "speechiness",
)
N_BOUNDED = len(BOUNDED_FEATURES)
N_KEY = 12
N_MODE = 2
N_TIME_SIG = 5  # 3, 4, 5, 6, 7 → idx 0~4

# Time sig 매핑
TIME_SIG_TO_IDX = {3: 0, 4: 1, 5: 2, 6: 3, 7: 4}
IDX_TO_TIME_SIG = {v: k for k, v in TIME_SIG_TO_IDX.items()}


def _mlp(in_dim: int, out_dim: int, hidden: int = 256, dropout: float = 0.1) -> nn.Module:
    return nn.Sequential(
        nn.Linear(in_dim, hidden),
        nn.GELU(),
        nn.Dropout(dropout),
        nn.Linear(hidden, out_dim),
    )


class MultiTaskHeads(nn.Module):
    """768d → multi-task outputs."""

    def __init__(
        self,
        in_dim: int = 768,
        embedding_dim: int = 256,
        hidden_dim: int = 256,
        dropout: float = 0.1,
        # 확장 옵션
        n_genres: int = 0,       # 0이면 비활성
        n_kpop_moods: int = 0,
    ):
        super().__init__()
        self.in_dim = in_dim
        self.embedding_dim = embedding_dim

        # Spotify-12
        self.head_bounded = _mlp(in_dim, N_BOUNDED, hidden_dim, dropout)
        self.head_tempo = _mlp(in_dim, 1, hidden_dim, dropout)
        self.head_loudness = _mlp(in_dim, 1, hidden_dim, dropout)
        self.head_key = _mlp(in_dim, N_KEY, hidden_dim, dropout)
        self.head_mode = _mlp(in_dim, N_MODE, hidden_dim, dropout)
        self.head_time_sig = _mlp(in_dim, N_TIME_SIG, hidden_dim, dropout)

        # 추천용 projection (L2 normalized)
        self.head_embedding = nn.Sequential(
            nn.Linear(in_dim, 512),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(512, embedding_dim),
        )

        # 확장 (옵션)
        self.head_genre = (
            _mlp(in_dim, n_genres, hidden_dim, dropout) if n_genres > 0 else None
        )
        self.head_kpop_mood = (
            _mlp(in_dim, n_kpop_moods, hidden_dim, dropout) if n_kpop_moods > 0 else None
        )

    def forward(self, x: torch.Tensor) -> dict[str, torch.Tensor]:
        """x: (B, 768)"""
        out = {
            "bounded": torch.sigmoid(self.head_bounded(x)),       # (B, 7)
            "tempo": self.head_tempo(x).squeeze(-1),              # (B,)
            "loudness": self.head_loudness(x).squeeze(-1),        # (B,)
            "key": self.head_key(x),                              # (B, 12) — logits
            "mode": self.head_mode(x),                            # (B, 2)
            "time_sig": self.head_time_sig(x),                    # (B, 5)
            "embedding": F.normalize(self.head_embedding(x), dim=-1),  # (B, 256)
        }
        if self.head_genre is not None:
            out["genre"] = self.head_genre(x)                     # logits, BCE 적용
        if self.head_kpop_mood is not None:
            out["kpop_mood"] = self.head_kpop_mood(x)             # logits, CE 적용
        return out
