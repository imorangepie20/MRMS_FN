"""Tidal OAuth token endpoints — 브라우저 SDK용 token 전달 + refresh + 재생 proxy."""
from __future__ import annotations

import base64
import json
import os
from datetime import datetime, timedelta, timezone

import httpx
import psycopg
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from mrms.api.deps import db_conn, get_current_user_id
from mrms.auth.tidal import TidalOAuthClient
from mrms.db.user_track import get_oauth, upsert_oauth


router = APIRouter(prefix="/api/auth/tidal", tags=["auth"])
playback_router = APIRouter(prefix="/api/playback/tidal", tags=["playback"])


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
async def get_token(
    user_id: str = Depends(get_current_user_id),
    conn: psycopg.Connection = Depends(db_conn),
) -> dict:
    """현재 유효한 access_token 반환. 만료 임박 시 자동 refresh."""
    oauth = get_oauth(conn, user_id, "tidal")
    if not oauth:
        raise HTTPException(404, "Tidal OAuth not configured. Sign in via /login")

    access_token = await _get_access_token(user_id, conn)
    # _get_access_token이 refresh했을 수 있으므로 expires_at 재조회
    oauth = get_oauth(conn, user_id, "tidal")
    expires_at = oauth["expiresAt"] if oauth else None
    premium = await _check_premium(access_token)
    return {
        "access_token": access_token,
        "expires_at": expires_at.isoformat() if expires_at else None,
        "premium": premium,
    }


@router.post("/refresh")
async def refresh_token(
    user_id: str = Depends(get_current_user_id),
    conn: psycopg.Connection = Depends(db_conn),
) -> dict:
    """명시적 refresh — 새 access_token 발급."""
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


async def _get_access_token(user_id: str, conn: psycopg.Connection) -> str:
    """Helper — 주어진 user_id의 유효 access_token. 만료 임박 시 자동 refresh + DB 저장."""
    oauth = get_oauth(conn, user_id, "tidal")
    if not oauth:
        raise HTTPException(404, "Tidal OAuth not configured. Sign in via /login")

    access_token = oauth["accessToken"]
    expires_at = oauth["expiresAt"]

    # 60초 이내 만료 → refresh
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
    return access_token


@playback_router.get("/stream/{track_id}")
async def stream_track(
    track_id: str,
    user_id: str = Depends(get_current_user_id),
    conn: psycopg.Connection = Depends(db_conn),
):
    """Tidal 트랙을 직접 stream — SDK 우회.

    1. /v1/tracks/{id}/playbackinfo 호출 → manifest 받음
    2. manifest 디코드 → audio URL 추출
    3. 그 URL을 stream proxy
    """
    access_token = await _get_access_token(user_id, conn)

    # 1. playbackinfo 호출
    async with httpx.AsyncClient(timeout=10.0) as http:
        info_r = await http.get(
            f"https://api.tidal.com/v1/tracks/{track_id}/playbackinfo",
            params={
                "audioquality": "HIGH",       # LOW / HIGH / LOSSLESS / HI_RES_LOSSLESS
                "playbackmode": "STREAM",
                "assetpresentation": "FULL",
            },
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if info_r.status_code != 200:
            raise HTTPException(info_r.status_code, f"playbackinfo failed: {info_r.text[:200]}")
        info = info_r.json()

    # 2. manifest 디코드 (base64-encoded JSON)
    manifest_b64 = info.get("manifest")
    if not manifest_b64:
        raise HTTPException(500, f"no manifest in playbackinfo response: {list(info.keys())}")
    try:
        manifest_json = json.loads(base64.b64decode(manifest_b64).decode("utf-8"))
    except Exception as e:
        raise HTTPException(500, f"manifest decode failed: {e}")

    # 3. URL 추출 — urls[0] 또는 url
    audio_url = None
    if "urls" in manifest_json and manifest_json["urls"]:
        audio_url = manifest_json["urls"][0]
    elif "url" in manifest_json:
        audio_url = manifest_json["url"]
    if not audio_url:
        raise HTTPException(500, f"no audio URL in manifest: {list(manifest_json.keys())}")

    # 4. mime type 추측
    codec = manifest_json.get("codecs") or manifest_json.get("mimeType") or ""
    codec_l = codec.lower()
    if "flac" in codec_l:
        media_type = "audio/flac"
    elif "mp4" in codec_l or "m4a" in codec_l or "aac" in codec_l:
        media_type = "audio/mp4"
    else:
        media_type = "audio/mpeg"

    # 5. stream proxy — Tidal CDN에서 받고 그대로 흘려보냄
    async def stream_audio():
        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream(
                "GET",
                audio_url,
                headers={"Authorization": f"Bearer {access_token}"},
            ) as resp:
                if resp.status_code != 200:
                    body = await resp.aread()
                    raise HTTPException(resp.status_code, f"CDN fetch failed: {body[:200]}")
                async for chunk in resp.aiter_bytes(chunk_size=8192):
                    yield chunk

    return StreamingResponse(stream_audio(), media_type=media_type)
