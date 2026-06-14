from __future__ import annotations

import uuid

import pytest

from mrms.db.user_track import get_or_create_user
from mrms.recsys.wellness import MOOD_PRESETS, recommend_wellness


def test_presets_have_four_moods():
    assert set(MOOD_PRESETS) == {"calm", "energize", "focus", "sleep"}


def test_presets_are_vet_tuples():
    # 각 무드는 (valence, energy, tempo) — 망가진 acousticness/instrumentalness 폐기
    for vet in MOOD_PRESETS.values():
        assert len(vet) == 3
        v, e, t = vet
        assert 0.0 <= v <= 1.0 and 0.0 <= e <= 1.0 and 40.0 <= t <= 200.0


def test_recommend_bad_mood_raises(db_conn):
    with pytest.raises(ValueError):
        recommend_wellness(db_conn, "dummy-user", "nope", n=5)


def test_recommend_no_taste_returns_empty(db_conn, cleanup):
    # 취향(UserTrack/UserEmbedding) 없는 유저 → 취향-우선 엔진은 빈 리스트
    uid = get_or_create_user(db_conn, f"well_{uuid.uuid4().hex[:8]}@t.local")
    cleanup('DELETE FROM "User" WHERE id = %s', (uid,))
    assert recommend_wellness(db_conn, uid, "calm", n=10) == []
