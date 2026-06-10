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

    ok_stage = {
        "status": "success",
        "duration_ms": 100,
        "stdout": "",
        "stderr": "",
        "error": None,
    }

    with patch("mrms.emp.runner._run_importer_tidal", new=fake_import_tidal), \
         patch("mrms.emp.runner._run_importer_spotify", new=fake_import_spotify), \
         patch("mrms.emp.runner._run_audio_download", return_value=ok_stage), \
         patch("mrms.emp.runner._run_extract_embeddings", return_value=ok_stage), \
         patch("mrms.emp.runner._run_load_to_db", return_value=ok_stage):
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

    ok_stage = {"status": "success", "duration_ms": 100, "stdout": "", "stderr": "", "error": None}
    fail_stage = {"status": "failed", "duration_ms": 50, "stdout": "", "stderr": "boom", "error": "exit 1"}

    with patch("mrms.emp.runner._run_importer_tidal", new=fake_import_tidal), \
         patch("mrms.emp.runner._run_importer_spotify", new=fake_import_spotify), \
         patch("mrms.emp.runner._run_audio_download", return_value=fail_stage), \
         patch("mrms.emp.runner._run_extract_embeddings", return_value=ok_stage), \
         patch("mrms.emp.runner._run_load_to_db", return_value=ok_stage):
        run_id = await run_pipeline(db_conn, platform="all", triggered_by="scheduler")

    cleanup('DELETE FROM "IngestionRun" WHERE id = %s', (run_id,))

    with db_conn.cursor() as cur:
        cur.execute('SELECT status FROM "IngestionRun" WHERE id = %s', (run_id,))
        assert cur.fetchone()[0] == "partial"
