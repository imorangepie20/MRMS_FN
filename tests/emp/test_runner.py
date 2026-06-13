"""Pipeline runner — orchestrates importers + audio + extract + load, records IngestionRun."""
from unittest.mock import patch


async def test_run_pipeline_records_run(db_conn, cleanup):
    """run_pipeline → IngestionRun row 생성 + stages append + finish."""
    from mrms.emp.runner import run_pipeline

    async def fake_import_tidal(conn):
        return {
            "tracks_new": 5,
            "tracks_existing": 2,
            "playlists_processed": 3,
            "errors": [],
        }

    async def fake_import_spotify(conn):
        return {
            "tracks_new": 3,
            "tracks_existing": 1,
            "playlists_processed": 2,
            "errors": [],
        }

    async def fake_import_flo(conn):
        return {
            "tracks_new": 4,
            "tracks_existing": 1,
            "playlists_processed": 2,
            "errors": [],
        }

    async def fake_import_melon(conn):
        return {
            "tracks_new": 10,
            "tracks_existing": 0,
            "playlists_processed": 1,
            "errors": [],
        }

    async def fake_import_vibe(conn):
        return {
            "tracks_new": 8,
            "tracks_existing": 2,
            "playlists_processed": 4,
            "errors": [],
        }

    async def fake_import_apple(conn):
        return {
            "tracks_new": 6,
            "tracks_existing": 1,
            "playlists_processed": 2,
            "errors": [],
        }

    async def fake_import_youtube(conn):
        return {
            "tracks_new": 7,
            "tracks_existing": 3,
            "playlists_processed": 2,
            "errors": [],
        }

    ok_stage = {
        "status": "success",
        "duration_ms": 100,
        "stdout": "",
        "stderr": "",
        "error": None,
    }

    with patch("mrms.emp.runner._run_importer_tidal", new=fake_import_tidal), \
         patch("mrms.emp.runner._run_importer_spotify", new=fake_import_spotify), \
         patch("mrms.emp.runner._run_importer_flo", new=fake_import_flo), \
         patch("mrms.emp.runner._run_importer_melon", new=fake_import_melon), \
         patch("mrms.emp.runner._run_importer_vibe", new=fake_import_vibe), \
         patch("mrms.emp.runner._run_importer_apple", new=fake_import_apple), \
         patch("mrms.emp.runner._run_importer_youtube", new=fake_import_youtube), \
         patch("mrms.emp.runner._run_audio_download", return_value=ok_stage), \
         patch("mrms.emp.runner._run_extract_embeddings", return_value=ok_stage), \
         patch("mrms.emp.runner._run_youtube_misses", return_value=ok_stage), \
         patch("mrms.emp.runner._run_load_to_db", return_value=ok_stage), \
         patch("mrms.emp.runner._run_regenerate_mrt", return_value=ok_stage):
        run_id = await run_pipeline(db_conn, platform="all", triggered_by="manual")

    cleanup('DELETE FROM "IngestionRun" WHERE id = %s', (run_id,))

    with db_conn.cursor() as cur:
        cur.execute(
            'SELECT status, stages FROM "IngestionRun" WHERE id = %s',
            (run_id,),
        )
        status, stages = cur.fetchone()
    assert status == "success"
    stage_names = [s["stage"] for s in stages]
    assert "import_tidal" in stage_names
    assert "import_spotify" in stage_names
    assert "import_flo" in stage_names
    assert "import_melon" in stage_names
    assert "import_vibe" in stage_names
    assert "import_apple" in stage_names
    assert "import_youtube" in stage_names
    assert "download_audio" in stage_names
    assert "extract_embeddings" in stage_names
    assert "load_to_db" in stage_names


