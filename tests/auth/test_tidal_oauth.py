"""Tidal OAuth client 테스트."""
import base64
import hashlib

import pytest
import respx
from httpx import Response

from mrms.auth.tidal import TidalOAuthClient


@pytest.fixture
def client():
    return TidalOAuthClient(
        client_id="cid_test",
        client_secret="cs_test",
        redirect_uri="https://mrms.approid.team/callback/tidal",
        scopes=["user.read", "collection.read", "playlists.read"],
    )


def test_pkce_pair_is_valid(client):
    """code_challenge = base64url(sha256(verifier))."""
    verifier, challenge = client.generate_pkce_pair()
    assert 43 <= len(verifier) <= 128
    expected = base64.urlsafe_b64encode(
        hashlib.sha256(verifier.encode()).digest()
    ).rstrip(b"=").decode()
    assert challenge == expected


def test_pkce_pair_random(client):
    """매번 다른 verifier 생성."""
    v1, _ = client.generate_pkce_pair()
    v2, _ = client.generate_pkce_pair()
    assert v1 != v2


def test_build_authorize_url(client):
    url = client.build_authorize_url(
        code_challenge="CHALLENGE",
        state="STATE",
    )
    assert url.startswith("https://login.tidal.com/authorize?")
    assert "client_id=cid_test" in url
    assert "code_challenge=CHALLENGE" in url
    assert "code_challenge_method=S256" in url
    assert "state=STATE" in url
    assert "response_type=code" in url
    assert "scope=user.read+collection.read+playlists.read" in url \
        or "scope=user.read%20collection.read%20playlists.read" in url


@respx.mock
@pytest.mark.asyncio
async def test_exchange_code_success(client):
    respx.post("https://auth.tidal.com/v1/oauth2/token").mock(
        return_value=Response(
            200,
            json={
                "access_token": "AT_NEW",
                "refresh_token": "RT_NEW",
                "expires_in": 86400,
                "scope": "user.read collection.read playlists.read",
                "token_type": "Bearer",
            },
        )
    )
    tokens = await client.exchange_code(code="CODE", verifier="VERIFIER")
    assert tokens["access_token"] == "AT_NEW"
    assert tokens["refresh_token"] == "RT_NEW"
    assert tokens["expires_in"] == 86400
    assert "user.read" in tokens["scope"]


@respx.mock
@pytest.mark.asyncio
async def test_refresh_token_success(client):
    respx.post("https://auth.tidal.com/v1/oauth2/token").mock(
        return_value=Response(
            200,
            json={
                "access_token": "AT_REFRESHED",
                "refresh_token": "RT_KEPT",
                "expires_in": 86400,
                "scope": "user.read",
                "token_type": "Bearer",
            },
        )
    )
    tokens = await client.refresh_access_token(refresh_token="RT_OLD")
    assert tokens["access_token"] == "AT_REFRESHED"


@respx.mock
@pytest.mark.asyncio
async def test_exchange_code_failure_raises(client):
    respx.post("https://auth.tidal.com/v1/oauth2/token").mock(
        return_value=Response(400, json={"error": "invalid_grant"})
    )
    with pytest.raises(Exception, match="invalid_grant|400"):
        await client.exchange_code(code="BAD", verifier="VERIFIER")
