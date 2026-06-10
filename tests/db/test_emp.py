"""EMP DB helpers."""
import uuid

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


def test_upsert_emp_source_sets_track_in_emp(db_conn: psycopg.Connection, cleanup):
    """EMPSource INSERT → Track.inEmp 자동 TRUE."""
    with db_conn.cursor() as cur:
        cur.execute('SELECT id FROM "Track" LIMIT 1')
        row = cur.fetchone()
    if not row:
        pytest.skip("Track 데이터 부족")
    track_id = row[0]

    source_id = f"pl_xyz_{uuid.uuid4().hex[:8]}"
    cleanup(
        'DELETE FROM "EMPSource" WHERE "trackId" = %s AND source_id = %s',
        (track_id, source_id),
    )

    src_id = upsert_emp_source(
        db_conn,
        track_id=track_id,
        platform="tidal",
        source_type="editorial_playlist",
        source_id=source_id,
        source_name="Rising",
    )
    assert src_id

    with db_conn.cursor() as cur:
        cur.execute('SELECT "inEmp" FROM "Track" WHERE id = %s', (track_id,))
        assert cur.fetchone()[0] is True


def test_upsert_emp_source_dedup(db_conn: psycopg.Connection, cleanup):
    """동일 (trackId, platform, source_id) 두 번 호출 — 두 번째는 idempotent."""
    with db_conn.cursor() as cur:
        cur.execute('SELECT id FROM "Track" LIMIT 1')
        row = cur.fetchone()
    if not row:
        pytest.skip("Track 데이터 부족")
    track_id = row[0]

    source_id = f"pl_dup_{uuid.uuid4().hex[:8]}"
    cleanup(
        'DELETE FROM "EMPSource" WHERE "trackId" = %s AND source_id = %s',
        (track_id, source_id),
    )

    src1 = upsert_emp_source(db_conn, track_id, "tidal", "editorial_playlist", source_id, "X")
    src2 = upsert_emp_source(db_conn, track_id, "tidal", "editorial_playlist", source_id, "X")
    assert src1 == src2  # deterministic id

    with db_conn.cursor() as cur:
        cur.execute(
            'SELECT COUNT(*) FROM "EMPSource" WHERE "trackId"=%s AND platform=%s AND source_id=%s',
            (track_id, "tidal", source_id),
        )
        assert cur.fetchone()[0] == 1


def test_get_emp_stats_aggregates(db_conn: psycopg.Connection):
    """stats 응답에 키들 존재 + 타입 맞음."""
    stats = get_emp_stats(db_conn)
    assert isinstance(stats["total_tracks"], int)
    assert isinstance(stats["in_emp"], int)
    assert isinstance(stats["with_embedding"], int)
    assert isinstance(stats["by_platform"], dict)


def test_create_and_finish_run(db_conn: psycopg.Connection, cleanup):
    """run 생성 + stage append + finish."""
    run_id = create_run(db_conn, platform="tidal", triggered_by="manual")
    assert run_id
    cleanup('DELETE FROM "IngestionRun" WHERE id = %s', (run_id,))

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
