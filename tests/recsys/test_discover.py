"""EMP-밖 discovery — blend/seed/read/gemini/resolve/generate."""
from __future__ import annotations

from mrms.recsys.discover import blend_recsys


def test_blend_interleaves_taste_and_discovery_5050():
    out = blend_recsys(["t1", "t2", "t3"], ["d1", "d2", "d3"], 6)
    assert out == ["t1", "d1", "t2", "d2", "t3", "d3"]


def test_blend_dedups_by_track_id_keeping_first():
    out = blend_recsys(["t1", "t2"], ["t1", "d1"], 4)
    # t1 from taste first; discovery t1 skipped as dup
    assert out == ["t1", "d1", "t2"]


def test_blend_drains_remaining_when_one_side_short():
    out = blend_recsys(["t1", "t2", "t3"], ["d1"], 10)
    assert out == ["t1", "d1", "t2", "t3"]


def test_blend_empty_discovery_returns_taste_only_capped():
    assert blend_recsys(["t1", "t2", "t3"], [], 2) == ["t1", "t2"]


def test_blend_empty_taste_returns_discovery_only():
    assert blend_recsys([], ["d1", "d2"], 5) == ["d1", "d2"]
