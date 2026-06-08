# User Embedding + MRT (B-full) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** UserTrack (PCT + PGT)을 K-means K=3로 클러스터링해 페르소나 embedding을 만들고, 각 페르소나로 카탈로그(166k)를 코사인 검색해 MRT(3 페르소나 플레이리스트 + 추천 트랙/앨범 derive)를 DB에 적재. CLI 갱신 + cron 스케줄.

**Architecture:** 책임 분리 — DB ops (`db/user_embedding.py`) ← K-means + 페르소나 적재 (`recsys/persona.py`) ← 페르소나별 검색 + derive (`recsys/mrt.py`) ← CLI 오케스트레이션. 테스트는 synthetic embedding + DB 트랜잭션 롤백.

**Tech Stack:** Python 3.10+, scikit-learn (KMeans), psycopg, pgvector, numpy, rich, pytest. 외부 의존성 추가 1개 (scikit-learn).

**Spec:** [docs/superpowers/specs/2026-06-08-user-embedding-mrt-design.md](../specs/2026-06-08-user-embedding-mrt-design.md)

---

## 파일 구조 (locked-in)

```
prisma/init/
└── 04_user_embedding.sql      # UserEmbedding + UserPersona + PlaylistHistory DDL

src/mrms/recsys/
├── __init__.py
├── persona.py                  # K-means + persona aggregation
└── mrt.py                      # 페르소나별 pgvector search + MRT derive

src/mrms/db/
└── user_embedding.py           # DB ops for UserEmbedding/UserPersona/PlaylistHistory

scripts/
├── 09_generate_mrt.py          # CLI 생성/갱신
└── 09_view_mrt.py              # CLI 검증/조회

docs/
└── cron-setup.md               # cron/launchd 가이드

tests/
├── recsys/
│   ├── __init__.py
│   ├── test_persona.py
│   └── test_mrt.py
└── db/
    └── test_user_embedding.py
```

의존성 순서:
```
sklearn dep → DDL → DB ops → persona (K-means) → mrt (search + derive) → CLI gen → CLI view → cron docs
```

---

## Task 0: scikit-learn 추가 + tests 디렉토리

**Files:**
- Modify: `pyproject.toml`
- Create: `tests/recsys/__init__.py`

- [ ] **Step 1: pyproject.toml에 scikit-learn 추가**

`pyproject.toml`의 `dependencies` 리스트에 추가:

```toml
"scikit-learn>=1.4",
```

(다른 코어 deps와 같은 섹션, e.g. `pandas` 근처)

- [ ] **Step 2: 의존성 설치**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
source .venv/bin/activate
pip install -e ".[dev]"
pip list | grep scikit-learn
```

Expected: `scikit-learn 1.x.y` 출력

- [ ] **Step 3: tests 디렉토리 생성**

```bash
mkdir -p tests/recsys
touch tests/recsys/__init__.py
```

- [ ] **Step 4: 테스트 collect 동작 확인**

```bash
pytest tests/recsys/ -v
```

Expected: `no tests ran in 0.0Xs` (디렉토리 OK, 테스트 없음)

- [ ] **Step 5: Commit**

```bash
git add pyproject.toml tests/recsys/__init__.py
git commit -m "test: scaffold recsys tests + add scikit-learn dep"
```

---

## Task 1: UserEmbedding + UserPersona + PlaylistHistory DDL

**Files:**
- Create: `prisma/init/04_user_embedding.sql`

- [ ] **Step 1: DDL 파일 작성**

`prisma/init/04_user_embedding.sql`:

```sql
-- UserEmbedding (사용자별 단일 vector, modelVersion으로 A/B)
CREATE TABLE IF NOT EXISTS "UserEmbedding" (
    "userId"       TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    "modelVersion" TEXT NOT NULL,
    embedding      vector(256) NOT NULL,
    "computedFrom" INTEGER NOT NULL,
    "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY ("userId", "modelVersion")
);

CREATE INDEX IF NOT EXISTS idx_userembedding_version
  ON "UserEmbedding"("modelVersion");

-- UserPersona (사용자당 K=3 페르소나, 추후 다양화 가능)
CREATE TABLE IF NOT EXISTS "UserPersona" (
    id             TEXT PRIMARY KEY,
    "userId"       TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    "personaIdx"   INTEGER NOT NULL,
    embedding      vector(256) NOT NULL,
    "inferredTag"  TEXT,
    "topGenres"    TEXT[] NOT NULL DEFAULT '{}',
    "avgBpm"       REAL,
    "contextHours" INTEGER[] NOT NULL DEFAULT '{}',
    "trackCount"   INTEGER NOT NULL,
    UNIQUE ("userId", "personaIdx")
);

CREATE INDEX IF NOT EXISTS idx_userpersona_user
  ON "UserPersona"("userId");

