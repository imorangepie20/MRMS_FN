"""Videos browse API — 비디오 섹션 + 플레이리스트 영상(공개)."""
from __future__ import annotations

import httpx
import psycopg
from fastapi import APIRouter, Depends

from mrms.api.deps import db_conn
from mrms.db.emp_section import list_sections_with_items
from mrms.emp.tidal import TidalEMPImporter

router = APIRouter(prefix="/api/videos", tags=["videos"])


@router.get("/sections")
def get_video_sections(conn: psycopg.Connection = Depends(db_conn)):
    # 공개 — 비회원 둘러보기(EMP와 동일). 비디오 섹션(video:%)만.
    sections = list_sections_with_items(conn, only_video=True)
    return {"sections": sections}


@router.get("/playlists/{playlist_uuid}")
async def get_video_playlist(
    playlist_uuid: str,
    conn: psycopg.Connection = Depends(db_conn),
):
    """비디오 플레이리스트(uuid)의 영상들 — 카드 클릭 시 라이브 fetch(x-tidal-token).
    응답: {"videos": [{video_id, title, artist, cover_url}, ...]}. 공개."""
    imp = TidalEMPImporter(conn=conn)
    async with httpx.AsyncClient(timeout=15.0) as http:
        videos = await imp._fetch_playlist_videos(http, playlist_uuid)
    return {"videos": videos}
