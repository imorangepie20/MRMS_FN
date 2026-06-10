#!/usr/bin/env python3
"""EMP import CLI.

Usage:
    python scripts/import_emp.py --platform tidal
    python scripts/import_emp.py --platform spotify
    python scripts/import_emp.py --platform all
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys

import psycopg


def get_conn() -> psycopg.Connection:
    return psycopg.connect(os.environ["DATABASE_URL"])


async def run_platform(platform: str, conn: psycopg.Connection) -> dict:
    if platform == "tidal":
        from mrms.emp.tidal import TidalEMPImporter
        importer = TidalEMPImporter(
            client_id=os.environ["TIDAL_CLIENT_ID"],
            client_secret=os.environ["TIDAL_CLIENT_SECRET"],
        )
    elif platform == "spotify":
        from mrms.emp.spotify import SpotifyEMPImporter
        importer = SpotifyEMPImporter(
            client_id=os.environ["SPOTIFY_CLIENT_ID"],
            client_secret=os.environ["SPOTIFY_CLIENT_SECRET"],
        )
    else:
        raise ValueError(f"unknown platform: {platform}")

    print(f"[import] {platform}…")
    summary = await importer.import_all(conn)
    print(
        f"[import] {platform}: new={summary['tracks_new']} "
        f"existing={summary['tracks_existing']} "
        f"playlists={summary['playlists_processed']} "
        f"errors={len(summary['errors'])}"
    )
    for err in summary["errors"][:5]:
        print(f"  ! {err}")
    return summary


async def main(platforms: list[str]) -> int:
    conn = get_conn()
    try:
        total_new = 0
        total_err = 0
        for p in platforms:
            try:
                summary = await run_platform(p, conn)
                total_new += summary["tracks_new"]
                total_err += len(summary["errors"])
            except Exception as e:
                print(f"  ✗ {p} failed: {type(e).__name__}: {e}", file=sys.stderr)
                total_err += 1
        print(f"\n✓ Done. new tracks={total_new}, errors={total_err}")
        return 0 if total_err == 0 else 1
    finally:
        conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--platform", choices=["tidal", "spotify", "all"], required=True)
    args = parser.parse_args()
    if args.platform == "all":
        plats = ["tidal", "spotify"]
    else:
        plats = [args.platform]
    sys.exit(asyncio.run(main(plats)))