-- PlaylistHistory (페르소나당 1행, 갱신마다 INSERT — history 보존)
CREATE TABLE IF NOT EXISTS "PlaylistHistory" (
    id             TEXT PRIMARY KEY,
    "userId"       TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    "trackIds"     TEXT[] NOT NULL,
    "modelVersion" TEXT NOT NULL,
    context        JSONB,
    "generatedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "playedCount"  INTEGER NOT NULL DEFAULT 0,
    "skipCount"    INTEGER NOT NULL DEFAULT 0,
    "savedCount"   INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_playlisthistory_user_gen
  ON "PlaylistHistory"("userId", "generatedAt" DESC);
```

- [ ] **Step 2: DB에 적용**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
docker compose exec -T pg psql -U mrms -d mrms < prisma/init/04_user_embedding.sql
```

Expected: `CREATE TABLE` × 3, `CREATE INDEX` × 3

- [ ] **Step 3: 테이블 확인**

```bash
docker compose exec pg psql -U mrms -d mrms -c '\d "UserEmbedding"'
docker compose exec pg psql -U mrms -d mrms -c '\d "UserPersona"'
docker compose exec pg psql -U mrms -d mrms -c '\d "PlaylistHistory"'
```

Expected: 3 테이블 모두 정의 출력 — FK / unique / index 포함

- [ ] **Step 4: Commit**

```bash
git add prisma/init/04_user_embedding.sql
git commit -m "feat: UserEmbedding + UserPersona + PlaylistHistory DDL"
```

---

## Task 2: DB ops (src/mrms/db/user_embedding.py)

**Files:**
- Create: `src/mrms/db/user_embedding.py`
- Create: `tests/db/test_user_embedding.py`

- [ ] **Step 1: 실패 테스트 작성**

`tests/db/test_user_embedding.py`:

```python
"""UserEmbedding / UserPersona / PlaylistHistory DB ops 테스트.

전제: PG에 V1 + A1 적재 완료된 상태.
각 테스트는 트랜잭션 롤백.
"""
import numpy as np
import pytest

from mrms.db.user_track import get_or_create_user
from mrms.db.user_embedding import (
    upsert_user_embedding,
    fetch_user_embedding,
    upsert_user_persona,
    list_user_personas,
    insert_playlist_history,
    fetch_latest_playlists,
    list_all_user_emails,
)


def _make_vec(seed: int) -> np.ndarray:
    """Deterministic 256d unit vector."""
    rng = np.random.default_rng(seed)
    v = rng.standard_normal(256).astype(np.float32)
    return v / np.linalg.norm(v)


def test_upsert_and_fetch_user_embedding(db_conn):
    user_id = get_or_create_user(db_conn, email="ue_a@example.com")
    vec = _make_vec(1)
    upsert_user_embedding(db_conn, user_id, "test-v1", vec, computed_from=100)
    fetched = fetch_user_embedding(db_conn, user_id, "test-v1")
    assert fetched is not None
    assert np.allclose(fetched["embedding"], vec, atol=1e-4)
    assert fetched["computedFrom"] == 100


def test_upsert_user_embedding_replaces(db_conn):
    user_id = get_or_create_user(db_conn, email="ue_b@example.com")
    upsert_user_embedding(db_conn, user_id, "test-v1", _make_vec(2), computed_from=50)
    upsert_user_embedding(db_conn, user_id, "test-v1", _make_vec(3), computed_from=200)
    fetched = fetch_user_embedding(db_conn, user_id, "test-v1")
    assert fetched["computedFrom"] == 200


def test_upsert_user_persona_and_list(db_conn):
    user_id = get_or_create_user(db_conn, email="up_a@example.com")
    upsert_user_persona(db_conn, user_id, persona_idx=0, embedding=_make_vec(10), track_count=120)
    upsert_user_persona(db_conn, user_id, persona_idx=1, embedding=_make_vec(11), track_count=110)
    upsert_user_persona(db_conn, user_id, persona_idx=2, embedding=_make_vec(12), track_count=104)
    personas = list_user_personas(db_conn, user_id)
    assert len(personas) == 3
    assert sorted(p["personaIdx"] for p in personas) == [0, 1, 2]
    by_idx = {p["personaIdx"]: p for p in personas}
    assert by_idx[0]["trackCount"] == 120


def test_upsert_user_persona_replaces(db_conn):
    user_id = get_or_create_user(db_conn, email="up_b@example.com")
    upsert_user_persona(db_conn, user_id, 0, _make_vec(20), track_count=100)
    upsert_user_persona(db_conn, user_id, 0, _make_vec(21), track_count=150)
    personas = list_user_personas(db_conn, user_id)
    assert len(personas) == 1
    assert personas[0]["trackCount"] == 150


def test_insert_playlist_history(db_conn):
    user_id = get_or_create_user(db_conn, email="ph_a@example.com")
    # 더미 trackId — Track FK 없음 (PlaylistHistory.trackIds는 TEXT[]로 FK 없음)
    track_ids = ["c000000000000000000000001", "c000000000000000000000002"]
    row_id = insert_playlist_history(
        db_conn, user_id, track_ids, "test-v1",
        context={"personaIdx": 0, "kind": "persona"},
    )
    assert row_id.startswith("c") or len(row_id) > 0


def test_fetch_latest_playlists_returns_latest_3(db_conn):
    user_id = get_or_create_user(db_conn, email="ph_b@example.com")
    # 두 번 generate → 총 6행. fetch_latest는 마지막 3개만.
    for i in range(3):
        insert_playlist_history(
            db_conn, user_id, [f"old{i}"], "test-v1",
            context={"personaIdx": i, "kind": "persona"},
        )
    # 두 번째 generation (더 늦은 시각)
    new_ids = []
    for i in range(3):
        rid = insert_playlist_history(
            db_conn, user_id, [f"new{i}"], "test-v1",
            context={"personaIdx": i, "kind": "persona"},
        )
        new_ids.append(rid)
    latest = fetch_latest_playlists(db_conn, user_id, limit=3)
    assert len(latest) == 3
    latest_ids = {p["id"] for p in latest}
    assert latest_ids == set(new_ids)


def test_list_all_user_emails_includes_recent(db_conn):
    get_or_create_user(db_conn, email="all_a@example.com")
    get_or_create_user(db_conn, email="all_b@example.com")
    emails = list_all_user_emails(db_conn)
    assert "all_a@example.com" in emails
    assert "all_b@example.com" in emails
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
source .venv/bin/activate
pytest tests/db/test_user_embedding.py -v
```

Expected: `ImportError: cannot import name '...' from 'mrms.db.user_embedding'`

- [ ] **Step 3: 구현**

`src/mrms/db/user_embedding.py`:

```python
"""UserEmbedding / UserPersona / PlaylistHistory DB ops.

pgvector vector(256) 타입은 list[float] 또는 numpy array로 받음.
register_vector(conn)로 호출자가 등록 필요.
"""
from __future__ import annotations

import hashlib
import json
from typing import Any

import numpy as np
import psycopg


def _id(value: str) -> str:
    h = hashlib.sha1(value.encode()).hexdigest()[:24]
    return f"c{h}"


def _to_list(vec: np.ndarray) -> list[float]:
    return [float(x) for x in vec.tolist()]


def upsert_user_embedding(
    conn: psycopg.Connection,
    user_id: str,
    model_version: str,
    embedding: np.ndarray,
    computed_from: int,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            '''INSERT INTO "UserEmbedding"
                 ("userId", "modelVersion", embedding, "computedFrom", "updatedAt")
               VALUES (%s, %s, %s, %s, NOW())
               ON CONFLICT ("userId", "modelVersion") DO UPDATE SET
                 embedding = EXCLUDED.embedding,
                 "computedFrom" = EXCLUDED."computedFrom",
                 "updatedAt" = NOW()''',
            (user_id, model_version, _to_list(embedding), computed_from),
        )


def fetch_user_embedding(
    conn: psycopg.Connection,
    user_id: str,
    model_version: str,
) -> dict[str, Any] | None:
    with conn.cursor() as cur:
        cur.execute(
            '''SELECT embedding, "computedFrom", "updatedAt"
               FROM "UserEmbedding"
               WHERE "userId" = %s AND "modelVersion" = %s''',
            (user_id, model_version),
        )
        row = cur.fetchone()
    if row is None:
        return None
    return {
        "embedding": np.asarray(row[0], dtype=np.float32),
        "computedFrom": row[1],
        "updatedAt": row[2],
    }


def upsert_user_persona(
    conn: psycopg.Connection,
    user_id: str,
    persona_idx: int,
    embedding: np.ndarray,
    track_count: int,
) -> str:
    row_id = _id(f"persona|{user_id}|{persona_idx}")
    with conn.cursor() as cur:
        cur.execute(
            '''INSERT INTO "UserPersona"
                 (id, "userId", "personaIdx", embedding, "trackCount")
               VALUES (%s, %s, %s, %s, %s)
               ON CONFLICT ("userId", "personaIdx") DO UPDATE SET
                 embedding = EXCLUDED.embedding,
                 "trackCount" = EXCLUDED."trackCount"''',
            (row_id, user_id, persona_idx, _to_list(embedding), track_count),
        )
    return row_id


def list_user_personas(
    conn: psycopg.Connection,
    user_id: str,
) -> list[dict[str, Any]]:
    with conn.cursor() as cur:
        cur.execute(
            '''SELECT id, "personaIdx", embedding, "trackCount"
               FROM "UserPersona"
               WHERE "userId" = %s
               ORDER BY "personaIdx"''',
            (user_id,),
        )
        rows = cur.fetchall()
    return [
        {
            "id": r[0],
            "personaIdx": r[1],
            "embedding": np.asarray(r[2], dtype=np.float32),
            "trackCount": r[3],
        }
        for r in rows
    ]


def insert_playlist_history(
    conn: psycopg.Connection,
    user_id: str,
    track_ids: list[str],
    model_version: str,
    context: dict[str, Any],
) -> str:
    # generatedAt 포함 결정론적 ID는 의미 없음 → uuid 비슷한 random + user_id
    import secrets
    row_id = "c" + hashlib.sha1(
        f"{user_id}|{model_version}|{secrets.token_hex(8)}".encode()
    ).hexdigest()[:24]
    with conn.cursor() as cur:
        cur.execute(
            '''INSERT INTO "PlaylistHistory"
                 (id, "userId", "trackIds", "modelVersion", context)
               VALUES (%s, %s, %s, %s, %s::jsonb)''',
            (row_id, user_id, track_ids, model_version, json.dumps(context)),
        )
    return row_id


def fetch_latest_playlists(
    conn: psycopg.Connection,
    user_id: str,
    limit: int = 3,
) -> list[dict[str, Any]]:
    with conn.cursor() as cur:
        cur.execute(
            '''SELECT id, "trackIds", "modelVersion", context, "generatedAt"
               FROM "PlaylistHistory"
               WHERE "userId" = %s
               ORDER BY "generatedAt" DESC
               LIMIT %s''',
            (user_id, limit),
        )
        rows = cur.fetchall()
    return [
        {
            "id": r[0],
            "trackIds": list(r[1]),
            "modelVersion": r[2],
            "context": r[3] if r[3] else {},
            "generatedAt": r[4],
        }
        for r in rows
    ]


def list_all_user_emails(conn: psycopg.Connection) -> list[str]:
    with conn.cursor() as cur:
        cur.execute('SELECT email FROM "User" ORDER BY "createdAt"')
        rows = cur.fetchall()
    return [r[0] for r in rows]
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
pytest tests/db/test_user_embedding.py -v
```

Expected: 7 passed

- [ ] **Step 5: Commit**

```bash
git add src/mrms/db/user_embedding.py tests/db/test_user_embedding.py
git commit -m "feat: DB ops for UserEmbedding/UserPersona/PlaylistHistory"
```

---

## Task 3: K-means + Persona (src/mrms/recsys/persona.py)

**Files:**
- Create: `src/mrms/recsys/__init__.py` (empty)
- Create: `src/mrms/recsys/persona.py`
- Create: `tests/recsys/test_persona.py`

- [ ] **Step 1: 실패 테스트 작성**

`src/mrms/recsys/__init__.py` (empty):

```python
```

`tests/recsys/test_persona.py`:

```python
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
        v[i * 80:(i + 1) * 80] += 3.0  # cluster 영역만 강조
        centers.append(v / np.linalg.norm(v))
    X = _make_clustered_embeddings(centers, per_cluster=50, noise_std=0.02)
    result = cluster_user_tracks(X, k=3)
    assert result.centroids.shape == (3, 256)
    assert result.labels.shape == (150,)
    assert set(result.labels.tolist()) == {0, 1, 2}
    assert result.weights.sum() == 150
    # 각 centroid이 어떤 원본 center와 유사한지 (cosine > 0.9)
    sims_per_centroid = np.abs(result.centroids @ np.array(centers).T)
    # 각 row(centroid)당 max sim이 충분히 높아야
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
    # L2 정규화 확인
    assert np.isclose(np.linalg.norm(user_vec), 1.0, atol=1e-4)
    # 가중치 100인 c0에 더 가까움
    assert user_vec @ c0 > user_vec @ c1


def test_aggregate_user_vector_l2_normalized():
    centroids = np.random.default_rng(7).standard_normal((3, 256)).astype(np.float32)
    centroids = centroids / np.linalg.norm(centroids, axis=1, keepdims=True)
    weights = np.array([50, 30, 20])
    user_vec = aggregate_user_vector(centroids, weights)
    assert np.isclose(np.linalg.norm(user_vec), 1.0, atol=1e-4)
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
pytest tests/recsys/test_persona.py -v
```

Expected: `ImportError`

- [ ] **Step 3: 구현**

`src/mrms/recsys/persona.py`:

```python
"""K-means 클러스터링 + UserEmbedding 집계.

UserTrack 임베딩 → 3 centroids + per-track label.
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
    """K-means로 사용자 트랙 임베딩을 K개 클러스터로.

    embeddings: (N, 256) 또는 (N, D) — 형태 검증은 호출자.
    """
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
    """페르소나 centroids를 trackCount 가중 평균 → 단일 256d vector.

    결과는 L2 정규화.
    """
    avg = np.average(centroids, axis=0, weights=weights)
    norm = np.linalg.norm(avg).clip(min=1e-12)
    return (avg / norm).astype(np.float32)
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
pytest tests/recsys/test_persona.py -v
```

Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
git add src/mrms/recsys/__init__.py src/mrms/recsys/persona.py tests/recsys/test_persona.py
git commit -m "feat: K-means clustering + persona aggregation"
```

---

## Task 4: MRT search + derive (src/mrms/recsys/mrt.py)

**Files:**
- Create: `src/mrms/recsys/mrt.py`
- Create: `tests/recsys/test_mrt.py`

- [ ] **Step 1: 실패 테스트 작성**

`tests/recsys/test_mrt.py`:

```python
"""MRT 페르소나 검색 + derive 테스트."""
import numpy as np
import pytest

from mrms.db.user_track import get_or_create_user, upsert_user_track, find_track_id_by_isrc
from mrms.recsys.mrt import (
    search_for_persona,
    derive_recommended_tracks,
    derive_recommended_albums,
)


def test_search_for_persona_returns_results(db_conn):
    """실제 카탈로그에 대해 random unit vector로 검색 → top-N 트랙 반환."""
    user_id = get_or_create_user(db_conn, email="mrt_a@example.com")
    # 임의 256d unit vector
    rng = np.random.default_rng(1)
    centroid = rng.standard_normal(256).astype(np.float32)
    centroid /= np.linalg.norm(centroid)
    results = search_for_persona(
        db_conn, user_id, centroid,
        catalog_model_version="our-v1.0",
        candidate_pool=10, top_n=5,
    )
    if not results:
        pytest.skip("TrackEmbedding 비어 있음 — V1 적재 선행 필요")
    assert len(results) <= 5
    assert all("track_id" in r and "similarity" in r for r in results)
    # similarity 내림차순
    sims = [r["similarity"] for r in results]
    assert sims == sorted(sims, reverse=True)


def test_search_excludes_user_tracks(db_conn):
    """이미 UserTrack에 있는 트랙은 결과에 안 나옴."""
    user_id = get_or_create_user(db_conn, email="mrt_b@example.com")
    with db_conn.cursor() as cur:
        cur.execute('SELECT id FROM "Track" LIMIT 1')
        row = cur.fetchone()
    if row is None:
        pytest.skip("Track 비어있음")
    excluded_track_id = row[0]
    upsert_user_track(db_conn, user_id, excluded_track_id,
                      is_core=True, source="liked", platform="tidal")
    # 해당 트랙의 임베딩으로 검색 → 자기 자신은 나오면 안 됨
    with db_conn.cursor() as cur:
        cur.execute(
            'SELECT embedding FROM "TrackEmbedding" WHERE "trackId" = %s LIMIT 1',
            (excluded_track_id,),
        )
        row = cur.fetchone()
    if row is None:
        pytest.skip("TrackEmbedding 미존재")
    centroid = np.asarray(row[0], dtype=np.float32)
    results = search_for_persona(
        db_conn, user_id, centroid,
        catalog_model_version="our-v1.0",
        candidate_pool=10, top_n=10,
    )
    returned_ids = {r["track_id"] for r in results}
    assert excluded_track_id not in returned_ids


def test_derive_recommended_tracks_dedup_and_score():
    """3 페르소나의 top-N → dedup by track_id, score=max similarity."""
    playlists = [
        {
            "context": {"personaIdx": 0},
            "trackIds": ["t1", "t2", "t3"],
            "scores": [0.9, 0.8, 0.7],
        },
        {
            "context": {"personaIdx": 1},
            "trackIds": ["t2", "t4"],  # t2 중복
            "scores": [0.95, 0.6],     # t2 더 높음
        },
        {
            "context": {"personaIdx": 2},
            "trackIds": ["t5"],
            "scores": [0.85],
        },
    ]
    results = derive_recommended_tracks(playlists, top_n=10)
    by_id = {r["track_id"]: r for r in results}
    assert by_id["t2"]["score"] == 0.95  # max similarity
    assert by_id["t1"]["score"] == 0.9
    # 모든 distinct track_ids
    assert set(by_id.keys()) == {"t1", "t2", "t3", "t4", "t5"}
    # score 내림차순
    scores = [r["score"] for r in results]
    assert scores == sorted(scores, reverse=True)


def test_derive_recommended_albums_by_track_count():
    """track→album 매핑에서 album별 추천 트랙 수 집계."""
    playlists = [
        {"context": {"personaIdx": 0}, "trackIds": ["t1", "t2"], "scores": [0.9, 0.8]},
        {"context": {"personaIdx": 1}, "trackIds": ["t3", "t4"], "scores": [0.7, 0.6]},
    ]
    track_to_album = {
        "t1": "album_a",
        "t2": "album_a",
        "t3": "album_a",
        "t4": "album_b",
    }
    result = derive_recommended_albums(playlists, track_to_album, top_n=2)
    # album_a 트랙 3개, album_b 1개
    assert result[0]["album_id"] == "album_a"
    assert result[0]["track_count"] == 3
    assert result[1]["album_id"] == "album_b"
    assert result[1]["track_count"] == 1
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
pytest tests/recsys/test_mrt.py -v
```

Expected: `ImportError`

- [ ] **Step 3: 구현**

`src/mrms/recsys/mrt.py`:

```python
"""MRT (Model Recommendation Tracks) — 페르소나별 pgvector 검색 + derive.

페르소나 centroid로 카탈로그를 코사인 검색하고,
3 페르소나의 결과를 합쳐서 추천 트랙/앨범 derive.
"""
from __future__ import annotations

from collections import defaultdict
from typing import Any

import numpy as np
import psycopg


def _to_list(vec: np.ndarray) -> list[float]:
    return [float(x) for x in vec.tolist()]


def search_for_persona(
    conn: psycopg.Connection,
    user_id: str,
    centroid: np.ndarray,
    catalog_model_version: str = "our-v1.0",
    candidate_pool: int = 30,
    top_n: int = 20,
) -> list[dict[str, Any]]:
    """페르소나 centroid로 카탈로그 코사인 검색. UserTrack 제외.

    반환: [{track_id, title, artist, album_id, similarity}, ...]
    """
    centroid_list = _to_list(centroid)
    with conn.cursor() as cur:
        cur.execute(
            '''SELECT t.id, t.title, a.name AS artist, t."albumId",
                      1 - (e.embedding <=> %s::vector) AS similarity
               FROM "TrackEmbedding" e
               JOIN "Track" t ON t.id = e."trackId"
               JOIN "Artist" a ON a.id = t."artistId"
               WHERE e."modelVersion" = %s
                 AND t.id NOT IN (
                   SELECT "trackId" FROM "UserTrack" WHERE "userId" = %s
                 )
               ORDER BY e.embedding <=> %s::vector
               LIMIT %s''',
            (centroid_list, catalog_model_version, user_id, centroid_list, candidate_pool),
        )
        rows = cur.fetchall()
    results = [
        {
            "track_id": r[0],
            "title": r[1],
            "artist": r[2],
            "album_id": r[3],
            "similarity": float(r[4]),
        }
        for r in rows
    ]
    return results[:top_n]


def derive_recommended_tracks(
    playlists: list[dict[str, Any]],
    top_n: int = 30,
) -> list[dict[str, Any]]:
    """페르소나 플레이리스트들에서 dedup + max score.

    playlists 각 항목: {context, trackIds, scores}
    반환: [{track_id, score, persona_indices}, ...] sorted desc.
    """
    best: dict[str, dict[str, Any]] = {}
    for pl in playlists:
        persona_idx = (pl.get("context") or {}).get("personaIdx")
        track_ids = pl.get("trackIds") or []
        scores = pl.get("scores") or [0.0] * len(track_ids)
        for tid, sc in zip(track_ids, scores):
            existing = best.get(tid)
            if existing is None or sc > existing["score"]:
                best[tid] = {
                    "track_id": tid,
                    "score": float(sc),
                    "persona_idx": persona_idx,
                }
    items = list(best.values())
    items.sort(key=lambda r: -r["score"])
    return items[:top_n]


def derive_recommended_albums(
    playlists: list[dict[str, Any]],
    track_to_album: dict[str, str | None],
    top_n: int = 15,
) -> list[dict[str, Any]]:
    """페르소나 플레이리스트들에서 album별 추천 트랙 수 집계.

    track_to_album: track_id → album_id (None 가능, 그러면 skip)
    반환: [{album_id, track_count}, ...] sorted desc.
    """
    counts: dict[str, int] = defaultdict(int)
    seen_pairs: set[tuple[str, str]] = set()
    for pl in playlists:
        for tid in (pl.get("trackIds") or []):
            album_id = track_to_album.get(tid)
            if not album_id:
                continue
            pair = (album_id, tid)
            if pair in seen_pairs:
                continue
            seen_pairs.add(pair)
            counts[album_id] += 1
    items = [{"album_id": aid, "track_count": cnt} for aid, cnt in counts.items()]
    items.sort(key=lambda r: -r["track_count"])
    return items[:top_n]
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
pytest tests/recsys/test_mrt.py -v
```

Expected: 4 passed (또는 Track/TrackEmbedding 비었으면 일부 skip)

- [ ] **Step 5: Commit**

```bash
git add src/mrms/recsys/mrt.py tests/recsys/test_mrt.py
git commit -m "feat: persona pgvector search + MRT derive helpers"
```

---

## Task 5: CLI generate (scripts/09_generate_mrt.py)

**Files:**
- Create: `scripts/09_generate_mrt.py`

- [ ] **Step 1: CLI 작성**

`scripts/09_generate_mrt.py`:

```python
"""MRT 생성/갱신 CLI.

본인 (또는 모든) 사용자의 UserTrack을 K-means로 클러스터링,
UserEmbedding + UserPersona UPSERT, 페르소나별 추천 검색,
PlaylistHistory 3행 INSERT.

사용:
    python3 scripts/09_generate_mrt.py --email me@example.com
    python3 scripts/09_generate_mrt.py --all
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

import numpy as np
import psycopg
from dotenv import load_dotenv
from rich.console import Console

from mrms.db.user_embedding import (
    upsert_user_embedding,
    upsert_user_persona,
    insert_playlist_history,
    list_all_user_emails,
)
from mrms.db.user_track import get_or_create_user
from mrms.recsys.mrt import search_for_persona
from mrms.recsys.persona import (
    NotEnoughTracksError,
    aggregate_user_vector,
    cluster_user_tracks,
)


MODEL_VERSION = "our-v1.0+persona-K3"
CATALOG_MODEL_VERSION = "our-v1.0"

load_dotenv(override=True)
console = Console()


def fetch_user_track_matrix(
    conn: psycopg.Connection,
    user_id: str,
    catalog_model_version: str = CATALOG_MODEL_VERSION,
) -> tuple[list[str], np.ndarray]:
    """UserTrack의 256d 임베딩 행렬 반환."""
    with conn.cursor() as cur:
        cur.execute(
            '''SELECT ut."trackId", e.embedding
               FROM "UserTrack" ut
               JOIN "TrackEmbedding" e ON e."trackId" = ut."trackId"
               WHERE ut."userId" = %s AND e."modelVersion" = %s''',
            (user_id, catalog_model_version),
        )
        rows = cur.fetchall()
    if not rows:
        return [], np.zeros((0, 256), dtype=np.float32)
    track_ids = [r[0] for r in rows]
    X = np.array([list(r[1]) for r in rows], dtype=np.float32)
    return track_ids, X


def generate_for_user(conn: psycopg.Connection, email: str, k: int, top_n: int, candidate_pool: int) -> bool:
    """단일 사용자 MRT 생성. True=성공, False=skip."""
    console.print(f"\n[bold]== {email} ==[/bold]")
    user_id = get_or_create_user(conn, email)
    conn.commit()

    track_ids, X = fetch_user_track_matrix(conn, user_id)
    console.print(f"  UserTrack 임베딩: [bold]{len(track_ids)}[/bold]")
    if len(track_ids) < k:
        console.print(f"  [yellow]skip — 트랙 수 < K({k})[/yellow]")
        return False

    try:
        result = cluster_user_tracks(X, k=k)
    except NotEnoughTracksError as e:
        console.print(f"  [yellow]skip — {e}[/yellow]")
        return False
    console.print(f"  K-means 클러스터 크기: {result.weights.tolist()}")

    # UserEmbedding 집계
    user_vec = aggregate_user_vector(result.centroids, result.weights)
    upsert_user_embedding(conn, user_id, MODEL_VERSION, user_vec, computed_from=len(track_ids))

    # UserPersona × K
    for idx in range(k):
        upsert_user_persona(
            conn, user_id, persona_idx=idx,
            embedding=result.centroids[idx],
            track_count=int(result.weights[idx]),
        )

    # 페르소나별 검색 + PlaylistHistory
    for idx in range(k):
        recs = search_for_persona(
            conn, user_id, result.centroids[idx],
            catalog_model_version=CATALOG_MODEL_VERSION,
            candidate_pool=candidate_pool,
            top_n=top_n,
        )
        track_id_list = [r["track_id"] for r in recs]
        score_list = [r["similarity"] for r in recs]
        insert_playlist_history(
            conn, user_id, track_id_list, MODEL_VERSION,
            context={"personaIdx": idx, "kind": "persona", "scores": score_list},
        )
        console.print(f"  페르소나 {idx} 추천: {len(track_id_list)}곡")

    conn.commit()
    console.print("  [green]✓ MRT 적재 완료[/green]")
    return True


def main() -> None:
    parser = argparse.ArgumentParser()
    grp = parser.add_mutually_exclusive_group(required=True)
    grp.add_argument("--email", type=str)
    grp.add_argument("--all", action="store_true")
    parser.add_argument("--k", type=int, default=3)
    parser.add_argument("--persona-top-n", type=int, default=20)
    parser.add_argument("--candidate-pool", type=int, default=30)
    args = parser.parse_args()

    dsn = os.environ.get("DATABASE_URL", "postgresql://mrms:mrms@localhost:5433/mrms")
    with psycopg.connect(dsn, autocommit=False) as conn:
        if args.email:
            ok = generate_for_user(conn, args.email, args.k, args.persona_top_n, args.candidate_pool)
            sys.exit(0 if ok else 1)
        # --all
        emails = list_all_user_emails(conn)
        console.print(f"전체 사용자: [bold]{len(emails)}[/bold]")
        success = 0
        for email in emails:
            try:
                if generate_for_user(conn, email, args.k, args.persona_top_n, args.candidate_pool):
                    success += 1
            except Exception as e:
                console.print(f"  [red]사용자 {email} 실패: {e}[/red]")
                conn.rollback()
        console.print(f"\n[bold]총 {success}/{len(emails)} 사용자 MRT 적재[/bold]")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: import 정상 검증**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
source .venv/bin/activate
python3 -c "
import sys; sys.path.insert(0, 'src')
import importlib.util
spec = importlib.util.spec_from_file_location('m', 'scripts/09_generate_mrt.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
print('OK — main:', hasattr(m, 'main'), 'fetch:', hasattr(m, 'fetch_user_track_matrix'))
"
```

Expected: `OK — main: True fetch: True`

- [ ] **Step 3: --help 동작 검증**

```bash
python3 scripts/09_generate_mrt.py --help
```

Expected: usage 출력, `--email` / `--all` mutually exclusive, `--k` 기본 3 표시

- [ ] **Step 4: Commit**

```bash
git add scripts/09_generate_mrt.py
git commit -m "feat: scripts/09_generate_mrt.py CLI orchestrator"
```

---

## Task 6: CLI view (scripts/09_view_mrt.py)

**Files:**
- Create: `scripts/09_view_mrt.py`

- [ ] **Step 1: CLI 작성**

`scripts/09_view_mrt.py`:

```python
"""MRT 조회/검증 CLI.

사용자의 latest MRT (페르소나별 플레이리스트, 추천 트랙, 추천 앨범) 출력.

사용:
    python3 scripts/09_view_mrt.py --email me@example.com
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

import psycopg
from dotenv import load_dotenv
from rich.console import Console
from rich.table import Table

from mrms.db.user_embedding import fetch_latest_playlists
from mrms.db.user_track import get_or_create_user
from mrms.recsys.mrt import derive_recommended_albums, derive_recommended_tracks


load_dotenv(override=True)
console = Console()


def fetch_track_metadata(
    conn: psycopg.Connection,
    track_ids: list[str],
) -> dict[str, dict]:
    """track_id → {title, artist, album_id, album_title} 매핑."""
    if not track_ids:
        return {}
    with conn.cursor() as cur:
        cur.execute(
            '''SELECT t.id, t.title, a.name, t."albumId", alb.title
               FROM "Track" t
               JOIN "Artist" a ON a.id = t."artistId"
               LEFT JOIN "Album" alb ON alb.id = t."albumId"
               WHERE t.id = ANY(%s)''',
            (track_ids,),
        )
        rows = cur.fetchall()
    return {
        r[0]: {
            "title": r[1],
            "artist": r[2],
            "album_id": r[3],
            "album_title": r[4],
        }
        for r in rows
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--email", required=True)
    parser.add_argument("--top-n", type=int, default=10, help="페르소나당 표시 곡 수")
    args = parser.parse_args()

    dsn = os.environ.get("DATABASE_URL", "postgresql://mrms:mrms@localhost:5433/mrms")
    with psycopg.connect(dsn, autocommit=False) as conn:
        user_id = get_or_create_user(conn, args.email)
        conn.commit()

        playlists = fetch_latest_playlists(conn, user_id, limit=3)
        if len(playlists) < 3:
            console.print(f"[yellow]MRT 데이터 부족: {len(playlists)}개 플레이리스트만 존재. 먼저 09_generate_mrt.py 실행.[/yellow]")
            sys.exit(1)

        # 페르소나 인덱스 기준 정렬
        playlists_sorted = sorted(
            playlists,
            key=lambda p: (p.get("context") or {}).get("personaIdx", 999),
        )

        # 모든 트랙 메타데이터 한 번에 조회
        all_track_ids = list({tid for p in playlists_sorted for tid in p["trackIds"]})
        meta = fetch_track_metadata(conn, all_track_ids)

        # 페르소나별 출력
        for p in playlists_sorted:
            ctx = p.get("context") or {}
            persona_idx = ctx.get("personaIdx", "?")
            scores = ctx.get("scores", [])
            console.print(f"\n[bold cyan]━━━ 페르소나 {persona_idx} ━━━[/bold cyan]")
            table = Table(show_header=True, header_style="bold")
            table.add_column("#", width=3)
            table.add_column("title")
            table.add_column("artist")
            table.add_column("similarity", width=10)
            for i, (tid, sc) in enumerate(zip(p["trackIds"][:args.top_n], scores[:args.top_n]), 1):
                m = meta.get(tid, {})
                table.add_row(
                    str(i),
                    m.get("title", "?")[:50],
                    m.get("artist", "?")[:30],
                    f"{sc:.3f}",
                )
            console.print(table)

        # 추천 트랙 derive
        playlists_with_scores = [
            {
                "context": p.get("context") or {},
                "trackIds": p["trackIds"],
                "scores": (p.get("context") or {}).get("scores", []),
            }
            for p in playlists_sorted
        ]
        rec_tracks = derive_recommended_tracks(playlists_with_scores, top_n=args.top_n)
        console.print(f"\n[bold magenta]━━━ 추천 트랙 (top-{len(rec_tracks)}) ━━━[/bold magenta]")
        rt_table = Table(show_header=True, header_style="bold")
        rt_table.add_column("#", width=3)
        rt_table.add_column("title")
        rt_table.add_column("artist")
        rt_table.add_column("from persona", width=12)
        rt_table.add_column("score", width=8)
        for i, t in enumerate(rec_tracks, 1):
            m = meta.get(t["track_id"], {})
            rt_table.add_row(
                str(i),
                m.get("title", "?")[:50],
                m.get("artist", "?")[:30],
                str(t.get("persona_idx", "?")),
                f"{t['score']:.3f}",
            )
        console.print(rt_table)

        # 추천 앨범 derive
        track_to_album = {tid: m["album_id"] for tid, m in meta.items()}
        rec_albums = derive_recommended_albums(playlists_with_scores, track_to_album, top_n=5)
        console.print(f"\n[bold green]━━━ 추천 앨범 (top-{len(rec_albums)}) ━━━[/bold green]")
        # album_id → title 조회
        album_ids = [r["album_id"] for r in rec_albums]
        album_titles = {}
        if album_ids:
            with conn.cursor() as cur:
                cur.execute(
                    'SELECT alb.id, alb.title, a.name FROM "Album" alb JOIN "Artist" a ON a.id = alb."artistId" WHERE alb.id = ANY(%s)',
                    (album_ids,),
                )
                for row in cur.fetchall():
                    album_titles[row[0]] = (row[1], row[2])
        for i, r in enumerate(rec_albums, 1):
            title, artist = album_titles.get(r["album_id"], ("?", "?"))
            console.print(f"  {i}. {title} - {artist} ({r['track_count']}곡 추천)")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: import 검증**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
source .venv/bin/activate
python3 -c "
import sys; sys.path.insert(0, 'src')
import importlib.util
spec = importlib.util.spec_from_file_location('m', 'scripts/09_view_mrt.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
print('OK')
"
```

Expected: `OK`

- [ ] **Step 3: --help 동작**

```bash
python3 scripts/09_view_mrt.py --help
```

Expected: usage with `--email EMAIL` and `--top-n` options

- [ ] **Step 4: Commit**

```bash
git add scripts/09_view_mrt.py
git commit -m "feat: scripts/09_view_mrt.py — MRT inspect/verify CLI"
```

---

## Task 7: Cron setup docs

**Files:**
- Create: `docs/cron-setup.md`

- [ ] **Step 1: 가이드 문서 작성**

`docs/cron-setup.md`:

```markdown
# MRT 갱신 스케줄링 가이드

`scripts/09_generate_mrt.py`를 정기적으로 호출해 모든 사용자의 MRT를 1주 2회 갱신.

## macOS (launchd 권장) 또는 Linux (cron)

### Linux / WSL / Mac (crontab)

```bash
crontab -e
```

다음 라인 추가 (매주 월, 목 오전 3시):

```
0 3 * * 1,4 cd "/Volumes/MacExtend 1/MRMS_FN" && .venv/bin/python3 scripts/09_generate_mrt.py --all >> logs/mrt_cron.log 2>&1
```

확인:

```bash
crontab -l        # 등록 확인
tail -f logs/mrt_cron.log    # 다음 실행 결과 보기
```

### macOS (launchd)

`~/Library/LaunchAgents/team.approid.mrms.mrt.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>team.approid.mrms.mrt</string>
  <key>ProgramArguments</key>
  <array>
    <string>/Volumes/MacExtend 1/MRMS_FN/.venv/bin/python3</string>
    <string>/Volumes/MacExtend 1/MRMS_FN/scripts/09_generate_mrt.py</string>
    <string>--all</string>
  </array>
  <key>WorkingDirectory</key>
  <string>/Volumes/MacExtend 1/MRMS_FN</string>
  <key>StandardOutPath</key>
  <string>/Volumes/MacExtend 1/MRMS_FN/logs/mrt_cron.log</string>
  <key>StandardErrorPath</key>
  <string>/Volumes/MacExtend 1/MRMS_FN/logs/mrt_cron.err</string>
  <key>StartCalendarInterval</key>
  <array>
    <dict>
      <key>Weekday</key><integer>1</integer>
      <key>Hour</key><integer>3</integer>
      <key>Minute</key><integer>0</integer>
    </dict>
    <dict>
      <key>Weekday</key><integer>4</integer>
      <key>Hour</key><integer>3</integer>
      <key>Minute</key><integer>0</integer>
    </dict>
  </array>
</dict>
</plist>
```

로드:

```bash
launchctl load ~/Library/LaunchAgents/team.approid.mrms.mrt.plist
launchctl list | grep mrms     # 등록 확인
```

해제:

```bash
launchctl unload ~/Library/LaunchAgents/team.approid.mrms.mrt.plist
```

## 수동 실행 (디버깅)

```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
source .venv/bin/activate
python3 scripts/09_generate_mrt.py --all
```

## 트러블슈팅

### "venv가 없습니다"

cron 환경에 venv 활성화 안 됨. 위 명령처럼 `.venv/bin/python3` 절대 경로로 호출.

### "DATABASE_URL 못 찾음"

cron은 shell 환경변수 안 상속. `.env` 파일이 cwd에 있어야 함 → `cd /Volumes/MacExtend 1/MRMS_FN` 먼저.

### "외장 SSD 마운트 안 됨"

Mac에서 외장 SSD가 sleep 모드면 cron 실행 시 unmount일 수 있음. 무인 운영 시 내장 디스크 경로 권장.
```

- [ ] **Step 2: 파일 내용 확인**

```bash
cat docs/cron-setup.md | head -20
```

- [ ] **Step 3: Commit**

```bash
git add docs/cron-setup.md
git commit -m "docs: MRT 갱신 스케줄링 (cron / launchd) 가이드"
```

---

## Task 8: 실제 데이터로 검증 + 본인 평가

**Files:**
- (수정 없음 — 실제 실행 및 결과 평가)

- [ ] **Step 1: 사전 확인**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
source .venv/bin/activate

# UserTrack 적재 확인 (A1 결과)
docker compose exec pg psql -U mrms -d mrms -c '
  SELECT COUNT(*) FROM "UserTrack"
  WHERE "userId" = (SELECT id FROM "User" WHERE email = $$jacinto68@onlinecmk.com$$);
'

# TrackEmbedding 확인
docker compose exec pg psql -U mrms -d mrms -c 'SELECT COUNT(*) FROM "TrackEmbedding";'
```

Expected: UserTrack ~334, TrackEmbedding 166k+

- [ ] **Step 2: MRT 생성**

```bash
python3 scripts/09_generate_mrt.py --email jacinto68@onlinecmk.com
```

Expected:
- UserTrack 임베딩 ~334
- K-means 3 클러스터 크기 출력 (e.g. [120, 110, 104])
- "MRT 적재 완료" 메시지

- [ ] **Step 3: DB 확인**

```bash
docker compose exec pg psql -U mrms -d mrms -c '
  SELECT
    (SELECT COUNT(*) FROM "UserEmbedding" WHERE "userId" = (SELECT id FROM "User" WHERE email = $$jacinto68@onlinecmk.com$$)) AS user_emb,
    (SELECT COUNT(*) FROM "UserPersona" WHERE "userId" = (SELECT id FROM "User" WHERE email = $$jacinto68@onlinecmk.com$$)) AS personas,
    (SELECT COUNT(*) FROM "PlaylistHistory" WHERE "userId" = (SELECT id FROM "User" WHERE email = $$jacinto68@onlinecmk.com$$)) AS playlists;
'
```

Expected: user_emb=1, personas=3, playlists=3

- [ ] **Step 4: MRT 조회 + 본인 평가**

```bash
python3 scripts/09_view_mrt.py --email jacinto68@onlinecmk.com
```

본인이 직접 결과 봐서:
- 페르소나 0/1/2 각 곡 목록 음악적으로 일관성 있는지
- "들어볼만한" 트랙 비율 ≥30%
- 페르소나 간 차이가 인지될 만큼 분리됐는지

평가 결과는 본인 메모.

- [ ] **Step 5: 멱등성 — 다시 실행**

```bash
python3 scripts/09_generate_mrt.py --email jacinto68@onlinecmk.com
```

```bash
docker compose exec pg psql -U mrms -d mrms -c '
  SELECT COUNT(*) FROM "PlaylistHistory"
  WHERE "userId" = (SELECT id FROM "User" WHERE email = $$jacinto68@onlinecmk.com$$);
'
```

Expected: 6 (3 × 2 generations — history 누적). UserEmbedding/UserPersona는 UPSERT라 행 수 동일.

- [ ] **Step 6: (선택) 추천 결과 별로면 follow-up 백로그**

만약 결과가 만족스럽지 않으면:
- K=5 시도: `--k 5`
- 다양성 규칙 (B.1로 분리)
- modelVersion 다른 값으로 A/B

이 경우 별도 issue/spec으로 후속 작업.

---

## Self-Review 결과

**Spec coverage**:
- ✅ Section 4 (Data Model) → Task 1
- ✅ Section 5 (Algorithm K-means + 집계 + 검색) → Task 3, 4
- ✅ Section 6 (CLI) → Task 5, 6
- ✅ Section 7 (Scheduling) → Task 7
- ✅ Section 8 (Error/Idempotency) → Task 5 (skip/rollback), Task 2 (UPSERT 룰)
- ✅ Section 9 (Testing) → Task 2, 3, 4 모두 TDD
- ✅ Section 10 (Out of Scope) — 의도적 제외
- ✅ Section 11 (파일 변경) → Task 0~7 정확한 경로
- ✅ Section 13 (구현 시 검증 필요) → Task 8

**남은 위험**:
- pgvector cosine 연산자 (`<=>`)와 L2 정규화 임베딩 호환성 (Task 8 첫 검증)
- 추천 결과 품질 — 알고리즘 자체. 결과 나쁘면 K나 다양성 규칙 follow-up.

**Placeholders**: 없음 (코드 완전)

**Type consistency**: 함수 시그니처 task 간 일관 (예: `cluster_user_tracks(embeddings, k, random_state)` Task 3 정의, Task 5에서 동일 호출)
