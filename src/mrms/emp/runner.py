"""파이프라인 runner — importers + 02/03/10 호출 + IngestionRun 기록."""
from __future__ import annotations

import os
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

from mrms.config import settings  # noqa: E402 (module-level constant 초기화 후 import)

# 유저 라이브러리 youtube 미스곡 전용 오디오 디렉토리 — EMP 카탈로그 audio_dir과 분리해
# 메인 03(decode 캐시 사용)이 미스곡 m4a를 건너뛰는 문제를 회피한다.
_YT_MISSES_DIR = settings.audio_dir.parent / "audio_yt_misses"
# 존재하지 않는 경로 → 03의 use_cache=False → audio-dir 직접 디코딩(캐시 우회).
_NO_DECODE_CACHE = settings.data_root / "_no_decode_cache"


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
    summary = await importer.import_all(conn)
    # 클래식 공연 실황 비디오(YouTube Data API) — 음악 import과 별개 섹션.
    # 래퍼에 둠: test_runner는 이 함수를 통째로 patch하고, youtube import_all 단위테스트는
    # import_all을 직접 호출하므로 어느 테스트도 실제 googleapis를 때리지 않는다.
    try:
        import httpx

        from mrms.emp.youtube_videos import import_classical_videos, import_jazz_videos
        async with httpx.AsyncClient(timeout=20.0) as http:
            try:
                await import_classical_videos(conn, http)
            except Exception as e:
                safe_rollback(conn)
                summary.setdefault("errors", []).append(f"classical_videos: {fmt_exc(e, 120)}")
            try:
                await import_jazz_videos(conn, http)
            except Exception as e:
                safe_rollback(conn)
                summary.setdefault("errors", []).append(f"jazz_videos: {fmt_exc(e, 120)}")
    except Exception as e:
        safe_rollback(conn)
        summary.setdefault("errors", []).append(f"videos: {fmt_exc(e, 120)}")
    return summary


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


def _run_enrich_isrc() -> dict:
    """합성-ISRC EMP 트랙을 real ISRC로 역해결 → 머지/re-key (02 download 전)."""
    return _run_script([sys.executable, _script_path("14_enrich_emp_isrc.py")])


def _run_extract_embeddings() -> dict:
    return _run_script([sys.executable, _script_path("03_extract_embeddings.py")])


def _run_load_to_db() -> dict:
    """증분 EMP 임베딩 로더 (10) — 07은 일회성 카탈로그 적재용(parquet 입력 필요)이라
    증분 EMP 트랙엔 입력 파일이 없어 실패함. stage 이름 'load_to_db'는 admin UI 호환 유지."""
    return _run_script([sys.executable, _script_path("10_load_emp_embeddings.py")])


def _run_youtube_misses(limit: int = 500) -> dict:
    """유저 라이브러리 youtube 미스곡: 13(다운로드, 전용 dir) + 03(추출, 캐시 우회).

    npy는 03 기본 out-dir(embed_dir/mert_v1_95m)에 생성 → 이후 load_to_db(10)이
    fetch_pending으로 미스곡을 잡아 적재한다. 메인 audio_dir과 분리해 decode 캐시
    충돌을 피한다. GPU 디바이스는 MRMS_EMBED_DEVICE(기본 cuda)로 지정."""
    t0 = time.monotonic()
    dl = _run_script([
        sys.executable, _script_path("13_embed_youtube_misses.py"),
        "--limit", str(limit), "--sleep", "2",
        "--audio-dir", str(_YT_MISSES_DIR),
    ])
    if dl["status"] != "success":
        dl["duration_ms"] = _ms_since(t0)
        return dl
    ex = _run_script([
        sys.executable, _script_path("03_extract_embeddings.py"),
        "--audio-dir", str(_YT_MISSES_DIR),
        "--cache-dir", str(_NO_DECODE_CACHE),
        "--device", os.environ.get("MRMS_EMBED_DEVICE", "cuda"),
    ])
    ex["duration_ms"] = _ms_since(t0)
    return ex


def _run_regenerate_mrt(conn: psycopg.Connection) -> dict:
    """stale MRT 유저 재생성 (in-process). 유저별 try/except + commit로 격리."""
    from mrms.db.user_embedding import prune_playlist_history
    from mrms.recsys.mrt import generate_user_mrt, select_stale_mrt_users

    t0 = time.monotonic()
    try:
        users = select_stale_mrt_users(conn)
    except Exception as e:
        safe_rollback(conn)
        return {"status": "failed", "duration_ms": _ms_since(t0),
                "stdout": "", "stderr": "", "error": fmt_exc(e, 300)}
    regenerated = 0
    failed = 0
    for uid in users:
        try:
            # 기본 k/top_n/candidate_pool(DEFAULT_*) 사용 — 이는 운영 MRT의 정본 값이며,
            # select_stale_mrt_users가 거르는 MODEL_VERSION(+persona-K3 = DEFAULT_K)과 일치해야 한다.
            # onboarding/scripts09가 비기본 top_n·candidate_pool로 바꾸면 여기도 맞춰야 추천 폭이 안 어긋난다.
            if generate_user_mrt(conn, uid) is not None:
                conn.commit()
                prune_playlist_history(conn, uid)   # 최신 N generation만 유지
                regenerated += 1
        except Exception:
            safe_rollback(conn)
            failed += 1
    return {
        "status": "success" if failed == 0 else "partial",
        "duration_ms": _ms_since(t0),
        "stdout": f"stale={len(users)} regenerated={regenerated} failed={failed}",
        "stderr": "",
        "error": None if failed == 0 else f"{failed} user(s) failed",
    }


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

        # 합성-ISRC enrichment — 중복 머지/신곡 re-key (download_audio 전에)
        s = _run_enrich_isrc()
        append_stage(conn, run_id, {"stage": "enrich_isrc", **s})
        if s["status"] != "success":
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

        # youtube 미스곡 다운로드 + 전용 추출 (신규)
        s = _run_youtube_misses()
        append_stage(conn, run_id, {"stage": "youtube_misses", **s})
        if s["status"] != "success":
            overall_ok = False

        # load to DB
        s = _run_load_to_db()
        append_stage(conn, run_id, {"stage": "load_to_db", **s})
        if s["status"] != "success":
            overall_ok = False

        # stale MRT 재생성 (신규)
        s = _run_regenerate_mrt(conn)
        append_stage(conn, run_id, {"stage": "regenerate_mrt", **s})
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
