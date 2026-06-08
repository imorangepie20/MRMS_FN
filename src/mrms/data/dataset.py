"""Embedding 캐시 + Spotify features 라벨 dataset.

03_extract_embeddings.py가 생성한 768d npy 캐시를 메모리에 로드해
빠르게 (B, 768) 텐서를 반환. 라벨은 enriched parquet에서 읽음.

Train/Val/Test 분할:
    artist-stratified — 같은 아티스트가 양쪽에 들어가지 않도록.
    음악 ML의 가장 흔한 데이터 누수 함정 방지.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
import torch
from torch.utils.data import Dataset

from mrms.data.catalog import (
    FEATURE_COLUMNS,
    derive_track_key,
    has_features,
    load_catalog,
)
from mrms.models.heads import (
    BOUNDED_FEATURES,
    TIME_SIG_TO_IDX,
)


@dataclass(slots=True)
class TrackSample:
    key: str
    embedding: np.ndarray              # (768,) float32
    bounded: np.ndarray                # (7,) float32 — bounded features
    tempo: float
    loudness: float
    key_label: int
    mode_label: int
    time_sig_label: int
    # 라벨 유효성 (NaN 등 처리)
    has_bounded: bool
    has_tempo: bool
    has_loudness: bool
    has_key: bool
    has_mode: bool
    has_time_sig: bool


def _coerce_int(x) -> int | None:
    try:
        return int(x)
    except (ValueError, TypeError):
        return None


def build_index(
    catalog_path: Path,
    embedding_dir: Path,
) -> pd.DataFrame:
    """학습 가능한 트랙 인덱스 생성.

    조건:
        1) audio features 있음 (energy 컬럼 not null)
        2) 임베딩 npy 존재

    Returns:
        DataFrame with columns:
            key, artist, embedding_path,
            danceability, ..., time_signature
    """
    df = load_catalog(catalog_path)
    df = df[has_features(df)].copy()
    df["key_str"] = df.apply(derive_track_key, axis=1)

    # 동일 ISRC/pseudo-key가 여러 행에 있을 수 있음 → 첫 행 유지
    df = df.drop_duplicates(subset=["key_str"], keep="first")

    # 임베딩 존재 확인
    available = {p.stem for p in embedding_dir.glob("*.npy")}
    df = df[df["key_str"].isin(available)].copy()

    df["embedding_path"] = df["key_str"].apply(lambda k: str(embedding_dir / f"{k}.npy"))
    df = df.rename(columns={"key_str": "key", "artists": "artist"})

    cols = ["key", "artist", "embedding_path"] + list(FEATURE_COLUMNS)
    return df[cols].reset_index(drop=True)


def artist_stratified_split(
    df: pd.DataFrame,
    val_pct: float = 0.10,
    test_pct: float = 0.10,
    seed: int = 42,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """같은 아티스트가 train/val/test에 동시에 들어가지 않게 분할."""
    rng = np.random.RandomState(seed)
    artists = df["artist"].fillna("__unknown__").unique().tolist()
    rng.shuffle(artists)

    n = len(artists)
    n_test = int(n * test_pct)
    n_val = int(n * val_pct)

    test_set = set(artists[:n_test])
    val_set = set(artists[n_test : n_test + n_val])

    a = df["artist"].fillna("__unknown__")
    train = df[~a.isin(test_set) & ~a.isin(val_set)].reset_index(drop=True)
    val = df[a.isin(val_set)].reset_index(drop=True)
    test = df[a.isin(test_set)].reset_index(drop=True)
    return train, val, test


class EmbeddingDataset(Dataset):
    """단일 split (train/val/test)용 Dataset.

    npy 임베딩을 lazy load (디스크 → memory).
    """

    def __init__(self, df: pd.DataFrame, in_memory: bool = True):
        self.df = df.reset_index(drop=True)
        self.in_memory = in_memory
        if in_memory:
            self._cache: list[np.ndarray | None] = [None] * len(df)

    def __len__(self) -> int:
        return len(self.df)

    def _load_emb(self, idx: int) -> np.ndarray:
        if self.in_memory and self._cache[idx] is not None:
            return self._cache[idx]
        row = self.df.iloc[idx]
        arr = np.load(row["embedding_path"]).astype(np.float32)
        if self.in_memory:
            self._cache[idx] = arr
        return arr

    def __getitem__(self, idx: int) -> dict[str, torch.Tensor]:
        row = self.df.iloc[idx]
        emb = self._load_emb(idx)

        # ─── 라벨 정규화 + mask ─────────────
        # bounded: 7개
        bounded = np.array(
            [row.get(f, np.nan) for f in BOUNDED_FEATURES], dtype=np.float32
        )
        mask_bounded = np.isfinite(bounded).all()
        if not mask_bounded:
            bounded = np.zeros(len(BOUNDED_FEATURES), dtype=np.float32)
        # clamp [0,1]
        bounded = np.clip(bounded, 0.0, 1.0)

        # tempo
        tempo = float(row["tempo"]) if pd.notna(row["tempo"]) else 0.0
        mask_tempo = pd.notna(row["tempo"]) and tempo > 0

        # loudness
        loudness = float(row["loudness"]) if pd.notna(row["loudness"]) else 0.0
        mask_loudness = pd.notna(row["loudness"])

        # key (0~11)
        k = _coerce_int(row["key"])
        if k is None or not (0 <= k <= 11):
            k = 0
            mask_key = False
        else:
            mask_key = True

        # mode (0/1)
        m = _coerce_int(row["mode"])
        if m is None or m not in (0, 1):
            m = 0
            mask_mode = False
        else:
            mask_mode = True

        # time_sig (3~7 → 0~4)
        ts = _coerce_int(row["time_signature"])
        if ts in TIME_SIG_TO_IDX:
            ts_idx = TIME_SIG_TO_IDX[ts]
            mask_time_sig = True
        else:
            ts_idx = 1  # default 4/4
            mask_time_sig = False

        return {
            "embedding": torch.from_numpy(emb),
            "bounded": torch.from_numpy(bounded),
            "tempo": torch.tensor(tempo, dtype=torch.float32),
            "loudness": torch.tensor(loudness, dtype=torch.float32),
            "key": torch.tensor(k, dtype=torch.long),
            "mode": torch.tensor(m, dtype=torch.long),
            "time_sig": torch.tensor(ts_idx, dtype=torch.long),
            "mask_bounded": torch.tensor(mask_bounded, dtype=torch.bool),
            "mask_tempo": torch.tensor(mask_tempo, dtype=torch.bool),
            "mask_loudness": torch.tensor(mask_loudness, dtype=torch.bool),
            "mask_key": torch.tensor(mask_key, dtype=torch.bool),
            "mask_mode": torch.tensor(mask_mode, dtype=torch.bool),
            "mask_time_sig": torch.tensor(mask_time_sig, dtype=torch.bool),
        }


def collate(batch: list[dict]) -> dict:
    """단순 stack collator."""
    return {k: torch.stack([b[k] for b in batch]) for k in batch[0].keys()}
