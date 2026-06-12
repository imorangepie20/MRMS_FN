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


def test_upsert_emp_source_stores_cover_url(db_conn: psycopg.Connection, cleanup):
    """cover_url 파라미터가 EMPSource.cover_url 컬럼에 저장된다."""
    with db_conn.cursor() as cur:
        cur.execute('SELECT id FROM "Track" LIMIT 1')
        row = cur.fetchone()
    if not row:
        pytest.skip("Track 데이터 부족")
    track_id = row[0]

    source_id = f"pl_cover_{uuid.uuid4().hex[:8]}"
    cleanup(
        'DELETE FROM "EMPSource" WHERE "trackId" = %s AND source_id = %s',
        (track_id, source_id),
    )

    cover = "https://cdn.example/cover_xyz.jpg"
    upsert_emp_source(
        db_conn,
        track_id=track_id,
        platform="melon",
        source_type="chart",
        source_id=source_id,
        source_name="Hot",
        cover_url=cover,
    )

    with db_conn.cursor() as cur:
        cur.execute(
            'SELECT cover_url FROM "EMPSource" '
            'WHERE "trackId" = %s AND platform = %s AND source_id = %s',
            (track_id, "melon", source_id),
        )
        assert cur.fetchone()[0] == cover


def test_upsert_emp_source_cover_defaults_none(db_conn: psycopg.Connection, cleanup):
    """cover_url 생략(하위호환) → NULL 저장."""
    with db_conn.cursor() as cur:
        cur.execute('SELECT id FROM "Track" LIMIT 1')
        row = cur.fetchone()
    if not row:
        pytest.skip("Track 데이터 부족")
    track_id = row[0]

    source_id = f"pl_nocover_{uuid.uuid4().hex[:8]}"
    cleanup(
        'DELETE FROM "EMPSource" WHERE "trackId" = %s AND source_id = %s',
        (track_id, source_id),
    )

    upsert_emp_source(db_conn, track_id, "spotify", "editorial_embed", source_id, "Top")

    with db_conn.cursor() as cur:
        cur.execute(
            'SELECT cover_url FROM "EMPSource" '
            'WHERE "trackId" = %s AND platform = %s AND source_id = %s',
            (track_id, "spotify", source_id),
        )
        assert cur.fetchone()[0] is None


def test_upsert_emp_source_backfills_cover(db_conn: psycopg.Connection, cleanup):
    """기존 row가 cover None이면 재호출 시 채워지고(백필), 이미 있으면 유지."""
    with db_conn.cursor() as cur:
        cur.execute('SELECT id FROM "Track" LIMIT 1')
        row = cur.fetchone()
    if not row:
        pytest.skip("Track 데이터 부족")
    track_id = row[0]

    source_id = f"pl_backfill_{uuid.uuid4().hex[:8]}"
    cleanup(
        'DELETE FROM "EMPSource" WHERE "trackId" = %s AND source_id = %s',
        (track_id, source_id),
    )

    def cover_of() -> str | None:
        with db_conn.cursor() as cur:
            cur.execute(
                'SELECT cover_url FROM "EMPSource" '
                'WHERE "trackId" = %s AND platform = %s AND source_id = %s',
                (track_id, "melon", source_id),
            )
            return cur.fetchone()[0]

    # 1) 커버 없이 적재 → None
    upsert_emp_source(db_conn, track_id, "melon", "chart", source_id, "Hot")
    assert cover_of() is None

    # 2) 커버 있는 값으로 재적재 → 백필됨
    new_cover = "https://cdn.example/backfilled.jpg"
    upsert_emp_source(db_conn, track_id, "melon", "chart", source_id, "Hot", cover_url=new_cover)
    assert cover_of() == new_cover

    # 3) 또 다른 커버로 재적재 → 기존 커버 유지 (덮어쓰지 않음)
    upsert_emp_source(db_conn, track_id, "melon", "chart", source_id, "Hot", cover_url="https://cdn.example/other.jpg")
    assert cover_of() == new_cover


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
