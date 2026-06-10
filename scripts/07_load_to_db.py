"""
features + embeddings + 카탈로그 메타 → PostgreSQL.

전제 조건:
    1. docker compose up -d   (PG + pgvector 실행 중)
    2. npx prisma migrate dev (스키마 생성)
    3. DATABASE_URL 환경변수 .env에 설정됨

Input:
    data/csv/ems_enriched.parquet               (메타: isrc, title, artists, source, ...)
    data/features/our_model_v1.0.parquet         (Spotify-12 + 우리 확장)
    data/projection/v1.0.parquet                 (256d projection)

DB Insert:
    Artist (distinct artist names)
    Album (distinct title + artist)
    Track (isrc-keyed identity)
    TrackPlatform (source 별 1:N 매핑)
    TrackAudioFeatures (model_version='our-v1.0')
    TrackEmbedding (model_version='our-v1.0', pgvector 256)

Usage:
    python3 scripts/07_load_to_db.py
    python3 scripts/07_load_to_db.py --limit 1000   # smoke test
    python3 scripts/07_load_to_db.py --reset        # 기존 데이터 삭제 후 적재
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

import numpy as np
import pandas as pd
import psycopg
from pgvector.psycopg import register_vector
from rich.console import Console
from rich.progress import (
    BarColumn,
    MofNCompleteColumn,
    Progress,
    SpinnerColumn,
    TextColumn,
    TimeRemainingColumn,
)

from mrms.config import EMBEDDING_MODEL_VERSION, settings
from mrms.data.catalog import derive_track_key, load_catalog

console = Console()

MODEL_VERSION = EMBEDDING_MODEL_VERSION


def cuid_id(_prefix: str, value: str) -> str:
    """Prisma cuid 대신 안정적 결정론 ID 생성 (sha1 기반).

    Note: _prefix는 의미상 구분용으로 호출부에 남아 있지만
    실제 ID는 hash만 사용 (충돌 가능성 0에 가까움).
    """
    import hashlib

    h = hashlib.sha1(value.encode()).hexdigest()[:24]
    return f"c{h}"


def progress_bar() -> Progress:
    return Progress(
        SpinnerColumn(),
        TextColumn("[bold blue]{task.description}"),
        BarColumn(),
        MofNCompleteColumn(),
        TextColumn("[cyan]{task.percentage:>3.1f}%"),
        TimeRemainingColumn(),
        console=console,
    )


# ─── Loaders ─────────────────────────────────────────────
def load_inputs(
    catalog_path: Path,
    features_path: Path,
    projection_path: Path,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    console.print(f"카탈로그: [cyan]{catalog_path}[/cyan]")
    cat = load_catalog(catalog_path)
    cat["key"] = cat.apply(derive_track_key, axis=1)
    console.print(f"  rows: {len(cat):,}")

    console.print(f"features: [cyan]{features_path}[/cyan]")
    feat = pd.read_parquet(features_path)
    console.print(f"  rows: {len(feat):,}")

    console.print(f"projection: [cyan]{projection_path}[/cyan]")
    proj = pd.read_parquet(projection_path)
    console.print(f"  rows: {len(proj):,}")

    return cat, feat, proj


# ─── Insert layers ───────────────────────────────────────
def upsert_artists(cur, names: set[str]) -> dict[str, str]:
    """name → artist_id 매핑 반환. 안정적 cuid."""
    if not names:
        return {}
    rows = []
    name_to_id: dict[str, str] = {}
    for n in names:
        aid = cuid_id("a", n)
        name_to_id[n] = aid
        rows.append((aid, n, n.lower(), None))
    cur.executemany(
        """
        INSERT INTO "Artist" (id, name, "nameNormalized", "mainGenre")
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (id) DO NOTHING
        """,
        rows,
    )
    return name_to_id


def upsert_albums(cur, key_tuples: set[tuple[str, str]]) -> dict[tuple[str, str], str]:
    """(title, artist_id) → album_id."""
    if not key_tuples:
        return {}
    rows = []
    mapping: dict[tuple[str, str], str] = {}
    for title, artist_id in key_tuples:
        aid = cuid_id("al", f"{title}|{artist_id}")
        mapping[(title, artist_id)] = aid
        rows.append((aid, title, "album", artist_id))
    cur.executemany(
        """
        INSERT INTO "Album" (id, title, "albumType", "artistId")
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (id) DO NOTHING
        """,
        rows,
    )
    return mapping


def upsert_tracks(cur, tracks: list[dict]) -> dict[str, str]:
    """isrc-or-pseudokey → track_id."""
    if not tracks:
        return {}
    rows = []
    key_to_id: dict[str, str] = {}
    for t in tracks:
        tid = cuid_id("t", t["isrc"])
        key_to_id[t["isrc"]] = tid
        rows.append(
            (
                tid,
                t["isrc"],
                t["title"],
                t["title"].lower(),
                t["duration_ms"],
                False,  # explicit
                t["artist_id"],
                t.get("album_id"),
            )
        )
    cur.executemany(
        """
        INSERT INTO "Track"
            (id, isrc, title, "titleNormalized", "durationMs", explicit,
             "artistId", "albumId", "updatedAt")
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW())
        ON CONFLICT (isrc) DO NOTHING
        """,
        rows,
    )
    return key_to_id


def insert_platforms(cur, rows: list[tuple]) -> None:
    if not rows:
        return
    cur.executemany(
        """
        INSERT INTO "TrackPlatform"
            (id, "trackId", platform, "platformTrackId", popularity, available, regions, "previewUrl")
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT ("trackId", platform) DO NOTHING
        """,
        rows,
    )


def insert_audio_features(cur, rows: list[tuple]) -> None:
    if not rows:
        return
    cur.executemany(
        """
        INSERT INTO "TrackAudioFeatures"
            (id, "trackId", source, "modelVersion",
             danceability, energy, valence, acousticness, instrumentalness,
             liveness, speechiness, tempo, loudness,
             key, mode, "timeSignature",
             "energyCurve", "subgenres", confidence)
        VALUES (%s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s)
        ON CONFLICT ("trackId", "modelVersion") DO NOTHING
        """,
        rows,
    )


def insert_embeddings(cur, rows: list[tuple]) -> None:
    if not rows:
        return
    cur.executemany(
        """
        INSERT INTO "TrackEmbedding"
            (id, "trackId", "modelVersion", embedding, pooling, "audioSource")
        VALUES (%s, %s, %s, %s, %s, %s)
        ON CONFLICT ("trackId", "modelVersion") DO NOTHING
        """,
        rows,
    )


# ─── 메인 ───────────────────────────────────────────────
def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", type=Path, default=Path("data/csv/ems_enriched.parquet"))
    parser.add_argument(
        "--features", type=Path, default=Path("data/features/our_model_v1.0.parquet")
    )
    parser.add_argument(
        "--projection", type=Path, default=Path("data/projection/v1.0.parquet")
    )
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument(
        "--reset", action="store_true", help="기존 DB 데이터 모두 삭제 후 적재"
    )
    parser.add_argument("--batch-size", type=int, default=2000)
    args = parser.parse_args()

    cat, feat, proj = load_inputs(args.catalog, args.features, args.projection)

    # ─── 학습 가능한 트랙만 (features + projection 둘 다 있는) ──
    has_keys = set(feat["key"]) & set(proj["key"])
    console.print(f"\n features + projection 둘 다 있는 key: [bold]{len(has_keys):,}[/bold]")

    # ─── 카탈로그 중 적재 대상 (audio 있고 features 예측됐고) ─
    cat = cat[cat["key"].isin(has_keys)].copy()
    cat = cat.drop_duplicates(subset=["key"], keep="first")
    if args.limit:
        cat = cat.head(args.limit)
    console.print(f" 적재 대상 트랙: [bold]{len(cat):,}[/bold]\n")

    feat_idx = feat.set_index("key")
    proj_idx = proj.set_index("key")

    # ─── DB 연결 ───────────────────────────────────────────
    dsn = settings.database_url
    console.print(f"DB 연결: [cyan]{dsn.split('@')[-1]}[/cyan]")
    with psycopg.connect(dsn, autocommit=False) as conn:
        register_vector(conn)
        cur = conn.cursor()

        if args.reset:
            console.print("[yellow]기존 데이터 삭제...[/yellow]")
            for tbl in (
                "TrackEmbedding",
                "TrackAudioFeatures",
                "TrackPlatform",
                "Track",
                "Album",
                "Artist",
            ):
                cur.execute(f'DELETE FROM "{tbl}"')
            conn.commit()

        # 1) Artist
        artists = set(cat["artists"].dropna().astype(str).str.split(",").explode().str.strip())
        artists.discard("")
        console.print(f"Artists: [bold]{len(artists):,}[/bold]")
        artist_map = upsert_artists(cur, artists)
        conn.commit()

        # 2) Album
        cat["primary_artist"] = (
            cat["artists"].fillna("").astype(str).str.split(",").str[0].str.strip()
        )
        cat["primary_artist_id"] = cat["primary_artist"].map(artist_map)
        album_keys = set(
            zip(
                cat["album"].fillna(cat["title"]).astype(str),
                cat["primary_artist_id"].fillna(""),
            )
        )
        console.print(f"Albums: [bold]{len(album_keys):,}[/bold]")
        album_map = upsert_albums(cur, album_keys)
        conn.commit()

        # 3) Tracks
        tracks_rows = []
        for r in cat.itertuples():
            artist_id = artist_map.get(r.primary_artist)
            if not artist_id:
                continue
            album_title = r.album if pd.notna(r.album) else r.title
            album_id = album_map.get((album_title, artist_id))
            tracks_rows.append(
                {
                    "isrc": r.key,
                    "title": str(r.title) if pd.notna(r.title) else "",
                    "duration_ms": int(r.duration_ms_a) if pd.notna(r.duration_ms_a) else 0,
                    "artist_id": artist_id,
                    "album_id": album_id,
                }
            )
        console.print(f"Tracks: [bold]{len(tracks_rows):,}[/bold]")
        track_key_to_id = upsert_tracks(cur, tracks_rows)
        conn.commit()

        # 4) TrackPlatform
        plat_rows = []
        for r in cat.itertuples():
            tid = track_key_to_id.get(r.key)
            if not tid or not pd.notna(r.platform_track_id):
                continue
            plat_rows.append(
                (
                    cuid_id("tp", f"{tid}|{r.source}"),
                    tid,
                    str(r.source),
                    str(r.platform_track_id),
                    None,
                    True,
                    [],
                    r.preview_url if pd.notna(r.preview_url) else None,
                )
            )
        console.print(f"TrackPlatform: [bold]{len(plat_rows):,}[/bold]")
        with progress_bar() as p:
            task = p.add_task("inserting platforms", total=len(plat_rows))
            for i in range(0, len(plat_rows), args.batch_size):
                insert_platforms(cur, plat_rows[i : i + args.batch_size])
                p.advance(task, len(plat_rows[i : i + args.batch_size]))
        conn.commit()

        # 5) TrackAudioFeatures
        feat_rows = []
        for r in cat.itertuples():
            tid = track_key_to_id.get(r.key)
            if not tid or r.key not in feat_idx.index:
                continue
            f = feat_idx.loc[r.key]
            feat_rows.append(
                (
                    cuid_id("af", f"{tid}|{MODEL_VERSION}"),
                    tid,
                    "our_model",
                    MODEL_VERSION,
                    float(f["danceability"]),
                    float(f["energy"]),
                    float(f["valence"]),
                    float(f["acousticness"]),
                    float(f["instrumentalness"]),
                    float(f["liveness"]),
                    float(f["speechiness"]),
                    float(f["tempo"]),
                    float(f["loudness"]),
                    int(f["spotify_key"]),
                    int(f["mode"]),
                    int(f["time_signature"]),
                    [],  # energy_curve V2
                    [],  # subgenres V2
                    1.0,  # confidence placeholder
                )
            )
        console.print(f"TrackAudioFeatures: [bold]{len(feat_rows):,}[/bold]")
        with progress_bar() as p:
            task = p.add_task("inserting features", total=len(feat_rows))
            for i in range(0, len(feat_rows), args.batch_size):
                insert_audio_features(cur, feat_rows[i : i + args.batch_size])
                p.advance(task, len(feat_rows[i : i + args.batch_size]))
        conn.commit()

        # 6) TrackEmbedding (pgvector)
        emb_rows = []
        for r in cat.itertuples():
            tid = track_key_to_id.get(r.key)
            if not tid or r.key not in proj_idx.index:
                continue
            embedding = proj_idx.loc[r.key]["embedding"]
            emb_rows.append(
                (
                    cuid_id("te", f"{tid}|{MODEL_VERSION}"),
                    tid,
                    MODEL_VERSION,
                    np.asarray(embedding, dtype=np.float32),
                    "attention",
                    "mp3_30s",
                )
            )
        console.print(f"TrackEmbedding: [bold]{len(emb_rows):,}[/bold]")
        with progress_bar() as p:
            task = p.add_task("inserting embeddings", total=len(emb_rows))
            for i in range(0, len(emb_rows), args.batch_size):
                insert_embeddings(cur, emb_rows[i : i + args.batch_size])
                p.advance(task, len(emb_rows[i : i + args.batch_size]))
        conn.commit()

        # ─── 요약 ────────────────────────────────────────
        console.print()
        for tbl in ("Artist", "Album", "Track", "TrackPlatform", "TrackAudioFeatures", "TrackEmbedding"):
            cur.execute(f'SELECT COUNT(*) FROM "{tbl}"')
            n = cur.fetchone()[0]
            console.print(f"  {tbl:<22}: [bold]{n:,}[/bold]")

    console.print(f"\n[green]✓ DB 적재 완료[/green]")


if __name__ == "__main__":
    main()
