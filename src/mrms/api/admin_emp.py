"""Admin EMP API — stats / runs / trigger."""
from __future__ import annotations

import os
import subprocess

import psycopg
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel

from mrms.api.deps import db_conn, get_current_user_id
from mrms.db.emp import (
    count_runs,
    delete_run,
    delete_runs_older_than,
    get_emp_stats,
    list_recent_runs,
)
from mrms.db.settings import list_settings, set_setting
from mrms.emp.apple import SOURCES_SETTING_KEY as APPLE_SOURCES_SETTING_KEY
from mrms.emp.flo import SOURCES_SETTING_KEY as FLO_SOURCES_SETTING_KEY
from mrms.emp.spotify import SOURCES_SETTING_KEY as SPOTIFY_SOURCES_SETTING_KEY
from mrms.emp.tidal import SOURCES_SETTING_KEY, TOKEN_SETTING_KEY
from mrms.emp.vibe import SOURCES_SETTING_KEY as VIBE_SOURCES_SETTING_KEY
from mrms.emp.youtube import SOURCES_SETTING_KEY as YOUTUBE_SOURCES_SETTING_KEY

router = APIRouter(prefix="/api/admin/emp", tags=["admin_emp"])


def _require_admin(conn: psycopg.Connection, user_id: str) -> None:
    admin_email = os.environ.get("ADMIN_EMAIL", "").strip().lower()
    if not admin_email:
        raise HTTPException(403, "admin not configured")
    with conn.cursor() as cur:
        cur.execute('SELECT email FROM "User" WHERE id = %s', (user_id,))
        row = cur.fetchone()
    if not row or (row[0] or "").strip().lower() != admin_email:
        raise HTTPException(403, "not admin")


@router.get("/stats")
def admin_stats(
    user_id: str = Depends(get_current_user_id),
    conn: psycopg.Connection = Depends(db_conn),
):
    _require_admin(conn, user_id)
    stats = get_emp_stats(conn)
    runs = list_recent_runs(conn, limit=1)
    stats["last_run"] = runs[0] if runs else None
    return stats


@router.get("/users")
def admin_users(
    user_id: str = Depends(get_current_user_id),
    conn: psycopg.Connection = Depends(db_conn),
):
    """추천 실행 대상 선택용 사용자 목록 (track_count 내림차순 — 라이브러리 보유 우선)."""
    _require_admin(conn, user_id)
    with conn.cursor() as cur:
        cur.execute(
            '''SELECT u.email, u."displayName", count(ut."trackId") AS track_count
               FROM "User" u
               LEFT JOIN "UserTrack" ut ON ut."userId" = u.id
               GROUP BY u.id, u.email, u."displayName", u."createdAt"
               ORDER BY track_count DESC, u."createdAt"'''
        )
        rows = cur.fetchall()
    return {
        "users": [
            {"email": r[0], "display_name": r[1], "track_count": r[2]} for r in rows
        ]
    }


@router.get("/runs")
def admin_runs(
    limit: int = 20,
    offset: int = 0,
    user_id: str = Depends(get_current_user_id),
    conn: psycopg.Connection = Depends(db_conn),
):
    _require_admin(conn, user_id)
    limit = max(1, min(limit, 100))
    offset = max(0, offset)
    return {
        "runs": list_recent_runs(conn, limit=limit, offset=offset),
        "total": count_runs(conn),
        "limit": limit,
        "offset": offset,
    }


@router.delete("/runs/{run_id}")
def admin_delete_run(
    run_id: str,
    user_id: str = Depends(get_current_user_id),
    conn: psycopg.Connection = Depends(db_conn),
):
    _require_admin(conn, user_id)
    if not delete_run(conn, run_id):
        raise HTTPException(404, "run not found or still running")
    return {"deleted": run_id}


class PruneBody(BaseModel):
    keep: int = 50


