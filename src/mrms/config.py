"""환경변수 기반 통합 설정."""

from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


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


# Singleton
settings = Settings()
