"""Playlists API — create / list / get tracks."""
from __future__ import annotations

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from mrms.api.auth_tidal import _get_access_token
from mrms.api.deps import db_conn, get_current_user_id
from mrms.db.playlist import (
    add_tracks_to_playlist,
    create_playlist,
    delete_playlist,
    get_playlist,
    get_playlist_tidal_id,
    get_playlist_tracks,
    list_user_playlists,
    remove_track_from_playlist,
    reorder_playlist_tracks,
    set_playlist_share,
    set_playlist_tidal_id,
    update_playlist_meta,
)
from mrms.db.user_track import get_oauth, get_user_track_states
from mrms.tidal_playlist import create_tidal_playlist, make_tidal_playlist_public

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
async def toggle_playlist_share(
    playlist_id: str,
    body: ShareRequest,
    user_id: str = Depends(get_current_user_id),
    conn=Depends(db_conn),
):
    """공유 토글 (소유자만). enabled=true면 공개 링크 생성, false면 해제.
    공유 켤 때 소유자가 Tidal 연결돼 있으면 본인 Tidal에 동일 플레이리스트를 1회 생성해
    공유페이지의 'Tidal에서 재생' 링크로 노출(실패해도 공유는 정상 진행)."""
    pl = get_playlist(conn, playlist_id)
    if not pl:
        raise HTTPException(404, "playlist not found")
    if pl["user_id"] != user_id:
        raise HTTPException(403, "forbidden")
    share_id = set_playlist_share(conn, playlist_id, body.enabled)

    tidal_ready = False
    if body.enabled and get_oauth(conn, user_id, "tidal"):  # 소유자 Tidal 연결됨
        try:
            access_token = await _get_access_token(user_id, conn)
            uuid = get_playlist_tidal_id(conn, playlist_id)
            if not uuid:
                # 아직 안 만든 경우 → 생성 + 트랙 추가
                track_ids: list[str] = []
                seen: set[str] = set()
                for t in get_playlist_tracks(conn, playlist_id):
                    tid = t.get("tidal_track_id")
                    if tid and str(tid) not in seen:
                        seen.add(str(tid))
                        track_ids.append(str(tid))
                if track_ids:
                    uuid = await create_tidal_playlist(
                        access_token, pl["name"], pl.get("description"), track_ids
                    )
                    set_playlist_tidal_id(conn, playlist_id, uuid)
            if uuid:
                # 공개 전환(기본 private면 404) — 기존에 만든 private도 여기서 복구. 멱등.
                await make_tidal_playlist_public(access_token, uuid)
                tidal_ready = True
        except (httpx.HTTPError, KeyError):
            tidal_ready = False  # best-effort — 공유는 그대로 진행

    return {
        "share_id": share_id,
        "share_url": f"/p/{share_id}" if share_id else None,
        "tidal_created": tidal_ready,
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
