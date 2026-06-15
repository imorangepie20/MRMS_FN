"""User tracks API — like/pct toggle + state."""
from __future__ import annotations

from fastapi import APIRouter, Depends

from mrms.api.deps import db_conn, get_current_user_id
from mrms.db.ids import stable_id as _id
from mrms.db.user_blocked import block_target


router = APIRouter(prefix="/api/user/tracks", tags=["user_tracks"])


@router.post("/{track_id}/like")
def toggle_like(
    track_id: str,
    user_id: str = Depends(get_current_user_id),
    conn=Depends(db_conn),
):
    """좋아요 토글. UserTrack source='liked' 추가/제거.

    이미 PCT(isCore=true)면 source만 변경하고 행 유지.
    """
    with conn.cursor() as cur:
        cur.execute(
            '''SELECT source, "isCore" FROM "UserTrack"
               WHERE "userId" = %s AND "trackId" = %s''',
            (user_id, track_id),
        )
        row = cur.fetchone()
        if row is None:
            row_id = _id(f"usertrack|{user_id}|{track_id}")
            cur.execute(
                '''INSERT INTO "UserTrack"
                     (id, "userId", "trackId", source, "isCore", platform)
                   VALUES (%s, %s, %s, 'liked', false, 'mrms')''',
                (row_id, user_id, track_id),
            )
            conn.commit()
            return {"liked": True}

        source, is_core = row
        if source == "liked":
            if is_core:
                cur.execute(
                    '''UPDATE "UserTrack" SET source = 'playlist'
                       WHERE "userId" = %s AND "trackId" = %s''',
                    (user_id, track_id),
                )
            else:
                # 플레이리스트에 담긴 곡이면 라이브러리에서 완전 삭제하지 않고 'curated'로
                # 강등 → MRT 숨김 유지(플레이리스트=MRT 제외 보장). 아니면 기존대로 삭제.
                cur.execute(
                    '''SELECT 1 FROM "PlaylistTrack" pt
                       JOIN "Playlist" p ON p.id = pt."playlistId"
                       WHERE p."userId" = %s AND pt."trackId" = %s
                       LIMIT 1''',
                    (user_id, track_id),
                )
                if cur.fetchone():
                    cur.execute(
                        '''UPDATE "UserTrack" SET source = 'curated'
                           WHERE "userId" = %s AND "trackId" = %s''',
                        (user_id, track_id),
                    )
                else:
                    cur.execute(
                        '''DELETE FROM "UserTrack"
                           WHERE "userId" = %s AND "trackId" = %s''',
                        (user_id, track_id),
                    )
            conn.commit()
            return {"liked": False}
        else:
            cur.execute(
                '''UPDATE "UserTrack" SET source = 'liked'
                   WHERE "userId" = %s AND "trackId" = %s''',
                (user_id, track_id),
            )
            conn.commit()
            return {"liked": True}


@router.post("/{track_id}/pct")
def toggle_pct(
    track_id: str,
    user_id: str = Depends(get_current_user_id),
    conn=Depends(db_conn),
):
    """PCT(isCore) 토글. 없으면 INSERT (source='liked', isCore=true)."""
    with conn.cursor() as cur:
        cur.execute(
            '''SELECT "isCore" FROM "UserTrack"
               WHERE "userId" = %s AND "trackId" = %s''',
            (user_id, track_id),
        )
        row = cur.fetchone()
        if row is None:
            row_id = _id(f"usertrack|{user_id}|{track_id}")
            cur.execute(
                '''INSERT INTO "UserTrack"
                     (id, "userId", "trackId", source, "isCore", platform)
                   VALUES (%s, %s, %s, 'liked', true, 'mrms')''',
                (row_id, user_id, track_id),
            )
            conn.commit()
            return {"pct": True}

        is_core = row[0]
        new_value = not is_core
        cur.execute(
            '''UPDATE "UserTrack" SET "isCore" = %s
               WHERE "userId" = %s AND "trackId" = %s''',
            (new_value, user_id, track_id),
        )
        conn.commit()
        return {"pct": new_value}


@router.post("/album/{album_id}/collect")
def collect_album(
    album_id: str,
    user_id: str = Depends(get_current_user_id),
    conn=Depends(db_conn),
):
    """앨범의 카탈로그 트랙 전부를 PGT로 담기 (source='liked'). collected 수 반환."""
    with conn.cursor() as cur:
        cur.execute('SELECT id FROM "Track" WHERE "albumId" = %s', (album_id,))
        track_ids = [r[0] for r in cur.fetchall()]
        for tid in track_ids:
            cur.execute(
                '''INSERT INTO "UserTrack" (id, "userId", "trackId", source, "isCore", platform)
                   VALUES (%s, %s, %s, 'liked', false, 'mrms')
                   ON CONFLICT ("userId", "trackId") DO NOTHING''',
                (_id(f"usertrack|{user_id}|{tid}"), user_id, tid),
            )
    conn.commit()
    return {"collected": len(track_ids)}


@router.post("/{track_id}/dislike")
def dislike_track(
    track_id: str,
    user_id: str = Depends(get_current_user_id),
    conn=Depends(db_conn),
):
    """싫어요 — 트랙 영구 제외."""
    block_target(conn, user_id, track_id, "track", "disliked")
    return {"disliked": True}


@router.post("/{track_id}/dismiss")
def dismiss_track(
    track_id: str,
    user_id: str = Depends(get_current_user_id),
    conn=Depends(db_conn),
):
    """관심없어요 — 트랙 일시 숨김."""
    block_target(conn, user_id, track_id, "track", "dismissed")
    return {"dismissed": True}


@router.post("/album/{album_id}/dislike")
def dislike_album(
    album_id: str,
    user_id: str = Depends(get_current_user_id),
    conn=Depends(db_conn),
):
    """싫어요 — 앨범 영구 제외."""
    block_target(conn, user_id, album_id, "album", "disliked")
    return {"disliked": True}


@router.post("/album/{album_id}/dismiss")
def dismiss_album(
    album_id: str,
    user_id: str = Depends(get_current_user_id),
    conn=Depends(db_conn),
):
    """관심없어요 — 앨범 일시 숨김."""
    block_target(conn, user_id, album_id, "album", "dismissed")
    return {"dismissed": True}


@router.get("/{track_id}/state")
def get_track_state(
    track_id: str,
    user_id: str = Depends(get_current_user_id),
    conn=Depends(db_conn),
):
    """현재 트랙 liked + pct 상태."""
    with conn.cursor() as cur:
        cur.execute(
            '''SELECT source, "isCore" FROM "UserTrack"
               WHERE "userId" = %s AND "trackId" = %s''',
            (user_id, track_id),
        )
        row = cur.fetchone()
    if row is None:
        return {"liked": False, "pct": False}
    source, is_core = row
    return {"liked": source == "liked", "pct": bool(is_core)}
