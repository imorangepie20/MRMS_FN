"""Tidal Device Code OAuth → AuthSession cookie."""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

import httpx
import psycopg
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from mrms.api.deps import db_conn, get_current_user_id, get_current_user_id_optional
from mrms.db.user_track import resolve_primary_platform, upsert_oauth

router = APIRouter(prefix="/api/auth", tags=["auth"])

TIDAL_DEVICE_AUTH_URL = "https://auth.tidal.com/v1/oauth2/device_authorization"
TIDAL_TOKEN_URL = "https://auth.tidal.com/v1/oauth2/token"
TIDAL_SCOPES = "r_usr w_usr w_sub"
SESSION_COOKIE_NAME = "mrms_session"


class DeviceCodePollRequest(BaseModel):
    device_code: str


@router.post("/tidal/device-code/init")
async def device_code_init() -> dict:
    """Tidal device_authorization → user_code + verification_uri 반환."""
    client_id = os.environ["TIDAL_CLIENT_ID"]
    async with httpx.AsyncClient(timeout=10.0) as http:
        r = await http.post(
            TIDAL_DEVICE_AUTH_URL,
            data={"client_id": client_id, "scope": TIDAL_SCOPES},
        )
    if r.status_code != 200:
        raise HTTPException(r.status_code, f"Tidal device_authorization failed: {r.text[:200]}")
    data = r.json()
    verification_uri = data.get("verificationUri") or ""
    if verification_uri and not verification_uri.startswith("http"):
        verification_uri = f"https://{verification_uri}"
    verification_uri_complete = (
        data.get("verificationUriComplete")
        or f"{verification_uri}?code={data['userCode']}"
    )
    if verification_uri_complete and not verification_uri_complete.startswith("http"):
        verification_uri_complete = f"https://{verification_uri_complete}"
    return {
        "user_code": data["userCode"],
        "device_code": data["deviceCode"],
        "verification_uri_complete": verification_uri_complete,
        "expires_in": data.get("expiresIn", 300),
        "interval": data.get("interval", 5),
    }


@router.post("/tidal/device-code/poll")
async def device_code_poll(
    body: DeviceCodePollRequest,
    user_id: str | None = Depends(get_current_user_id_optional),
    conn: psycopg.Connection = Depends(db_conn),
) -> dict:
    """Tidal token endpoint 폴링. 성공 시 현재 세션 유저에 tidal 연결(링크 모드)."""
    client_id = os.environ["TIDAL_CLIENT_ID"]
    client_secret = os.environ["TIDAL_CLIENT_SECRET"]

    async with httpx.AsyncClient(timeout=10.0) as http:
        r = await http.post(
            TIDAL_TOKEN_URL,
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "device_code": body.device_code,
                "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
                "scope": TIDAL_SCOPES,
            },
        )

    if r.status_code == 400:
        err = r.json().get("error", "")
        if err in ("authorization_pending", "slow_down"):
            return {"status": "pending"}
        if err == "expired_token":
            return {"status": "expired"}
        return {"status": "error", "detail": err}

    if r.status_code != 200:
        raise HTTPException(r.status_code, f"Tidal token exchange failed: {r.text[:200]}")

    if user_id is None:
        return {"status": "error", "detail": "login_required"}

    tokens = r.json()
    access_token = tokens["access_token"]
    refresh_token = tokens.get("refresh_token", "")
    expires_in = tokens.get("expires_in", 86400)

    token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
    upsert_oauth(
        conn, user_id=user_id, platform="tidal",
        access_token=access_token, refresh_token=refresh_token,
        expires_at=token_expires_at, scopes=TIDAL_SCOPES.split(),
    )

    with conn.cursor() as cur:
        cur.execute('SELECT COUNT(*) FROM "PlaylistHistory" WHERE "userId" = %s', (user_id,))
        has_mrt = cur.fetchone()[0] > 0
    conn.commit()
    return {"status": "success", "has_mrt": has_mrt}


@router.get("/me")
def me(
    user_id: str = Depends(get_current_user_id),
    conn: psycopg.Connection = Depends(db_conn),
) -> dict:
    """현재 user 정보 반환."""
    with conn.cursor() as cur:
        cur.execute(
            'SELECT email, nickname, "displayName", country FROM "User" WHERE id = %s',
            (user_id,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "User not found")
        email, nickname, display_name, country = row
        cur.execute('SELECT COUNT(*) FROM "UserPersona" WHERE "userId" = %s', (user_id,))
        personas_count = cur.fetchone()[0]
        cur.execute('SELECT COUNT(*) FROM "UserTrack" WHERE "userId" = %s', (user_id,))
        tracks_count = cur.fetchone()[0]
    # primary는 저장값(User.primaryPlatform) 대신 현재 연결된 플랫폼에서 계산 —
    # 구독(Tidal/Spotify) 연결/해제가 자동 반영. 아무것도 연결 안 됐으면 None
    # (프론트는 미연결이면 재생 안 함).
    primary_platform = resolve_primary_platform(conn, user_id)
    return {
        "user_id": user_id,
        "email": email,
        "nickname": nickname,
        "displayName": display_name,
        "country": country,
        "personas_count": personas_count,
        "user_tracks_count": tracks_count,
        "primary_platform": primary_platform,
    }


@router.post("/logout")
def logout(
    request: Request,
    response: Response,
    conn: psycopg.Connection = Depends(db_conn),
) -> dict:
    """AuthSession 삭제 + cookie clear."""
    session_id = request.cookies.get(SESSION_COOKIE_NAME)
    if session_id:
        with conn.cursor() as cur:
            cur.execute('DELETE FROM "AuthSession" WHERE id = %s', (session_id,))
        conn.commit()
    response.delete_cookie(SESSION_COOKIE_NAME)
    return {"status": "ok"}