@router.post("/runs/prune")
def admin_prune_runs(
    body: PruneBody,
    user_id: str = Depends(get_current_user_id),
    conn: psycopg.Connection = Depends(db_conn),
):
    """최근 keep개를 제외한 run 일괄 삭제 (진행 중 제외)."""
    _require_admin(conn, user_id)
    keep = max(1, body.keep)
    deleted = delete_runs_older_than(conn, keep=keep)
    return {"deleted": deleted, "kept": keep}


# Whitelisted keys — never let arbitrary keys be set via admin
ALLOWED_SETTING_KEYS = [
    TOKEN_SETTING_KEY,
    SOURCES_SETTING_KEY,
    SPOTIFY_SOURCES_SETTING_KEY,
    FLO_SOURCES_SETTING_KEY,
    VIBE_SOURCES_SETTING_KEY,
    APPLE_SOURCES_SETTING_KEY,
    YOUTUBE_SOURCES_SETTING_KEY,
]

# Keys whose value should be masked in GET response (tokens etc.)
MASKED_KEYS: set[str] = {TOKEN_SETTING_KEY}


@router.get("/settings")
def admin_get_settings(
    user_id: str = Depends(get_current_user_id),
    conn: psycopg.Connection = Depends(db_conn),
):
    _require_admin(conn, user_id)
    values = list_settings(conn, ALLOWED_SETTING_KEYS)
    out: dict[str, dict] = {}
    for k, v in values.items():
        if k in MASKED_KEYS:
            if v:
                out[k] = {"present": True, "preview": f"…{v[-4:]}" if len(v) > 4 else "…"}
            else:
                out[k] = {"present": False, "preview": None}
        else:
            # Plain value — return as-is
            out[k] = {"present": v is not None, "value": v}
    return {"settings": out}


class SettingUpdate(BaseModel):
    key: str
    value: str | None  # None or empty → delete


@router.put("/settings")
def admin_put_setting(
    body: SettingUpdate,
    user_id: str = Depends(get_current_user_id),
    conn: psycopg.Connection = Depends(db_conn),
):
    _require_admin(conn, user_id)
    if body.key not in ALLOWED_SETTING_KEYS:
        raise HTTPException(400, f"key not allowed: {body.key}")
    set_setting(conn, body.key, body.value or None)
    return {"message": "saved", "key": body.key}


class RunMrtRequest(BaseModel):
    target: str  # "all" | "user"
    email: str | None = None


def _regenerate_all_mrt() -> None:
    """MRT 보유 전 유저 force 재생성 (백그라운드, 자체 conn + IngestionRun).

    generate_user_mrt(persona+discovery)는 유저별 best-effort. select_stale 무시(force).
    """
    import time

    from mrms.db.emp import append_stage, create_run, finish_run
    from mrms.db.user_blocked import clear_dismissed
    from mrms.db.user_embedding import prune_playlist_history
    from mrms.emp.base import safe_rollback
    from mrms.recsys.mrt import MODEL_VERSION, generate_user_mrt

    conn = psycopg.connect(os.environ["DATABASE_URL"])
    t0 = time.monotonic()
    try:
        run_id = create_run(conn, platform="mrt", triggered_by="admin")
        with conn.cursor() as cur:
            cur.execute(
                'SELECT DISTINCT "userId" FROM "PlaylistHistory" WHERE "modelVersion" = %s',
                (MODEL_VERSION,),
            )
            uids = [r[0] for r in cur.fetchall()]
        regenerated = failed = skipped = 0
        for uid in uids:
            try:
                if generate_user_mrt(conn, uid) is not None:
                    conn.commit()  # generate_user_mrt 쓰기 명시 커밋 (호출자 책임)
                    prune_playlist_history(conn, uid)  # 자체 commit
                    clear_dismissed(conn, uid)  # 자체 commit
                    regenerated += 1
                else:
                    safe_rollback(conn)  # 트랙 부족(None) — 부분 쓰기 폐기, 다음 유저로
                    skipped += 1
            except Exception:
                safe_rollback(conn)
                failed += 1
        status = "success" if failed == 0 else "partial"
        try:
            append_stage(conn, run_id, {
                "stage": "manual_mrt", "status": status,
                "duration_ms": int((time.monotonic() - t0) * 1000),
                "stdout": (
                    f"total={len(uids)} regenerated={regenerated}"
                    f" skipped={skipped} failed={failed}"
                ),
                "stderr": "", "error": None if failed == 0 else f"{failed} user(s) failed",
            })
            finish_run(conn, run_id, status)
            conn.commit()
        except Exception:
            safe_rollback(conn)
            try:
                finish_run(conn, run_id, "failed")  # 좀비 run 방지
            except Exception:
                pass
    finally:
        conn.close()


