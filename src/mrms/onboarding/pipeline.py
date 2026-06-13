"""Onboarding 전체 단계 orchestration: favorites → UserTrack → embedding → MRT."""
from __future__ import annotations

import base64
import json

import numpy as np
import psycopg
from pgvector.psycopg import register_vector

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
from mrms.recsys.mrt import (
    CATALOG_MODEL_VERSION,
    DEFAULT_CANDIDATE_POOL,
    DEFAULT_K,
    DEFAULT_TOP_N,
    generate_user_mrt,
)


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


def count_embedding_user_tracks(
    conn: psycopg.Connection,
    user_id: str,
) -> int:
    """임베딩 보유 UserTrack 수 — step 2 게이트(_fetch_user_track_matrix)와 동일 조건.

    precheck와 게이트가 같은 집합을 보도록 단일 출처로 둔다 (CATALOG_MODEL_VERSION
    임베딩에 JOIN된 UserTrack만). 미스(임베딩 없는 videoId Track)로만 채워진
    YouTube 사용자는 0이 나와 precheck가 "run"이 아니라 "import"로 보내야 한다.
    """
    with conn.cursor() as cur:
        cur.execute(
            '''SELECT COUNT(*)
               FROM "UserTrack" ut
               JOIN "TrackEmbedding" e ON e."trackId" = ut."trackId"
               WHERE ut."userId" = %s AND e."modelVersion" = %s''',
            (user_id, CATALOG_MODEL_VERSION),
        )
        return int(cur.fetchone()[0])


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

        register_vector(conn)
        if oauth_spotify and not oauth_tidal:
            await _run_spotify_collection(user_id, status, conn, oauth_spotify)
        elif oauth_tidal:
            await _run_tidal_collection(user_id, status, conn, oauth_tidal)
        else:
            # Tidal/Spotify 둘 다 없음 — YouTube import 등으로 이미 임베딩 보유
            # UserTrack이 적재됐는지 확인. 있으면 수집을 스킵하고 step 2로 진행
            # (import가 매칭한 임베딩 트랙으로 클러스터/MRT가 동작). 없으면 실패.
            existing_ids, _existing_X = _fetch_user_track_matrix(conn, user_id)
            if not existing_ids:
                status.fail("음악 플랫폼 연결 또는 플레이리스트 import가 필요합니다")
                return

        # 2. UserTrack 임베딩 + cluster + MRT (platform 무관) — generate_user_mrt 공유 함수로 위임
        status.set("computing_embedding", 50, "음악 취향 분석 중...")
        status.set("clustering", 75, f"페르소나 {k}개 추출 중...")
        n_tracks = generate_user_mrt(
            conn, user_id, k=k, top_n=persona_top_n, candidate_pool=candidate_pool,
        )
        if n_tracks is None:
            status.fail(f"트랙 임베딩이 부족합니다 (< K={k})")
            return
        status.set("generating_mrt", 90, "추천 생성 중...")
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
    favorite_isrcs = await fetch_spotify_favorite_tracks(access_token=access_token)
    favorite_track_ids = list(favorite_isrcs.keys())

    status.set("fetching_favorites", 10, "Spotify 플레이리스트 목록 가져오는 중...")
    playlist_ids = await fetch_spotify_user_playlists(access_token=access_token)
    status.set(
        "fetching_favorites", 11,
        f"Spotify 플레이리스트 {len(playlist_ids)}개 발견",
    )

    playlist_isrcs: dict[str, str | None] = {}
    playlist_track_ids_set: set[str] = set()
    playlist_fetch_errors = 0
    last_playlist_error = ""
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
            playlist_isrcs.update(tracks)
            playlist_track_ids_set.update(tracks.keys())
        except Exception as e:
            playlist_fetch_errors += 1
            last_playlist_error = f"{type(e).__name__}: {str(e)[:150]}"
            continue

    favorite_set = set(favorite_track_ids)
    all_spotify_ids = list(favorite_set | playlist_track_ids_set)

    if not all_spotify_ids:
        raise RuntimeError("Spotify 좋아요와 플레이리스트에 트랙이 없습니다.")

    status.set(
        "matching_tracks", 25,
        f"트랙 매칭 중... (좋아요 {len(favorite_set)}곡, 플레이리스트 {len(playlist_track_ids_set)}곡, 합 {len(all_spotify_ids)}곡)",
    )
    with conn.cursor() as cur:
        cur.execute(
            '''SELECT "trackId", "platformTrackId" FROM "TrackPlatform"
               WHERE platform = 'spotify' AND "platformTrackId" = ANY(%s)''',
            (all_spotify_ids,),
        )
        rows = cur.fetchall()
    internal_to_spotify = {r[0]: r[1] for r in rows}
    direct_match_count = len(internal_to_spotify)

    # ISRC fallback — fetch 시 inline으로 받은 ISRC로 Track.isrc 직접 매칭.
    # /tracks?ids= 별도 호출 안 함 (Spotify Dev Mode 403).
    isrc_match_count = 0
    matched_spotify_ids = set(internal_to_spotify.values())
    all_isrcs = {**favorite_isrcs, **playlist_isrcs}  # {spotify_id: isrc}
    unmatched_with_isrc = {
        sid: isrc for sid, isrc in all_isrcs.items()
        if sid not in matched_spotify_ids and isrc
    }
    if unmatched_with_isrc:
        status.set(
            "matching_tracks", 28,
            f"ISRC로 catalog 재매칭 중... ({len(unmatched_with_isrc)}곡)",
        )
        isrc_to_spotify = {isrc: sid for sid, isrc in unmatched_with_isrc.items()}
        with conn.cursor() as cur:
            cur.execute(
                'SELECT id, isrc FROM "Track" WHERE isrc = ANY(%s)',
                (list(unmatched_with_isrc.values()),),
            )
            isrc_rows = cur.fetchall()
            for internal_id, isrc in isrc_rows:
                sid = isrc_to_spotify.get(isrc)
                if sid and internal_id not in internal_to_spotify:
                    internal_to_spotify[internal_id] = sid
                    isrc_match_count += 1
                    # 다음 사용자 위해 캐시 (TrackPlatform spotify entry)
                    cur.execute(
                        '''INSERT INTO "TrackPlatform"
                             (id, "trackId", platform, "platformTrackId")
                           VALUES (%s, %s, 'spotify', %s)
                           ON CONFLICT ("trackId", platform) DO NOTHING''',
                        (f"tp_spotify_{sid}", internal_id, sid),
                    )
            if isrc_match_count:
                conn.commit()

    internal_track_ids = list(internal_to_spotify.keys())
    if len(internal_track_ids) < 10:
        diag = (
            f"playlists 발견={len(playlist_ids)}, fetch 실패={playlist_fetch_errors}"
            f", direct 매칭={direct_match_count}, ISRC 매칭={isrc_match_count}"
            + (f", last_err=[{last_playlist_error}]" if last_playlist_error else "")
        )
        raise RuntimeError(
            f"매칭된 트랙이 부족합니다 (좋아요 {len(favorite_set)}곡 + 플레이리스트 {len(playlist_track_ids_set)}곡 → "
            f"{len(all_spotify_ids)}곡 중 {len(internal_track_ids)}곡만 매칭). 최소 10곡 필요 | {diag}"
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
