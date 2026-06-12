"""YouTube videoId → 훅 30초 오디오 클립 (yt-dlp + ffmpeg).

카탈로그 임베딩이 플랫폼 프리뷰(훅)에서 나왔으므로, 풀트랙 앞(인트로)이 아니라
길이의 offset_ratio 지점부터 clip_seconds 만큼 추출해 분포를 맞춘다.
"""
from __future__ import annotations

import subprocess
from pathlib import Path


def clip_offset_seconds(
    duration: float | None, *, ratio: float, clip_seconds: float
) -> float:
    """클립 시작 오프셋(초). 오프셋+클립이 트랙 끝을 넘거나 길이 미상이면 0."""
    if not duration or duration <= 0:
        return 0.0
    offset = duration * ratio
    if offset + clip_seconds > duration:
        return 0.0
    return offset


def _stream_url_and_duration(video_id: str) -> tuple[str, float | None]:
    """yt-dlp로 bestaudio 스트림 URL + duration 확보 (다운로드 X)."""
    import yt_dlp

    url = f"https://www.youtube.com/watch?v={video_id}"
    with yt_dlp.YoutubeDL(
        {"quiet": True, "no_warnings": True, "format": "bestaudio", "skip_download": True}
    ) as ydl:
        info = ydl.extract_info(url, download=False)
    audio = [
        f for f in info.get("formats", [])
        if f.get("acodec") not in (None, "none") and f.get("vcodec") == "none"
    ]
    if not audio:
        raise RuntimeError(f"no audio stream for {video_id}")
    return audio[-1]["url"], info.get("duration")


def download_and_clip(
    video_id: str,
    dest: Path,
    *,
    offset_ratio: float,
    clip_seconds: float = 30.0,
) -> None:
    """videoId → 훅 클립을 dest(.m4a)로 저장. 실패 시 예외."""
    stream_url, duration = _stream_url_and_duration(video_id)
    offset = clip_offset_seconds(duration, ratio=offset_ratio, clip_seconds=clip_seconds)
    dest.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "ffmpeg", "-y", "-loglevel", "error",
        "-ss", str(offset), "-i", stream_url,
        "-t", str(clip_seconds), "-vn", "-acodec", "aac", "-b:a", "128k",
        str(dest),
    ]
    subprocess.run(cmd, check=True, capture_output=True, timeout=120)
    if not dest.exists() or dest.stat().st_size < 5_000:
        raise RuntimeError(f"clip too small/missing for {video_id}")
