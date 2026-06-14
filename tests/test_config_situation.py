from __future__ import annotations

from mrms.config import settings


def test_gemini_model_default():
    assert settings.gemini_model == "gemini-2.5-flash"


def test_gemini_api_key_field_exists():
    # 필드 존재만 확인 (.env 값 유무와 무관)
    assert hasattr(settings, "gemini_api_key")
