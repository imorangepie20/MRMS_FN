"""훅 클립 오프셋 순수 로직 검증 (download_and_clip은 네트워크 의존이라 e2e에서)."""
from __future__ import annotations

from mrms.ingest.youtube_audio import clip_offset_seconds


def test_offset_skips_intro_for_long_track():
    # 200초 트랙, ratio 0.30 → 60초 지점부터
    assert clip_offset_seconds(200.0, ratio=0.30, clip_seconds=30.0) == 60.0


def test_offset_zero_for_short_track():
    # 35초 트랙: 오프셋 적용 시 끝을 넘으므로 0부터
    assert clip_offset_seconds(35.0, ratio=0.30, clip_seconds=30.0) == 0.0


def test_offset_zero_when_duration_unknown():
    assert clip_offset_seconds(None, ratio=0.30, clip_seconds=30.0) == 0.0
