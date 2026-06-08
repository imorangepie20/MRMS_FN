"""Tidal 온보딩 CLI.

본인 Tidal 계정 OAuth + 좋아요/플레이리스트 import → UserTrack 적재.

사전 조건:
    - .env에 TIDAL_CLIENT_ID/SECRET/REDIRECT_URI/SCOPES 설정
    - Cloudflare Tunnel mrms.approid.team → localhost:8080 동작 중
    - PostgreSQL (port 5433) 실행 중 + V1 적재 완료
    - prisma/init/03_user_track.sql 적용됨

사용:
    python3 scripts/08_onboard_tidal.py --email me@example.com
"""
from __future__ import annotations

import argparse
import asyncio
import os
import secrets
import sys
import webbrowser
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

import httpx
import psycopg
from dotenv import load_dotenv
from rich.console import Console

from mrms.auth.callback_server import CallbackServer
from mrms.auth.tidal import TidalOAuthClient
from mrms.db.user_track import (
    get_or_create_user,
    get_oauth,
    upsert_oauth,
)
from mrms.sync.tidal_importer import TidalImporter, import_all

load_dotenv()
console = Console()


async def ensure_token(conn, user_id: str) -> tuple[str, str]:
    """유효한 access_token 보장. 필요시 refresh 또는 fresh OAuth.

    반환: (access_token, refresh_token)
    """
    client_id = os.environ["TIDAL_CLIENT_ID"]
    client_secret = os.environ["TIDAL_CLIENT_SECRET"]
    redirect_uri = os.environ["TIDAL_REDIRECT_URI"]
    scopes = ["user.read", "collection.read", "playlists.read"]

    client = TidalOAuthClient(
        client_id=client_id,
        client_secret=client_secret,
        redirect_uri=redirect_uri,
        scopes=scopes,
    )

    existing = get_oauth(conn, user_id, "tidal")
    if existing and existing["expiresAt"] > datetime.now(timezone.utc) + timedelta(seconds=60):
        console.print("[green]기존 토큰 유효 — refresh 안 함[/green]")
        return existing["accessToken"], existing["refreshToken"]

    if existing:
        console.print("[yellow]토큰 만료 임박 — refresh 시도[/yellow]")
        try:
            tokens = await client.refresh_access_token(existing["refreshToken"])
        except Exception as e:
            console.print(f"[red]refresh 실패: {e}[/red] — fresh OAuth로 진행")
        else:
            _persist(conn, user_id, tokens, scopes)
            return tokens["access_token"], tokens.get("refresh_token", existing["refreshToken"])

    console.print("[bold]Fresh OAuth flow 시작[/bold]")
    verifier, challenge = client.generate_pkce_pair()
    state = secrets.token_urlsafe(16)
    server = CallbackServer(host="127.0.0.1", port=8080, path="/callback/tidal")
    auth_url = client.build_authorize_url(challenge, state)
    console.print(f"브라우저 열림: {auth_url[:80]}...")
    webbrowser.open(auth_url)

    try:
        code, received_state = await asyncio.to_thread(
            server.wait_for_callback, 300
        )
    except TimeoutError as e:
        raise RuntimeError("OAuth 콜백 안 옴 (300초 timeout)") from e
    if received_state != state:
        raise RuntimeError(f"state 불일치: {received_state} != {state}")

    tokens = await client.exchange_code(code, verifier)
    _persist(conn, user_id, tokens, scopes)
    return tokens["access_token"], tokens["refresh_token"]


def _persist(conn, user_id: str, tokens: dict, requested_scopes: list[str]) -> None:
    expires = datetime.now(timezone.utc) + timedelta(seconds=tokens["expires_in"])
    scope_resp = tokens.get("scope", "")
    granted = scope_resp.split() if isinstance(scope_resp, str) else list(scope_resp)
    if not granted:
        granted = requested_scopes
    upsert_oauth(
        conn,
        user_id=user_id,
        platform="tidal",
        access_token=tokens["access_token"],
        refresh_token=tokens.get("refresh_token", ""),
        expires_at=expires,
        scopes=granted,
    )
    conn.commit()


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--email", required=True)
    args = parser.parse_args()

    dsn = os.environ.get("DATABASE_URL", "postgresql://mrms:mrms@localhost:5433/mrms")
    with psycopg.connect(dsn, autocommit=False) as conn:
        console.print(f"[1/3] User 조회/생성: [cyan]{args.email}[/cyan]")
        user_id = get_or_create_user(conn, args.email)
        conn.commit()
        console.print(f"      user_id = {user_id}")

        console.print("[2/3] OAuth")
        access_token, _ = await ensure_token(conn, user_id)

        console.print("[3/3] Import 시작")
        async with httpx.AsyncClient(timeout=30.0) as http:
            importer = TidalImporter(http, access_token=access_token, country_code="KR")
            user_info = await importer.fetch_user_info()
            country = user_info.get("country", "KR")
            importer.country = country
            console.print(f"      country = {country}")
            stats = await import_all(conn, user_id, importer)
            conn.commit()

        console.print()
        for line in stats.summary_lines():
            console.print(f"  {line}")
        console.print("[green]✓ 완료[/green]")


if __name__ == "__main__":
    asyncio.run(main())
