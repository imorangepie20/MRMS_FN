"""아티스트 소개 텍스트 생성 — Gemini 자유텍스트(스키마 없음). best-effort."""
from __future__ import annotations

import logging

from google import genai
from google.genai import types

from mrms.config import settings

log = logging.getLogger(__name__)

_ARTIST_BIO_PROMPT = (
    "너는 음악 칼럼니스트다. 주어진 아티스트를 한국어로 2-3문장 소개한다. "
    "장르·활동·대표적 특징 중심으로 간결하게. 모르면 장르 기반으로 일반적이되 사실만. "
    "과장·허구·확인 안 된 디테일 금지. 인삿말/메타설명 없이 소개 본문만."
)


def _client() -> genai.Client:
    return genai.Client(api_key=settings.gemini_api_key)


def gemini_artist_bio(
    name: str, genres: list[str], *, client: genai.Client | None = None
) -> str | None:
    """아티스트명+장르 → 2-3문장 소개. 키 없음/실패 → None(호출부 삼킴)."""
    if client is None and not settings.gemini_api_key:
        return None
    client = client or _client()
    prompt = (
        f"아티스트: {name}\n"
        f"장르: {', '.join(genres) or '미상'}\n"
        "이 아티스트를 2-3문장으로 소개해줘."
    )
    try:
        resp = client.models.generate_content(
            model=settings.gemini_model,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=_ARTIST_BIO_PROMPT,
                max_output_tokens=512,
                thinking_config=types.ThinkingConfig(thinking_budget=0),
            ),
        )
    except Exception as e:  # noqa: BLE001 — best-effort
        log.warning("artist bio gemini failed for %s: %r", name, e)
        return None
    txt = (resp.text or "").strip()
    return txt or None
