"""Tidal OAuth (Authorization Code Flow with PKCE).

엔드포인트:
  AUTHORIZE: https://login.tidal.com/authorize
  TOKEN:     https://auth.tidal.com/v1/oauth2/token
"""
from __future__ import annotations

import base64
import hashlib
import secrets
from urllib.parse import urlencode

import httpx


AUTHORIZE_URL = "https://login.tidal.com/authorize"
TOKEN_URL = "https://auth.tidal.com/v1/oauth2/token"


class TidalOAuthError(Exception):
    pass


class TidalOAuthClient:
    def __init__(
        self,
        client_id: str,
        client_secret: str,
        redirect_uri: str,
        scopes: list[str],
    ):
        self.client_id = client_id
        self.client_secret = client_secret
        self.redirect_uri = redirect_uri
        self.scopes = scopes

    def generate_pkce_pair(self) -> tuple[str, str]:
        """(code_verifier, code_challenge) 반환.

        verifier: 랜덤 64자 url-safe
        challenge: base64url(sha256(verifier)), padding 제거
        """
        verifier = secrets.token_urlsafe(64)[:64]
        digest = hashlib.sha256(verifier.encode()).digest()
        challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode()
        return verifier, challenge

    def build_authorize_url(self, code_challenge: str, state: str) -> str:
        params = {
            "response_type": "code",
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "scope": " ".join(self.scopes),
            "code_challenge": code_challenge,
            "code_challenge_method": "S256",
            "state": state,
        }
        return f"{AUTHORIZE_URL}?{urlencode(params)}"

    async def exchange_code(self, code: str, verifier: str) -> dict:
        """authorization_code grant — code + verifier → tokens."""
        async with httpx.AsyncClient(timeout=15.0) as http:
            r = await http.post(
                TOKEN_URL,
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.redirect_uri,
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "code_verifier": verifier,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
        if r.status_code != 200:
            raise TidalOAuthError(
                f"token exchange failed: {r.status_code} {r.text[:300]}"
            )
        return r.json()

    async def refresh_access_token(self, refresh_token: str) -> dict:
        """refresh_token grant — 새 access_token (+ 보통 refresh_token도 갱신)."""
        async with httpx.AsyncClient(timeout=15.0) as http:
            r = await http.post(
                TOKEN_URL,
                data={
                    "grant_type": "refresh_token",
                    "refresh_token": refresh_token,
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
        if r.status_code != 200:
            raise TidalOAuthError(
                f"refresh failed: {r.status_code} {r.text[:300]}"
            )
        return r.json()
