"""Artwork API — iTunes Search proxy + cache."""
from __future__ import annotations

import httpx
from fastapi import APIRouter, Depends, Query

from mrms.api.deps import db_conn
from mrms.db.artwork import get_cached, upsert


router = APIRouter(tags=["artwork"])

ITUNES_SEARCH = "https://itunes.apple.com/search"


async def _fetch_itunes(artist: str, album: str) -> str | None:
    term = f"{artist} {album}".strip()
    try:
        async with httpx.AsyncClient(timeout=8.0) as http:
            r = await http.get(
                ITUNES_SEARCH,
                params={"term": term, "entity": "album", "limit": 1},
            )
            if r.status_code != 200:
                return None
            data = r.json()
            first = (data.get("results") or [None])[0]
            if not first or not first.get("artworkUrl100"):
                return None
            return str(first["artworkUrl100"]).replace("100x100", "600x600")
    except Exception:
        return None


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
    url = await _fetch_itunes(artist, album)
    upsert(conn, artist, album, url)
    return {"url": url, "cached": False}
