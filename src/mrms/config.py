"""환경변수 기반 통합 설정."""

from __future__ import annotations

import os
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _expand_env_refs(value: str) -> str:
    """${VAR} 참조 재귀 확장.

    systemd EnvironmentFile은 변수 참조를 확장하지 않고 literal 전달
    (bash source/dotenv와 다름) — AUDIO_DIR=${DATA_ROOT}/audio 가 문자
    그대로 들어와 '${DATA_ROOT}' 디렉토리를 만들려다 죽는 사고 방지.
    DATA_ROOT 자체가 ${PROJECT_ROOT} 참조라 고정점까지 반복."""
    for _ in range(10):
        expanded = os.path.expandvars(value)
        if expanded == value:
            return expanded
        value = expanded
    return value

# ─── 카탈로그 임베딩 모델 버전 (TrackEmbedding.modelVersion 값) ────
# 버전 범프 시 여기 한 곳만 수정. 파생 버전(예: '+persona-K3')은
# f"{EMBEDDING_MODEL_VERSION}+..." 형태로 유도해 단일 출처 유지.
EMBEDDING_MODEL_VERSION = "our-v1.0"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ─── API credentials ─────────────────────────────
    spotify_client_id: str = ""
    spotify_client_secret: str = ""
    spotify_redirect_uri: str = ""
    spotify_scopes: str = ""

    tidal_client_id: str = ""
    tidal_client_secret: str = ""
    tidal_redirect_uri: str = ""
    tidal_scopes: str = ""

    # ─── OAuth callback server ───────────────────────
    oauth_callback_host: str = "127.0.0.1"
    oauth_callback_port: int = 8080
    oauth_public_host: str = "mrms.approid.team"

    # ─── DB ──────────────────────────────────────────
    database_url: str = "postgresql://mrms:mrms@localhost:5432/mrms"

    # ─── Paths ───────────────────────────────────────
    project_root: Path = Path.cwd()
    data_root: Path = Path("data")
    audio_dir: Path = Path("data/audio")
    mel_dir: Path = Path("data/mel")
    embed_dir: Path = Path("data/embeddings")
    checkpoint_dir: Path = Path("checkpoints")
    log_dir: Path = Path("logs")

    @field_validator(
        "project_root",
        "data_root",
        "audio_dir",
        "mel_dir",
        "embed_dir",
        "checkpoint_dir",
        "log_dir",
        "tracks_110k_path",
        "tracks_90k_path",
        mode="before",
    )
    @classmethod
    def _expand_path_env_refs(cls, v: object) -> object:
        if isinstance(v, str):
            return _expand_env_refs(v)
        return v

    # ─── Model ───────────────────────────────────────
    encoder_model_id: str = "m-a-p/MERT-v1-95M"
    model_version: str = "mert-v1.0"
    encoder_device: str = "mps"
    encoder_precision: str = "fp16"
    embedding_dim: int = 256
    batch_size: int = 8
    sample_rate: int = 22050
    chunk_duration: int = 30

    # ─── Data ────────────────────────────────────────
    tracks_110k_path: str = ""
    tracks_90k_path: str = ""

    # ─── Download ────────────────────────────────────
    download_concurrency: int = 15
    download_preview_seconds: int = 30
    download_format: str = "m4a"

    # YouTube 풀트랙에서 훅 근처 30초를 뽑기 위한 오프셋 비율 (앞=인트로 회피).
    # 카탈로그 임베딩이 플랫폼 프리뷰(훅)에서 나왔으므로 분포를 맞춘다.
    youtube_clip_offset_ratio: float = 0.30


# Singleton
settings = Settings()
