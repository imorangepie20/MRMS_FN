"""공유 플레이리스트 공개 조회 — 무인증. 토큰으로 메타 + 트랙."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from mrms.api.deps import db_conn
from mrms.db.playlist import get_playlist_by_share_id, get_playlist_tracks

router = APIRouter(tags=["shared"])


@router.get("/api/shared/{share_id}")
def get_shared_playlist(share_id: str, conn=Depends(db_conn)):
    """공개 페이지용 — 인증 불필요. 없거나 해제된 토큰은 404."""
    pl = get_playlist_by_share_id(conn, share_id)
    if not pl:
        raise HTTPException(404, "공유가 없거나 해제된 링크입니다")
    tracks = get_playlist_tracks(conn, pl["id"])
    return {"playlist": pl, "tracks": tracks}
