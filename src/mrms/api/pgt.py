"""PGT 라이브러리 섹션 API — 파생 섹션 + 사용자 플레이리스트 재사용."""
from __future__ import annotations

from fastapi import APIRouter, Depends

from mrms.api.deps import db_conn, get_current_user_id
from mrms.db import pgt as pgt_db
from mrms.db.playlist import list_user_playlists
from mrms.db.user_track import get_user_track_states

router = APIRouter(prefix="/api/pgt", tags=["pgt"])


def _with_states(conn, user_id, tracks):
    states = get_user_track_states(conn, user_id, [t["track_id"] for t in tracks])
    for t in tracks:
        t["liked"], t["pct"] = states.get(t["track_id"], (False, False))
    return tracks


@router.get("/sections")
def sections(user_id: str = Depends(get_current_user_id), conn=Depends(db_conn)):
    return {
        "liked": len(pgt_db.section_liked(conn, user_id)),
        "pct": len(pgt_db.section_pct(conn, user_id)),
        "albums": len(pgt_db.section_albums(conn, user_id)),
        "artists": len(pgt_db.section_artists(conn, user_id)),
        "user_playlists": list_user_playlists(conn, user_id),
    }


@router.get("/liked")
def liked(user_id: str = Depends(get_current_user_id), conn=Depends(db_conn)):
    return {"tracks": _with_states(conn, user_id, pgt_db.section_liked(conn, user_id))}


@router.get("/pct")
def pct(user_id: str = Depends(get_current_user_id), conn=Depends(db_conn)):
    return {"tracks": _with_states(conn, user_id, pgt_db.section_pct(conn, user_id))}


@router.get("/albums")
def albums(user_id: str = Depends(get_current_user_id), conn=Depends(db_conn)):
    return {"albums": pgt_db.section_albums(conn, user_id)}


@router.get("/albums/{album_id}")
def album_tracks(album_id: str, user_id: str = Depends(get_current_user_id), conn=Depends(db_conn)):
    return {"tracks": _with_states(conn, user_id, pgt_db.album_tracks(conn, user_id, album_id))}


@router.get("/artists")
def artists(user_id: str = Depends(get_current_user_id), conn=Depends(db_conn)):
    return {"artists": pgt_db.section_artists(conn, user_id)}


@router.get("/artists/{artist_id}")
def artist_tracks(artist_id: str, user_id: str = Depends(get_current_user_id), conn=Depends(db_conn)):
    return {"tracks": _with_states(conn, user_id, pgt_db.artist_tracks(conn, user_id, artist_id))}


