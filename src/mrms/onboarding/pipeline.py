"""Onboarding 전체 단계 orchestration: favorites → UserTrack → embedding → MRT."""
from __future__ import annotations

import base64
import json

import numpy as np
import psycopg
from pgvector.psycopg import register_vector

from mrms.db.user_embedding import (
    insert_playlist_history,
    upsert_user_embedding,
    upsert_user_persona,
)
from mrms.db.user_track import get_oauth, upsert_user_track
from mrms.onboarding.spotify_collection import (
    fetch_spotify_favorite_tracks,
    fetch_spotify_playlist_tracks,
    fetch_spotify_user_playlists,
)
from mrms.onboarding.status import OnboardingStatus
from mrms.onboarding.tidal_favorites import (
    fetch_tidal_favorite_tracks,
    fetch_tidal_playlist_tracks,
    fetch_tidal_user_playlists,
)
from mrms.recsys.mrt import search_for_persona
from mrms.recsys.persona import (
    NotEnoughTracksError,
    aggregate_user_vector,
    cluster_user_tracks,
)


MODEL_VERSION = "our-v1.0+persona-K3"
CATALOG_MODEL_VERSION = "our-v1.0"
DEFAULT_K = 3
DEFAULT_TOP_N = 20
DEFAULT_CANDIDATE_POOL = 30


def _extract_tidal_uid(access_token: str) -> str:
    parts = access_token.split(".")
    payload_b64 = parts[1] + "=" * (4 - len(parts[1]) % 4)
    payload = json.loads(base64.urlsafe_b64decode(payload_b64))
    return str(payload["uid"])


def _match_tidal_to_internal(
    conn: psycopg.Connection, tidal_track_ids: list[str]
) -> list[str]:
    """Tidal platformTrackIds → internal Track.id 매핑."""
    if not tidal_track_ids:
        return []
    with conn.cursor() as cur:
        cur.execute(
            '''SELECT "trackId" FROM "TrackPlatform"
               WHERE platform = 'tidal' AND "platformTrackId" = ANY(%s)''',
            (tidal_track_ids,),
        )
        return [r[0] for r in cur.fetchall()]


def _fetch_user_track_matrix(
    conn: psycopg.Connection,
    user_id: str,
) -> tuple[list[str], np.ndarray]:
    """UserTrack의 256d 임베딩 행렬 반환."""
    with conn.cursor() as cur:
        cur.execute(
            '''SELECT ut."trackId", e.embedding
               FROM "UserTrack" ut
               JOIN "TrackEmbedding" e ON e."trackId" = ut."trackId"
               WHERE ut."userId" = %s AND e."modelVersion" = %s''',
            (user_id, CATALOG_MODEL_VERSION),
        )
        rows = cur.fetchall()
    if not rows:
        return [], np.zeros((0, 256), dtype=np.float32)
    track_ids = [r[0] for r in rows]
    embeddings = []
    for r in rows:
        v = r[1]
        if isinstance(v, str):
            v = np.fromstring(v.strip("[]"), sep=",", dtype=np.float32)
        embeddings.append(np.asarray(v, dtype=np.float32))
    X = np.vstack(embeddings)
    return track_ids, X


