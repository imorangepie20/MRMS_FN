from __future__ import annotations

from mrms.llm.situation import SituationInterpretation, build_preset


def _interp(**over) -> SituationInterpretation:
    base = dict(
        interpretation="차분한 아침", mood_label="calm morning",
        valence=0.5, energy=0.4, tempo_bpm=100.0, acousticness=0.5, instrumentalness=0.2,
        valence_weight=1.0, energy_weight=1.0, tempo_weight=0.5,
        acousticness_weight=0.5, instrumentalness_weight=1.0,
    )
    base.update(over)
    return SituationInterpretation(**base)


def test_build_preset_shape_and_sigma():
    p = build_preset(_interp())
    assert set(p) == {"valence", "energy", "tempo", "acousticness", "instrumentalness"}
    # 각 축은 (center, sigma, weight); tempo center는 BPM
    assert p["tempo"][0] == 100.0
    assert p["tempo"][1] == 28.0  # _DEFAULT_SIGMA["tempo"]
    assert p["valence"][1] == 0.18


def test_build_preset_clamps_out_of_range():
    p = build_preset(_interp(valence=1.7, energy=-0.3, tempo_bpm=9999.0,
                             instrumentalness_weight=5.0))
    assert p["valence"][0] == 1.0
    assert p["energy"][0] == 0.0
    assert p["tempo"][0] == 200.0           # tempo는 [40,200]
    assert p["instrumentalness"][2] == 1.0  # weight clamp


def test_build_preset_all_zero_weight_falls_back_to_uniform():
    p = build_preset(_interp(valence_weight=0, energy_weight=0, tempo_weight=0,
                             acousticness_weight=0, instrumentalness_weight=0))
    assert all(p[ax][2] == 1.0 for ax in p)
