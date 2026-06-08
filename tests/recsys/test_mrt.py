"""MRT 페르소나 검색 + derive 테스트."""
import numpy as np
import pytest

from mrms.db.user_track import get_or_create_user, upsert_user_track
from mrms.recsys.mrt import (
    search_for_persona,
    derive_recommended_tracks,
    derive_recommended_albums,
)


def test_search_for_persona_returns_results(db_conn):
    """실제 카탈로그에 대해 random unit vector로 검색 → top-N 트랙 반환."""
    user_id = get_or_create_user(db_conn, email="mrt_a@example.com")
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
    with db_conn.cursor() as cur:
        cur.execute(
            'SELECT embedding FROM "TrackEmbedding" WHERE "trackId" = %s LIMIT 1',
            (excluded_track_id,),
        )
        row = cur.fetchone()
    if row is None:
        pytest.skip("TrackEmbedding 미존재")
    # row[0]은 string '[0.1, 0.2, ...]' 또는 array (register_vector 호출 상태에 따라)
    centroid_raw = row[0]
    if isinstance(centroid_raw, str):
        # parse "[x,y,z]"
        centroid = np.fromstring(centroid_raw.strip("[]"), sep=",", dtype=np.float32)
    else:
        centroid = np.asarray(centroid_raw, dtype=np.float32)
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
            "trackIds": ["t2", "t4"],
            "scores": [0.95, 0.6],
        },
        {
            "context": {"personaIdx": 2},
            "trackIds": ["t5"],
            "scores": [0.85],
        },
    ]
    results = derive_recommended_tracks(playlists, top_n=10)
    by_id = {r["track_id"]: r for r in results}
    assert by_id["t2"]["score"] == 0.95
    assert by_id["t1"]["score"] == 0.9
    assert set(by_id.keys()) == {"t1", "t2", "t3", "t4", "t5"}
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
    assert result[0]["album_id"] == "album_a"
    assert result[0]["track_count"] == 3
    assert result[1]["album_id"] == "album_b"
    assert result[1]["track_count"] == 1