async def run_onboarding(
    user_id: str,
    status: OnboardingStatus,
    conn: psycopg.Connection,
    k: int = DEFAULT_K,
    persona_top_n: int = DEFAULT_TOP_N,
    candidate_pool: int = DEFAULT_CANDIDATE_POOL,
) -> None:
    """User 한 명의 onboarding pipeline. Tidal/Spotify oauth 자동 분기."""
    try:
        # 1. UserOAuth 조회 — Tidal/Spotify
        oauth_tidal = get_oauth(conn, user_id, "tidal")
        oauth_spotify = get_oauth(conn, user_id, "spotify")

        if oauth_spotify and not oauth_tidal:
            await _run_spotify_collection(user_id, status, conn, oauth_spotify)
        elif oauth_tidal:
            await _run_tidal_collection(user_id, status, conn, oauth_tidal)
        else:
            status.fail("Tidal 또는 Spotify 연결이 필요합니다")
            return

        # 2. UserTrack 임베딩 + cluster + MRT (platform 무관)
        status.set("computing_embedding", 50, "음악 취향 분석 중...")
        register_vector(conn)
        track_ids, X = _fetch_user_track_matrix(conn, user_id)
        if len(track_ids) < k:
            status.fail(f"트랙 임베딩이 부족합니다 ({len(track_ids)}곡 < K={k})")
            return

        status.set("clustering", 75, f"페르소나 {k}개 추출 중...")
        try:
            result = cluster_user_tracks(X, k=k)
        except NotEnoughTracksError as e:
            status.fail(f"클러스터링 실패: {e}")
            return

        user_vec = aggregate_user_vector(result.centroids, result.weights)
        upsert_user_embedding(conn, user_id, MODEL_VERSION, user_vec, computed_from=len(track_ids))
        for idx in range(k):
            upsert_user_persona(
                conn, user_id, persona_idx=idx,
                embedding=result.centroids[idx],
                track_count=int(result.weights[idx]),
            )

        status.set("generating_mrt", 90, "추천 생성 중...")
        for idx in range(k):
            recs = search_for_persona(
                conn, user_id, result.centroids[idx],
                catalog_model_version=CATALOG_MODEL_VERSION,
                candidate_pool=candidate_pool,
                top_n=persona_top_n,
            )
            track_id_list = [r["track_id"] for r in recs]
            score_list = [r["similarity"] for r in recs]
            insert_playlist_history(
                conn, user_id, track_id_list, MODEL_VERSION,
                context={"personaIdx": idx, "kind": "persona", "scores": score_list},
            )
        conn.commit()

        status.set("done", 100, "완료")
    except RuntimeError as e:
        status.fail(str(e))
        conn.rollback()
    except Exception as e:
        status.fail(f"예외: {e!s}")
        conn.rollback()


async def _run_tidal_collection(
    user_id: str,
    status: OnboardingStatus,
    conn: psycopg.Connection,
    oauth: dict,
) -> None:
    """Tidal favorites + playlists 트랙 fetch + UserTrack 저장."""
    access_token = oauth["accessToken"]
    tidal_uid = _extract_tidal_uid(access_token)

    status.set("fetching_favorites", 5, "Tidal 즐겨찾기 가져오는 중...")
    favorite_track_ids = await fetch_tidal_favorite_tracks(
        access_token=access_token, tidal_user_id=tidal_uid, country="KR"
    )

    status.set("fetching_favorites", 10, "Tidal 플레이리스트 목록 가져오는 중...")
    playlist_uuids = await fetch_tidal_user_playlists(
        access_token=access_token, tidal_user_id=tidal_uid, country="KR"
    )

    playlist_track_ids_set: set[str] = set()
    for i, pl_uuid in enumerate(playlist_uuids):
        status.set(
            "fetching_favorites",
            10 + int(10 * (i + 1) / max(len(playlist_uuids), 1)),
            f"Tidal 플레이리스트 트랙 가져오는 중... ({i + 1}/{len(playlist_uuids)})",
        )
        try:
            tracks = await fetch_tidal_playlist_tracks(
                access_token=access_token, playlist_uuid=pl_uuid, country="KR"
            )
            playlist_track_ids_set.update(tracks)
        except Exception:
            continue

    favorite_set = set(favorite_track_ids)
    all_tidal_ids = list(favorite_set | playlist_track_ids_set)

    if not all_tidal_ids:
        raise RuntimeError("Tidal 즐겨찾기와 플레이리스트에 트랙이 없습니다.")

    status.set("matching_tracks", 25, f"트랙 매칭 중... (Tidal {len(all_tidal_ids)}곡)")
    internal_track_ids = _match_tidal_to_internal(conn, all_tidal_ids)
    if len(internal_track_ids) < 10:
        raise RuntimeError(
            f"매칭된 트랙이 부족합니다 (Tidal {len(all_tidal_ids)}곡 중 {len(internal_track_ids)}곡만 매칭). 최소 10곡 필요"
        )

    with conn.cursor() as cur:
        cur.execute(
            '''SELECT "trackId", "platformTrackId" FROM "TrackPlatform"
               WHERE platform = 'tidal' AND "platformTrackId" = ANY(%s)''',
            (all_tidal_ids,),
        )
        rows = cur.fetchall()
    internal_to_tidal = {r[0]: r[1] for r in rows}

    for internal_id in internal_track_ids:
        tidal_id = internal_to_tidal.get(internal_id)
        if tidal_id and tidal_id in favorite_set:
            upsert_user_track(
                conn, user_id=user_id, track_id=internal_id,
                is_core=True, source="liked", platform="tidal",
            )
        else:
            upsert_user_track(
                conn, user_id=user_id, track_id=internal_id,
                is_core=False, source="playlist", platform="tidal",
            )
    conn.commit()


