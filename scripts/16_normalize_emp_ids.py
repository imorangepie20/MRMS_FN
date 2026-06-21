"""머지로 stale해진 EMPSource id 정규화 (일회성·멱등).

enrichment 머지(_repoint_or_drop)가 trackId만 바꿔 EMPSource.id가 옛 synth 기준으로
남은 행을 정본 공식으로 재계산한다:
    EMPSource.id = stable_id("emp|{trackId}|{platform}|{source_id}")
stale id는 import가 머지로 사라진 합성 트랙을 재생성할 때 EMPSource_pkey PK 충돌을
일으키는데, 정규화하면 그 충돌이 사라진다. (각 (trackId,platform,source_id)가 유니크
id로 사상돼 재계산 중 충돌 없음.) 재실행 안전.

※ TrackPlatform은 카탈로그(07 로더)가 다른 id 스킴을 써 전역 재계산이 불가하고
   import 충돌 원인도 아니라 건드리지 않는다.

Usage:
    DATABASE_URL=<prod> python scripts/16_normalize_emp_ids.py --dry-run
    DATABASE_URL=<prod> python scripts/16_normalize_emp_ids.py
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

import psycopg

from mrms.db.ids import stable_id as _id


def _normalize(conn: psycopg.Connection, table: str, cols: str, id_fn, dry_run: bool) -> int:
    with conn.cursor() as cur:
        cur.execute(f'SELECT id, {cols} FROM "{table}"')
        rows = cur.fetchall()
    updates = [(id_fn(r), r[0]) for r in rows if id_fn(r) != r[0]]
    print(f"  {table}: {len(rows):,} scanned, {len(updates):,} stale")
    if updates and not dry_run:
        with conn.cursor() as uc:
            uc.executemany(f'UPDATE "{table}" SET id = %s WHERE id = %s', updates)
        conn.commit()
        print(f"    → {len(updates):,} 정규화 완료")
    return len(updates)


def main() -> None:
    ap = argparse.ArgumentParser(description="EMPSource/TrackPlatform stale id 정규화")
    ap.add_argument("--dry-run", action="store_true", help="변경 없이 stale 수만 집계")
    args = ap.parse_args()

    conn = psycopg.connect(os.environ["DATABASE_URL"])
    try:
        print("DRY-RUN" if args.dry_run else "LIVE")
        # r = (id, trackId, platform, source_id)
        n1 = _normalize(
            conn, "EMPSource", '"trackId", platform, source_id',
            lambda r: _id(f"emp|{r[1]}|{r[2]}|{r[3]}"), args.dry_run,
        )
        verb = "would normalize" if args.dry_run else "normalized"
        print(f"\n{verb}: EMPSource {n1:,}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
