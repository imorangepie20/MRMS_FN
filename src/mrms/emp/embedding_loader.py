"""증분 EMP 임베딩 로더 — 신규 EMP 트랙 npy → trained projection head → TrackEmbedding.

07_load_to_db.py는 일회성 카탈로그 적재용 (ems_enriched.parquet + features +
projection parquet 입력 필요)이라 증분 EMP 트랙에는 쓸 수 없음. 이 모듈은:

1. DB에서 EMP 풀 중 TrackEmbedding(modelVersion=EMBEDDING_MODEL_VERSION) 없는
   트랙 조회 (02_download_audio.py --emp-only와 동일 조건)
2. 02와 동일한 key 규칙으로 {embed_dir}/mert_v1_95m/{key}.npy 탐색
3. 768d MERT 임베딩 → 05_inference.py와 동일한 trained head로 256d projection
4. 07_load_to_db.py와 동일한 형식으로 TrackEmbedding insert (ON CONFLICT skip)

벡터 공간 일치가 최우선 — 변환은 05/07과 정확히 동일해야 함:
  np.load(npy).astype(float32), shape (768,) 검증
  → MRMSHeadModule.load_from_checkpoint(...).eval() forward
  → pred["embedding"] (head 내부에서 L2-normalize된 256d)
  → .cpu().numpy().astype(float32) → pgvector.
체크포인트가 없으면 절대 임의 변환으로 대체하지 말 것 — 기존 카탈로그와
다른 벡터 공간이 되어 유사도 검색이 조용히 망가짐.
"""
from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import psycopg

from mrms.config import EMBEDDING_MODEL_VERSION, settings
from mrms.db.ids import stable_id

EMBED_SUBDIR = "mert_v1_95m"


@dataclass(slots=True)
class PendingTrack:
    track_id: str
    isrc: str | None
    tidal_id: str | None
    spotify_id: str | None


def candidate_keys(track: PendingTrack) -> list[str]:
    """02_download_audio.py가 만들었을 npy 파일 key 후보 (우선순위 순).

    02 --emp-only는 derive_track_key 규칙 사용: ISRC가 있으면 ISRC,
    없으면 '{source}_{platform_track_id}' (source 우선순위 tidal > spotify > db).
    다운로드 시점에 ISRC가 없었던 트랙이 이후 ISRC를 얻을 수도 있으므로
    단일 키가 아니라 모든 후보를 순서대로 시도한다.
    """
    keys: list[str] = []
    if track.isrc:
        keys.append(str(track.isrc))
    if track.tidal_id:
        keys.append(f"tidal_{track.tidal_id}")
    if track.spotify_id:
        keys.append(f"spotify_{track.spotify_id}")
    keys.append(f"db_{track.track_id}")
    return keys


def resolve_npy(embed_dir: Path, track: PendingTrack) -> Path | None:
    """후보 key 중 실제 존재하는 첫 npy 경로. 없으면 None."""
    for key in candidate_keys(track):
        p = embed_dir / f"{key}.npy"
        if p.exists():
            return p
    return None


def fetch_pending(conn: psycopg.Connection, limit: int = 0) -> list[PendingTrack]:
    """EMP 풀 중 현재 modelVersion 임베딩이 없는 트랙 (02 --emp-only와 동일 쿼리 조건)."""
    sql = """
        SELECT t.id, t.isrc,
               tp_tidal."platformTrackId"   AS tidal_id,
               tp_spotify."platformTrackId" AS spotify_id
        FROM "Track" t
        LEFT JOIN "TrackPlatform" tp_tidal
          ON tp_tidal."trackId" = t.id AND tp_tidal.platform = 'tidal'
        LEFT JOIN "TrackPlatform" tp_spotify
          ON tp_spotify."trackId" = t.id AND tp_spotify.platform = 'spotify'
        WHERE t."inEmp" = TRUE
          AND NOT EXISTS (
            SELECT 1 FROM "TrackEmbedding" te
            WHERE te."trackId" = t.id AND te."modelVersion" = %s
          )
        ORDER BY t."createdAt" DESC
    """
    params: list = [EMBEDDING_MODEL_VERSION]
    if limit:
        sql += " LIMIT %s"
        params.append(limit)
    with conn.cursor() as cur:
        cur.execute(sql, params)
        return [PendingTrack(*row) for row in cur.fetchall()]


def load_projector(ckpt_path: Path, device: str = "cpu"):
    """05_inference.py load_checkpoint와 동일 — eval 모드 (dropout off)."""
    from mrms.training.trainer import MRMSHeadModule  # torch lazy import

    module = MRMSHeadModule.load_from_checkpoint(str(ckpt_path), map_location=device)
    module.eval()
    module.to(device)
    return module


