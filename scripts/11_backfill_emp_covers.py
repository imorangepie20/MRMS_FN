#!/usr/bin/env python3
"""EMP 트랙 커버 완전 백필 — cover_url 비어있는 EMPSource를 iTunes 아트워크로 채운다.

importer 재import는 "현재 소스에서 다시 만난 트랙"만 백필하므로(ON CONFLICT COALESCE),
과거 소스의 트랙은 안 채워진다. 이 스크립트는 cover_url IS NULL인 모든 EMPSource를
(artist, album) 단위로 묶어 iTunes Search로 커버를 받아 일괄 UPDATE한다.

- album 단위 그룹 → iTunes 호출 수 최소 (4만 트랙도 고유 앨범은 수천).
- ArtworkCache 재사용 — 이미 조회한 (artist, album)은 외부 호출 없이 즉시.
- cover_url IS NULL 조건이라 resumable (중단 후 재실행 = 남은 것만).
- album_title 없는 트랙(Spotify embed 등)은 검색 불가 → skip (어차피 커버 소스 없음).

Usage:
    python scripts/11_backfill_emp_covers.py                  # 전체
    python scripts/11_backfill_emp_covers.py --limit 500      # 고유 앨범 500개만
    python scripts/11_backfill_emp_covers.py --sleep 2        # iTunes 호출 간 sleep(초)
    python scripts/11_backfill_emp_covers.py --platform tidal # 특정 플랫폼만
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys
import time

import psycopg

from mrms.api.artwork import _fetch_itunes
from mrms.db.artwork import get_cached, upsert


def _pending_albums(
    conn: psycopg.Connection, platform: str | None, limit: int
) -> list[tuple[str, str]]:
    """cover 비어있는 EMPSource의 고유 (artist, album). album_title 있는 것만."""
    where = (
        'es.cover_url IS NULL '
        "AND alb.title IS NOT NULL AND alb.title <> '' "
    )
    params: list = []
    if platform:
        where += "AND es.platform = %s "
        params.append(platform)
    sql = (
        'SELECT DISTINCT ar.name, alb.title '
        'FROM "EMPSource" es '
        'JOIN "Track" t ON t.id = es."trackId" '
        'JOIN "Artist" ar ON ar.id = t."artistId" '
        'JOIN "Album" alb ON alb.id = t."albumId" '
        f'WHERE {where}'
        'ORDER BY ar.name '
    )
    if limit:
        sql += "LIMIT %s"
        params.append(limit)
    with conn.cursor() as cur:
        cur.execute(sql, tuple(params))
        return [(r[0], r[1]) for r in cur.fetchall()]


def _apply_cover(
    conn: psycopg.Connection, artist: str, album: str, url: str
) -> int:
    """그 (artist, album)에 속한 cover NULL인 EMPSource를 일괄 UPDATE. 갱신 수 반환."""
    with conn.cursor() as cur:
        cur.execute(
            '''UPDATE "EMPSource" es
               SET cover_url = %s
               FROM "Track" t
               JOIN "Album" alb ON alb.id = t."albumId"
               JOIN "Artist" ar ON ar.id = t."artistId"
               WHERE es."trackId" = t.id
                 AND es.cover_url IS NULL
                 AND ar.name = %s AND alb.title = %s''',
            (url, artist, album),
        )
        n = cur.rowcount
    conn.commit()
    return n


async def main(platform: str | None, limit: int, sleep_s: float) -> int:
    conn = psycopg.connect(os.environ["DATABASE_URL"])
    try:
        pairs = _pending_albums(conn, platform, limit)
        print(f"백필 대상: {len(pairs)} 고유 (artist, album)")
        if not pairs:
            print("채울 게 없습니다.")
            return 0

        filled_rows = 0
        miss_calls = 0
        no_art = 0
        for i, (artist, album) in enumerate(pairs):
            hit, url = get_cached(conn, artist, album)
            if not hit:
                url = await _fetch_itunes(artist, album)
                upsert(conn, artist, album, url)
                miss_calls += 1
                if sleep_s > 0:
                    time.sleep(sleep_s)  # iTunes rate limit 배려
            if url:
                filled_rows += _apply_cover(conn, artist, album, url)
            else:
                no_art += 1
            if i % 50 == 0:
                print(
                    f"  {i}/{len(pairs)} … filled rows={filled_rows} "
                    f"itunes_calls={miss_calls} no_art={no_art}"
                )

        print(
            f"\n✓ 완료. EMPSource {filled_rows} rows 커버 백필, "
            f"iTunes 호출 {miss_calls}, 아트 없음 {no_art}"
        )
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--platform", type=str, default=None,
                        help="특정 플랫폼만 (tidal/flo/vibe/...). 생략 시 전체")
    parser.add_argument("--limit", type=int, default=0,
                        help="고유 앨범 처리 상한 (0 = 전체)")
    parser.add_argument("--sleep", type=float, default=1.5,
                        help="iTunes 호출(캐시 미스) 간 sleep 초")
    args = parser.parse_args()
    sys.exit(asyncio.run(main(args.platform, args.limit, args.sleep)))
