"""랜딩 히어로 API — 무인증. 전역 카탈로그에서 preview 확보된 N곡."""
from __future__ import annotations

import asyncio

import httpx
from fastapi import APIRouter, Depends

from mrms.api.deps import db_conn
from mrms.db.landing import pick_preview_candidates
from mrms.ingest.preview import resolve_preview_url

router = APIRouter(prefix="/api/landing", tags=["landing"])


@router.get("/preview-tracks")
async def preview_tracks(n: int = 5, conn=Depends(db_conn)):
    """랜덤 트랙 중 preview 확보된 N곡(메타+preview_url). 무인증.

    preview URL은 만료 서명(Deezer)이 있어 캐시하지 않고 매 호출 resolve한다(병렬)."""
    n = max(1, min(n, 10))
    candidates = pick_preview_candidates(conn, limit=n * 2)

    async with httpx.AsyncClient(timeout=15.0) as http:
        async def _resolve(c: dict):
            url = c.get("preview_url") or await resolve_preview_url(
                http, c["isrc"], c["title"], c["artist"]
            )
            return c, url

        resolved = await asyncio.gather(*[_resolve(c) for c in candidates])

    out: list[dict] = []
    for c, url in resolved:
        if len(out) >= n:
            break
        if url:
            out.append({
                "track_id": c["track_id"], "title": c["title"], "artist": c["artist"],
                "album_cover": c["album_cover"], "preview_url": url,
            })
    return {"tracks": out}
