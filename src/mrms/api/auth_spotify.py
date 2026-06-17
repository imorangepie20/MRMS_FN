"""Spotify Authorization Code OAuth endpoints."""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import quote, unquote

import httpx
import psycopg
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse

from mrms.api.deps import db_conn, get_current_user_id
from mrms.auth.spotify import SpotifyOAuthClient, SpotifyOAuthError
from mrms.db.user_track import get_oauth, upsert_oauth

router = APIRouter(prefix="/api/auth/spotify", tags=["auth"])


SPOTIFY_SCOPES = [
    "user-read-email",
    "user-read-private",
    "user-library-read",
    "playlist-read-private",
    "streaming",
    "user-read-playback-state",
    "user-modify-playback-state",
]

SESSION_COOKIE_NAME = "mrms_session"
SESSION_MAX_AGE = 30 * 24 * 60 * 60  # 30 days
OAUTH_STATE_COOKIE = "mrms_oauth_state"
OAUTH_NEXT_COOKIE = "mrms_oauth_next"
OAUTH_STATE_MAX_AGE = 600  # 10 min

SPOTIFY_API_BASE = "https://api.spotify.com/v1"


def _client() -> SpotifyOAuthClient:
    return SpotifyOAuthClient(
        client_id=os.environ["SPOTIFY_CLIENT_ID"],
        client_secret=os.environ["SPOTIFY_CLIENT_SECRET"],
        # 기본값은 prod HTTPS — env 누락 시 http://localhost로 튕겨 주소창 "위험"이
        # 뜨던 폭탄 제거. 로컬 dev는 .env로 localhost 콜백을 명시 오버라이드.
        redirect_uri=os.environ.get(
            "SPOTIFY_REDIRECT_URI",
            "https://mrms.approid.team/api/auth/spotify/callback",
        ),
        scopes=SPOTIFY_SCOPES,
    )


def _safe_next(next_url: str | None) -> str | None:
    """오픈 리다이렉트 방지 — 사이트 내부 상대 경로(/...)만 허용, //는 거부."""
    if next_url and next_url.startswith("/") and not next_url.startswith("//"):
        return next_url
    return None


@router.get("/authorize")
def authorize(
    next_url: str | None = Query(default=None, alias="next"),
) -> RedirectResponse:
    """state 생성 + Spotify authorize URL로 302 redirect.

    next=인증 후 돌아올 사이트 내부 경로(예: /p/{token}). 공유 페이지에서 연결 시
    신규·기존 회원 모두 원래 페이지로 복귀시킨다.
    """
    state = uuid.uuid4().hex
    url = _client().build_authorize_url(state)
    resp = RedirectResponse(url=url, status_code=307)
    resp.set_cookie(
        key=OAUTH_STATE_COOKIE,
        value=state,
        httponly=True,
        samesite="lax",
        max_age=OAUTH_STATE_MAX_AGE,
        secure=False,
    )
    safe_next = _safe_next(next_url)
    if safe_next:
        # URL-encode — '/'가 들어가면 Set-Cookie가 값을 따옴표로 감싸므로 인코딩해 저장.
        resp.set_cookie(
            key=OAUTH_NEXT_COOKIE,
            value=quote(safe_next, safe=""),
            httponly=True,
            samesite="lax",
            max_age=OAUTH_STATE_MAX_AGE,
            secure=False,
        )
    return resp


