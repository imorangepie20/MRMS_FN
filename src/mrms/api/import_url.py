"""공유 URL → 트랙 fetch → EMP 적재 → 표시. search expand 패턴 재사용."""
from __future__ import annotations

import httpx
import psycopg
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from mrms.api.deps import db_conn, get_current_user_id
from mrms.api.search import _spotify_tok, _tidal_tok
from mrms.search.app_token import get_app_token
from mrms.search.expand import (
    _container_title,
    fetch_container_tracks,
    fetch_track,
    persist_container_tracks,
)
from mrms.search.normalize import merge_tracks
from mrms.search.share_url import parse_share_url

router = APIRouter(prefix="/api/import", tags=["import"])


class ImportReq(BaseModel):
    url: str


@router.post("/url")
async def import_url(
    req: ImportReq,
    user_id: str = Depends(get_current_user_id),
    conn: psycopg.Connection = Depends(db_conn),
):
    parsed = parse_share_url(req.url)
    if not parsed:
        raise HTTPException(400, "지원하지 않는 URL입니다 (Tidal/Spotify track·playlist·album)")
    platform, item_type, item_id = parsed

    with conn.cursor() as cur:
        cur.execute('SELECT country FROM "User" WHERE id = %s', (user_id,))
        u = cur.fetchone()
    country = u[0] if u and u[0] else "US"

    title = None
    normalized: list = []
    async with httpx.AsyncClient(timeout=15.0) as http:
        # 카탈로그 조회는 사용자 인증과 무관 — 앱 토큰(client_credentials) 우선,
        # 안 되면(예: Spotify playlist 403) 연동된 유저 토큰으로 폴백. 재생만 연동 필요.
        tokens: list[str] = []
        for getter in (
            lambda: get_app_token(http, platform),
            lambda: (_spotify_tok if platform == "spotify" else _tidal_tok)(user_id, conn),
        ):
            try:
                tokens.append(await getter())
            except Exception:
                continue
        if not tokens:
            raise HTTPException(502, f"{platform} 토큰을 얻을 수 없습니다")

        used = None
        for tok in tokens:
            if item_type == "track":
                one = await fetch_track(http, platform, item_id, tok, country)
                cand = [one] if one else []
            else:
                cand = await fetch_container_tracks(
                    http, platform, item_type, item_id, tok, country)
            if cand:
                normalized, used = cand, tok
                break
        if normalized and item_type != "track":
            title = await _container_title(http, platform, item_type, item_id, used, country)

    if not normalized:
        raise HTTPException(404, "트랙을 가져올 수 없습니다 (비공개·삭제·미지원·연동 필요)")

    persist_container_tracks(conn, normalized, item_type, item_id)
    tracks = merge_tracks(normalized)
    if item_type == "track" and tracks:
        title = f"{tracks[0]['artist']} — {tracks[0]['title']}"
    return {"platform": platform, "item_type": item_type, "title": title, "tracks": tracks}
