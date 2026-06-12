"""설정값 검증."""
from __future__ import annotations


def test_youtube_clip_offset_ratio_default():
    from mrms.config import settings

    assert 0.0 <= settings.youtube_clip_offset_ratio < 1.0
    assert settings.youtube_clip_offset_ratio == 0.30
