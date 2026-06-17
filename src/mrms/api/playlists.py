"""Playlists API — create / list / get tracks."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from mrms.api.deps import db_conn, get_current_user_id
from mrms.db.playlist import (
    add_tracks_to_playlist,
    create_playlist,
    delete_playlist,
    get_playlist,
    get_playlist_tracks,
    list_user_playlists,
    remove_track_from_playlist,
    reorder_playlist_tracks,
    set_playlist_share,
    update_playlist_meta,
)
from mrms.db.user_track import get_user_track_states

router = APIRouter(tags=["playlists"])


class CreatePlaylistRequest(BaseModel):
    name: str
    description: str | None = None
    track_ids: list[str] = Field(default_factory=list)


class ShareRequest(BaseModel):
    enabled: bool


class AddTracksRequest(BaseModel):
    track_ids: list[str]


class ReorderRequest(BaseModel):
    track_ids: list[str]


class UpdatePlaylistRequest(BaseModel):
    name: str | None = None
    description: str | None = None


def _require_owned(conn, playlist_id: str, user_id: str) -> dict:
    """소유 플레이리스트 반환. 없으면 404, 타인 소유면 403."""
    pl = get_playlist(conn, playlist_id)
    if not pl:
        raise HTTPException(404, "playlist not found")
    if pl["user_id"] != user_id:
        raise HTTPException(403, "forbidden")
    return pl


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


@router.post("/api/playlists/{playlist_id}/tracks")
def add_tracks_endpoint(
    playlist_id: str,
    body: AddTracksRequest,
    user_id: str = Depends(get_current_user_id),
    conn=Depends(db_conn),
):
    _require_owned(conn, playlist_id, user_id)
    if not body.track_ids:
        raise HTTPException(400, "track_ids required")
    return add_tracks_to_playlist(conn, playlist_id, body.track_ids, user_id)


@router.delete("/api/playlists/{playlist_id}/tracks/{track_id}")
def remove_track_endpoint(
    playlist_id: str,
    track_id: str,
    user_id: str = Depends(get_current_user_id),
    conn=Depends(db_conn),
):
    _require_owned(conn, playlist_id, user_id)
    remove_track_from_playlist(conn, playlist_id, track_id)
    return {"ok": True}


@router.patch("/api/playlists/{playlist_id}/tracks/order")
def reorder_tracks_endpoint(
    playlist_id: str,
    body: ReorderRequest,
    user_id: str = Depends(get_current_user_id),
    conn=Depends(db_conn),
):
    _require_owned(conn, playlist_id, user_id)
    if not reorder_playlist_tracks(conn, playlist_id, body.track_ids):
        raise HTTPException(400, "track set mismatch")
    return {"ok": True}


@router.patch("/api/playlists/{playlist_id}")
def update_playlist_endpoint(
    playlist_id: str,
    body: UpdatePlaylistRequest,
    user_id: str = Depends(get_current_user_id),
    conn=Depends(db_conn),
):
    pl = _require_owned(conn, playlist_id, user_id)
    name = (body.name if body.name is not None else pl["name"]).strip()
    if not name:
        raise HTTPException(400, "name required")
    # 명시적 null은 설명 비우기, 필드 생략은 기존 설명 유지 (둘을 구분).
    if "description" in body.model_fields_set:
        description = body.description
    else:
        description = pl["description"]
    update_playlist_meta(conn, playlist_id, name, description)
    return {"playlist": get_playlist(conn, playlist_id)}


@router.delete("/api/playlists/{playlist_id}")
def delete_playlist_endpoint(
    playlist_id: str,
    user_id: str = Depends(get_current_user_id),
    conn=Depends(db_conn),
):
    _require_owned(conn, playlist_id, user_id)
    delete_playlist(conn, playlist_id)
    return {"ok": True}
