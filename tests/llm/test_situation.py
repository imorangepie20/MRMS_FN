from __future__ import annotations

import pytest

from mrms.llm.situation import SituationInterpretation, SituationLLMError, interpret_situation


def _interp(**over) -> SituationInterpretation:
    base = dict(
        interpretation="차분한 아침", mood_label="calm morning",
        valence=0.5, energy=0.4, tempo_bpm=100.0,
    )
    base.update(over)
    return SituationInterpretation(**base)


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
    assert out.valence == 0.5 and out.tempo_bpm == 100.0


def test_interpret_situation_none_parsed_raises():
    client = _FakeClient(_FakeResp(None))  # max_output_tokens 초과 등 → None
    with pytest.raises(SituationLLMError):
        interpret_situation("아무거나", client=client)


def test_interpret_situation_api_error_raises():
    client = _FakeClient(RuntimeError("boom"))
    with pytest.raises(SituationLLMError):
        interpret_situation("아무거나", client=client)
