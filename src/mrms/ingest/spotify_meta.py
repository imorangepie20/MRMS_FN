"""Spotify Web API (client_credentials flow) — 메타데이터 enrichment용.

사용자 OAuth 불필요. 앱 자격증명만으로 트랙 메타 조회 가능.
주 용도: ISRC 누락된 Spotify 행에 external_ids.isrc 채우기.

Note:
    Spotify dev 앱에서 batch `/v1/tracks?ids=...`는 403 반환하는 경우가 있어
    단일 `/v1/tracks/{id}`를 병렬 호출하는 방식 사용.

Docs: https://developer.spotify.com/documentation/web-api/concepts/authorization
"""

from __future__ import annotations

import asyncio
import base64
import logging
import time
from typing import Optional

import httpx
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

log = logging.getLogger(__name__)

AUTH_URL = "https://accounts.spotify.com/api/token"
API_BASE = "https://api.spotify.com/v1"


class SpotifyAuthError(Exception):
    pass


class SpotifyQuotaExhausted(Exception):
    """Daily quota 도달 — Retry-After가 비현실적으로 길 때."""


class _RetryableError(Exception):
    """일시적 오류 — tenacity 재시도 트리거."""


MAX_RETRY_AFTER_SEC = 60  # 1분 초과시 quota 도달로 간주, 중단


class SpotifyClient:
    def __init__(
        self,
        client_id: str,
        client_secret: str,
        timeout: float = 15.0,
        concurrency: int = 20,
    ):
        if not client_id or not client_secret:
            raise SpotifyAuthError("client_id/secret 비어 있음")
        self._cid = client_id
        self._csec = client_secret
        self._token: Optional[str] = None
        self._exp_at: float = 0.0
        self._client = httpx.AsyncClient(
            timeout=httpx.Timeout(timeout),
            limits=httpx.Limits(max_connections=concurrency * 2),
        )
        self._concurrency = concurrency

    async def __aenter__(self) -> "SpotifyClient":
        return self

    async def __aexit__(self, *exc) -> None:
        await self.aclose()

    async def aclose(self) -> None:
        await self._client.aclose()

    async def _ensure_token(self) -> str:
        if self._token and time.time() < self._exp_at - 60:
            return self._token
        auth = base64.b64encode(f"{self._cid}:{self._csec}".encode()).decode()
        r = await self._client.post(
            AUTH_URL,
            headers={
                "Authorization": f"Basic {auth}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            data={"grant_type": "client_credentials"},
        )
        if r.status_code != 200:
            raise SpotifyAuthError(f"token request failed: {r.status_code} {r.text[:200]}")
        body = r.json()
        self._token = body["access_token"]
        self._exp_at = time.time() + body["expires_in"]
        return self._token

    @retry(
        retry=retry_if_exception_type(_RetryableError),
        stop=stop_after_attempt(4),
        wait=wait_exponential(multiplier=1, min=2, max=15),
        reraise=True,
    )
    async def fetch_isrc_single(self, track_id: str) -> Optional[str]:
        """단일 트랙의 ISRC만 추출 반환. 없으면 None."""
        token = await self._ensure_token()
        r = await self._client.get(
            f"{API_BASE}/tracks/{track_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        if r.status_code == 200:
            body = r.json()
            return (body.get("external_ids") or {}).get("isrc")
        if r.status_code == 401:
            # 토큰 만료 → 재발급 트리거
            self._token = None
            raise _RetryableError("token expired")
        if r.status_code == 429:
            retry_after = int(r.headers.get("Retry-After", "5"))
            if retry_after > MAX_RETRY_AFTER_SEC:
                log.error("Spotify daily quota exhausted (Retry-After=%ds)", retry_after)
                raise SpotifyQuotaExhausted(
                    f"daily quota — retry after {retry_after}s ({retry_after // 3600}h)"
                )
            log.warning("Spotify 429, sleeping %ds", retry_after)
            await asyncio.sleep(retry_after)
            raise _RetryableError("rate limited")
        if r.status_code in (404, 400):
            # 트랙 없음 / 잘못된 ID — 재시도 X
            return None
        # 기타 5xx — 재시도
        if r.status_code >= 500:
            raise _RetryableError(f"server error {r.status_code}")
        # 403 등 — 재시도 의미 없음
        log.debug("track %s: HTTP %d", track_id, r.status_code)
        return None

    async def fetch_isrcs(
        self,
        ids: list[str],
        on_progress=None,
    ) -> dict[str, str]:
        """병렬 단일 호출. {track_id: isrc} 매핑 반환."""
        out: dict[str, str] = {}
        sem = asyncio.Semaphore(self._concurrency)
        out_lock = asyncio.Lock()

        async def worker(track_id: str) -> None:
            async with sem:
                try:
                    isrc = await self.fetch_isrc_single(track_id)
                    if isrc:
                        async with out_lock:
                            out[track_id] = isrc
                except Exception as e:
                    log.debug("track %s failed: %s", track_id, e)
                if on_progress:
                    on_progress(1)

        await asyncio.gather(*[worker(tid) for tid in ids])
        return out
