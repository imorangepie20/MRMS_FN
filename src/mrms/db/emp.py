"""EMP DB helpers — EMPSource upsert, stats, IngestionRun."""
from __future__ import annotations

import json
import uuid

import psycopg

# re-export — 기존 `from mrms.db.emp import EMBEDDING_MODEL_VERSION` 경로 유지
from mrms.config import EMBEDDING_MODEL_VERSION  # noqa: F401
from mrms.db.ids import stable_id as _id


def upsert_emp_source(
    conn: psycopg.Connection,
    track_id: str,
    platform: str,
    source_type: str,
    source_id: str,
    source_name: str | None,
) -> str:
    """EMPSource INSERT (UNIQUE 충돌 시 skip). row_id 반환.
    trigger가 Track.inEmp = TRUE 자동 설정."""
    row_id = _id(f"emp|{track_id}|{platform}|{source_id}")
    with conn.cursor() as cur:
        cur.execute(
            '''INSERT INTO "EMPSource"
                 (id, "trackId", platform, source_type, source_id, source_name)
               VALUES (%s, %s, %s, %s, %s, %s)
               ON CONFLICT ("trackId", platform, source_id) DO NOTHING''',
            (row_id, track_id, platform, source_type, source_id, source_name),
        )
    conn.commit()
    return row_id


def get_emp_stats(conn: psycopg.Connection) -> dict:
    """EMP 풀 통계."""
    with conn.cursor() as cur:
        cur.execute('SELECT COUNT(*) FROM "Track"')
        total = cur.fetchone()[0]
        cur.execute('SELECT COUNT(*) FROM "Track" WHERE "inEmp" = TRUE')
        in_emp = cur.fetchone()[0]
        cur.execute(
            '''SELECT COUNT(DISTINCT t.id)
               FROM "Track" t
               JOIN "TrackEmbedding" te ON te."trackId" = t.id
                 AND te."modelVersion" = %s
               WHERE t."inEmp" = TRUE''',
            (EMBEDDING_MODEL_VERSION,),
        )
        with_emb = cur.fetchone()[0]
        cur.execute(
            '''SELECT platform, COUNT(DISTINCT "trackId")
               FROM "EMPSource"
               GROUP BY platform'''
        )
        by_platform = {r[0]: r[1] for r in cur.fetchall()}
    return {
        "total_tracks": total,
        "in_emp": in_emp,
        "with_embedding": with_emb,
        "by_platform": by_platform,
    }


def create_run(
    conn: psycopg.Connection,
    platform: str | None,
    triggered_by: str = "scheduler",
) -> str:
    """IngestionRun 시작 row. id 반환."""
    run_id = f"run_{uuid.uuid4().hex[:16]}"
    with conn.cursor() as cur:
        cur.execute(
            '''INSERT INTO "IngestionRun" (id, status, platform, "triggeredBy")
               VALUES (%s, 'running', %s, %s)''',
            (run_id, platform, triggered_by),
        )
    conn.commit()
    return run_id


def append_stage(
    conn: psycopg.Connection, run_id: str, stage: dict
) -> None:
    """stages JSONB에 한 stage 추가."""
    with conn.cursor() as cur:
        cur.execute(
            '''UPDATE "IngestionRun"
               SET stages = stages || %s::jsonb
               WHERE id = %s''',
            (json.dumps([stage]), run_id),
        )
    conn.commit()


def finish_run(
    conn: psycopg.Connection, run_id: str, status: str
) -> None:
    """run 종료. status: 'success' | 'failed' | 'partial'."""
    with conn.cursor() as cur:
        cur.execute(
            '''UPDATE "IngestionRun"
               SET status = %s, "finishedAt" = NOW()
               WHERE id = %s''',
            (status, run_id),
        )
    conn.commit()


def fail_stale_runs(
    conn: psycopg.Connection, older_than_hours: int = 5
) -> int:
    """watchdog — finish 못 하고 죽은 (kill -9, systemd timeout 등) 좀비 run 정리.
    'running'인데 시작한 지 older_than_hours 넘은 row를 failed로 마감."""
    with conn.cursor() as cur:
        cur.execute(
            '''UPDATE "IngestionRun"
               SET status = 'failed', "finishedAt" = NOW(),
                   stages = stages || %s::jsonb
               WHERE status = 'running'
                 AND "startedAt" < NOW() - make_interval(hours => %s)''',
            (
                json.dumps([{
                    "stage": "watchdog",
                    "status": "failed",
                    "error": "stale run — process died without finishing",
                }]),
                older_than_hours,
            ),
        )
        n = cur.rowcount
    conn.commit()
    return n


def has_active_run(
    conn: psycopg.Connection, within_hours: int = 5
) -> bool:
    """최근 within_hours 안에 시작해 아직 'running'인 run 존재 여부 — 동시 실행 방지용."""
    with conn.cursor() as cur:
        cur.execute(
            '''SELECT 1 FROM "IngestionRun"
               WHERE status = 'running'
                 AND "startedAt" >= NOW() - make_interval(hours => %s)
               LIMIT 1''',
            (within_hours,),
        )
        return cur.fetchone() is not None


def list_recent_runs(
    conn: psycopg.Connection, limit: int = 50
) -> list[dict]:
    """최근 IngestionRun 목록."""
    with conn.cursor() as cur:
        cur.execute(
            '''SELECT id, "startedAt", "finishedAt", status, platform, stages, "triggeredBy"
               FROM "IngestionRun"
               ORDER BY "startedAt" DESC
               LIMIT %s''',
            (limit,),
        )
        rows = cur.fetchall()
    return [
        {
            "id": r[0],
            "started_at": r[1].isoformat() if r[1] else None,
            "finished_at": r[2].isoformat() if r[2] else None,
            "status": r[3],
            "platform": r[4],
            "stages": r[5] if isinstance(r[5], list) else json.loads(r[5] or "[]"),
            "triggered_by": r[6],
        }
        for r in rows
    ]
