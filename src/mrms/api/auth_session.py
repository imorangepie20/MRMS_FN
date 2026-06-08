"""Tidal Device Code OAuth → AuthSession cookie."""
from __future__ import annotations

import base64
import json
import os
import uuid
from datetime import datetime, timedelta, timezone

import httpx
import psycopg
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from mrms.api.deps import db_conn
from mrms.db.user_track import get_or_create_user, upsert_oauth


router = APIRouter(prefix="/api/auth", tags=["auth"])

TIDAL_DEVICE_AUTH_URL = "https://auth.tidal.com/v1/oauth2/device_authorization"
TIDAL_TOKEN_URL = "https://auth.tidal.com/v1/oauth2/token"
TIDAL_SCOPES = "r_usr w_usr w_sub"
SESSION_COOKIE_NAME = "mrms_session"
SESSION_MAX_AGE = 30 * 24 * 60 * 60  # 30 days


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
    request: Request,
    response: Response,
    conn: psycopg.Connection = Depends(db_conn),
) -> dict:
    """Tidal token endpoint 폴링. 성공 시 AuthSession 생성 + cookie set."""
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

    tokens = r.json()
    access_token = tokens["access_token"]
    refresh_token = tokens.get("refresh_token", "")
    expires_in = tokens.get("expires_in", 86400)

    # JWT payload에서 Tidal uid 추출
    parts = access_token.split(".")
    payload_b64 = parts[1] + "=" * (4 - len(parts[1]) % 4)
    payload = json.loads(base64.urlsafe_b64decode(payload_b64))
    tidal_uid = str(payload["uid"])
    email = f"tidal-{tidal_uid}@auto.local"

    user_id = get_or_create_user(conn, email)
    conn.commit()

    token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
    upsert_oauth(
        conn,
        user_id=user_id,
        platform="tidal",
        access_token=access_token,
        refresh_token=refresh_token,
        expires_at=token_expires_at,
        scopes=TIDAL_SCOPES.split(),
    )

    # AuthSession 생성 — 기존 세션 모두 제거 후 신규 1개
    session_id = uuid.uuid4().hex
    session_expires = datetime.now(timezone.utc) + timedelta(seconds=SESSION_MAX_AGE)
    with conn.cursor() as cur:
        cur.execute('DELETE FROM "AuthSession" WHERE "userId" = %s', (user_id,))
        cur.execute(
            'INSERT INTO "AuthSession" (id, "userId", "expiresAt", "userAgent") VALUES (%s, %s, %s, %s)',
            (session_id, user_id, session_expires, request.headers.get("user-agent")),
        )

    # has_mrt 체크 (기존 PlaylistHistory rows)
    with conn.cursor() as cur:
        cur.execute('SELECT COUNT(*) FROM "PlaylistHistory" WHERE "userId" = %s', (user_id,))
        has_mrt = cur.fetchone()[0] > 0
    conn.commit()

    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_id,
        httponly=True,
        samesite="lax",
        max_age=SESSION_MAX_AGE,
        secure=False,  # production은 True
    )
    return {"status": "success", "has_mrt": has_mrt}
