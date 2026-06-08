"""Spotify API 진단 스크립트.

실행:
    python scripts/00_test_spotify.py

단계별로 표시:
    1. .env에서 credentials 로드 (길이/마스킹된 값)
    2. 토큰 요청 → 응답 본문
    3. 단일 트랙 조회 → 응답 본문
    4. 검색 endpoint 테스트
"""

from __future__ import annotations

import asyncio
import base64
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

import httpx
from dotenv import load_dotenv
from rich.console import Console

load_dotenv()
console = Console()


async def main() -> None:
    cid = os.environ.get("SPOTIFY_CLIENT_ID", "").strip()
    csec = os.environ.get("SPOTIFY_CLIENT_SECRET", "").strip()

    console.rule("[bold]Step 1: Credentials[/bold]")
    console.print(f"client_id length:     {len(cid)}")
    console.print(f"client_id mask:       {cid[:4]}...{cid[-4:] if len(cid) > 8 else ''}")
    console.print(f"client_secret length: {len(csec)}")
    console.print(
        f"client_secret mask:   {csec[:4]}...{csec[-4:] if len(csec) > 8 else ''}"
    )
    if not cid or not csec:
        console.print("[red]ERROR: SPOTIFY_CLIENT_ID/SECRET not found in .env[/red]")
        return

    async with httpx.AsyncClient(timeout=15.0) as client:
        # ─── Step 2: token ───
        console.rule("[bold]Step 2: Token request[/bold]")
        auth = base64.b64encode(f"{cid}:{csec}".encode()).decode()
        r = await client.post(
            "https://accounts.spotify.com/api/token",
            headers={
                "Authorization": f"Basic {auth}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            data={"grant_type": "client_credentials"},
        )
        console.print(f"HTTP {r.status_code}")
        body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {"raw": r.text}
        console.print(body)

        token = body.get("access_token") if isinstance(body, dict) else None
        if not token:
            console.print("[red]Token issuance failed. Stop.[/red]")
            return
        console.print(f"[green]token OK: {token[:20]}...[/green]")

        headers = {"Authorization": f"Bearer {token}"}

        # ─── Step 3: GET /v1/tracks/{id} ───
        console.rule("[bold]Step 3: GET /v1/tracks/{id}[/bold]")
        r = await client.get(
            "https://api.spotify.com/v1/tracks/70sjcC1GLyYfcHntiZ16cN",
            headers=headers,
        )
        console.print(f"HTTP {r.status_code}")
        try:
            console.print(r.json())
        except Exception:
            console.print(r.text[:500])

        # ─── Step 4: GET /v1/search ───
        console.rule("[bold]Step 4: GET /v1/search[/bold]")
        r = await client.get(
            "https://api.spotify.com/v1/search",
            headers=headers,
            params={"q": "test", "type": "track", "limit": 1},
        )
        console.print(f"HTTP {r.status_code}")
        try:
            body = r.json()
            # search 응답은 길어서 핵심만
            if "tracks" in body:
                items = body["tracks"].get("items", [])
                console.print(f"items count: {len(items)}")
                if items:
                    console.print(f"first: {items[0].get('name')} - {items[0].get('artists', [{}])[0].get('name')}")
            else:
                console.print(body)
        except Exception:
            console.print(r.text[:500])


if __name__ == "__main__":
    asyncio.run(main())
