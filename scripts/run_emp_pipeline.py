#!/usr/bin/env python3
"""scripts/run_emp_pipeline.py — systemd timer 호출용.

- SIGTERM (systemd timeout/stop) 을 SystemExit으로 변환 → runner가 run을 failed로 마감
- 시작 시 좀비 정리: systemd oneshot이 단일 인스턴스를 보장하므로
  (timer/수동 trigger 모두 systemctl start 경유 — active 중이면 no-op)
  이 프로세스가 시작된 시점에 남아 있는 'running' row는 전부 죽은 run.
  나이 무관하게 failed로 마감 후 진행 — 좀비가 새 run을 막는 일 없음.
"""
from __future__ import annotations

import asyncio
import os
import signal
import sys

import psycopg

from mrms.db.emp import fail_stale_runs
from mrms.emp.runner import run_pipeline


def _sigterm(_sig, _frame):  # noqa: ANN001
    raise SystemExit(143)


async def main() -> int:
    conn = psycopg.connect(os.environ["DATABASE_URL"])
    try:
        zombies = fail_stale_runs(conn, older_than_hours=0)
        if zombies:
            print(f"watchdog: {zombies}개 좀비 run → failed 처리")

        run_id = await run_pipeline(conn, platform="all", triggered_by="scheduler")
        print(f"✓ run_id={run_id}")
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    signal.signal(signal.SIGTERM, _sigterm)
    sys.exit(asyncio.run(main()))
