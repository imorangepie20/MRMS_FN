"""랜딩 히어로용 preview URL resolve — Deezer 우선 → iTunes 폴백. best-effort."""
from __future__ import annotations

import logging

import httpx

from mrms.ingest import deezer, itunes

log = logging.getLogger(__name__)


async def resolve_preview_url(
    http: httpx.AsyncClient, isrc: str, title: str, artist: str
) -> str | None:
    """ISRC로 30s preview URL 얻기. Deezer→iTunes. 실패 None."""
    if not isrc:
        return None
    try:
        dt = await deezer.lookup_by_isrc(http, isrc)
        if dt and dt.get("preview_url"):
            return dt["preview_url"]
    except Exception as e:  # noqa: BLE001 — best-effort
        log.debug("deezer preview [%s]: %r", isrc, e)
    try:
        url = await itunes.search_by_isrc(http, isrc)
        if url:
            return url
    except Exception as e:  # noqa: BLE001
        log.debug("itunes preview [%s]: %r", isrc, e)
    return None
