"""Artwork API — iTunes Search proxy + cache."""
from __future__ import annotations

import httpx
from fastapi import APIRouter, Depends, Query

from mrms.api.deps import db_conn
from mrms.db.artwork import get_cached, upsert

router = APIRouter(tags=["artwork"])

ITUNES_SEARCH = "https://itunes.apple.com/search"


class _TransientArtworkError(Exception):
    """iTunes rate-limit/일시 장애 — negative 캐시에 박지 않고 다음에 재시도."""


async def _fetch_itunes(artist: str, album: str) -> str | None:
    """앨범 아트워크 URL(없으면 None). rate-limit(429)은 _TransientArtworkError로."""
    term = f"{artist} {album}".strip()
    async with httpx.AsyncClient(timeout=8.0) as http:
        try:
            r = await http.get(
                ITUNES_SEARCH,
                params={"term": term, "entity": "album", "limit": 1},
            )
        except Exception:
            return None  # 네트워크 오류 → no-match(7일 TTL 후 재시도)
        if r.status_code == 429:
            raise _TransientArtworkError("itunes rate limited")
        if r.status_code != 200:
            return None
        try:
            data = r.json()
        except Exception:
            return None
        first = (data.get("results") or [None])[0]
        if not first or not first.get("artworkUrl100"):
            return None
        return str(first["artworkUrl100"]).replace("100x100", "600x600")


@router.get("/api/artwork")
async def get_artwork(
    artist: str = Query(...),
    album: str = Query(...),
    conn=Depends(db_conn),
):
    """앨범 아트워크 URL 조회 — 캐시 우선, 미스 시 iTunes."""
    if not artist.strip() or not album.strip():
        return {"url": None}
    hit, url = get_cached(conn, artist, album)
    if hit:
        return {"url": url, "cached": True}
    try:
        url = await _fetch_itunes(artist, album)
    except _TransientArtworkError:
        return {"url": None, "cached": False}  # rate-limit — 캐시 안 함, 다음에 재시도
    upsert(conn, artist, album, url)
    return {"url": url, "cached": False}
