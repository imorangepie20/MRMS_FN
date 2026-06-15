#!/usr/bin/env python3
"""기존 플레이리스트 곡 → UserTrack(source='curated') 소급 백필.

플레이리스트 생성 시 UserTrack을 만들도록 고친(028b8da) 이전에 만들어진 플레이리스트의
곡들은 UserTrack 행이 없어 MRT 추천에 계속 남는다(생성=Playlist/PlaylistTrack에만 적재,
MRT hidden 필터는 UserTrack만 봄). 이 스크립트는 모든 user-created Playlist의 곡 중
UserTrack이 없는 것을 source='curated'로 편입해 MRT에서 제외시킨다(소급 적용).

- 이미 UserTrack이 있는 곡(liked/pct 등)은 건드리지 않는다 — UserTrack 없는 쌍만 처리.
- create_playlist와 동일한 헬퍼(upsert_user_track, source='curated')를 재사용 →
  id 규칙·conflict 규칙 일치. source='curated'는 PGT imported('playlist%')와 안 겹친다.
- 멱등·resumable: 재실행해도 UserTrack 없는 것만 추가(중복/덮어쓰기 없음).

Usage:
    python scripts/backfill_playlist_usertracks.py --dry-run   # 미리보기(쓰기 없음)
    python scripts/backfill_playlist_usertracks.py             # 실제 백필
"""
from __future__ import annotations

import argparse
import os
import sys

import psycopg

from mrms.db.user_track import upsert_user_track

_MISSING_SQL = '''
    SELECT DISTINCT p."userId", pt."trackId"
    FROM "PlaylistTrack" pt
    JOIN "Playlist" p ON p.id = pt."playlistId"
    WHERE NOT EXISTS (
        SELECT 1 FROM "UserTrack" ut
        WHERE ut."userId" = p."userId" AND ut."trackId" = pt."trackId"
    )
'''


def find_missing(conn: psycopg.Connection) -> list[tuple[str, str]]:
    """UserTrack이 없는 (userId, trackId) 플레이리스트 멤버 쌍."""
    with conn.cursor() as cur:
        cur.execute(_MISSING_SQL)
        return [(r[0], r[1]) for r in cur.fetchall()]


def backfill(conn: psycopg.Connection, *, dry_run: bool) -> int:
    """UserTrack 없는 플레이리스트 곡을 source='curated'로 편입. 처리(예정) 수 반환."""
    missing = find_missing(conn)
    if dry_run:
        return len(missing)
    for user_id, track_id in missing:
        upsert_user_track(
            conn, user_id, track_id, is_core=False, source="curated", platform="mrms"
        )
    conn.commit()
    return len(missing)


def main() -> int:
    ap = argparse.ArgumentParser(
        description="기존 플레이리스트 곡 → UserTrack(curated) 소급 백필"
    )
    ap.add_argument(
        "--dry-run", action="store_true", help="미리보기 — 쓰기 없이 대상 수만 출력"
    )
    args = ap.parse_args()

    conn = psycopg.connect(os.environ["DATABASE_URL"])
    try:
        n = backfill(conn, dry_run=args.dry_run)
    finally:
        conn.close()

    if args.dry_run:
        print(f"[dry-run] UserTrack 없는 플레이리스트 곡 {n}개 → 'curated' 편입 예정")
    else:
        print(f"[done] 플레이리스트 곡 {n}개를 'curated'로 편입(소급) — MRT에서 제외됨")
    return 0


if __name__ == "__main__":
    sys.exit(main())
