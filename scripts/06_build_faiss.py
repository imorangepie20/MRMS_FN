"""
FAISS HNSW 인덱스 빌드 — 256d projection으로 k-NN 추천.

Input:
    data/projection/v1.0.parquet  (key, embedding 256d)

Output:
    data/faiss/v1.0.bin            (FAISS 인덱스 바이너리)
    data/faiss/v1.0_keys.parquet   (인덱스 인덱스 → key 매핑)

Usage:
    # 인덱스 빌드
    python3 scripts/06_build_faiss.py

    # 빌드 + 즉시 검색 테스트
    python3 scripts/06_build_faiss.py --query-key USUG12510788 --k 10
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

import faiss
import numpy as np
import pandas as pd
from rich.console import Console

console = Console()


def build_index(emb: np.ndarray, m: int = 32, ef_construction: int = 200) -> faiss.Index:
    """HNSW (cosine = inner product after L2 normalize)."""
    dim = emb.shape[1]
    # IP = inner product; 임베딩이 이미 L2 정규화돼 있어서 IP = cosine
    index = faiss.IndexHNSWFlat(dim, m, faiss.METRIC_INNER_PRODUCT)
    index.hnsw.efConstruction = ef_construction
    t0 = time.time()
    index.add(emb.astype(np.float32))
    console.print(f"  insert: [bold]{time.time() - t0:.1f}s[/bold]")
    return index


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--projection",
        type=Path,
        default=Path("data/projection/v1.0.parquet"),
    )
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=Path("data/faiss"),
    )
    parser.add_argument("--version", type=str, default="v1.0")
    parser.add_argument("--hnsw-m", type=int, default=32)
    parser.add_argument("--ef-construction", type=int, default=200)
    parser.add_argument("--ef-search", type=int, default=64)
    parser.add_argument(
        "--query-key",
        type=str,
        default=None,
        help="빌드 후 이 key로 유사 곡 검색 (테스트용)",
    )
    parser.add_argument("--k", type=int, default=10)
    args = parser.parse_args()

    # ─── 로드 ──────────────────────────
    console.print(f"projection 로드: [cyan]{args.projection}[/cyan]")
    df = pd.read_parquet(args.projection)
    console.print(f"  tracks: [bold]{len(df):,}[/bold]")

    emb_list = df["embedding"].tolist()
    emb = np.stack(emb_list).astype(np.float32)
    console.print(f"  shape: {emb.shape}")

    # 정규화 확인 (이미 모델에서 L2 normalize됨, 안전 차원에서 한 번 더)
    norms = np.linalg.norm(emb, axis=1)
    console.print(f"  norm range: {norms.min():.3f} ~ {norms.max():.3f}")
    if not np.allclose(norms, 1.0, atol=1e-3):
        console.print("  [yellow]renormalizing...[/yellow]")
        emb = emb / norms[:, None].clip(min=1e-8)

    # ─── 인덱스 빌드 ───────────────────
    console.print(
        f"building HNSW(m={args.hnsw_m}, ef={args.ef_construction})..."
    )
    index = build_index(emb, args.hnsw_m, args.ef_construction)
    index.hnsw.efSearch = args.ef_search

    # ─── 저장 ──────────────────────────
    args.out_dir.mkdir(parents=True, exist_ok=True)
    bin_path = args.out_dir / f"{args.version}.bin"
    keys_path = args.out_dir / f"{args.version}_keys.parquet"

    faiss.write_index(index, str(bin_path))
    pd.DataFrame({"row": range(len(df)), "key": df["key"].values}).to_parquet(
        keys_path, index=False
    )
    console.print(f"[green]✓ index →[/green] {bin_path} ({bin_path.stat().st_size / 1e6:.1f} MB)")
    console.print(f"[green]✓ keys  →[/green] {keys_path}")

    # ─── (옵션) 검색 테스트 ────────────
    if args.query_key:
        console.print()
        console.print(f"[bold]유사 곡 검색 — query: {args.query_key}[/bold]")
        query_idx = df.index[df["key"] == args.query_key].tolist()
        if not query_idx:
            console.print(f"[red]key not found[/red]")
            return
        q = emb[query_idx[0]:query_idx[0] + 1]
        t0 = time.time()
        D, I = index.search(q, args.k)
        console.print(f"  search: {(time.time() - t0) * 1000:.1f} ms")
        console.print(f"  top-{args.k}:")
        for rank, (sim, idx) in enumerate(zip(D[0], I[0])):
            sim_pct = (sim + 1) * 50  # cosine [-1,1] → [0,100]
            console.print(f"    {rank + 1:2d}. {df['key'].iloc[idx]:<20} sim={sim:.3f} ({sim_pct:.1f}%)")


if __name__ == "__main__":
    main()
