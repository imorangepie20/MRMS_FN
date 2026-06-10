"""파이프라인 runner — importers + 02/03/07 호출 + IngestionRun 기록."""
from __future__ import annotations

import os
import subprocess
import time

import psycopg

from mrms.db.emp import append_stage, create_run, finish_run


def _ms_since(t0: float) -> int:
    return int((time.monotonic() - t0) * 1000)


async def _run_importer_tidal(conn) -> dict:
    from mrms.emp.tidal import TidalEMPImporter
    importer = TidalEMPImporter(conn=conn)  # token 자동 로딩 from Setting
    return await importer.import_all(conn)


async def _run_importer_spotify(conn) -> dict:
    from mrms.emp.spotify import SpotifyEMPImporter
    importer = SpotifyEMPImporter(
        client_id=os.environ["SPOTIFY_CLIENT_ID"],
        client_secret=os.environ["SPOTIFY_CLIENT_SECRET"],
    )
    return await importer.import_all(conn)


def _run_script(args: list[str]) -> dict:
    """subprocess로 외부 스크립트 실행 + 종료 코드 + 시간 기록."""
    t0 = time.monotonic()
    try:
        proc = subprocess.run(args, capture_output=True, text=True, timeout=3600)
        ok = proc.returncode == 0
        return {
            "status": "success" if ok else "failed",
            "duration_ms": _ms_since(t0),
            "stdout": (proc.stdout or "")[-2000:],
            "stderr": (proc.stderr or "")[-2000:],
            "error": None if ok else f"exit {proc.returncode}",
        }
    except Exception as e:
        return {
            "status": "failed",
            "duration_ms": _ms_since(t0),
            "stdout": "",
            "stderr": "",
            "error": f"{type(e).__name__}: {str(e)[:200]}",
        }


def _run_audio_download(limit: int = 500) -> dict:
    return _run_script([
        ".venv/bin/python",
        "scripts/02_download_audio.py",
        "--emp-only",
        "--limit",
        str(limit),
    ])


def _run_extract_embeddings() -> dict:
    return _run_script([".venv/bin/python", "scripts/03_extract_embeddings.py"])


def _run_load_to_db() -> dict:
    return _run_script([".venv/bin/python", "scripts/07_load_to_db.py"])


async def run_pipeline(
    conn: psycopg.Connection,
    platform: str = "all",
    triggered_by: str = "scheduler",
) -> str:
    """전체 파이프라인 한 사이클. run_id 반환."""
    run_id = create_run(conn, platform=platform, triggered_by=triggered_by)
    overall_ok = True

    # importers
    if platform in ("all", "tidal"):
        t0 = time.monotonic()
        try:
            s = await _run_importer_tidal(conn)
            append_stage(conn, run_id, {
                "stage": "import_tidal",
                "status": "success" if not s["errors"] else "partial",
                "tracks_new": s["tracks_new"],
                "tracks_existing": s["tracks_existing"],
                "duration_ms": _ms_since(t0),
                "error": "; ".join(s["errors"])[:500] if s["errors"] else None,
            })
            if s["errors"]:
                overall_ok = False
        except Exception as e:
            append_stage(conn, run_id, {
                "stage": "import_tidal",
                "status": "failed",
                "duration_ms": _ms_since(t0),
                "error": f"{type(e).__name__}: {str(e)[:300]}",
            })
            overall_ok = False

    if platform in ("all", "spotify"):
        t0 = time.monotonic()
        try:
            s = await _run_importer_spotify(conn)
            append_stage(conn, run_id, {
                "stage": "import_spotify",
                "status": "success" if not s["errors"] else "partial",
                "tracks_new": s["tracks_new"],
                "tracks_existing": s["tracks_existing"],
                "duration_ms": _ms_since(t0),
                "error": "; ".join(s["errors"])[:500] if s["errors"] else None,
            })
            if s["errors"]:
                overall_ok = False
        except Exception as e:
            append_stage(conn, run_id, {
                "stage": "import_spotify",
                "status": "failed",
                "duration_ms": _ms_since(t0),
                "error": f"{type(e).__name__}: {str(e)[:300]}",
            })
            overall_ok = False

    # audio download
    s = _run_audio_download()
    append_stage(conn, run_id, {"stage": "download_audio", **s})
    if s["status"] != "success":
        overall_ok = False

    # extract embeddings
    s = _run_extract_embeddings()
    append_stage(conn, run_id, {"stage": "extract_embeddings", **s})
    if s["status"] != "success":
        overall_ok = False

    # load to DB
    s = _run_load_to_db()
    append_stage(conn, run_id, {"stage": "load_to_db", **s})
    if s["status"] != "success":
        overall_ok = False

    finish_run(conn, run_id=run_id, status="success" if overall_ok else "partial")
    return run_id
