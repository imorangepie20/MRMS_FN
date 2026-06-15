"""YouTube Music 검색 — ytmusicapi 주력(쿼터 0) + 예산가드 Data API 폴백.

ytmusicapi(비공식)는 'songs' 검색이 간헐적으로 0이 될 수 있어, 0건일 때만
일일 예산 안에서 Data API v3 search.list로 폴백한다. ytmusicapi 결과는 videoId를
바로 주므로 EMP 적재 시 재생 resolve 쿼터를 절약한다.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
from datetime import datetime, timezone

import httpx
import psycopg

from mrms.db.settings import get_setting, set_setting
from mrms.search.normalize import normalize_ytmusic_track

log = logging.getLogger(__name__)

AUTH_SETTING_KEY = "youtube_auth_json"
FALLBACK_CAP_KEY = "yt_search_fallback_cap"
DEFAULT_FALLBACK_CAP = 30
YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search"
YT_FALLBACK_LIMIT = 12

# auth_raw 문자열 키 캐시 (Setting 교체 시 새 인스턴스). 무인증은 "" 키.
_yt_cache: dict[str, object] = {}


def _ytmusic(auth_raw: str | None):
    """YTMusic 인스턴스 (캐시). import lazy — ytmusicapi 없는 환경 순수테스트 보호."""
    cache_key = auth_raw or ""
    inst = _yt_cache.get(cache_key)
    if inst is None:
        from ytmusicapi import YTMusic

        auth = None
        if auth_raw:
            try:
                auth = json.loads(auth_raw)
            except ValueError:
                auth = None
        inst = YTMusic(auth) if auth else YTMusic()
        _yt_cache[cache_key] = inst
    return inst


def _today_key() -> str:
    return "yt_search_fallback_count_" + datetime.now(timezone.utc).strftime("%Y%m%d")


def _today_count(conn: psycopg.Connection) -> int:
    raw = get_setting(conn, _today_key())
    try:
        return int(raw) if raw else 0
    except ValueError:
        return 0


def _fallback_cap(conn: psycopg.Connection) -> int:
    raw = get_setting(conn, FALLBACK_CAP_KEY)
    try:
        return int(raw) if raw is not None else DEFAULT_FALLBACK_CAP
    except ValueError:
        return DEFAULT_FALLBACK_CAP


def _bump_fallback(conn: psycopg.Connection) -> None:
    set_setting(conn, _today_key(), str(_today_count(conn) + 1))


async def _ytmusic_search(conn: psycopg.Connection, q: str) -> list[dict]:
    """ytmusicapi 검색 → song/video 정규화 트랙. Data API 쿼터 0."""
    auth_raw = get_setting(conn, AUTH_SETTING_KEY)
    yt = _ytmusic(auth_raw)
    raw = await asyncio.to_thread(yt.search, q)
    out: list[dict] = []
    for item in raw or []:
        nt = normalize_ytmusic_track(item)
        if nt:
            out.append(nt)
    return out


async def _data_api_fallback(http: httpx.AsyncClient, q: str) -> list[dict]:
    """Data API v3 search.list(videoEmbeddable) → 트랙. 100유닛. 키 없으면 []."""
    key = os.environ.get("YOUTUBE_DATA_API_KEY")
    if not key:
        return []
    r = await http.get(
        YOUTUBE_SEARCH_URL,
        params={
            "part": "snippet",
            "type": "video",
            "videoEmbeddable": "true",
            "maxResults": YT_FALLBACK_LIMIT,
            "q": q,
            "key": key,
        },
        headers={"Accept": "application/json"},
    )
    if r.status_code != 200:
        log.warning("yt data api fallback %s: %s", r.status_code, r.text[:200])
        return []
    out: list[dict] = []
    for it in r.json().get("items", []):
        vid = (it.get("id") or {}).get("videoId")
        if not vid:
            continue
        sn = it.get("snippet") or {}
        out.append({
            "platform": "youtube",
            "platform_track_id": str(vid),
            "title": sn.get("title") or "",
            "artist": sn.get("channelTitle") or "",
            "album_title": None,
            "album_cover": None,
            "duration_ms": None,
            "isrc": None,
        })
    return out


async def search_youtube(
    conn: psycopg.Connection, q: str, *, http: httpx.AsyncClient
) -> dict:
    """ytmusicapi 주력 → 0건 + 예산 통과 시 Data API 폴백. v1 tracks만."""
    tracks = await _ytmusic_search(conn, q)
    if not tracks and _today_count(conn) < _fallback_cap(conn):
        fb = await _data_api_fallback(http, q)
        if fb:
            _bump_fallback(conn)
            tracks = fb
    return {"tracks": tracks, "albums": [], "playlists": []}
