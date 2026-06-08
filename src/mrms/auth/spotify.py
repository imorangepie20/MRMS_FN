"""Spotify OAuth Authorization Code client."""
from __future__ import annotations

import base64
from urllib.parse import urlencode

import httpx


SPOTIFY_AUTHORIZE_URL = "https://accounts.spotify.com/authorize"
SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token"


class SpotifyOAuthError(Exception):
    pass


class SpotifyOAuthClient:
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

    def build_authorize_url(self, state: str) -> str:
        params = {
            "client_id": self.client_id,
            "response_type": "code",
            "redirect_uri": self.redirect_uri,
            "state": state,
            "scope": " ".join(self.scopes),
            "show_dialog": "false",
        }
        return f"{SPOTIFY_AUTHORIZE_URL}?{urlencode(params)}"

    def _basic_auth_header(self) -> str:
        creds = f"{self.client_id}:{self.client_secret}".encode()
        return f"Basic {base64.b64encode(creds).decode()}"

    async def exchange_code(self, code: str) -> dict:
        async with httpx.AsyncClient(timeout=10.0) as http:
            r = await http.post(
                SPOTIFY_TOKEN_URL,
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.redirect_uri,
                },
                headers={
                    "Authorization": self._basic_auth_header(),
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            )
        if r.status_code != 200:
            raise SpotifyOAuthError(f"token exchange failed {r.status_code}: {r.text[:200]}")
        return r.json()

    async def refresh_access_token(self, refresh_token: str) -> dict:
        async with httpx.AsyncClient(timeout=10.0) as http:
            r = await http.post(
                SPOTIFY_TOKEN_URL,
                data={
                    "grant_type": "refresh_token",
                    "refresh_token": refresh_token,
                },
                headers={
                    "Authorization": self._basic_auth_header(),
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            )
        if r.status_code != 200:
            raise SpotifyOAuthError(f"token refresh failed {r.status_code}: {r.text[:200]}")
        return r.json()
