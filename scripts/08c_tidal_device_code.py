"""Tidal Device Authorization Code Flow CLI.

기존 scripts/08_onboard_tidal.py 는 Authorization Code + PKCE flow 사용.
하지만 python-tidal의 fX2 client_id는 Device Code 전용 (redirect URI 미등록).
이 CLI는 Device Code flow로 토큰 받음 → r_stream scope 포함 → FULL playback.

사용:
    python3 scripts/08c_tidal_device_code.py --email me@example.com
"""
from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

import psycopg
import tidalapi
from dotenv import load_dotenv
from rich.console import Console

from mrms.db.user_track import get_or_create_user, upsert_oauth


load_dotenv(override=True)
console = Console()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--email", required=True)
    args = parser.parse_args()

    console.print(f"[bold]== {args.email} ==[/bold]")

    dsn = os.environ.get("DATABASE_URL", "postgresql://mrms:mrms@localhost:5433/mrms")
    with psycopg.connect(dsn, autocommit=False) as conn:
        # User row
        user_id = get_or_create_user(conn, args.email)
        conn.commit()
        console.print(f"user_id = {user_id}")

        # Tidal Device Code flow via tidalapi
        console.print("\n[bold cyan]Tidal Device Code Flow[/bold cyan]")
        session = tidalapi.Session()

        # login_oauth() returns (login_obj, future) where future is the polling result
        login, future = session.login_oauth()
        verification_uri = getattr(login, "verification_uri_complete", None) or getattr(login, "verificationUriComplete", None)
        if not verification_uri:
            # fallback
            base_uri = getattr(login, "verification_uri", None) or getattr(login, "verificationUri", None)
            user_code = getattr(login, "user_code", None) or getattr(login, "userCode", None)
            if base_uri and user_code:
                verification_uri = f"{base_uri}?code={user_code}"
        if not verification_uri:
            raise RuntimeError(f"Tidal device authorization 응답에서 verification URI 추출 실패: {login!r}")

        console.print()
        console.print(f"[bold yellow]브라우저에서 다음 URL 방문 + 동의:[/bold yellow]")
        console.print(f"[link]{verification_uri}[/link]")
        console.print()
        console.print("[dim]동의 완료될 때까지 대기 중...[/dim]")

        # block until user authorizes
        future.result()

        # session has access_token, refresh_token, expiry_time
        access_token = session.access_token
        refresh_token = session.refresh_token
        expiry = session.expiry_time  # datetime

        if not access_token or not refresh_token:
            raise RuntimeError(f"Token 미수신: access={bool(access_token)}, refresh={bool(refresh_token)}")

        # expiry가 naive이면 UTC tz 추가
        if expiry and expiry.tzinfo is None:
            expiry = expiry.replace(tzinfo=timezone.utc)
        if not expiry:
            expiry = datetime.now(timezone.utc) + timedelta(hours=24)

        # 토큰 디코딩으로 실제 scope 확인 (informational)
        import base64
        import json
        jwt_scope = None
        try:
            parts = access_token.split(".")
            if len(parts) == 3:
                payload_b64 = parts[1] + "=" * (4 - len(parts[1]) % 4)
                payload = json.loads(base64.urlsafe_b64decode(payload_b64))
                jwt_scope = payload.get("scope")
                console.print(f"\n[green]토큰 발급 성공![/green]")
                console.print(f"  scope (JWT): {jwt_scope}")
                console.print(f"  expires: {expiry.isoformat()}")
        except Exception:
            pass

        # UserOAuth UPSERT (delete + insert via upsert)
        scopes_for_db = (
            jwt_scope.split() if isinstance(jwt_scope, str)
            else ["r_usr", "w_usr", "r_stream"]
        )
        upsert_oauth(
            conn,
            user_id=user_id,
            platform="tidal",
            access_token=access_token,
            refresh_token=refresh_token,
            expires_at=expiry,
            scopes=scopes_for_db,
        )
        conn.commit()
        console.print(f"\n[green]✓ UserOAuth 저장 완료[/green]")


if __name__ == "__main__":
    main()
