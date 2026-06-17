"""역할 기반 관리자 게이팅. 이메일==ADMIN_EMAIL은 항상 superadmin(env 루트)."""
from __future__ import annotations

import os

import psycopg
from fastapi import Depends, HTTPException

from mrms.api.deps import db_conn, get_current_user_id

ROLES = ("user", "admin", "superadmin")


def get_effective_role(conn: psycopg.Connection, user_id: str) -> str:
    """email==ADMIN_EMAIL이면 'superadmin'(env 루트, 락아웃 불가). 아니면 DB role."""
    admin_email = os.environ.get("ADMIN_EMAIL", "").strip().lower()
    with conn.cursor() as cur:
        cur.execute('SELECT email, role FROM "User" WHERE id = %s', (user_id,))
        row = cur.fetchone()
    if not row:
        raise HTTPException(404, "User not found")
    email, role = row
    if admin_email and (email or "").strip().lower() == admin_email:
        return "superadmin"
    return role if role in ROLES else "user"


def require_admin(
    user_id: str = Depends(get_current_user_id),
    conn: psycopg.Connection = Depends(db_conn),
) -> str:
    """admin 또는 superadmin이 아니면 403. 통과 시 user_id 반환."""
    if get_effective_role(conn, user_id) not in ("admin", "superadmin"):
        raise HTTPException(403, "admin required")
    return user_id


def require_superadmin(
    user_id: str = Depends(get_current_user_id),
    conn: psycopg.Connection = Depends(db_conn),
) -> str:
    """superadmin이 아니면 403. 통과 시 user_id 반환."""
    if get_effective_role(conn, user_id) != "superadmin":
        raise HTTPException(403, "superadmin required")
    return user_id
