"""회원·역할 관리 — superadmin 전용."""
from __future__ import annotations

import os
from typing import Literal

import psycopg
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from mrms.api.deps import db_conn
from mrms.auth.roles import require_superadmin

router = APIRouter(prefix="/api/admin/users", tags=["admin_users"])


@router.get("")
def list_users(
    _su: str = Depends(require_superadmin),
    conn: psycopg.Connection = Depends(db_conn),
) -> dict:
    """전체 유저 목록(역할 포함). createdAt 오름차순."""
    admin_email = os.environ.get("ADMIN_EMAIL", "").strip().lower()
    with conn.cursor() as cur:
        cur.execute(
            '''SELECT u.id, u.email, u.nickname, u.role, u."createdAt",
                      count(ut."trackId") AS track_count,
                      (SELECT o.platform FROM "UserOAuth" o
                       WHERE o."userId" = u.id
                       ORDER BY CASE o.platform
                                  WHEN 'tidal' THEN 0 WHEN 'spotify' THEN 1
                                  WHEN 'youtube' THEN 2 ELSE 3 END
                       LIMIT 1) AS primary_platform
               FROM "User" u
               LEFT JOIN "UserTrack" ut ON ut."userId" = u.id
               GROUP BY u.id
               ORDER BY u."createdAt" ASC'''
        )
        rows = cur.fetchall()
    users = []
    for r in rows:
        uid, email, nickname, role, created_at, track_count, primary = r
        eff = (
            "superadmin"
            if admin_email and (email or "").strip().lower() == admin_email
            else (role if role in ("user", "admin", "superadmin") else "user")
        )
        users.append({
            "user_id": uid, "email": email, "nickname": nickname, "role": eff,
            "created_at": created_at.isoformat() if created_at else None,
            "track_count": track_count, "primary_platform": primary,
        })
    return {"users": users}


class RoleUpdate(BaseModel):
    role: Literal["admin", "user"]


@router.patch("/{target_id}/role")
def set_role(
    target_id: str,
    body: RoleUpdate,
    _su: str = Depends(require_superadmin),
    conn: psycopg.Connection = Depends(db_conn),
) -> dict:
    """대상 유저의 DB role 변경(admin↔user). env 루트는 변경 불가."""
    admin_email = os.environ.get("ADMIN_EMAIL", "").strip().lower()
    with conn.cursor() as cur:
        cur.execute('SELECT email FROM "User" WHERE id = %s', (target_id,))
        row = cur.fetchone()
    if not row:
        raise HTTPException(404, "user not found")
    if admin_email and (row[0] or "").strip().lower() == admin_email:
        raise HTTPException(403, "cannot change root admin")
    with conn.cursor() as cur:
        cur.execute('UPDATE "User" SET role = %s WHERE id = %s', (body.role, target_id))
    conn.commit()
    return {"user_id": target_id, "role": body.role}
