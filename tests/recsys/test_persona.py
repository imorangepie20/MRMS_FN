"""K-means 클러스터링 + persona 집계 테스트."""
import numpy as np
import pytest

from mrms.recsys.persona import (
    PersonaResult,
    cluster_user_tracks,
    aggregate_user_vector,
    NotEnoughTracksError,
)


def _make_clustered_embeddings(centers: list[np.ndarray], per_cluster: int, noise_std: float = 0.05) -> np.ndarray:
    """각 center 주변에 per_cluster개 샘플 생성 (L2 정규화)."""
    rng = np.random.default_rng(42)
    parts = []
    for c in centers:
        noise = rng.standard_normal((per_cluster, len(c))) * noise_std
        pts = c + noise
        pts = pts / np.linalg.norm(pts, axis=1, keepdims=True)
        parts.append(pts)
    return np.vstack(parts).astype(np.float32)


def test_cluster_recovers_known_centers():
    """3개 멀리 떨어진 cluster center 주변 샘플 → K=3 K-means가 비슷한 centroid 복원."""
    rng = np.random.default_rng(0)
    # 3개 orthogonal-ish center (256d unit vectors)
    centers = []
    for i in range(3):
        v = rng.standard_normal(256)
        v[i * 80:(i + 1) * 80] += 3.0
        centers.append(v / np.linalg.norm(v))
    X = _make_clustered_embeddings(centers, per_cluster=50, noise_std=0.02)
    result = cluster_user_tracks(X, k=3)
    assert result.centroids.shape == (3, 256)
    assert result.labels.shape == (150,)
    assert set(result.labels.tolist()) == {0, 1, 2}
    assert result.weights.sum() == 150
    sims_per_centroid = np.abs(result.centroids @ np.array(centers).T)
    assert (sims_per_centroid.max(axis=1) > 0.85).all()


def test_cluster_weights_match_label_counts():
    centers = [np.eye(256)[i] for i in range(3)]
    X = _make_clustered_embeddings(centers, per_cluster=30)
    result = cluster_user_tracks(X, k=3)
    label_counts = np.bincount(result.labels, minlength=3)
    assert np.array_equal(result.weights, label_counts)


def test_cluster_too_few_tracks_raises():
    X = np.random.randn(2, 256).astype(np.float32)
    with pytest.raises(NotEnoughTracksError):
        cluster_user_tracks(X, k=3)


def test_aggregate_user_vector_weighted():
    """sizes가 다른 두 centroid → 큰 쪽이 사용자 벡터에 더 가까움."""
    c0 = np.array([1.0] + [0.0] * 255, dtype=np.float32)
    c1 = np.array([0.0, 1.0] + [0.0] * 254, dtype=np.float32)
    centroids = np.vstack([c0, c1])
    weights = np.array([100, 10])
    user_vec = aggregate_user_vector(centroids, weights)
    assert np.isclose(np.linalg.norm(user_vec), 1.0, atol=1e-4)
    assert user_vec @ c0 > user_vec @ c1


def test_aggregate_user_vector_l2_normalized():
    centroids = np.random.default_rng(7).standard_normal((3, 256)).astype(np.float32)
    centroids = centroids / np.linalg.norm(centroids, axis=1, keepdims=True)
    weights = np.array([50, 30, 20])
    user_vec = aggregate_user_vector(centroids, weights)
    assert np.isclose(np.linalg.norm(user_vec), 1.0, atol=1e-4)
