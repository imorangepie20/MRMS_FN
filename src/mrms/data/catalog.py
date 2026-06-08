"""EMS 카탈로그 CSV 로더 + 컬럼 스키마.

원본: data/csv/ems_collected_track.csv
- 36 컬럼, 헤더 없음
- Spotify/Tidal/FLO/Melon 통합
- 일부 행에 Spotify audio features 포함 (Reccobeats ISRC 매칭)
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd

CATALOG_COLUMNS = [
    # 식별 + 기본 메타 (0-11)
    "row_id",
    "platform_track_id",
    "title",
    "artists",
    "source",  # 'spotify' | 'tidal' | 'flo' | 'melon'
    "album",
    "image_url",
    "open_url",
    "platform_uri",
    "preview_url",
    "duration_ms_a",
    "pool",
    # 수집 + 매칭 (12-18)
    "collected_at",
    "matched_spotify_id",
    "match_method",  # 'open_spotify_page' | 'reccobeats_isrc_match' | ...
    "has_match",
    "c16_unused",
    "matched_spotify_url",
    "matched_spotify_uri",
    # 오디오 features (19-32)
    "feature_type",
    "duration_ms_b",
    "key",  # 0~11
    "mode",  # 0(minor) | 1(major)
    "time_signature",  # 3~7
    "danceability",
    "energy",
    "valence",
    "instrumentalness",
    "liveness",
    "loudness",  # dB
    "speechiness",
    "tempo",  # BPM
    "acousticness",
    # 시간 + ISRC (33-35)
    "features_at",
    "isrc",
    "c35_unused",
]

# Spotify-12 audio features
FEATURE_COLUMNS = [
    "danceability",
    "energy",
    "valence",
    "acousticness",
    "instrumentalness",
    "liveness",
    "loudness",
    "speechiness",
    "tempo",
    "key",
    "mode",
    "time_signature",
]


def load_catalog(path: Path) -> pd.DataFrame:
    """헤더 없는 36-col CSV를 로드. Parquet이면 그대로."""
    path = Path(path)
    if path.suffix == ".parquet":
        return pd.read_parquet(path)
    return pd.read_csv(path, names=CATALOG_COLUMNS, low_memory=False)


def has_features(df: pd.DataFrame) -> pd.Series:
    """학습용 라벨이 채워진 행 boolean mask."""
    return df["energy"].notna()


def derive_track_key(row) -> str:
    """파일명/DB키용 정규 키.

    ISRC가 있으면 ISRC 사용 (글로벌 식별자),
    없으면 '{platform}_{platform_track_id}'.
    """
    if pd.notna(row.isrc) and row.isrc:
        return str(row.isrc)
    return f"{row.source}_{row.platform_track_id}"
