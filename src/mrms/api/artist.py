"""아티스트 소개 팝업 API — 캐시 우선, MISS 시 Spotify+Gemini, 곡은 라이브."""
from __future__ import annotations

import httpx
import psycopg
from fastapi import APIRouter, Depends, HTTPException

from mrms.api.deps import db_conn, get_current_user_id_optional
from mrms.db.artist import artist_tracks_by_name
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
        async with httpx.AsyncClient(timeout=10.0) as http:
            image, genres = await fetch_spotify_artist(http, name)
        bio = gemini_artist_bio(name, genres)
        if bio is not None or image is not None:
            upsert_artist_profile(conn, norm, name, bio, image, genres)
        prof = {"name": name, "bio": bio, "image_url": image, "genres": genres}

    tracks = artist_tracks_by_name(conn, norm, user_id=user_id)
    return {
        "name": prof["name"], "image": prof.get("image_url"),
        "genres": prof.get("genres") or [], "bio": prof.get("bio"),
        "tracks": tracks,
    }
