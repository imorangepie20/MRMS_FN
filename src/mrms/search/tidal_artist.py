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
# 공백/탭만 접고(줄바꿈은 보존), 빈 줄 연속은 한 줄로 정규화 — 프론트의
# whitespace-pre-line이 \n을 문단 구분으로 렌더하므로 문단 구조를 유지한다.
_HSPACE_RE = re.compile(r"[ \t]+")
_BLANKLINES_RE = re.compile(r"\n[ \t]*\n[ \t\n]*")


def _strip_tidal_markup(text: str) -> str:
    """Tidal 인라인 마크업 태그 제거(내부 텍스트 보존). 공백/탭은 접되 문단
    구분 줄바꿈은 보존(프론트 whitespace-pre-line 의도와 일치)."""
    out = _OPEN_TAG_RE.sub("", text)
    out = _CLOSE_TAG_RE.sub("", out)
    out = _HSPACE_RE.sub(" ", out)
    out = _BLANKLINES_RE.sub("\n\n", out)
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
        # bio/이미지는 고신뢰 필드라 캐시·노출됨 — limit=1 검색의 첫 결과를
        # 맹신하면 풀에 정확 일치가 없는 아티스트에 다른 아티스트의 전기/이미지가
        # 붙는다. Spotify와 동일하게 정규화 이름이 일치할 때만 채택.
        if (artist.get("name") or "").strip().lower() != name.strip().lower():
            log.info("tidal artist mismatch: query=%r matched=%r",
                     name, artist.get("name"))
            return None, None
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
