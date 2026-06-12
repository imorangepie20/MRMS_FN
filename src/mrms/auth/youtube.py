"""YouTube (Google) OAuth Authorization Code + PKCE client.

SpotifyOAuthClient 미러. 차이점:
- Google 웹 OAuth + PKCE(S256): authorize 시 code_challenge, token 교환 시 code_verifier.
- token 교환은 Basic auth 대신 body에 client_id/client_secret 동봉.
- access_type=offline + prompt=consent 로 refresh_token 확보.
"""
from __future__ import annotations

import base64
import hashlib
import os
from urllib.parse import urlencode

import httpx

GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"


class YouTubeOAuthError(Exception):
    pass


def gen_pkce() -> tuple[str, str]:
    """(code_verifier, code_challenge) 생성.

    verifier = base64url(32 random bytes), challenge = base64url(sha256(verifier)).
    base64url는 '=' 패딩 제거 (RFC 7636).
    """
    verifier = base64.urlsafe_b64encode(os.urandom(32)).rstrip(b"=").decode("ascii")
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")
    return verifier, challenge


class YouTubeOAuthClient:
    def __init__(
        self,
        client_id: str,
        client_secret: str,
        redirect_uri: str,
        scopes: list[str],
    ) -> None:
        self.client_id = client_id
        self.client_secret = client_secret
        self.redirect_uri = redirect_uri
        self.scopes = scopes

    def build_authorize_url(self, state: str, code_challenge: str) -> str:
        params = {
            "client_id": self.client_id,
            "response_type": "code",
            "redirect_uri": self.redirect_uri,
            "scope": " ".join(self.scopes),
            "state": state,
            "code_challenge_method": "S256",
            "code_challenge": code_challenge,
            "access_type": "offline",
            "prompt": "consent",
        }
        return f"{GOOGLE_AUTHORIZE_URL}?{urlencode(params)}"

    async def exchange_code(
        self, code: str, code_verifier: str, redirect_uri: str | None = None
    ) -> dict:
        async with httpx.AsyncClient(timeout=10.0) as http:
            r = await http.post(
                GOOGLE_TOKEN_URL,
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": redirect_uri or self.redirect_uri,
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "code_verifier": code_verifier,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
        if r.status_code != 200:
            raise YouTubeOAuthError(
                f"token exchange failed {r.status_code}: {r.text[:200]}"
            )
        return r.json()

    async def refresh_access_token(self, refresh_token: str) -> dict:
        async with httpx.AsyncClient(timeout=10.0) as http:
            r = await http.post(
                GOOGLE_TOKEN_URL,
                data={
                    "grant_type": "refresh_token",
                    "refresh_token": refresh_token,
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
        if r.status_code != 200:
            raise YouTubeOAuthError(
                f"token refresh failed {r.status_code}: {r.text[:200]}"
            )
        data = r.json()
        # Google은 refresh 응답에 refresh_token을 안 줌 — 기존 것 유지
        if not data.get("refresh_token"):
            data["refresh_token"] = refresh_token
        return data

    async def fetch_userinfo(self, access_token: str) -> dict:
        async with httpx.AsyncClient(timeout=10.0) as http:
            r = await http.get(
                GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token}"},
            )
        if r.status_code != 200:
            raise YouTubeOAuthError(
                f"userinfo failed {r.status_code}: {r.text[:200]}"
            )
        return r.json()
