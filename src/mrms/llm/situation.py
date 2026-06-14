"""상황 자유텍스트 → Gemini 해석 → wellness preset. 웰니스 프레이밍(치료 표방 금지)."""
from __future__ import annotations

from pydantic import BaseModel, Field


class SituationInterpretation(BaseModel):
    """Gemini 구조화 출력 스키마 — 피처 중심점 + 축별 가중치 + 한 줄 해석."""

    interpretation: str = Field(description="상황에 대한 한국어 한 줄 해석(사용자에게 보여줌)")
    mood_label: str = Field(description="짧은 무드 라벨 (예: '차분한 일요일 아침')")
    valence: float = Field(description="정서 밝기/긍정 0~1")
    energy: float = Field(description="에너지/강도 0~1")
    tempo_bpm: float = Field(description="템포 BPM (느림 60~80, 보통 90~120, 빠름 130~160)")
    acousticness: float = Field(description="어쿠스틱성 0~1")
    instrumentalness: float = Field(description="기악성(보컬 적음) 0~1")
    valence_weight: float = Field(description="이 상황에서 valence 중요도 0~1 (0=무시)")
    energy_weight: float = Field(description="energy 중요도 0~1")
    tempo_weight: float = Field(description="tempo 중요도 0~1")
    acousticness_weight: float = Field(description="acousticness 중요도 0~1")
    instrumentalness_weight: float = Field(description="instrumentalness 중요도 0~1")


class SituationLLMError(RuntimeError):
    """Gemini 호출/파싱 실패 — API에서 502로 매핑."""


# 축별 가우시안 폭(σ) — wellness MOOD_PRESETS 상수 재사용. LLM은 σ를 만지지 않는다.
_DEFAULT_SIGMA: dict[str, float] = {
    "valence": 0.18, "energy": 0.18, "tempo": 28.0,
    "acousticness": 0.25, "instrumentalness": 0.30,
}

_SITUATION_PROMPT = (
    "너는 음악 무드 해석기다. 사용자가 적은 '상황'을 읽고, 그 장면에 어울리는 음악을 "
    "valence(정서 밝기 0~1), energy(강도 0~1), tempo(BPM), acousticness(어쿠스틱성 0~1), "
    "instrumentalness(기악성 0~1)의 중심값과, 각 축이 이 상황에서 얼마나 중요한지(weight 0~1)로 매핑한다.\n"
    "규칙:\n"
    "- 기본은 '보컬 위주'. 대부분의 일상·사회·활동 상황은 instrumentalness 중심을 낮게(0.10~0.20) "
    "두되 weight는 유의미하게(보컬 곡이 나오도록). acousticness를 습관적으로 높이지 말 것('조용함'≠'어쿠스틱').\n"
    "- 명백히 기악/배경/집중·공부/수면/명상 상황일 때만 instrumentalness·acousticness의 center·weight를 올린다.\n"
    "- 상황과 무관한 축은 weight를 낮게/0으로 둔다.\n"
    "- interpretation은 한국어 한 줄, 따뜻하지만 과장 없이. 효능·치료(therapy)를 주장하지 말 것(웰니스/정서 조절만).\n"
    "- 음악과 무관하거나 유해·부적절한 입력은 모든 center를 0.5(tempo는 110)·weight를 균등하게 두고, "
    "그 사실을 interpretation에 자연스럽게 반영한다."
)


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, float(v)))


def build_preset(interp: SituationInterpretation) -> dict[str, tuple[float, float, float]]:
    """LLM 해석 → {축: (center, sigma, weight)}. center/weight 클램프, 전부-0 weight면 균등 폴백."""
    centers = {
        "valence": _clamp(interp.valence, 0.0, 1.0),
        "energy": _clamp(interp.energy, 0.0, 1.0),
        "tempo": _clamp(interp.tempo_bpm, 40.0, 200.0),
        "acousticness": _clamp(interp.acousticness, 0.0, 1.0),
        "instrumentalness": _clamp(interp.instrumentalness, 0.0, 1.0),
    }
    weights = {
        "valence": _clamp(interp.valence_weight, 0.0, 1.0),
        "energy": _clamp(interp.energy_weight, 0.0, 1.0),
        "tempo": _clamp(interp.tempo_weight, 0.0, 1.0),
        "acousticness": _clamp(interp.acousticness_weight, 0.0, 1.0),
        "instrumentalness": _clamp(interp.instrumentalness_weight, 0.0, 1.0),
    }
    if sum(weights.values()) == 0.0:
        weights = {k: 1.0 for k in weights}
    return {ax: (centers[ax], _DEFAULT_SIGMA[ax], weights[ax]) for ax in centers}
