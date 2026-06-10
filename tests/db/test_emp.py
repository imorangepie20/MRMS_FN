"""EMP DB helpers."""
import psycopg
import pytest

from mrms.db.emp import (
    upsert_emp_source,
    get_emp_stats,
    list_recent_runs,
    create_run,
    finish_run,
    append_stage,
)


def test_upsert_emp_source_sets_track_in_emp(db_conn: psycopg.Connection):
    """EMPSource INSERT → Track.inEmp 자동 TRUE."""
    with db_conn.cursor() as cur:
        cur.execute('SELECT id FROM "Track" LIMIT 1')
        row = cur.fetchone()
    if not row:
        pytest.skip("Track 데이터 부족")
    track_id = row[0]

    src_id = upsert_emp_source(
        db_conn,
        track_id=track_id,
        platform="tidal",
        source_type="editorial_playlist",
        source_id="pl_xyz",
        source_name="Rising",
    )
    assert src_id

    with db_conn.cursor() as cur:
        cur.execute('SELECT "inEmp" FROM "Track" WHERE id = %s', (track_id,))
        assert cur.fetchone()[0] is True

    # cleanup so test is idempotent
    with db_conn.cursor() as cur:
        cur.execute('DELETE FROM "EMPSource" WHERE id = %s', (src_id,))
    db_conn.commit()


def test_upsert_emp_source_dedup(db_conn: psycopg.Connection):
    """동일 (trackId, platform, source_id) 두 번 호출 — 두 번째는 idempotent."""
    with db_conn.cursor() as cur:
        cur.execute('SELECT id FROM "Track" LIMIT 1')
        row = cur.fetchone()
    if not row:
        pytest.skip("Track 데이터 부족")
    track_id = row[0]

    src1 = upsert_emp_source(db_conn, track_id, "tidal", "editorial_playlist", "pl_dup", "X")
    src2 = upsert_emp_source(db_conn, track_id, "tidal", "editorial_playlist", "pl_dup", "X")
    assert src1 == src2  # deterministic id

    with db_conn.cursor() as cur:
        cur.execute(
            'SELECT COUNT(*) FROM "EMPSource" WHERE "trackId"=%s AND platform=%s AND source_id=%s',
            (track_id, "tidal", "pl_dup"),
        )
        assert cur.fetchone()[0] == 1

    # cleanup
    with db_conn.cursor() as cur:
        cur.execute('DELETE FROM "EMPSource" WHERE id = %s', (src1,))
    db_conn.commit()


def test_get_emp_stats_aggregates(db_conn: psycopg.Connection):
    """stats 응답에 키들 존재 + 타입 맞음."""
    stats = get_emp_stats(db_conn)
    assert isinstance(stats["total_tracks"], int)
    assert isinstance(stats["in_emp"], int)
    assert isinstance(stats["with_embedding"], int)
    assert isinstance(stats["by_platform"], dict)


def test_create_and_finish_run(db_conn: psycopg.Connection):
    """run 생성 + stage append + finish."""
    run_id = create_run(db_conn, platform="tidal", triggered_by="manual")
    assert run_id

    append_stage(
        db_conn,
        run_id=run_id,
        stage={
            "stage": "import_tidal",
            "status": "success",
            "tracks_new": 5,
            "tracks_existing": 2,
            "duration_ms": 100,
            "error": None,
        },
    )

    finish_run(db_conn, run_id=run_id, status="success")

    runs = list_recent_runs(db_conn, limit=5)
    matched = [r for r in runs if r["id"] == run_id]
    assert matched
    assert matched[0]["status"] == "success"
    assert len(matched[0]["stages"]) == 1
    assert matched[0]["stages"][0]["tracks_new"] == 5

    # cleanup
    with db_conn.cursor() as cur:
        cur.execute('DELETE FROM "IngestionRun" WHERE id = %s', (run_id,))
    db_conn.commit()
