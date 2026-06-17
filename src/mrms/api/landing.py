"""랜딩 히어로 API — 무인증. 전역 최신곡 풀에서 preview 확보된 N곡."""
from __future__ import annotations

import httpx
from fastapi import APIRouter, Depends

from mrms.api.deps import db_conn
from mrms.db.landing import pick_preview_candidates, set_track_preview_url
from mrms.ingest.preview import resolve_preview_url

router = APIRouter(prefix="/api/landing", tags=["landing"])


@router.get("/preview-tracks")
async def preview_tracks(n: int = 5, conn=Depends(db_conn)):
    """랜덤 최신곡 중 preview 확보된 N곡(메타+preview_url). 무인증."""
    n = max(1, min(n, 10))
    candidates = pick_preview_candidates(conn, limit=n * 3)
    out: list[dict] = []
    async with httpx.AsyncClient(timeout=15.0) as http:
        for c in candidates:
            if len(out) >= n:
                break
            url = c.get("preview_url")
            if not url:
                url = await resolve_preview_url(http, c["isrc"], c["title"], c["artist"])
                if url:
                    set_track_preview_url(conn, c["track_id"], url)
            if url:
                out.append({
                    "track_id": c["track_id"], "title": c["title"], "artist": c["artist"],
                    "album_cover": c["album_cover"], "preview_url": url,
                })
    return {"tracks": out}