@router.get("/callback")
async def callback(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    conn: psycopg.Connection = Depends(db_conn),
) -> RedirectResponse:
    """Spotify가 redirect한 콜백 처리."""
    if error:
        # access_denied → "denied" (사용자가 거부), 그 외는 그대로 전달
        suffix = "denied" if error == "access_denied" else error
        resp = RedirectResponse(url=f"/login?error=spotify_{suffix}", status_code=307)
        resp.delete_cookie(OAUTH_STATE_COOKIE)
        return resp

    if not code or not state:
        raise HTTPException(400, "code/state required")

    expected_state = request.cookies.get(OAUTH_STATE_COOKIE)
    if not expected_state or expected_state != state:
        raise HTTPException(400, "state mismatch (CSRF protection)")

    # code → tokens
    try:
        tokens = await _client().exchange_code(code)
    except SpotifyOAuthError:
        resp = RedirectResponse(url="/login?error=spotify_failed", status_code=307)
        resp.delete_cookie(OAUTH_STATE_COOKIE)
        return resp

    access_token = tokens["access_token"]
    refresh_token = tokens.get("refresh_token", "")
    expires_in = tokens.get("expires_in", 3600)
    scope_str = tokens.get("scope", "")
    granted = scope_str.split() if scope_str else SPOTIFY_SCOPES

    # Spotify /me 호출 — email 받기
    async with httpx.AsyncClient(timeout=10.0) as http:
        me_r = await http.get(
            f"{SPOTIFY_API_BASE}/me",
            headers={"Authorization": f"Bearer {access_token}"},
        )
    if me_r.status_code != 200:
        resp = RedirectResponse(url="/login?error=spotify_me_failed", status_code=307)
        resp.delete_cookie(OAUTH_STATE_COOKIE)
        return resp
    me = me_r.json()
    # 링크 모드 — 현재 세션 유저에 spotify 연결(유저/세션 생성 안 함).
    session_id_cookie = request.cookies.get(SESSION_COOKIE_NAME)
    user_id: str | None = None
    if session_id_cookie:
        with conn.cursor() as cur:
            cur.execute('SELECT "userId", "expiresAt" FROM "AuthSession" WHERE id = %s',
                        (session_id_cookie,))
            srow = cur.fetchone()
        if srow:
            su, se = srow
            if se is not None and se.tzinfo is None:
                se = se.replace(tzinfo=timezone.utc)
            if se is None or se >= datetime.now(timezone.utc):
                user_id = su
    if user_id is None:
        resp = RedirectResponse(url="/login?error=spotify_login_required", status_code=307)
        resp.delete_cookie(OAUTH_STATE_COOKIE)
        resp.delete_cookie(OAUTH_NEXT_COOKIE)
        return resp

    display_name = me.get("display_name")
    country = me.get("country")
    with conn.cursor() as cur:
        cur.execute(
            'UPDATE "User" SET "displayName" = COALESCE("displayName", %s), '
            'country = COALESCE(country, %s) WHERE id = %s',
            (display_name, country, user_id),
        )
    conn.commit()

    token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
    upsert_oauth(
        conn, user_id=user_id, platform="spotify",
        access_token=access_token, refresh_token=refresh_token,
        expires_at=token_expires_at, scopes=granted,
    )
    conn.commit()

    next_cookie = request.cookies.get(OAUTH_NEXT_COOKIE)
    next_target = _safe_next(unquote(next_cookie)) if next_cookie else None
    target = next_target or "/onboarding"
    resp = RedirectResponse(url=target, status_code=307)
    resp.delete_cookie(OAUTH_STATE_COOKIE)
    resp.delete_cookie(OAUTH_NEXT_COOKIE)
    return resp


@router.get("/token")
async def get_token(
    user_id: str = Depends(get_current_user_id),
    conn: psycopg.Connection = Depends(db_conn),
) -> dict:
    """현재 user의 Spotify access_token 반환 (만료 임박 시 refresh)."""
    oauth = get_oauth(conn, user_id, "spotify")
    if not oauth:
        raise HTTPException(404, "Spotify OAuth not configured. Sign in with Spotify")

    access_token = oauth["accessToken"]
    expires_at = oauth["expiresAt"]

    if expires_at and expires_at - timedelta(seconds=60) < datetime.now(timezone.utc):
        try:
            tokens = await _client().refresh_access_token(oauth["refreshToken"])
        except SpotifyOAuthError as e:
            raise HTTPException(401, f"Spotify refresh failed: {e}")
        access_token = tokens["access_token"]
        new_refresh = tokens.get("refresh_token", oauth["refreshToken"])
        new_expires = datetime.now(timezone.utc) + timedelta(seconds=tokens["expires_in"])
        scope_str = tokens.get("scope", "")
        granted = scope_str.split() if scope_str else list(oauth.get("scope", []))
        upsert_oauth(
            conn, user_id=user_id, platform="spotify",
            access_token=access_token, refresh_token=new_refresh,
            expires_at=new_expires, scopes=granted,
        )
        conn.commit()
        expires_at = new_expires

    return {
        "access_token": access_token,
        "expires_at": expires_at.isoformat() if expires_at else None,
    }
