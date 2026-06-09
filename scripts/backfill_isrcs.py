"""Catalog Track.isrc 백필 — fake 'spotify_X' ISRC를 진짜 ISRC로 갱신.

사용:
  # dev — limit 100개만 (테스트)
  python scripts/backfill_isrcs.py 100

  # prod — 전체
  python scripts/backfill_isrcs.py

환경변수 (.env.production 또는 export):
  DATABASE_URL, SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET
"""
from __future__ import annotations

import asyncio
import base64
import os
import sys
import time

import httpx
import psycopg


BATCH_SIZE = 50
RATE_LIMIT_SEC = 0.5  # Spotify ~180 req/min 안전선


async def get_app_token(client_id: str, client_secret: str) -> str:
    auth = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
    async with httpx.AsyncClient(timeout=10.0) as http:
        r = await http.post(
            "https://accounts.spotify.com/api/token",
            data={"grant_type": "client_credentials"},
            headers={
                "Authorization": f"Basic {auth}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
        )
        r.raise_for_status()
        return r.json()["access_token"]


async def fetch_isrcs_batch(
    token: str, spotify_ids: list[str]
) -> dict[str, str]:
    """Spotify ID 리스트 → {spotify_id: real_isrc}."""
    if not spotify_ids:
        return {}
    result: dict[str, str] = {}
    async with httpx.AsyncClient(timeout=20.0) as http:
        ids_param = ",".join(spotify_ids)
        r = await http.get(
            f"https://api.spotify.com/v1/tracks?ids={ids_param}",
            headers={"Authorization": f"Bearer {token}"},
        )
        if r.status_code == 429:
            retry_after = int(r.headers.get("Retry-After", "5"))
            print(f"  rate limit hit, sleeping {retry_after}s", file=sys.stderr)
            await asyncio.sleep(retry_after)
            return await fetch_isrcs_batch(token, spotify_ids)
        if r.status_code != 200:
            print(f"  ERR {r.status_code}: {r.text[:200]}", file=sys.stderr)
            return {}
        data = r.json()
        for track in data.get("tracks") or []:
            if not track:
                continue
            tid = track.get("id")
            isrc = (track.get("external_ids") or {}).get("isrc")
            if tid and isrc:
                result[tid] = isrc
    return result


async def main(limit: int | None) -> None:
    database_url = os.environ["DATABASE_URL"]
    client_id = os.environ["SPOTIFY_CLIENT_ID"]
    client_secret = os.environ["SPOTIFY_CLIENT_SECRET"]

    token = await get_app_token(client_id, client_secret)
    print(f"✓ Spotify app token 획득")

    conn = psycopg.connect(database_url)

    with conn.cursor() as cur:
        if limit:
            cur.execute(
                """SELECT id, isrc FROM "Track"
                   WHERE isrc LIKE 'spotify_%'
                   ORDER BY id LIMIT %s""",
                (limit,),
            )
        else:
            cur.execute(
                """SELECT id, isrc FROM "Track"
                   WHERE isrc LIKE 'spotify_%'"""
            )
        rows = cur.fetchall()

    total = len(rows)
    print(f"✓ fake ISRC 가진 트랙 {total}개 발견 (limit={limit})")
    if total == 0:
        conn.close()
        return

    updated = 0
    conflicts = 0
    no_isrc_returned = 0
    started = time.monotonic()

    for batch_idx in range(0, total, BATCH_SIZE):
        batch = rows[batch_idx:batch_idx + BATCH_SIZE]
        spotify_id_to_track_id: dict[str, str] = {}
        for track_id, fake_isrc in batch:
            sid = fake_isrc[len("spotify_"):]
            if sid:
                spotify_id_to_track_id[sid] = track_id

        spotify_ids = list(spotify_id_to_track_id.keys())
        real_isrcs = await fetch_isrcs_batch(token, spotify_ids)

        for sid, real_isrc in real_isrcs.items():
            track_id = spotify_id_to_track_id[sid]
            with conn.cursor() as cur:
                try:
                    cur.execute(
                        'UPDATE "Track" SET isrc = %s WHERE id = %s',
                        (real_isrc, track_id),
                    )
                    conn.commit()
                    updated += 1
                except psycopg.errors.UniqueViolation:
                    conn.rollback()
                    conflicts += 1

        for sid in spotify_ids:
            if sid not in real_isrcs:
                no_isrc_returned += 1

        if (batch_idx // BATCH_SIZE) % 20 == 0 and batch_idx > 0:
            elapsed = time.monotonic() - started
            done = batch_idx + BATCH_SIZE
            rate = done / elapsed if elapsed else 0
            eta_sec = (total - done) / rate if rate else 0
            print(
                f"  진행 {done}/{total} | updated={updated} conflicts={conflicts} "
                f"no_isrc={no_isrc_returned} | {rate:.0f}/s | ETA {int(eta_sec/60)}m"
            )

        await asyncio.sleep(RATE_LIMIT_SEC)

    conn.close()
    elapsed = time.monotonic() - started
    print(
        f"\n✓ 완료 ({int(elapsed)}s) — total={total} updated={updated} "
        f"conflicts={conflicts} no_isrc={no_isrc_returned}"
    )


if __name__ == "__main__":
    limit_arg = int(sys.argv[1]) if len(sys.argv) > 1 else None
    asyncio.run(main(limit=limit_arg))
