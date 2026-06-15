"""YouTube (Google) Authorization Code + PKCE OAuth endpoints.

auth_spotify.py 미러. 차이점:
- PKCE: /authorize에서 code_verifier/challenge 생성, code_verifier를 httponly
  쿠키로 저장 → /callback에서 read 후 token 교환에 사용 + 쿠키 삭제.
- 사용자 식별: Spotify는 /me email, YouTube는 oauth2 userinfo (이메일 없으면
  google id 기반 합성 email).
- /import: web에서 라이브러리 import를 트리거하는 엔드포인트 (Tidal은 CLI).
"""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timedelta, timezone

import httpx
import psycopg
from fastapi import APIRouter, Body, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse

from mrms.api.deps import db_conn, get_current_user_id
from mrms.auth.youtube import YouTubeOAuthClient, YouTubeOAuthError, gen_pkce
from mrms.db.user_track import get_oauth, get_or_create_user, upsert_oauth
from mrms.sync.youtube_importer import YouTubeImporter, import_all

router = APIRouter(prefix="/api/auth/youtube", tags=["auth"])


YOUTUBE_SCOPES = [
    "https://www.googleapis.com/auth/youtube.readonly",
    "https://www.googleapis.com/auth/userinfo.profile",
]

SESSION_COOKIE_NAME = "mrms_session"
SESSION_MAX_AGE = 30 * 24 * 60 * 60  # 30 days
OAUTH_STATE_COOKIE = "mrms_yt_oauth_state"
OAUTH_VERIFIER_COOKIE = "mrms_yt_pkce_verifier"
OAUTH_STATE_MAX_AGE = 600  # 10 min


def _cred(*names: str) -> str:
    """env에서 첫 비어있지 않은 값 — YOUTUBE_* 우선, GOOGLE_* 폴백.

    OAuth client creds를 GOOGLE_CLIENT_ID/SECRET에 둬도 동작 (키 이름은 임의)."""
    for name in names:
        v = (os.environ.get(name) or "").strip()
        if v:
            return v
    return ""


def _client() -> YouTubeOAuthClient:
    return YouTubeOAuthClient(
        client_id=_cred("YOUTUBE_CLIENT_ID", "GOOGLE_CLIENT_ID"),
        client_secret=_cred("YOUTUBE_CLIENT_SECRET", "GOOGLE_CLIENT_SECRET"),
        # 기본값 prod HTTPS — env 누락 시 localhost 폴백(주소창 "위험") 방지. dev는 .env 오버라이드.
        redirect_uri=os.environ.get(
            "YOUTUBE_REDIRECT_URI",
            "https://mrms.approid.team/api/auth/youtube/callback",
        ),
        scopes=YOUTUBE_SCOPES,
    )


