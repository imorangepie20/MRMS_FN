"""Tidal OAuth token endpoints — 브라우저 SDK용 token 전달 + refresh."""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

import httpx
import psycopg
from fastapi import APIRouter, Depends, HTTPException

from mrms.api.deps import db_conn, get_default_user_email
from mrms.auth.tidal import TidalOAuthClient
from mrms.db.user_track import get_oauth, get_or_create_user, upsert_oauth


router = APIRouter(prefix="/api/auth/tidal", tags=["auth"])


def _client() -> TidalOAuthClient:
    return TidalOAuthClient(
        client_id=os.environ["TIDAL_CLIENT_ID"],
        client_secret=os.environ["TIDAL_CLIENT_SECRET"],
        redirect_uri=os.environ.get("TIDAL_REDIRECT_URI", ""),
        scopes=[],  # refresh엔 불필요
    )


async def _check_premium(access_token: str) -> bool | None:
    """Tidal /v2/users/me에서 subscriptionType 확인. 실패 시 None."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as http:
            r = await http.get(
                "https://openapi.tidal.com/v2/users/me",
                params={"countryCode": "KR"},
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "application/vnd.api+json",
                },
            )
        if r.status_code != 200:
            return None
        body = r.json()
        data = body.get("data") or {}
        attrs = data.get("attributes") or {}
        sub_type = attrs.get("subscriptionType")
        # 비-Free면 Premium (HiFi / HiFi Plus / Tidal Premium 등)
        if sub_type and sub_type != "FREE":
            return True
        if sub_type == "FREE":
            return False
        return None
    except Exception:
        return None


@router.get("/token")
async def get_token(conn: psycopg.Connection = Depends(db_conn)) -> dict:
    """현재 유효한 access_token 반환. 만료 임박 시 자동 refresh."""
    email = get_default_user_email()
    user_id = get_or_create_user(conn, email)
    conn.commit()
    oauth = get_oauth(conn, user_id, "tidal")
    if not oauth:
        raise HTTPException(404, "Tidal OAuth not configured. Run scripts/08_onboard_tidal.py")

    access_token = oauth["accessToken"]
    expires_at = oauth["expiresAt"]

    # 60초 이내 만료면 refresh
    if expires_at and expires_at - timedelta(seconds=60) < datetime.now(timezone.utc):
        tokens = await _client().refresh_access_token(oauth["refreshToken"])
        access_token = tokens["access_token"]
        new_refresh = tokens.get("refresh_token", oauth["refreshToken"])
        new_expires = datetime.now(timezone.utc) + timedelta(seconds=tokens["expires_in"])
        scope = tokens.get("scope", "")
        granted = scope.split() if isinstance(scope, str) else list(scope)
        if not granted:
            granted = list(oauth.get("scope", []))
        upsert_oauth(
            conn, user_id=user_id, platform="tidal",
            access_token=access_token, refresh_token=new_refresh,
            expires_at=new_expires, scopes=granted,
        )
        conn.commit()
        expires_at = new_expires

    premium = await _check_premium(access_token)
    return {
        "access_token": access_token,
        "expires_at": expires_at.isoformat() if expires_at else None,
        "premium": premium,
    }


@router.post("/refresh")
async def refresh_token(conn: psycopg.Connection = Depends(db_conn)) -> dict:
    """명시적 refresh — 새 access_token 발급."""
    email = get_default_user_email()
    user_id = get_or_create_user(conn, email)
    conn.commit()
    oauth = get_oauth(conn, user_id, "tidal")
    if not oauth:
        raise HTTPException(404, "Tidal OAuth not configured")

    tokens = await _client().refresh_access_token(oauth["refreshToken"])
    new_access = tokens["access_token"]
    new_refresh = tokens.get("refresh_token", oauth["refreshToken"])
    new_expires = datetime.now(timezone.utc) + timedelta(seconds=tokens["expires_in"])
    scope = tokens.get("scope", "")
    granted = scope.split() if isinstance(scope, str) else list(scope)
    if not granted:
        granted = list(oauth.get("scope", []))
    upsert_oauth(
        conn, user_id=user_id, platform="tidal",
        access_token=new_access, refresh_token=new_refresh,
        expires_at=new_expires, scopes=granted,
    )
    conn.commit()
    return {
        "access_token": new_access,
        "expires_at": new_expires.isoformat(),
    }