async def test_run_pipeline_partial_on_failure(db_conn, cleanup):
    """한 stage 실패 시 status = partial."""
    from mrms.emp.runner import run_pipeline

    async def fake_import_tidal(conn):
        return {"tracks_new": 5, "tracks_existing": 2, "playlists_processed": 3, "errors": []}

    async def fake_import_spotify(conn):
        return {"tracks_new": 3, "tracks_existing": 1, "playlists_processed": 2, "errors": []}

    async def fake_import_flo(conn):
        return {"tracks_new": 4, "tracks_existing": 1, "playlists_processed": 2, "errors": []}

    async def fake_import_melon(conn):
        return {"tracks_new": 10, "tracks_existing": 0, "playlists_processed": 1, "errors": []}

    async def fake_import_vibe(conn):
        return {"tracks_new": 8, "tracks_existing": 2, "playlists_processed": 4, "errors": []}

    async def fake_import_apple(conn):
        return {"tracks_new": 6, "tracks_existing": 1, "playlists_processed": 2, "errors": []}

    async def fake_import_youtube(conn):
        return {"tracks_new": 7, "tracks_existing": 3, "playlists_processed": 2, "errors": []}

    ok_stage = {"status": "success", "duration_ms": 100, "stdout": "", "stderr": "", "error": None}
    fail_stage = {"status": "failed", "duration_ms": 50, "stdout": "", "stderr": "boom", "error": "exit 1"}

    with patch("mrms.emp.runner._run_importer_tidal", new=fake_import_tidal), \
         patch("mrms.emp.runner._run_importer_spotify", new=fake_import_spotify), \
         patch("mrms.emp.runner._run_importer_flo", new=fake_import_flo), \
         patch("mrms.emp.runner._run_importer_melon", new=fake_import_melon), \
         patch("mrms.emp.runner._run_importer_vibe", new=fake_import_vibe), \
         patch("mrms.emp.runner._run_importer_apple", new=fake_import_apple), \
         patch("mrms.emp.runner._run_importer_youtube", new=fake_import_youtube), \
         patch("mrms.emp.runner._run_audio_download", return_value=fail_stage), \
         patch("mrms.emp.runner._run_extract_embeddings", return_value=ok_stage), \
         patch("mrms.emp.runner._run_youtube_misses", return_value=ok_stage), \
         patch("mrms.emp.runner._run_load_to_db", return_value=ok_stage), \
         patch("mrms.emp.runner._run_regenerate_mrt", return_value=ok_stage):
        run_id = await run_pipeline(db_conn, platform="all", triggered_by="scheduler")

    cleanup('DELETE FROM "IngestionRun" WHERE id = %s', (run_id,))

    with db_conn.cursor() as cur:
        cur.execute('SELECT status FROM "IngestionRun" WHERE id = %s', (run_id,))
        assert cur.fetchone()[0] == "partial"


async def test_run_pipeline_crash_marks_failed(db_conn, cleanup):
    """SIGTERM(SystemExit) 등으로 중단돼도 run이 failed로 마감 — 좀비 'running' 방지."""
    import pytest
    from mrms.emp.runner import run_pipeline

    async def boom(conn):
        raise SystemExit(143)  # SIGTERM 핸들러 경로

    with patch("mrms.emp.runner._run_importer_tidal", new=boom):
        with pytest.raises(SystemExit):
            await run_pipeline(db_conn, platform="tidal", triggered_by="manual")

    with db_conn.cursor() as cur:
        cur.execute(
            '''SELECT id, status FROM "IngestionRun"
               WHERE "triggeredBy" = 'manual' ORDER BY "startedAt" DESC LIMIT 1'''
        )
        run_id, status = cur.fetchone()
    cleanup('DELETE FROM "IngestionRun" WHERE id = %s', (run_id,))
    assert status == "failed"


