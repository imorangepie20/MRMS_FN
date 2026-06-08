"""K-means 클러스터링 + UserEmbedding 집계.

UserTrack 임베딩 → K centroids + per-track label.
centroids는 L2 정규화 → pgvector cosine 검색에 바로 사용.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from sklearn.cluster import KMeans


class NotEnoughTracksError(Exception):
    """클러스터링에 트랙이 부족할 때."""


@dataclass
class PersonaResult:
    centroids: np.ndarray  # (K, 256) L2 정규화
    labels: np.ndarray     # (N,) 각 입력의 cluster 인덱스
    weights: np.ndarray    # (K,) 클러스터별 크기


def cluster_user_tracks(
    embeddings: np.ndarray,
    k: int = 3,
    random_state: int = 42,
    n_init: int = 10,
) -> PersonaResult:
    """K-means로 사용자 트랙 임베딩을 K개 클러스터로."""
    n = embeddings.shape[0]
    if n < k:
        raise NotEnoughTracksError(
            f"최소 {k}개 UserTrack 필요. 현재 {n}개."
        )
    km = KMeans(
        n_clusters=k,
        init="k-means++",
        n_init=n_init,
        max_iter=300,
        random_state=random_state,
    )
    labels = km.fit_predict(embeddings)
    centroids = km.cluster_centers_
    # L2 정규화 (cosine 검색용)
    norms = np.linalg.norm(centroids, axis=1, keepdims=True).clip(min=1e-12)
    centroids = centroids / norms
    weights = np.bincount(labels, minlength=k)
    return PersonaResult(
        centroids=centroids.astype(np.float32),
        labels=labels.astype(np.int32),
        weights=weights.astype(np.int32),
    )


def aggregate_user_vector(
    centroids: np.ndarray,
    weights: np.ndarray,
) -> np.ndarray:
    """페르소나 centroids를 trackCount 가중 평균 → 단일 256d vector. L2 정규화."""
    avg = np.average(centroids, axis=0, weights=weights)
    norm = np.linalg.norm(avg).clip(min=1e-12)
    return (avg / norm).astype(np.float32)
