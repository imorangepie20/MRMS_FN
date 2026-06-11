"""Admin EMP API — stats / runs / trigger."""
from __future__ import annotations

import os
import subprocess

import psycopg
from fastapi import APIRouter, Depends, HTTPException
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
from mrms.emp.flo import SOURCES_SETTING_KEY as FLO_SOURCES_SETTING_KEY
from mrms.emp.spotify import SOURCES_SETTING_KEY as SPOTIFY_SOURCES_SETTING_KEY
from mrms.emp.tidal import SOURCES_SETTING_KEY, TOKEN_SETTING_KEY
from mrms.emp.vibe import SOURCES_SETTING_KEY as VIBE_SOURCES_SETTING_KEY

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
