from __future__ import annotations

import pytest

from mrms.llm.situation import SituationInterpretation, SituationLLMError, build_preset, interpret_situation


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


# ---------------------------------------------------------------------------
# interpret_situation — fake client (no real network call)
# ---------------------------------------------------------------------------

class _FakeModels:
    def __init__(self, result):
        self._result = result  # SituationInterpretation-bearing resp, or Exception

    def generate_content(self, **kwargs):
        if isinstance(self._result, Exception):
            raise self._result
        return self._result


class _FakeResp:
    def __init__(self, parsed):
        self.parsed = parsed


class _FakeClient:
    def __init__(self, result):
        self.models = _FakeModels(result)


def test_interpret_situation_returns_parsed():
    interp = _interp(mood_label="rainy reading")
    client = _FakeClient(_FakeResp(interp))
    out = interpret_situation("비 오는 아침 독서", client=client)
    assert out.mood_label == "rainy reading"


def test_interpret_situation_none_parsed_raises():
    client = _FakeClient(_FakeResp(None))  # max_output_tokens 초과 등 → None
    with pytest.raises(SituationLLMError):
        interpret_situation("아무거나", client=client)


def test_interpret_situation_api_error_raises():
    client = _FakeClient(RuntimeError("boom"))
    with pytest.raises(SituationLLMError):
        interpret_situation("아무거나", client=client)
