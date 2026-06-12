"""파이프라인 runner — importers + 02/03/10 호출 + IngestionRun 기록."""
from __future__ import annotations

import subprocess
import sys
import time
from pathlib import Path

import psycopg

from mrms.db.emp import append_stage, create_run, finish_run
from mrms.emp import make_importer
from mrms.emp.base import fmt_exc, safe_rollback

# repo 루트 절대 경로 (editable install 기준 src/mrms/emp/runner.py → 3단계 위)
# — systemd WorkingDirectory 외의 cwd에서 호출돼도 스크립트 경로가 깨지지 않음
_REPO_ROOT = Path(__file__).resolve().parents[3]


def _ms_since(t0: float) -> int:
    return int((time.monotonic() - t0) * 1000)


async def _run_importer_tidal(conn) -> dict:
    importer = make_importer("tidal", conn)
    return await importer.import_all(conn)


async def _run_importer_spotify(conn) -> dict:
    importer = make_importer("spotify", conn)
    return await importer.import_all(conn)


async def _run_importer_flo(conn) -> dict:
    importer = make_importer("flo", conn)
    return await importer.import_all(conn)


async def _run_importer_melon(conn) -> dict:
    importer = make_importer("melon", conn)
    return await importer.import_all(conn)


async def _run_importer_vibe(conn) -> dict:
    importer = make_importer("vibe", conn)
    return await importer.import_all(conn)


async def _run_importer_apple(conn) -> dict:
    importer = make_importer("apple", conn)
    return await importer.import_all(conn)


async def _run_importer_youtube(conn) -> dict:
    importer = make_importer("youtube", conn)
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
            "error": fmt_exc(e),
        }


def _script_path(name: str) -> str:
    return str(_REPO_ROOT / "scripts" / name)


def _run_audio_download(limit: int = 500) -> dict:
    return _run_script([
        sys.executable,
        _script_path("02_download_audio.py"),
        "--emp-only",
        "--limit",
        str(limit),
    ])


def _run_extract_embeddings() -> dict:
    return _run_script([sys.executable, _script_path("03_extract_embeddings.py")])


def _run_load_to_db() -> dict:
    """증분 EMP 임베딩 로더 (10) — 07은 일회성 카탈로그 적재용(parquet 입력 필요)이라
    증분 EMP 트랙엔 입력 파일이 없어 실패함. stage 이름 'load_to_db'는 admin UI 호환 유지."""
    return _run_script([sys.executable, _script_path("10_load_emp_embeddings.py")])


async def _import_stage(
    conn: psycopg.Connection, run_id: str, stage_name: str, importer_fn
) -> bool:
    """importer 1개 실행 + stage 기록. 에러 없이 끝났으면 True."""
    t0 = time.monotonic()
    try:
        s = await importer_fn(conn)
        append_stage(conn, run_id, {
            "stage": stage_name,
            "status": "success" if not s["errors"] else "partial",
            "tracks_new": s["tracks_new"],
            "tracks_existing": s["tracks_existing"],
            "duration_ms": _ms_since(t0),
            "error": "; ".join(s["errors"])[:500] if s["errors"] else None,
        })
        return not s["errors"]
    except Exception as e:
        safe_rollback(conn)  # importer가 트랜잭션을 깨뜨린 채 raise한 경우 복구
        append_stage(conn, run_id, {
            "stage": stage_name,
            "status": "failed",
            "duration_ms": _ms_since(t0),
            "error": fmt_exc(e, 300),
        })
        return False


async def run_pipeline(
    conn: psycopg.Connection,
    platform: str = "all",
    triggered_by: str = "scheduler",
) -> str:
    """전체 파이프라인 한 사이클. run_id 반환.

    crash-safe: SIGTERM(SystemExit)·예외로 중단돼도 run을 failed로 마감해
    'running' 좀비 row가 남지 않도록 함."""
    run_id = create_run(conn, platform=platform, triggered_by=triggered_by)
    overall_ok = True

    try:
        # importers — 모듈 attr로 참조해야 테스트의 patch가 적용됨
        for plat, stage_name, importer_fn in (
            ("tidal", "import_tidal", _run_importer_tidal),
            ("spotify", "import_spotify", _run_importer_spotify),
            ("flo", "import_flo", _run_importer_flo),
            ("melon", "import_melon", _run_importer_melon),
            ("vibe", "import_vibe", _run_importer_vibe),
            ("apple", "import_apple", _run_importer_apple),
            ("youtube", "import_youtube", _run_importer_youtube),
        ):
            if platform in ("all", plat):
                if not await _import_stage(conn, run_id, stage_name, importer_fn):
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
    except BaseException:
        # SystemExit(SIGTERM)·KeyboardInterrupt 포함 — 마감 후 re-raise
        safe_rollback(conn)  # 깨진 트랜잭션이면 finish_run도 실패하므로 먼저 복구
        try:
            finish_run(conn, run_id=run_id, status="failed")
        except Exception:
            pass  # DB까지 죽은 경우 — watchdog이 다음 run에서 정리
        raise

    finish_run(conn, run_id=run_id, status="success" if overall_ok else "partial")
    return run_id
