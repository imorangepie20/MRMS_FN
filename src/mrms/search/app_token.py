"""플랫폼 앱 토큰(client_credentials) — 공개 카탈로그 조회용. 사용자 인증 불필요.

카탈로그 조회(트랙/앨범/플레이리스트 메타)는 사용자 연동과 무관하다(재생만 연동 필요).
Tidal은 앱 토큰으로 전부 조회 가능. Spotify는 track/album은 되나 playlist는 403(dev-mode)
이라, 호출부가 앱 토큰 실패 시 사용자 토큰으로 폴백한다.
"""
from __future__ import annotations

import base64

import httpx

from mrms.config import settings

_TOKEN_URL = {
    "spotify": "https://accounts.spotify.com/api/token",
    "tidal": "https://auth.tidal.com/v1/oauth2/token",
}


async def get_app_token(http: httpx.AsyncClient, platform: str) -> str:
    """client_credentials 앱 토큰. 실패 시 예외(raise_for_status)."""
    if platform == "spotify":
        cid, csec = settings.spotify_client_id, settings.spotify_client_secret
    else:
        cid, csec = settings.tidal_client_id, settings.tidal_client_secret
    auth = base64.b64encode(f"{cid}:{csec}".encode()).decode()
    r = await http.post(
        _TOKEN_URL[platform],
        headers={
            "Authorization": f"Basic {auth}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        data={"grant_type": "client_credentials"},
    )
    r.raise_for_status()
    return r.json()["access_token"]
