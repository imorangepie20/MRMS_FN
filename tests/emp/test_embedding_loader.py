"""증분 EMP 임베딩 로더 — key 매핑 + pending 조회 + (체크포인트 있으면) projection 통합 검증."""
from __future__ import annotations

import os
import subprocess
import sys
import uuid
from pathlib import Path

import numpy as np
import pytest

from mrms.config import EMBEDDING_MODEL_VERSION
from mrms.emp.embedding_loader import (
    PendingTrack,
    candidate_keys,
    fetch_pending,
    main,
    resolve_npy,
)

REPO_ROOT = Path(__file__).resolve().parents[2]
CKPT = REPO_ROOT / "checkpoints" / "heads_v1.0" / "best.ckpt"


# ─── key 매핑 (02_download_audio.py --emp-only와 동일 규칙) ──────────
def test_candidate_keys_isrc_first():
    t = PendingTrack(track_id="t1", isrc="KRA012345678", tidal_id="111", spotify_id="abc")
    assert candidate_keys(t) == ["KRA012345678", "tidal_111", "spotify_abc", "db_t1"]


def test_candidate_keys_no_isrc_tidal_before_spotify():
    t = PendingTrack(track_id="t1", isrc=None, tidal_id="111", spotify_id="abc")
    assert candidate_keys(t) == ["tidal_111", "spotify_abc", "db_t1"]


def test_candidate_keys_db_fallback_only():
    t = PendingTrack(track_id="t1", isrc=None, tidal_id=None, spotify_id=None)
    assert candidate_keys(t) == ["db_t1"]


def test_candidate_keys_empty_isrc_treated_as_missing():
    t = PendingTrack(track_id="t1", isrc="", tidal_id=None, spotify_id="abc")
    assert candidate_keys(t) == ["spotify_abc", "db_t1"]


def test_resolve_npy_picks_highest_priority_existing(tmp_path):
    t = PendingTrack(track_id="t1", isrc="ISRCX", tidal_id="111", spotify_id=None)
    np.save(tmp_path / "tidal_111.npy", np.zeros(768, dtype=np.float32))
    assert resolve_npy(tmp_path, t) == tmp_path / "tidal_111.npy"
    # isrc npy가 생기면 그게 우선
    np.save(tmp_path / "ISRCX.npy", np.zeros(768, dtype=np.float32))
    assert resolve_npy(tmp_path, t) == tmp_path / "ISRCX.npy"


def test_resolve_npy_none_when_missing(tmp_path):
    t = PendingTrack(track_id="t1", isrc="NOPE", tidal_id="x", spotify_id="y")
    assert resolve_npy(tmp_path, t) is None


# ─── DB pending 조회 ────────────────────────────────────────────────
def test_fetch_pending_includes_emp_track_then_excludes_after_embedding(db_conn, cleanup):
    from mrms.emp.base import upsert_track_and_emp_source

    sfx = uuid.uuid4().hex[:8].upper()
    fake_isrc = f"TEST{sfx}"
    artist = f"Loader Artist {sfx}"
    cleanup('DELETE FROM "Artist" WHERE name = %s', (artist,))
    cleanup('DELETE FROM "Track" WHERE isrc = %s', (fake_isrc,))

    r = upsert_track_and_emp_source(
        db_conn,
        isrc=fake_isrc,
        title="Loader T",
        artist=artist,
        album_title=None,
        duration_ms=1000,
        platform="tidal",
        platform_track_id=f"tid_{sfx}",
        source_type="editorial_playlist",
        source_id=f"pl_{sfx}",
        source_name="L",
    )
    track_id = r["track_id"]

    pending = {p.track_id: p for p in fetch_pending(db_conn, limit=0)}
    assert track_id in pending
    assert pending[track_id].isrc == fake_isrc
    assert pending[track_id].tidal_id == f"tid_{sfx}"
    assert pending[track_id].spotify_id is None

    # 임베딩이 생기면 pending에서 제외 (uncommitted — db_conn fixture가 rollback)
    vec = "[" + ",".join(["0"] * 256) + "]"
    with db_conn.cursor() as cur:
        cur.execute(
            '''INSERT INTO "TrackEmbedding"
                 (id, "trackId", "modelVersion", embedding, pooling, "audioSource")
               VALUES (%s, %s, %s, %s::vector, %s, %s)''',
            (f"te_test_{sfx}", track_id, EMBEDDING_MODEL_VERSION, vec, "attention", "mp3_30s"),
        )
    assert track_id not in {p.track_id for p in fetch_pending(db_conn, limit=0)}


def test_fetch_pending_respects_limit(db_conn):
    assert len(fetch_pending(db_conn, limit=1)) <= 1


# ─── 체크포인트 가드 ────────────────────────────────────────────────
def test_main_exits_1_when_checkpoint_missing(tmp_path, capsys):
    rc = main(["--ckpt", str(tmp_path / "nope.ckpt"), "--dry-run"])
    assert rc == 1
    assert "checkpoint not found" in capsys.readouterr().err


# ─── projection 통합 검증 (로컬 체크포인트 있을 때만) ────────────────
@pytest.mark.skipif(not CKPT.exists(), reason="local trained head checkpoint 없음")
def test_projection_matches_inference_contract():
    """05_inference.py와 동일 계약: (N,768) → (N,256) float32, L2-normalized."""
    from mrms.emp.embedding_loader import load_projector, project_embeddings

    module = load_projector(CKPT, device="cpu")
    rng = np.random.default_rng(0)
    x = rng.normal(size=(3, 768)).astype(np.float32)
    out = project_embeddings(module, x, device="cpu")
    assert out.shape == (3, 256)
    assert out.dtype == np.float32
    assert np.allclose(np.linalg.norm(out, axis=1), 1.0, atol=1e-4)
    # 결정론 — eval 모드 (dropout off)
    out2 = project_embeddings(module, x, device="cpu")
    assert np.array_equal(out, out2)


@pytest.mark.skipif(not CKPT.exists(), reason="local trained head checkpoint 없음")
def test_script_dry_run_smoke():
    """스크립트 전 구간 스모크 (DB 조회 + npy 매핑 + projection, 쓰기 없음)."""
    proc = subprocess.run(
        [
            sys.executable,
            str(REPO_ROOT / "scripts" / "10_load_emp_embeddings.py"),
            "--dry-run",
            "--limit",
            "1",
            "--device",
            "cpu",
        ],
        capture_output=True,
        text=True,
        timeout=600,
        cwd=str(REPO_ROOT),
        env={**os.environ},
    )
    assert proc.returncode == 0, f"stdout:\n{proc.stdout[-1000:]}\nstderr:\n{proc.stderr[-2000:]}"
    assert ("DRY-RUN would load" in proc.stdout) or ("nothing to do" in proc.stdout)
