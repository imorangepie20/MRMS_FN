"""Tidal 아티스트 조회 — app 토큰으로 이미지/에디토리얼 bio. best-effort.

유저 인증 불필요(app client_credentials 토큰만). 검색→첫 아티스트의 picture(UUID)로
이미지 URL을, /bio로 에디토리얼 전기(text)를 얻는다. text엔 Tidal 마크업
([wimpLink ...] 등)이 섞여 있어 _strip_tidal_markup으로 정리한다.
"""
from __future__ import annotations

import logging
import re

import httpx

from mrms.search.app_token import get_app_token

log = logging.getLogger(__name__)

TIDAL_SEARCH_URL = "https://api.tidal.com/v1/search"
TIDAL_ARTIST_URL = "https://api.tidal.com/v1/artists"

# 알려진 Tidal 인라인 마크업 태그만 타겟 — 일반 대괄호 텍스트는 보존.
_KNOWN_TAGS = ("wimpLink", "album", "track", "video")
# 여는 태그(속성 포함 가능): [wimpLink artistId="4288"] / [album albumId="1"] ...
_OPEN_TAG_RE = re.compile(
    r"\[(?:" + "|".join(_KNOWN_TAGS) + r")(?:\s[^\]]*)?\]",
    re.IGNORECASE,
)
# 닫는 태그: [/wimpLink] / [/album] ...
_CLOSE_TAG_RE = re.compile(
    r"\[/(?:" + "|".join(_KNOWN_TAGS) + r")\]",
    re.IGNORECASE,
)
_WS_RE = re.compile(r"\s+")


def _strip_tidal_markup(text: str) -> str:
    """Tidal 인라인 마크업 태그 제거(내부 텍스트 보존), 연속 공백 정리."""
    out = _OPEN_TAG_RE.sub("", text)
    out = _CLOSE_TAG_RE.sub("", out)
    out = _WS_RE.sub(" ", out)
    return out.strip()


def _tidal_artist_image(picture: str | None) -> str | None:
    """picture UUID → 750x750 아티스트 이미지 URL. 없으면 None."""
    if not picture:
        return None
    path = str(picture).replace("-", "/")
    return f"https://resources.tidal.com/images/{path}/750x750.jpg"


async def fetch_tidal_artist(
    http: httpx.AsyncClient, name: str
) -> tuple[str | None, str | None]:
    """이름으로 Tidal 아티스트 검색 → (image_url, bio_full). 각 단계 best-effort."""
    image_url: str | None = None
    bio_full: str | None = None
    try:
        tok = await get_app_token(http, "tidal")
        headers = {"Authorization": f"Bearer {tok}"}
        r = await http.get(
            TIDAL_SEARCH_URL,
            params={
                "query": name, "types": "ARTISTS",
                "limit": 1, "countryCode": "KR",
            },
            headers=headers,
        )
        if r.status_code != 200:
            log.warning("tidal artist search %s: %s", name, r.status_code)
            return None, None
        items = ((r.json().get("artists") or {}).get("items")) or []
        if not items:
            return None, None
        artist = items[0]
        artist_id = artist.get("id")
        image_url = _tidal_artist_image(artist.get("picture"))
    except Exception as e:  # noqa: BLE001 — best-effort
        log.warning("tidal artist search failed for %s: %r", name, e)
        return None, None

    try:
        rb = await http.get(
            f"{TIDAL_ARTIST_URL}/{artist_id}/bio",
            params={"countryCode": "KR"},
            headers=headers,
        )
        if rb.status_code == 200:
            text = (rb.json().get("text") or "").strip()
            if text:
                bio_full = _strip_tidal_markup(text) or None
    except Exception as e:  # noqa: BLE001 — best-effort
        log.warning("tidal artist bio failed for %s: %r", name, e)

    return image_url, bio_full
