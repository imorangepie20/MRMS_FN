"""SpotifyOAuthClient 테스트."""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from mrms.auth.spotify import SpotifyOAuthClient, SpotifyOAuthError


def _client() -> SpotifyOAuthClient:
    return SpotifyOAuthClient(
        client_id="cid",
        client_secret="csecret",
        redirect_uri="http://localhost:8000/callback",
        scopes=["user-read-email", "user-library-read"],
    )


def test_build_authorize_url_contains_required_params():
    c = _client()
    url = c.build_authorize_url(state="STATE_XYZ")
    assert url.startswith("https://accounts.spotify.com/authorize")
    assert "client_id=cid" in url
    assert "response_type=code" in url
    assert "state=STATE_XYZ" in url
    assert "redirect_uri=http%3A%2F%2Flocalhost%3A8000%2Fcallback" in url
    assert "scope=user-read-email+user-library-read" in url or \
           "scope=user-read-email%20user-library-read" in url


@pytest.mark.asyncio
async def test_exchange_code_returns_tokens():
    fake = MagicMock()
    fake.status_code = 200
    fake.json = MagicMock(return_value={
        "access_token": "AT_xyz",
        "refresh_token": "RT_xyz",
        "expires_in": 3600,
        "scope": "user-read-email user-library-read",
        "token_type": "Bearer",
    })
    fake_client = MagicMock()
    fake_client.__aenter__ = AsyncMock(return_value=fake_client)
    fake_client.__aexit__ = AsyncMock(return_value=None)
    fake_client.post = AsyncMock(return_value=fake)

    with patch("httpx.AsyncClient", return_value=fake_client):
        tokens = await _client().exchange_code("CODE_xyz")
    assert tokens["access_token"] == "AT_xyz"
    assert tokens["refresh_token"] == "RT_xyz"
    assert tokens["expires_in"] == 3600


@pytest.mark.asyncio
async def test_exchange_code_raises_on_4xx():
    fake = MagicMock()
    fake.status_code = 400
    fake.text = '{"error":"invalid_grant"}'
    fake.json = MagicMock(return_value={"error": "invalid_grant"})
    fake_client = MagicMock()
    fake_client.__aenter__ = AsyncMock(return_value=fake_client)
    fake_client.__aexit__ = AsyncMock(return_value=None)
    fake_client.post = AsyncMock(return_value=fake)

    with patch("httpx.AsyncClient", return_value=fake_client):
        with pytest.raises(SpotifyOAuthError):
            await _client().exchange_code("BAD_CODE")


@pytest.mark.asyncio
async def test_refresh_returns_new_access_token():
    fake = MagicMock()
    fake.status_code = 200
    fake.json = MagicMock(return_value={
        "access_token": "NEW_AT",
        "expires_in": 3600,
        "scope": "user-read-email",
        "token_type": "Bearer",
    })
    fake_client = MagicMock()
    fake_client.__aenter__ = AsyncMock(return_value=fake_client)
    fake_client.__aexit__ = AsyncMock(return_value=None)
    fake_client.post = AsyncMock(return_value=fake)

    with patch("httpx.AsyncClient", return_value=fake_client):
        tokens = await _client().refresh_access_token("OLD_RT")
    assert tokens["access_token"] == "NEW_AT"
