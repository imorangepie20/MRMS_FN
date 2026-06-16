"""아티스트 소개 팝업 API — 캐시 우선, MISS 시 Spotify+Gemini, 곡은 라이브."""
from __future__ import annotations

import asyncio

import httpx
import psycopg
from fastapi import APIRouter, Depends, HTTPException

from mrms.api.deps import db_conn, get_current_user_id_optional
from mrms.db.artist import artist_in_pool, artist_tracks_by_name
from mrms.db.artist_profile import get_artist_profile, upsert_artist_profile
from mrms.recsys.artist_bio import gemini_artist_bio
from mrms.search.spotify_artist import fetch_spotify_artist

router = APIRouter(prefix="/api/artist", tags=["artist"])


@router.get("/intro")
async def artist_intro(
    name: str,
    user_id: str | None = Depends(get_current_user_id_optional),
    conn: psycopg.Connection = Depends(db_conn),
):
    """아티스트 소개(이미지/장르/bio) + 우리 풀의 그 아티스트 곡. auth-optional."""
    norm = (name or "").strip().lower()
    if not norm:
        raise HTTPException(400, "name required")

    prof = get_artist_profile(conn, norm)
    if prof is None:
        # 외부(Spotify/Gemini) 호출·캐시쓰기는 우리 풀에 실제 있는 아티스트만 —
        # 임의 이름으로 무인증 비용 소진/캐시 오염을 차단(풀에 없으면 곡도 0개).
        if artist_in_pool(conn, norm):
            async with httpx.AsyncClient(timeout=10.0) as http:
                image, genres = await fetch_spotify_artist(http, name)
            # blocking Gemini 호출을 스레드로 오프로드 — async 이벤트루프 블로킹 방지.
            bio = await asyncio.to_thread(gemini_artist_bio, name, genres)
            if bio is not None or image is not None:
                upsert_artist_profile(conn, norm, name, bio, image, genres)
            prof = {"name": name, "bio": bio, "image_url": image, "genres": genres}
        else:
            prof = {"name": name, "bio": None, "image_url": None, "genres": []}

    tracks = artist_tracks_by_name(conn, norm, user_id=user_id)
    return {
        "name": prof["name"], "image": prof.get("image_url"),
        "genres": prof.get("genres") or [], "bio": prof.get("bio"),
        "tracks": tracks,
    }
