"""검색 → 표시 + EMP 적재. Tidal+Spotify 라이브, 미연동 플랫폼은 skip(부분 결과)."""
from __future__ import annotations

import logging

import httpx
import psycopg
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from mrms.search.expand import fetch_container_tracks, persist_container_tracks

from mrms.api.auth_spotify import get_token as _spotify_token
from mrms.api.auth_tidal import _get_access_token as _tidal_token
from mrms.api.deps import db_conn, get_current_user_id
from mrms.search.normalize import merge_tracks
from mrms.search.persist import persist_search_tracks
from mrms.search.spotify import search_spotify
from mrms.search.tidal import search_tidal

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/search", tags=["search"])

MAX_Q = 120


async def _spotify_tok(user_id, conn):
    return (await _spotify_token(user_id=user_id, conn=conn))["access_token"]


async def _tidal_tok(user_id, conn):
    return await _tidal_token(user_id, conn)


@router.get("")
async def search(
    q: str,
    types: str = "track,album,playlist",
    user_id: str = Depends(get_current_user_id),
    conn: psycopg.Connection = Depends(db_conn),
):
    q = (q or "").strip()[:MAX_Q]
    if not q:
        raise HTTPException(400, "q required")
    type_list = [t for t in types.split(",") if t in ("track", "album", "playlist")]

    with conn.cursor() as cur:
        cur.execute('SELECT country FROM "User" WHERE id = %s', (user_id,))
        u = cur.fetchone()
    country = u[0] if u and u[0] else "US"

    skipped: list[str] = []
    agg = {"tracks": [], "albums": [], "playlists": []}
    async with httpx.AsyncClient(timeout=10.0) as http:
        for platform, get_tok, run in (
            ("spotify", _spotify_tok, lambda tok: search_spotify(http, tok, q, type_list)),
            ("tidal", _tidal_tok, lambda tok: search_tidal(http, tok, q, type_list, country)),
        ):
            try:
                tok = await get_tok(user_id, conn)
            except Exception as e:
                log.warning("search: %s token unavailable: %r", platform, e)
                skipped.append(platform)
                continue
            try:
                res = await run(tok)
            except Exception as e:
                log.warning("search: %s search failed: %r", platform, e)
                skipped.append(platform)
                continue
            agg["tracks"].extend(res["tracks"])
            agg["albums"].extend(res["albums"])
            agg["playlists"].extend(res["playlists"])

    tracks = merge_tracks(agg["tracks"])
    persist_search_tracks(conn, tracks, q)
    return {
        "tracks": tracks,
        "albums": agg["albums"],
        "playlists": agg["playlists"],
        "skipped_platforms": skipped,
    }


class ExpandReq(BaseModel):
    platform: str
    item_type: str  # 'album' | 'playlist'
    item_id: str


@router.post("/expand")
async def expand(
    req: ExpandReq,
    user_id: str = Depends(get_current_user_id),
    conn: psycopg.Connection = Depends(db_conn),
):
    if req.item_type not in ("album", "playlist") or req.platform not in ("tidal", "spotify"):
        raise HTTPException(400, "bad platform/item_type")
    with conn.cursor() as cur:
        cur.execute('SELECT country FROM "User" WHERE id = %s', (user_id,))
        u = cur.fetchone()
    country = u[0] if u and u[0] else "US"
    try:
        tok = await (_spotify_tok if req.platform == "spotify" else _tidal_tok)(user_id, conn)
    except Exception:
        raise HTTPException(401, f"{req.platform} auth unavailable")
    async with httpx.AsyncClient(timeout=15.0) as http:
        tracks = await fetch_container_tracks(
            http, req.platform, req.item_type, req.item_id, tok, country)
    source_id = persist_container_tracks(conn, tracks, req.item_type, req.item_id)
    return {"source_id": source_id, "count": len(tracks)}
