from __future__ import annotations

import math

from mrms.recsys.wellness import MOOD_PRESETS, mood_fit


def test_presets_have_four_moods():
    assert set(MOOD_PRESETS) == {"calm", "energize", "focus", "sleep"}


def test_mood_fit_peaks_at_center():
    feats = {"valence": 0.40, "energy": 0.25, "tempo": 85.0,
             "acousticness": 0.70, "instrumentalness": 0.0}
    assert abs(mood_fit(feats, MOOD_PRESETS["calm"]) - 1.0) < 1e-9


def test_mood_fit_monotonic_decrease():
    center = {"valence": 0.40, "energy": 0.25, "tempo": 85.0,
              "acousticness": 0.70, "instrumentalness": 0.0}
    near = {**center, "energy": 0.35}
    far = {**center, "energy": 0.65}
    p = MOOD_PRESETS["calm"]
    assert mood_fit(center, p) > mood_fit(near, p) > mood_fit(far, p)
    assert 0.0 < mood_fit(far, p) <= 1.0


def test_mood_fit_ignores_zero_weight_axis():
    p = MOOD_PRESETS["energize"]
    base = {"valence": 0.78, "energy": 0.80, "tempo": 135.0,
            "acousticness": 0.5, "instrumentalness": 0.0}
    other = {**base, "instrumentalness": 1.0}
    assert mood_fit(base, p) == mood_fit(other, p)