def project_embeddings(module, embs_768: np.ndarray, device: str = "cpu") -> np.ndarray:
    """(N, 768) float32 → (N, 256) float32 — 05_inference.py flush()와 동일 변환.

    head 내부에서 F.normalize(dim=-1)까지 수행되므로 추가 정규화 금지.
    """
    import torch

    with torch.no_grad():
        x = torch.from_numpy(np.ascontiguousarray(embs_768, dtype=np.float32)).to(device)
        pred = module(x)
        return pred["embedding"].cpu().numpy().astype(np.float32)


def insert_embeddings(conn: psycopg.Connection, rows: list[tuple]) -> None:
    """07_load_to_db.py insert_embeddings와 동일 형식/충돌 처리."""
    if not rows:
        return
    with conn.cursor() as cur:
        cur.executemany(
            """
            INSERT INTO "TrackEmbedding"
                (id, "trackId", "modelVersion", embedding, pooling, "audioSource")
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT ("trackId", "modelVersion") DO NOTHING
            """,
            rows,
        )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="증분 EMP 임베딩 로더 (npy → 256d → DB)")
    parser.add_argument(
        "--ckpt",
        type=Path,
        default=settings.checkpoint_dir / "heads_v1.0" / "best.ckpt",
        help="04_train_heads.py가 만든 trained head 체크포인트",
    )
    parser.add_argument(
        "--embed-dir",
        type=Path,
        default=settings.embed_dir / EMBED_SUBDIR,
        help="03_extract_embeddings.py 출력 디렉토리 (768d npy)",
    )
    parser.add_argument("--device", type=str, default="cpu")
    parser.add_argument("--batch-size", type=int, default=512)
    parser.add_argument("--limit", type=int, default=0, help="DB 조회 LIMIT (0 = 전체)")
    parser.add_argument("--dry-run", action="store_true", help="DB 쓰기 없이 전 구간 검증만")
    args = parser.parse_args(argv)

    # 체크포인트 검증 — 없으면 즉시 실패 (대체 변환 금지: 벡터 공간 불일치 사고 방지)
    if not args.ckpt.exists():
        print(f"ERROR: trained head checkpoint not found: {args.ckpt}", file=sys.stderr)
        print(
            "04_train_heads.py 체크포인트가 필요합니다 — 기존 카탈로그와 같은 "
            "projection head를 써야 같은 벡터 공간이 됩니다.",
            file=sys.stderr,
        )
        return 1

    # embed_dir 검증 — 디렉토리 오설정 시 전 트랙이 skipped(no npy)로
    # 조용히 'success' 위장하며 백로그가 쌓이는 것 방지
    if not args.embed_dir.is_dir():
        print(f"ERROR: embed dir not found: {args.embed_dir}", file=sys.stderr)
        print("03_extract_embeddings.py 출력 디렉토리가 필요합니다.", file=sys.stderr)
        return 1

    from pgvector.psycopg import register_vector

    with psycopg.connect(settings.database_url) as conn:
        register_vector(conn)

        pending = fetch_pending(conn, limit=args.limit)
        print(f"EMP pending (no '{EMBEDDING_MODEL_VERSION}' embedding): {len(pending)}")

        resolved: list[tuple[PendingTrack, Path]] = []
        skipped_no_npy = 0
        for t in pending:
            p = resolve_npy(args.embed_dir, t)
            if p is None:
                skipped_no_npy += 1
            else:
                resolved.append((t, p))

        if not resolved:
            print(f"loaded 0 / skipped(no npy) {skipped_no_npy} — nothing to do")
            return 0

        print(f"npy resolved: {len(resolved)} / skipped(no npy): {skipped_no_npy}")
        print(f"loading checkpoint: {args.ckpt} (device={args.device})")
        module = load_projector(args.ckpt, args.device)

        loaded = 0
        skipped_bad = 0
        batch: list[tuple[str, np.ndarray]] = []

        def flush() -> None:
            nonlocal loaded
            if not batch:
                return
            vecs = project_embeddings(
                module, np.stack([e for _, e in batch]), args.device
            )
            if not args.dry_run:
                rows = [
                    (
                        # 07 cuid_id("te", ...)와 동일한 sha1 기반 id — 재실행 멱등
                        stable_id(f"{tid}|{EMBEDDING_MODEL_VERSION}"),
                        tid,
                        EMBEDDING_MODEL_VERSION,
                        np.asarray(v, dtype=np.float32),
                        "attention",
                        "mp3_30s",
                    )
                    for (tid, _), v in zip(batch, vecs)
                ]
                insert_embeddings(conn, rows)
                conn.commit()
            loaded += len(batch)
            batch.clear()

        for t, npy_path in resolved:
            try:
                emb = np.load(npy_path).astype(np.float32)
            except Exception:
                skipped_bad += 1
                continue
            if emb.shape != (768,):
                skipped_bad += 1
                continue
            batch.append((t.track_id, emb))
            if len(batch) >= args.batch_size:
                flush()
        flush()

        mode = "DRY-RUN would load" if args.dry_run else "loaded"
        print(
            f"{mode}: {loaded} / skipped(no npy): {skipped_no_npy}"
            f" / skipped(bad npy): {skipped_bad}"
        )

    return 0
