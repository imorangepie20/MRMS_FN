"""클래식 공연 실황 — YouTube Data API v3에서 공식 오케스트라/레이블 채널의
풀콘서트(long·임베드 허용) 영상을 모아 EMPSection('video:classical-live')으로 저장.

Tidal 영상 페이지엔 클래식 음악 공연 실황이 없어(2~13분 악장 클립뿐), YouTube가
유일하게 풀콘서트·리사이틀을 풍부하게 제공하고 앱이 이미 YouTube 재생을 지원한다.

- 섹션은 platform='youtube'로 저장 → Tidal importer의 video:% stale-prune
  (platform='tidal' 한정)이 건드리지 않는다. /api/videos/sections(only_video)에는
  플랫폼 무관 video:% 가 모두 포함돼 같이 노출된다.
- item_type='youtube_video' → 프론트가 YT IFrame 임베드로 풀스크린 재생(HLS 아님).
"""
from __future__ import annotations

import html
import os

import httpx
import psycopg

from mrms.db.emp_section import prune_stale_items, upsert_section, upsert_section_item

YT_DATA_API_KEY_ENV = "YOUTUBE_DATA_API_KEY"
YT_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search"
CLASSICAL_LIVE_SECTION = "video:classical-live"
CLASSICAL_LIVE_TITLE = "클래식 공연 실황"

# 공식 오케스트라/레이블 채널 — long(>20분)+임베드 허용 풀콘서트 업로드 검증됨(2026-06 실측).
# (channelId, 표시용 이름). Warner는 검색이 Warner Bros 만화 채널을 집어 제외.
CLASSICAL_CHANNELS: list[tuple[str, str]] = [
    ("UCtRkmSO4PrhJ4TzNOmFIwjw", "Berliner Philharmoniker"),
    ("UC_kqgIRwOD3XCZXXr4B6bPQ", "DW Classical Music"),
    ("UCY1yTIi-DaxPbNtLCnwAM1g", "London Symphony Orchestra"),
    ("UCl2Sa1BW9yF55yjqwSLro6Q", "Chicago Symphony Orchestra"),
    ("UCiyuYC0D4-AO0AonCfMifPQ", "hr-Sinfonieorchester"),
    ("UC7-ehvwuMEWYvBhLeqTh5Fg", "Wiener Symphoniker"),
    ("UCUqNn2bpiOC6JPhMcf6wRYw", "KBS교향악단"),
    ("UCPDXjHIRZsuW2RTr_g2rdVg", "LG필하모닉"),
]

JAZZ_LIVE_SECTION = "video:jazz-live"
JAZZ_LIVE_TITLE = "재즈 공연 실황"

# 공식 재즈 페스티벌·라디오 빅밴드 채널 — long(>20분)+임베드 허용 풀콘서트 검증됨(2026-06 실측).
JAZZ_CHANNELS: list[tuple[str, str]] = [
    ("UCHH_fkg_q8fu-AdEzIczzYQ", "North Sea Jazz Archive"),
    ("UCC87jVPU5DV_ccBcWs5smcQ", "Jazz In Marciac"),
    ("UCulDi5lPqT4Wa49gZhNgKdg", "WDR Big Band"),
    ("UC4LDP8Ee097zy6WOMuxI6Ag", "hr-Bigband"),
    ("UCiqZVYisk1zpBC4bxQBofeQ", "SWR Big Band"),
    ("UClUghHElK6LMJrK1_xCWOPA", "Montreux Jazz Festival"),
    ("UC0CnISy9tA2T3DDH3mjQaug", "Jazz à Vienne"),
    ("UC8-Hs7utuv_5qyTZW3JJnoA", "Jazzaldia"),
]


def _yt_thumbnail(snippet: dict) -> str | None:
    """search 결과 snippet.thumbnails에서 가장 큰 썸네일 URL."""
    th = snippet.get("thumbnails") or {}
    for size in ("maxres", "standard", "high", "medium", "default"):
        url = (th.get(size) or {}).get("url")
        if url:
            return url
    return None


def _normalize_yt_video(item) -> dict | None:
    """search(type=video) item → {video_id, title, channel, cover_url}. 부적합하면 None."""
    if not isinstance(item, dict):
        return None
    vid = (item.get("id") or {}).get("videoId")
    snippet = item.get("snippet") or {}
    title = snippet.get("title")
    if not vid or not title:
        return None
    return {
        "video_id": vid,
        "title": html.unescape(title),  # YT 제목의 &amp; &#39; 등 디코드
        "channel": snippet.get("channelTitle"),
        "cover_url": _yt_thumbnail(snippet),
    }