@router.post("/run-mrt")
def admin_run_mrt(
    req: RunMrtRequest,
    background: BackgroundTasks,
    user_id: str = Depends(get_current_user_id),
    conn: psycopg.Connection = Depends(db_conn),
):
    """MRT(persona+discovery) 강제 재생성. target='user'(sync) | 'all'(백그라운드)."""
    _require_admin(conn, user_id)
    from mrms.recsys.mrt import MODEL_VERSION

    if req.target == "all":
        with conn.cursor() as cur:
            cur.execute(
                'SELECT count(DISTINCT "userId") FROM "PlaylistHistory" WHERE "modelVersion" = %s',
                (MODEL_VERSION,),
            )
            n = cur.fetchone()[0]
        background.add_task(_regenerate_all_mrt)
        return {"mode": "all", "queued": int(n)}

    if req.target == "user":
        email = (req.email or "").strip().lower()
        if not email:
            raise HTTPException(400, "email required for target=user")
        with conn.cursor() as cur:
            # 저장된 email은 OAuth 제공자 표기 그대로(미정규화)라 대소문자 무시 매칭
            cur.execute('SELECT id FROM "User" WHERE lower(email) = %s', (email,))
            row = cur.fetchone()
        if not row:
            raise HTTPException(404, "user not found")
        target_uid = row[0]

        from mrms.db.user_blocked import clear_dismissed
        from mrms.db.user_embedding import prune_playlist_history
        from mrms.emp.base import fmt_exc, safe_rollback
        from mrms.recsys.discover import read_discovery
        from mrms.recsys.mrt import generate_user_mrt

        try:
            n = generate_user_mrt(conn, target_uid)
        except Exception as e:
            safe_rollback(conn)
            raise HTTPException(500, f"regenerate failed: {fmt_exc(e, 200)}") from e
        if n is None:
            return {
                "mode": "user", "regenerated": False,
                "reason": "UserTrack < k (임베딩 부족)",
                "tracks_used": 0, "discovery_count": 0,
            }
        conn.commit()  # generate_user_mrt 쓰기 명시 커밋 (호출자 책임)
        prune_playlist_history(conn, target_uid)  # 자체 commit
        clear_dismissed(conn, target_uid)  # 자체 commit
        discovery_count = len(read_discovery(conn, target_uid))
        return {
            "mode": "user", "regenerated": True,
            "tracks_used": n, "discovery_count": discovery_count,
        }

    raise HTTPException(400, "target must be 'all' or 'user'")


@router.post("/trigger")
def admin_trigger(
    user_id: str = Depends(get_current_user_id),
    conn: psycopg.Connection = Depends(db_conn),
):
    """EMP 파이프라인 수동 트리거.

    mrms-emp-import.service는 항상 전체 파이프라인(platform='all')을 실행 —
    platform 선택은 지원하지 않음 (run_emp_pipeline.py가 'all' 고정).
    """
    _require_admin(conn, user_id)
    try:
        subprocess.Popen(
            ["sudo", "systemctl", "start", "mrms-emp-import.service"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except Exception as e:
        raise HTTPException(500, f"trigger failed: {e}")
    return {"message": "triggered"}