async def _run_spotify_collection(
    user_id: str,
    status: OnboardingStatus,
    conn: psycopg.Connection,
    oauth: dict,
) -> None:
    """Spotify favorites + playlists 트랙 fetch + UserTrack 저장."""
    access_token = oauth["accessToken"]

    status.set("fetching_favorites", 5, "Spotify 좋아요 트랙 가져오는 중...")
    favorite_track_ids = await fetch_spotify_favorite_tracks(access_token=access_token)

    status.set("fetching_favorites", 10, "Spotify 플레이리스트 목록 가져오는 중...")
    playlist_ids = await fetch_spotify_user_playlists(access_token=access_token)

    playlist_track_ids_set: set[str] = set()
    for i, pl_id in enumerate(playlist_ids):
        status.set(
            "fetching_favorites",
            10 + int(10 * (i + 1) / max(len(playlist_ids), 1)),
            f"Spotify 플레이리스트 트랙 가져오는 중... ({i + 1}/{len(playlist_ids)})",
        )
        try:
            tracks = await fetch_spotify_playlist_tracks(
                access_token=access_token, playlist_id=pl_id
            )
            playlist_track_ids_set.update(tracks)
        except Exception:
            continue

    favorite_set = set(favorite_track_ids)
    all_spotify_ids = list(favorite_set | playlist_track_ids_set)

    if not all_spotify_ids:
        raise RuntimeError("Spotify 좋아요와 플레이리스트에 트랙이 없습니다.")

    status.set("matching_tracks", 25, f"트랙 매칭 중... (Spotify {len(all_spotify_ids)}곡)")
    with conn.cursor() as cur:
        cur.execute(
            '''SELECT "trackId", "platformTrackId" FROM "TrackPlatform"
               WHERE platform = 'spotify' AND "platformTrackId" = ANY(%s)''',
            (all_spotify_ids,),
        )
        rows = cur.fetchall()
    internal_to_spotify = {r[0]: r[1] for r in rows}
    internal_track_ids = list(internal_to_spotify.keys())
    if len(internal_track_ids) < 10:
        raise RuntimeError(
            f"매칭된 트랙이 부족합니다 (Spotify {len(all_spotify_ids)}곡 중 {len(internal_track_ids)}곡만 매칭). 최소 10곡 필요"
        )

    for internal_id in internal_track_ids:
        spotify_id = internal_to_spotify.get(internal_id)
        if spotify_id and spotify_id in favorite_set:
            upsert_user_track(
                conn, user_id=user_id, track_id=internal_id,
                is_core=True, source="liked", platform="spotify",
            )
        else:
            upsert_user_track(
                conn, user_id=user_id, track_id=internal_id,
                is_core=False, source="playlist", platform="spotify",
            )
    conn.commit()
