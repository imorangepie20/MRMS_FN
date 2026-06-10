"""EMP (External Music Pool) importers."""
from __future__ import annotations

import os

import psycopg

from mrms.emp.base import EMPImporter


def make_importer(platform: str, conn: psycopg.Connection) -> EMPImporter:
    """platform별 importer 생성. platform ∈ {'tidal', 'spotify'}.

    - tidal: token을 Setting에서 자동 로딩 (conn 필요)
    - spotify: SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET env 사용
    """
    if platform == "tidal":
        from mrms.emp.tidal import TidalEMPImporter
        return TidalEMPImporter(conn=conn)
    if platform == "spotify":
        from mrms.emp.spotify import SpotifyEMPImporter
        return SpotifyEMPImporter(
            client_id=os.environ["SPOTIFY_CLIENT_ID"],
            client_secret=os.environ["SPOTIFY_CLIENT_SECRET"],
        )
    raise ValueError(f"unknown platform: {platform}")
