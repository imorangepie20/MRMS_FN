"""검색 결과 flat 트랙을 EMP에 적재(best-effort). 적재 후 track_id를 flat에 채운다.

같은 ISRC의 두 플랫폼 ID는 base.upsert_track_and_emp_source가 한 Track으로 병합
(ISRC dedup) + TrackPlatform 2행. source_type='search'."""
from __future__ import annotations

import logging

import psycopg

from mrms.emp.base import upsert_track_and_emp_source

log = logging.getLogger(__name__)


def persist_search_tracks(
    conn: psycopg.Connection, flat_tracks: list[dict], q: str
) -> None:
    source_id = f"search:{q}"
    for t in flat_tracks:
        track_id = None
        for platform, key in (
            ("tidal", "tidal_track_id"),
            ("spotify", "spotify_track_id"),
            ("youtube", "youtube_track_id"),
        ):
            ptid = t.get(key)
            if not ptid:
                continue
            try:
                r = upsert_track_and_emp_source(
                    conn,
                    isrc=t.get("isrc"),
                    title=t["title"] or "",
                    artist=t["artist"] or "",
                    album_title=t.get("album_title"),
                    duration_ms=t.get("duration_ms"),
                    platform=platform,
                    platform_track_id=str(ptid),
                    source_type="search",
                    source_id=source_id,
                    source_name=q,
                    cover_url=t.get("album_cover"),
                )
                track_id = r["track_id"]
            except Exception as e:  # best-effort — 표시를 막지 않음
                conn.rollback()
                log.warning("persist search track failed (%s/%s): %s", platform, ptid, e)
        t["track_id"] = track_id