# 제목에 이게 들어가면 공연 실황이 아니라 인터뷰/다큐/예고/리허설 등으로 보고 제외.
# (en/ko/de — 로스터 채널이 독일 공영방송 포함이라 독일어도) long 필터만으론 인터뷰가
# 섞여 들어와서, 제목 기반으로 비-공연 콘텐츠를 걸러낸다.
_INTERVIEW_KEYWORDS: tuple[str, ...] = (
    "interview", "인터뷰",
    "in conversation", "conversation", "대담",
    "documentary", "dokumentation", "다큐",
    "trailer", "teaser", "예고",
    "behind the scenes", "making of",
    "masterclass", "master class", "meisterklasse", "마스터클래스",
    "q&a", "q & a",
    "podcast",
    "im gespräch", "gespräch",
    "press conference", "pressekonferenz",
    "rehearsal", "generalprobe", "리허설",
    "vorschau",
    "porträt",
    "강연",
    # 채널별 비-공연 포맷(특히 베를린 필 무료 채널 — 실연은 Digital Concert Hall 유료):
    "live lounge", "upbeat",
    "announces", "announcement", "예고편",
    "recording producer", "behind the", "history of the", "from scratch",
)


def _is_interview_like(title: str) -> bool:
    """제목에 인터뷰/다큐/리허설 등 비-공연 신호가 있으면 True (공연 실황만 남김)."""
    t = (title or "").lower()
    return any(kw in t for kw in _INTERVIEW_KEYWORDS)


async def _fetch_channel_videos(
    http: httpx.AsyncClient, api_key: str,
    channels: list[tuple[str, str]], per_channel: int = 12,
) -> list[dict]:
    """로스터 채널별로 long+임베드 허용 비디오를 모아 [{video_id, title, channel, cover_url}].
    video_id로 dedup, 채널/결과 순서 유지. 채널 실패는 건너뛴다."""
    out: list[dict] = []
    seen: set[str] = set()
    for channel_id, _name in channels:
        try:
            r = await http.get(
                YT_SEARCH_URL,
                params={
                    "key": api_key,
                    "part": "snippet",
                    "channelId": channel_id,
                    "type": "video",
                    "videoDuration": "long",       # >20분 = 풀콘서트/리사이틀
                    "videoEmbeddable": "true",     # IFrame 임베드 가능한 것만
                    "order": "date",
                    "maxResults": per_channel,
                },
            )
            if r.status_code != 200:
                continue
            data = r.json()
        except Exception:
            continue
        for it in data.get("items") or []:
            v = _normalize_yt_video(it)
            if not v or v["video_id"] in seen:
                continue
            if _is_interview_like(v["title"]):
                continue  # 인터뷰/다큐/리허설 제외 — 공연 실황만
            seen.add(v["video_id"])
            out.append(v)
    return out


async def fetch_classical_videos(
    http: httpx.AsyncClient, api_key: str, per_channel: int = 8
) -> list[dict]:
    """클래식 로스터 채널의 long+임베드 비디오."""
    return await _fetch_channel_videos(http, api_key, CLASSICAL_CHANNELS, per_channel)


async def fetch_jazz_videos(
    http: httpx.AsyncClient, api_key: str, per_channel: int = 8
) -> list[dict]:
    """재즈 로스터 채널의 long+임베드 비디오."""
    return await _fetch_channel_videos(http, api_key, JAZZ_CHANNELS, per_channel)


async def _import_video_section(
    conn: psycopg.Connection, http: httpx.AsyncClient,
    channels: list[tuple[str, str]], section_key: str, title: str, display_order: int,
) -> int:
    """채널 로스터 → EMPSection(platform='youtube') 저장(저장 영상 수 반환).
    YOUTUBE_DATA_API_KEY 없거나 결과 0이면 no-op(섹션 미생성)."""
    api_key = os.environ.get(YT_DATA_API_KEY_ENV)
    if not api_key:
        return 0
    videos = await _fetch_channel_videos(http, api_key, channels)
    if not videos:
        return 0
    sec_id = upsert_section(
        conn=conn, platform="youtube", section_key=section_key,
        display_title=title, display_order=display_order,
    )
    seen: set[tuple[str, str]] = set()
    for idx, v in enumerate(videos):
        upsert_section_item(
            conn=conn, section_id=sec_id, item_type="youtube_video",
            item_id=v["video_id"], title=v["title"],
            cover_url=v["cover_url"], display_order=idx,
        )
        seen.add(("youtube_video", v["video_id"]))
    prune_stale_items(conn, sec_id, seen)
    return len(videos)


async def import_classical_videos(
    conn: psycopg.Connection, http: httpx.AsyncClient, display_order: int = 0
) -> int:
    """'video:classical-live' 섹션 저장."""
    return await _import_video_section(
        conn, http, CLASSICAL_CHANNELS, CLASSICAL_LIVE_SECTION, CLASSICAL_LIVE_TITLE, display_order
    )


async def import_jazz_videos(
    conn: psycopg.Connection, http: httpx.AsyncClient, display_order: int = 1
) -> int:
    """'video:jazz-live' 섹션 저장."""
    return await _import_video_section(
        conn, http, JAZZ_CHANNELS, JAZZ_LIVE_SECTION, JAZZ_LIVE_TITLE, display_order
    )
