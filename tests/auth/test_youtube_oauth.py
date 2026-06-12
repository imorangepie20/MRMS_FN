"""YouTubeOAuthClient 테스트 (PKCE 포함)."""
import base64
import hashlib
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from mrms.auth.youtube import YouTubeOAuthClient, YouTubeOAuthError, gen_pkce


def _client() -> YouTubeOAuthClient:
    return YouTubeOAuthClient(
        client_id="cid",
        client_secret="csecret",
        redirect_uri="http://localhost:8000/api/auth/youtube/callback",
        scopes=[
            "https://www.googleapis.com/auth/youtube.readonly",
            "https://www.googleapis.com/auth/userinfo.profile",
        ],
    )


def test_gen_pkce_challenge_is_s256_of_verifier():
    verifier, challenge = gen_pkce()
    # 패딩 없는 base64url
    assert "=" not in verifier
    assert "=" not in challenge
    expected = (
        base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest())
        .rstrip(b"=")
        .decode()
    )
    assert challenge == expected
    # 매 호출마다 달라야 함
    v2, _ = gen_pkce()
    assert verifier != v2


def test_build_authorize_url_contains_required_params():
    c = _client()
    url = c.build_authorize_url(state="STATE_XYZ", code_challenge="CHAL_ABC")
    assert url.startswith("https://accounts.google.com/o/oauth2/v2/auth")
    assert "client_id=cid" in url
    assert "response_type=code" in url
    assert "state=STATE_XYZ" in url
    assert "code_challenge_method=S256" in url
    assert "code_challenge=CHAL_ABC" in url
    assert "access_type=offline" in url
    assert "prompt=consent" in url
    assert "youtube.readonly" in url


@pytest.mark.asyncio
async def test_exchange_code_sends_verifier_and_returns_tokens():
    fake = MagicMock()
    fake.status_code = 200
    fake.json = MagicMock(return_value={
        "access_token": "AT_xyz",
        "refresh_token": "RT_xyz",
        "expires_in": 3600,
        "scope": "https://www.googleapis.com/auth/youtube.readonly",
        "token_type": "Bearer",
    })
    fake_client = MagicMock()
    fake_client.__aenter__ = AsyncMock(return_value=fake_client)
    fake_client.__aexit__ = AsyncMock(return_value=None)
    fake_client.post = AsyncMock(return_value=fake)

    with patch("httpx.AsyncClient", return_value=fake_client):
        tokens = await _client().exchange_code("CODE_xyz", "VERIFIER_xyz")
    assert tokens["access_token"] == "AT_xyz"
    assert tokens["refresh_token"] == "RT_xyz"
    # body에 code_verifier + grant_type가 포함됐는지
    _, kwargs = fake_client.post.call_args
    body = kwargs["data"]
    assert body["code_verifier"] == "VERIFIER_xyz"
    assert body["grant_type"] == "authorization_code"
    assert body["code"] == "CODE_xyz"


@pytest.mark.asyncio
async def test_exchange_code_raises_on_4xx():
    fake = MagicMock()
    fake.status_code = 400
    fake.text = '{"error":"invalid_grant"}'
    fake_client = MagicMock()
    fake_client.__aenter__ = AsyncMock(return_value=fake_client)
    fake_client.__aexit__ = AsyncMock(return_value=None)
    fake_client.post = AsyncMock(return_value=fake)

    with patch("httpx.AsyncClient", return_value=fake_client):
        with pytest.raises(YouTubeOAuthError):
            await _client().exchange_code("BAD_CODE", "VERIFIER")


@pytest.mark.asyncio
async def test_refresh_keeps_old_refresh_token_when_absent():
    fake = MagicMock()
    fake.status_code = 200
    fake.json = MagicMock(return_value={
        "access_token": "NEW_AT",
        "expires_in": 3600,
        "scope": "https://www.googleapis.com/auth/youtube.readonly",
        "token_type": "Bearer",
        # refresh_token 없음 (Google 동작)
    })
    fake_client = MagicMock()
    fake_client.__aenter__ = AsyncMock(return_value=fake_client)
    fake_client.__aexit__ = AsyncMock(return_value=None)
    fake_client.post = AsyncMock(return_value=fake)

    with patch("httpx.AsyncClient", return_value=fake_client):
        tokens = await _client().refresh_access_token("OLD_RT")
    assert tokens["access_token"] == "NEW_AT"
    assert tokens["refresh_token"] == "OLD_RT"  # 기존 것 유지


@pytest.mark.asyncio
async def test_fetch_userinfo_returns_profile():
    fake = MagicMock()
    fake.status_code = 200
    fake.json = MagicMock(return_value={"id": "g_123", "name": "Bob"})
    fake_client = MagicMock()
    fake_client.__aenter__ = AsyncMock(return_value=fake_client)
    fake_client.__aexit__ = AsyncMock(return_value=None)
    fake_client.get = AsyncMock(return_value=fake)

    with patch("httpx.AsyncClient", return_value=fake_client):
        profile = await _client().fetch_userinfo("AT_xyz")
    assert profile["id"] == "g_123"
    assert profile["name"] == "Bob"
