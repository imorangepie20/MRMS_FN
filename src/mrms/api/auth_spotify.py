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
from mrms.db.user_track import get_oauth, get_or_create_user, upsert_oauth

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
        redirect_uri=os.environ.get(
            "SPOTIFY_REDIRECT_URI",
            "http://localhost:8000/api/auth/spotify/callback",
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
    email = me.get("email") or f"spotify-{me.get('id')}@auto.local"
    display_name = me.get("display_name")
    country = me.get("country")

    # User upsert
    # primaryPlatform: 새 user (UserOAuth(tidal) 없음)면 'spotify'로 설정,
    # 기존 Tidal 사용자가 같은 email로 들어온 경우 primaryPlatform 그대로 유지.
    # NOTE: primary는 이제 읽을 때 resolve_primary_platform로 계산하므로
    # 이 저장값 세팅은 vestigial(무해). 남겨도 무방.
    user_id = get_or_create_user(conn, email)
    with conn.cursor() as cur:
        cur.execute(
            '''UPDATE "User" SET
                 "displayName" = COALESCE("displayName", %s),
                 country = COALESCE(country, %s),
                 "primaryPlatform" = CASE
                   WHEN "primaryPlatform" = 'tidal'
                        AND NOT EXISTS (
                          SELECT 1 FROM "UserOAuth"
                          WHERE "userId" = %s AND platform = 'tidal'
                        )
                   THEN %s
                   ELSE "primaryPlatform"
                 END
               WHERE id = %s''',
            (display_name, country, user_id, "spotify", user_id),
        )
    conn.commit()

    # UserOAuth upsert
    token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
    upsert_oauth(
        conn, user_id=user_id, platform="spotify",
        access_token=access_token, refresh_token=refresh_token,
        expires_at=token_expires_at, scopes=granted,
    )

    # AuthSession 생성 (기존 세션은 단일 세션 정책상 삭제)
    session_id = uuid.uuid4().hex
    session_expires = datetime.now(timezone.utc) + timedelta(seconds=SESSION_MAX_AGE)
    with conn.cursor() as cur:
        cur.execute(
            'DELETE FROM "AuthSession" WHERE "userId" = %s',
            (user_id,),
        )
        cur.execute(
            'INSERT INTO "AuthSession" (id, "userId", "expiresAt", "userAgent") VALUES (%s, %s, %s, %s)',
            (session_id, user_id, session_expires, request.headers.get("user-agent")),
        )

    # has_mrt 체크
    with conn.cursor() as cur:
        cur.execute('SELECT COUNT(*) FROM "PlaylistHistory" WHERE "userId" = %s', (user_id,))
        has_mrt = cur.fetchone()[0] > 0
    conn.commit()

    # next 쿠키가 있으면 그 페이지로 복귀(공유 페이지 등), 없으면 기존 기본 목적지.
    next_cookie = request.cookies.get(OAUTH_NEXT_COOKIE)
    next_target = _safe_next(unquote(next_cookie)) if next_cookie else None
    target = next_target or ("/mrt" if has_mrt else "/onboarding")
    resp = RedirectResponse(url=target, status_code=307)
    resp.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_id,
        httponly=True,
        samesite="lax",
        max_age=SESSION_MAX_AGE,
        secure=False,
    )
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