def test_fail_stale_runs_and_has_active(db_conn, cleanup):
    """watchdog이 오래된 running row만 failed 처리, 최근 run은 active로 감지."""
    from mrms.db.emp import create_run, fail_stale_runs, finish_run, has_active_run

    run_id = create_run(db_conn, platform="all", triggered_by="manual")
    cleanup('DELETE FROM "IngestionRun" WHERE id = %s', (run_id,))

    # 방금 만든 run — active로 감지, stale 아님
    assert has_active_run(db_conn) is True
    assert fail_stale_runs(db_conn, older_than_hours=5) == 0

    # startedAt을 6시간 전으로 — stale로 처리됨
    with db_conn.cursor() as cur:
        cur.execute(
            '''UPDATE "IngestionRun"
               SET "startedAt" = NOW() - interval '6 hours' WHERE id = %s''',
            (run_id,),
        )
    db_conn.commit()
    assert fail_stale_runs(db_conn, older_than_hours=5) == 1
    with db_conn.cursor() as cur:
        cur.execute('SELECT status FROM "IngestionRun" WHERE id = %s', (run_id,))
        assert cur.fetchone()[0] == "failed"

    finish_run(db_conn, run_id, "failed")  # idempotent 확인용


async def test_run_pipeline_includes_youtube_and_mrt_stages(db_conn, cleanup):
    """run_pipeline → youtube_misses + regenerate_mrt 스테이지 기록 (순서 포함)."""
    from mrms.emp.runner import run_pipeline

    async def _imp(conn):
        return {"tracks_new": 1, "tracks_existing": 0, "playlists_processed": 1, "errors": []}

    ok = {"status": "success", "duration_ms": 10, "stdout": "", "stderr": "", "error": None}
    mrt_ok = {"status": "success", "duration_ms": 10, "stdout": "stale=0 regenerated=0 failed=0",
              "stderr": "", "error": None}

    with patch("mrms.emp.runner._run_importer_tidal", new=_imp), \
         patch("mrms.emp.runner._run_importer_spotify", new=_imp), \
         patch("mrms.emp.runner._run_importer_flo", new=_imp), \
         patch("mrms.emp.runner._run_importer_melon", new=_imp), \
         patch("mrms.emp.runner._run_importer_vibe", new=_imp), \
         patch("mrms.emp.runner._run_importer_apple", new=_imp), \
         patch("mrms.emp.runner._run_importer_youtube", new=_imp), \
         patch("mrms.emp.runner._run_audio_download", return_value=ok), \
         patch("mrms.emp.runner._run_extract_embeddings", return_value=ok), \
         patch("mrms.emp.runner._run_youtube_misses", return_value=ok), \
         patch("mrms.emp.runner._run_load_to_db", return_value=ok), \
         patch("mrms.emp.runner._run_regenerate_mrt", return_value=mrt_ok):
        run_id = await run_pipeline(db_conn, platform="all", triggered_by="manual")

    cleanup('DELETE FROM "IngestionRun" WHERE id = %s', (run_id,))
    with db_conn.cursor() as cur:
        cur.execute('SELECT status, stages FROM "IngestionRun" WHERE id = %s', (run_id,))
        status, stages = cur.fetchone()
    names = [s["stage"] for s in stages]
    assert status == "success"
    assert "youtube_misses" in names
    assert "regenerate_mrt" in names
    assert names.index("youtube_misses") > names.index("extract_embeddings")
    assert names.index("youtube_misses") < names.index("load_to_db")
    assert names.index("regenerate_mrt") > names.index("load_to_db")


def test_regenerate_calls_prune(db_conn, monkeypatch):
    """_run_regenerate_mrt가 재생성된 유저마다 prune_playlist_history를 호출."""
    import mrms.recsys.mrt as mrt
    import mrms.db.user_embedding as ue
    monkeypatch.setattr(mrt, "select_stale_mrt_users", lambda conn, **k: ["u1"])
    monkeypatch.setattr(mrt, "generate_user_mrt", lambda conn, uid, **k: 5)
    pruned = []
    monkeypatch.setattr(ue, "prune_playlist_history", lambda conn, uid, **k: pruned.append(uid) or 0)
    from mrms.emp.runner import _run_regenerate_mrt
    _run_regenerate_mrt(db_conn)
    assert pruned == ["u1"]
