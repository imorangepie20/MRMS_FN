"""Playlists API — create / list / get tracks."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from mrms.api.deps import db_conn, get_current_user_id
from mrms.db.playlist import (
    create_playlist,
    get_playlist,
    get_playlist_tracks,
    list_user_playlists,
    set_playlist_share,
)
from mrms.db.user_track import get_user_track_states

router = APIRouter(tags=["playlists"])


class CreatePlaylistRequest(BaseModel):
    name: str
    description: str | None = None
    track_ids: list[str] = Field(default_factory=list)


class ShareRequest(BaseModel):
    enabled: bool


@router.post("/api/user/playlists")
def create_playlist_endpoint(
    body: CreatePlaylistRequest,
    user_id: str = Depends(get_current_user_id),
    conn=Depends(db_conn),
):
    """새 playlist 생성."""
    name = body.name.strip()
    if not name:
        raise HTTPException(400, "name required")
    playlist_id = create_playlist(
        conn,
        user_id=user_id,
        name=name,
        description=(body.description or None),
        track_ids=body.track_ids,
    )
    playlist = get_playlist(conn, playlist_id)
    return {"playlist": playlist}


@router.get("/api/user/playlists")
def list_my_playlists(
    user_id: str = Depends(get_current_user_id),
    conn=Depends(db_conn),
):
    return {"playlists": list_user_playlists(conn, user_id)}


@router.get("/api/playlists/{playlist_id}/tracks")
def playlist_tracks_endpoint(
    playlist_id: str,
    user_id: str = Depends(get_current_user_id),
    conn=Depends(db_conn),
):
    pl = get_playlist(conn, playlist_id)
    if not pl:
        raise HTTPException(404, "playlist not found")
    if pl["user_id"] != user_id:
        raise HTTPException(403, "forbidden")
    tracks = get_playlist_tracks(conn, playlist_id)
    states = get_user_track_states(conn, user_id, [t["track_id"] for t in tracks])
    for t in tracks:
        t["liked"], t["pct"] = states.get(t["track_id"], (False, False))
    return {"playlist": pl, "tracks": tracks}


@router.post("/api/user/playlists/{playlist_id}/share")
def toggle_playlist_share(
    playlist_id: str,
    body: ShareRequest,
    user_id: str = Depends(get_current_user_id),
    conn=Depends(db_conn),
):
    """공유 토글 (소유자만). enabled=true면 공개 링크 생성, false면 해제."""
    pl = get_playlist(conn, playlist_id)
    if not pl:
        raise HTTPException(404, "playlist not found")
    if pl["user_id"] != user_id:
        raise HTTPException(403, "forbidden")
    share_id = set_playlist_share(conn, playlist_id, body.enabled)
    return {
        "share_id": share_id,
        "share_url": f"/p/{share_id}" if share_id else None,
    }
