"""상황 자유텍스트 → Gemini 해석 → 무드(valence/energy/tempo). 웰니스 프레이밍(치료 표방 금지).

장르·악기는 취향-우선 엔진(recommend_by_taste_mood)이 담당하므로, LLM은 '무드 방향'만 산출한다.
"""
from __future__ import annotations

from google import genai
from google.genai import types
from pydantic import BaseModel, Field

from mrms.config import settings


class SituationInterpretation(BaseModel):
    """Gemini 구조화 출력 — 무드 방향(valence/energy/tempo) + 한 줄 해석."""

    interpretation: str = Field(description="상황에 대한 한국어 한 줄 해석(사용자에게 보여줌)")
    mood_label: str = Field(description="짧은 무드 라벨 (예: '차분한 일요일 아침')")
    valence: float = Field(description="정서 밝기 0~1 (어두움/슬픔 0 ~ 밝음/행복 1)")
    energy: float = Field(description="에너지/강도 0~1 (잔잔함 0 ~ 격렬함 1)")
    tempo_bpm: float = Field(description="템포 BPM (느림 60~80, 보통 90~120, 빠름 130~160)")


class SituationLLMError(RuntimeError):
    """Gemini 호출/파싱 실패 — API에서 502로 매핑."""


_SITUATION_PROMPT = (
    "너는 음악 무드 해석기다. 사용자가 적은 '상황'을 읽고, 그 장면에 어울리는 음악의 분위기를 "
    "valence(정서 밝기 0~1), energy(강도 0~1: 잔잔함 0 ~ 격렬함 1), "
    "tempo(BPM: 느림 60~80, 보통 90~120, 빠름 130~160)로 추정한다.\n"
    "- 장르나 악기는 신경 쓰지 마라(그건 사용자 취향이 정한다). 오직 분위기(valence/energy/tempo)만.\n"
    "- interpretation은 한국어 한 줄, 따뜻하지만 과장 없이. 효능·치료(therapy)를 주장하지 말 것(웰니스/정서 조절만).\n"
    "- mood_label은 짧게.\n"
    "- 음악과 무관하거나 유해·부적절한 입력은 중립(valence 0.5, energy 0.5, tempo 110)으로 두고, "
    "그 사실을 interpretation에 자연스럽게 반영한다."
)


def _client() -> genai.Client:
    return genai.Client(api_key=settings.gemini_api_key)


def interpret_situation(
    text: str, *, client: genai.Client | None = None
) -> SituationInterpretation:
    """상황 텍스트 → Gemini 구조화 출력 → SituationInterpretation. 실패 시 SituationLLMError."""
    client = client or _client()
    try:
        resp = client.models.generate_content(
            model=settings.gemini_model,
            contents=text,
            config=types.GenerateContentConfig(
                system_instruction=_SITUATION_PROMPT,
                response_mime_type="application/json",
                response_schema=SituationInterpretation,
                max_output_tokens=2048,
                # 2.5-flash 기본 thinking 비활성 — 구조화 출력 None 위험 회피 + 지연 단축
                thinking_config=types.ThinkingConfig(thinking_budget=0),
            ),
        )
    except Exception as e:  # 어떤 SDK/네트워크 오류든 SituationLLMError로 → API 502
        raise SituationLLMError(str(e)) from e
    parsed = resp.parsed
    if parsed is None:
        raise SituationLLMError("LLM이 유효한 해석을 반환하지 않음")
    return parsed