@router.get("/authorize")
def authorize() -> RedirectResponse:
    """state + PKCE 생성 → state·code_verifier 쿠키 set → Google authorize 302."""
    state = uuid.uuid4().hex
    code_verifier, code_challenge = gen_pkce()
    url = _client().build_authorize_url(state, code_challenge)
    resp = RedirectResponse(url=url, status_code=307)
    resp.set_cookie(
        key=OAUTH_STATE_COOKIE,
        value=state,
        httponly=True,
        samesite="lax",
        max_age=OAUTH_STATE_MAX_AGE,
        secure=False,
    )
    resp.set_cookie(
        key=OAUTH_VERIFIER_COOKIE,
        value=code_verifier,
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
    """Google이 redirect한 콜백 처리."""
    if error:
        suffix = "denied" if error == "access_denied" else error
        resp = RedirectResponse(url=f"/login?error=youtube_{suffix}", status_code=307)
        resp.delete_cookie(OAUTH_STATE_COOKIE)
        resp.delete_cookie(OAUTH_VERIFIER_COOKIE)
        return resp

    if not code or not state:
        raise HTTPException(400, "code/state required")

    expected_state = request.cookies.get(OAUTH_STATE_COOKIE)
    if not expected_state or expected_state != state:
        raise HTTPException(400, "state mismatch (CSRF protection)")

    code_verifier = request.cookies.get(OAUTH_VERIFIER_COOKIE)
    if not code_verifier:
        raise HTTPException(400, "PKCE verifier missing")

    # code → tokens
    try:
        tokens = await _client().exchange_code(code, code_verifier)
    except YouTubeOAuthError:
        resp = RedirectResponse(url="/login?error=youtube_failed", status_code=307)
        resp.delete_cookie(OAUTH_STATE_COOKIE)
        resp.delete_cookie(OAUTH_VERIFIER_COOKIE)
        return resp

    access_token = tokens["access_token"]
    refresh_token = tokens.get("refresh_token", "")
    expires_in = tokens.get("expires_in", 3600)
    scope_str = tokens.get("scope", "")
    granted = scope_str.split() if scope_str else YOUTUBE_SCOPES

    # userinfo로 사용자 식별
    try:
        profile = await _client().fetch_userinfo(access_token)
    except YouTubeOAuthError:
        resp = RedirectResponse(
            url="/login?error=youtube_userinfo_failed", status_code=307
        )
        resp.delete_cookie(OAUTH_STATE_COOKIE)
        resp.delete_cookie(OAUTH_VERIFIER_COOKIE)
        return resp

    google_id = profile.get("id")
    email = profile.get("email") or f"youtube-{google_id}@auto.local"
    display_name = profile.get("name")

    # 기존 세션 사용자가 있으면 그 user에 youtube를 연결 (auth_spotify 미러 패턴).
    existing_user_id: str | None = None
    session_id_cookie = request.cookies.get(SESSION_COOKIE_NAME)
    if session_id_cookie:
        with conn.cursor() as cur:
            cur.execute(
                'SELECT "userId", "expiresAt" FROM "AuthSession" WHERE id = %s',
                (session_id_cookie,),
            )
            row = cur.fetchone()
        if row:
            sess_user_id, sess_expires = row
            if sess_expires is not None and sess_expires.tzinfo is None:
                sess_expires = sess_expires.replace(tzinfo=timezone.utc)
            if sess_expires is None or sess_expires >= datetime.now(timezone.utc):
                existing_user_id = sess_user_id

    if existing_user_id:
        user_id = existing_user_id
    else:
        user_id = get_or_create_user(conn, email)

    # NOTE: primary는 이제 읽을 때 resolve_primary_platform로 계산하므로
    # 아래 primaryPlatform CASE 세팅은 vestigial(무해). 남겨도 무방.
    with conn.cursor() as cur:
        cur.execute(
            '''UPDATE "User" SET
                 "displayName" = COALESCE("displayName", %s),
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
            (display_name, user_id, "youtube", user_id),
        )
    conn.commit()

    # UserOAuth upsert
    token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
    upsert_oauth(
        conn, user_id=user_id, platform="youtube",
        access_token=access_token, refresh_token=refresh_token,
        expires_at=token_expires_at, scopes=granted,
    )

    # AuthSession 생성 (단일 세션 정책 — 기존 세션 삭제)
    session_id = uuid.uuid4().hex
    session_expires = datetime.now(timezone.utc) + timedelta(seconds=SESSION_MAX_AGE)
    with conn.cursor() as cur:
        cur.execute('DELETE FROM "AuthSession" WHERE "userId" = %s', (user_id,))
        cur.execute(
            'INSERT INTO "AuthSession" (id, "userId", "expiresAt", "userAgent") VALUES (%s, %s, %s, %s)',
            (session_id, user_id, session_expires, request.headers.get("user-agent")),
        )

    with conn.cursor() as cur:
        cur.execute('SELECT COUNT(*) FROM "PlaylistHistory" WHERE "userId" = %s', (user_id,))
        has_mrt = cur.fetchone()[0] > 0
    conn.commit()

    target = "/mrt" if has_mrt else "/onboarding"
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
    resp.delete_cookie(OAUTH_VERIFIER_COOKIE)
    return resp


async def _get_access_token(
    conn: psycopg.Connection, user_id: str
) -> str:
    """현재 user의 유효 YouTube access_token (만료 임박 시 refresh + upsert)."""
    oauth = get_oauth(conn, user_id, "youtube")
    if not oauth:
        raise HTTPException(404, "YouTube OAuth not configured. Sign in with YouTube")

    access_token = oauth["accessToken"]
    expires_at = oauth["expiresAt"]
    if expires_at is not None and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at and expires_at - timedelta(seconds=60) < datetime.now(timezone.utc):
        try:
            tokens = await _client().refresh_access_token(oauth["refreshToken"])
        except YouTubeOAuthError as e:
            raise HTTPException(401, f"YouTube refresh failed: {e}")
        access_token = tokens["access_token"]
        new_refresh = tokens.get("refresh_token", oauth["refreshToken"])
        new_expires = datetime.now(timezone.utc) + timedelta(seconds=tokens["expires_in"])
        scope_str = tokens.get("scope", "")
        granted = scope_str.split() if scope_str else list(oauth.get("scope", []))
        upsert_oauth(
            conn, user_id=user_id, platform="youtube",
            access_token=access_token, refresh_token=new_refresh,
            expires_at=new_expires, scopes=granted,
        )
        conn.commit()
    return access_token


@router.get("/token")
async def get_token(
    user_id: str = Depends(get_current_user_id),
    conn: psycopg.Connection = Depends(db_conn),
) -> dict:
    """현재 user의 YouTube access_token 반환 (만료 임박 시 refresh)."""
    access_token = await _get_access_token(conn, user_id)
    oauth = get_oauth(conn, user_id, "youtube")
    expires_at = oauth["expiresAt"] if oauth else None
    return {
        "access_token": access_token,
        "expires_at": expires_at.isoformat() if expires_at else None,
    }


@router.get("/playlists")
async def list_playlists(
    user_id: str = Depends(get_current_user_id),
    conn: psycopg.Connection = Depends(db_conn),
) -> dict:
    """인증된 사용자의 YouTube 플레이리스트 목록.

    youtube/v3/playlists?mine=true 전수(페이지네이션) → {id, name, count,
    thumbnail}. 선택적 import flow가 사용자에게 어떤 플레이리스트를 가져올지
    고르게 하기 위한 목록 조회. 미연동(토큰 없음)이면 _get_access_token이 404
    ('YouTube OAuth not configured', spotify/tidal과 동일 컨벤션). 프론트는
    401(미인증)·404(미연동) 둘 다 '먼저 YouTube 연결' 안내로 처리한다.

    매핑은 레퍼런스(youtubeMusic.js GET /playlists) 기준:
    name=snippet.title, count=contentDetails.itemCount,
    thumbnail=snippet.thumbnails.high|medium.url.
    """
    access_token = await _get_access_token(conn, user_id)

    async with httpx.AsyncClient(timeout=30.0) as http:
        importer = YouTubeImporter(http, access_token)
        raw = await importer.fetch_my_playlists()

    # fetch_my_playlists는 {id, name, cover_url, item_count}를 주므로
    # 공유 계약 형태 {id, name, count, thumbnail}로 매핑.
    playlists = [
        {
            "id": p.get("id"),
            "name": p.get("name"),
            "count": p.get("item_count", 0),
            "thumbnail": p.get("cover_url"),
        }
        for p in raw
    ]
    return {"playlists": playlists, "total": len(playlists)}


@router.post("/import")
async def import_library(
    user_id: str = Depends(get_current_user_id),
    conn: psycopg.Connection = Depends(db_conn),
    body: dict = Body(default={}),
) -> dict:
    """인증된 사용자의 YouTube 라이브러리(좋아요 + 플레이리스트)를 import.

    body {playlist_ids?: [...], include_liked?: bool} — playlist_ids 지정 시
    그 플레이리스트만, 없으면 전체. include_liked 기본 True(기존 호환);
    False면 좋아요 배치를 스킵 (선택적 import flow).
    """
    access_token = await _get_access_token(conn, user_id)
    playlist_ids = body.get("playlist_ids") if body else None
    include_liked = body.get("include_liked", True) if body else True

    async with httpx.AsyncClient(timeout=30.0) as http:
        stats = await import_all(
            conn, http, user_id, access_token,
            playlist_ids=playlist_ids, include_liked=include_liked,
        )

    return {
        "playlists_fetched": stats.playlists_fetched,
        "tracks_fetched": stats.tracks_fetched,
        "tracks_imported": stats.tracks_imported,
        "tracks_created": stats.tracks_created,
        "tracks_existing": stats.tracks_existing,
    }
