"""EMP (External Music Pool) importers."""
from __future__ import annotations

import psycopg

from mrms.emp.base import EMPImporter


def make_importer(platform: str, conn: psycopg.Connection) -> EMPImporter:
    """platform별 importer 생성. platform ∈ {'tidal', 'spotify', 'flo', 'melon', 'vibe'}.

    - tidal: token을 Setting에서 자동 로딩 (conn 필요)
    - spotify: open.spotify.com/embed 공개 위젯 스크래핑 — 토큰/인증 불필요
    - flo: 토큰 불필요 (공개 API)
    - melon: 토큰 불필요 (차트 페이지 HTML 스크래핑)
    - vibe: 토큰 불필요 (apis.naver.com/vibeWeb 공개 JSON)
    """
    if platform == "tidal":
        from mrms.emp.tidal import TidalEMPImporter
        return TidalEMPImporter(conn=conn)
    if platform == "spotify":
        from mrms.emp.spotify import SpotifyEMPImporter
        return SpotifyEMPImporter()
    if platform == "flo":
        from mrms.emp.flo import FloEMPImporter
        return FloEMPImporter()
    if platform == "melon":
        from mrms.emp.melon import MelonEMPImporter
        return MelonEMPImporter()
    if platform == "vibe":
        from mrms.emp.vibe import VibeEMPImporter
        return VibeEMPImporter()
    raise ValueError(f"unknown platform: {platform}")
