#!/usr/bin/env python3
"""scripts/run_emp_pipeline.py — systemd timer 호출용."""
from __future__ import annotations

import asyncio
import os
import sys

import psycopg

from mrms.emp.runner import run_pipeline


async def main() -> int:
    conn = psycopg.connect(os.environ["DATABASE_URL"])
    try:
        run_id = await run_pipeline(conn, platform="all", triggered_by="scheduler")
        print(f"✓ run_id={run_id}")
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
