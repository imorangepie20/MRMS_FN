"""Admin EMP API — stats / runs / trigger."""
from __future__ import annotations

import os
import subprocess

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

import psycopg

from mrms.api.deps import db_conn, get_current_user_id
from mrms.db.emp import get_emp_stats, list_recent_runs


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
    limit: int = 50,
    user_id: str = Depends(get_current_user_id),
    conn: psycopg.Connection = Depends(db_conn),
):
    _require_admin(conn, user_id)
    return {"runs": list_recent_runs(conn, limit=limit)}


class TriggerBody(BaseModel):
    platform: str | None = "all"


@router.post("/trigger")
def admin_trigger(
    body: TriggerBody,
    user_id: str = Depends(get_current_user_id),
    conn: psycopg.Connection = Depends(db_conn),
):
    _require_admin(conn, user_id)
    try:
        subprocess.Popen(
            ["sudo", "systemctl", "start", "mrms-emp-import.service"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except Exception as e:
        raise HTTPException(500, f"trigger failed: {e}")
    return {"message": "triggered", "platform": body.platform}
