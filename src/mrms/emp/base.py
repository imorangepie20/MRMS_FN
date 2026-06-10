"""EMP importer base + Track upsert 로직."""
from __future__ import annotations

from abc import ABC, abstractmethod

import psycopg

from mrms.db.emp import upsert_emp_source
from mrms.db.ids import stable_id as _id


def fmt_exc(e: BaseException, limit: int = 200) -> str:
    """예외를 'ExcType: message' 형식으로 — message는 limit자에서 truncate."""
    return f"{type(e).__name__}: {str(e)[:limit]}"


def safe_rollback(conn: psycopg.Connection) -> None:
    """SQL 에러를 catch하고 같은 connection을 계속 쓸 때 필수.

    rollback 없이 진행하면 모든 후속 쿼리가 InFailedSqlTransaction으로
    연쇄 실패해 진짜 원인이 묻힘 (prod 좀비 run 사건의 근본 원인)."""
    try:
        conn.rollback()
    except Exception:
        pass  # connection 자체가 죽은 경우 — 호출자의 다음 쿼리가 명확히 실패함


def _get_or_create_artist(conn: psycopg.Connection, name: str) -> str:
    artist_id = _id(f"artist|{name.lower().strip()}")
    name_normalized = name.lower().strip()
    with conn.cursor() as cur:
        cur.execute(
            '''INSERT INTO "Artist" (id, name, "nameNormalized")
               VALUES (%s, %s, %s)
               ON CONFLICT (id) DO NOTHING''',
            (artist_id, name, name_normalized),
        )
    return artist_id


def _get_or_create_album(
    conn: psycopg.Connection,
    title: str,
    artist_id: str,
) -> str:
    album_id = _id(f"album|{artist_id}|{title.lower().strip()}")
    with conn.cursor() as cur:
        cur.execute(
            '''INSERT INTO "Album" (id, title, "albumType", "artistId")
               VALUES (%s, %s, 'album', %s)
               ON CONFLICT (id) DO NOTHING''',
            (album_id, title, artist_id),
        )
    return album_id


def upsert_track_and_emp_source(
    conn: psycopg.Connection,
    isrc: str | None,
    title: str,
    artist: str,
    album_title: str | None,
    duration_ms: int | None,
    platform: str,
    platform_track_id: str,
    source_type: str,
    source_id: str,
    source_name: str | None,
) -> dict:
    """
    1. ISRC로 기존 Track 찾기 → 있으면 재사용, 없으면 신규.
    2. TrackPlatform upsert.
    3. EMPSource upsert (trigger로 Track.inEmp=TRUE).
    Returns: {'track_id': ..., 'new': bool}.
    """
    track_id: str | None = None
    is_new = False

    if isrc:
        with conn.cursor() as cur:
            cur.execute('SELECT id FROM "Track" WHERE isrc = %s', (isrc,))
            row = cur.fetchone()
            if row:
                track_id = row[0]

    if track_id is None:
        artist_id = _get_or_create_artist(conn, artist)
        album_id = None
        if album_title:
            album_id = _get_or_create_album(conn, album_title, artist_id)
        track_isrc = isrc or f"emp_{platform}_{platform_track_id}"
        track_id = _id(f"track|{track_isrc}")
        title_norm = title.lower().strip()
        with conn.cursor() as cur:
            cur.execute(
                '''INSERT INTO "Track"
                     (id, isrc, title, "titleNormalized", "durationMs", "artistId", "albumId")
                   VALUES (%s, %s, %s, %s, %s, %s, %s)
                   ON CONFLICT (id) DO NOTHING''',
                (track_id, track_isrc, title, title_norm, duration_ms or 0, artist_id, album_id),
            )
        conn.commit()
        is_new = True

    tp_id = _id(f"tp|{platform}|{platform_track_id}")
    with conn.cursor() as cur:
        cur.execute(
            '''INSERT INTO "TrackPlatform"
                 (id, "trackId", platform, "platformTrackId")
               VALUES (%s, %s, %s, %s)
               ON CONFLICT ("trackId", platform) DO NOTHING''',
            (tp_id, track_id, platform, platform_track_id),
        )
    conn.commit()

    upsert_emp_source(
        conn,
        track_id=track_id,
        platform=platform,
        source_type=source_type,
        source_id=source_id,
        source_name=source_name,
    )

    return {"track_id": track_id, "new": is_new}


class EMPImporter(ABC):
    """EMP 임포터 base — 플랫폼별 진입점은 import_all 하나.

    playlist 목록 기반 플랫폼은 PlaylistEMPImporter를 상속할 것."""

    platform: str

    @abstractmethod
    async def import_all(self, conn: psycopg.Connection) -> dict:
        """모든 editorial source + 트랙 적재.
        Returns: {tracks_new, tracks_existing, playlists_processed, errors}."""
        ...


class PlaylistEMPImporter(EMPImporter):
    """Editorial playlist 목록 기반 임포터 (Spotify 등).

    fetch_editorial_playlists / fetch_playlist_tracks만 구현하면
    import_all이 playlist 루프 + upsert를 처리."""

    @abstractmethod
    async def fetch_editorial_playlists(self) -> list[dict]:
        """플랫폼의 editorial playlist 목록.
        Each dict: {id, name, source_type}."""
        ...

    @abstractmethod
    async def fetch_playlist_tracks(self, playlist_id: str) -> list[dict]:
        """한 playlist 트랙들.
        Each dict: {platform_track_id, title, isrc, artist, album_title, duration_ms}."""
        ...

    async def import_all(self, conn: psycopg.Connection) -> dict:
        """모든 editorial playlist + 트랙 적재.
        Returns: {tracks_new, tracks_existing, playlists_processed, errors}."""
        tracks_new = 0
        tracks_existing = 0
        playlists_processed = 0
        errors: list[str] = []

        try:
            playlists = await self.fetch_editorial_playlists()
        except Exception as e:
            errors.append(f"fetch_playlists: {fmt_exc(e, 120)}")
            return {
                "tracks_new": 0,
                "tracks_existing": 0,
                "playlists_processed": 0,
                "errors": errors,
            }

        for pl in playlists:
            try:
                tracks = await self.fetch_playlist_tracks(pl["id"])
                for t in tracks:
                    r = upsert_track_and_emp_source(
                        conn,
                        isrc=t.get("isrc"),
                        title=t["title"],
                        artist=t["artist"],
                        album_title=t.get("album_title"),
                        duration_ms=t.get("duration_ms"),
                        platform=self.platform,
                        platform_track_id=t["platform_track_id"],
                        source_type=pl.get("source_type", "editorial_playlist"),
                        source_id=pl["id"],
                        source_name=pl.get("name"),
                    )
                    if r["new"]:
                        tracks_new += 1
                    else:
                        tracks_existing += 1
                playlists_processed += 1
            except Exception as e:
                safe_rollback(conn)
                errors.append(f"playlist {pl.get('id')}: {fmt_exc(e, 120)}")
                continue

        return {
            "tracks_new": tracks_new,
            "tracks_existing": tracks_existing,
            "playlists_processed": playlists_processed,
            "errors": errors,
        }
