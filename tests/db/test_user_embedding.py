"""UserEmbedding / UserPersona / PlaylistHistory DB ops 테스트.

전제: PG에 V1 + A1 적재 완료된 상태.
각 테스트는 트랜잭션 롤백.
"""
import numpy as np

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
    track_ids = ["c000000000000000000000001", "c000000000000000000000002"]
    row_id = insert_playlist_history(
        db_conn, user_id, track_ids, "test-v1",
        context={"personaIdx": 0, "kind": "persona"},
    )
    assert row_id.startswith("c") or len(row_id) > 0


def test_fetch_latest_playlists_returns_latest_3(db_conn):
    user_id = get_or_create_user(db_conn, email="ph_b@example.com")
    # 첫 generation: 3행
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
