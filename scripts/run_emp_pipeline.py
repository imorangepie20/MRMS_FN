#!/usr/bin/env python3
"""scripts/run_emp_pipeline.py — systemd timer 호출용.

- SIGTERM (systemd timeout/stop) 을 SystemExit으로 변환 → runner가 run을 failed로 마감
- 시작 전 watchdog: 좀비 'running' row 정리
- 동시 실행 가드: 진행 중인 run 있으면 skip (nightly + 수동 trigger 중첩 방지)
"""
from __future__ import annotations

import asyncio
import os
import signal
import sys

import psycopg

from mrms.db.emp import fail_stale_runs, has_active_run
from mrms.emp.runner import run_pipeline


def _sigterm(_sig, _frame):  # noqa: ANN001
    raise SystemExit(143)


async def main() -> int:
    conn = psycopg.connect(os.environ["DATABASE_URL"])
    try:
        stale = fail_stale_runs(conn)
        if stale:
            print(f"watchdog: {stale}개 좀비 run → failed 처리")

        if has_active_run(conn):
            print("다른 run이 진행 중 — skip (동시 실행 방지)")
            return 0

        run_id = await run_pipeline(conn, platform="all", triggered_by="scheduler")
        print(f"✓ run_id={run_id}")
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    signal.signal(signal.SIGTERM, _sigterm)
    sys.exit(asyncio.run(main()))
