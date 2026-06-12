"""YouTube Music 공식 차트 importer — ytmusicapi 공개 플레이리스트 (인증 0).

YouTube가 만든 "Top 100 Songs {Country}" 공식 차트 플리를 ytmusicapi의
get_playlist로 받아온다 (인증 없이 동작, 2026-06 실측).

한계/특성 (실측):
- videoId는 인증 없이의 응답에서 대부분 None → platform_track_id를 제목+아티스트로
  합성 (일관성 유지: f"yt_{stable_id(...)[:16]}").
- thumbnails는 100% 제공 → 가장 큰 width를 커버로.
- ISRC·앨범은 없음. YouTube는 **차트 신호(곡 식별)** 용 — 재생/매칭은
  download/resolve(제목+아티스트 검색)가 담당.
- ytmusicapi는 동기 → asyncio.to_thread로 감싼다.

섹션 모델: Melon처럼 차트 자체를 단일 컨테이너로 둔다. playlist 1개당
EMPSection 1개(section_key='playlist:{pid}') + EMPSectionItem 1개(chart:{pid})에
모든 트랙을 매단다 (source_id='chart:{pid}').

소스 형식 (Setting 'youtube_emp_sources', 한 줄에 하나, # 주석):
- playlist/{id}  — 공식 차트 플레이리스트

비었을 때 기본값: Global + South Korea Top 100.
"""
from __future__ import annotations

import asyncio

import psycopg

from mrms.db.emp_section import prune_stale_items, upsert_section, upsert_section_item
from mrms.db.ids import stable_id
from mrms.db.settings import get_setting
from mrms.emp.base import (
    EMPImporter,
    fmt_exc,
    safe_rollback,
    upsert_track_and_emp_source,
)


SOURCES_SETTING_KEY = "youtube_emp_sources"
SOURCE_TYPE = "chart"

# 공식 차트 플리 id (실측 — YouTube가 만든 "Top 100 Songs {Country}")
DEFAULT_SOURCES = [
    "playlist/PL4fGSI1pDJn6puJdseH2Rt9sMvt9E2M4i",  # Global
    "playlist/PL4fGSI1pDJn6jXS_Tv_N9B8Z0HTRVJE0m",  # South Korea
]


def _duration_to_ms(duration: str | None) -> int | None:
    """'M:SS' 또는 'H:MM:SS' → ms. 파싱 불가 시 None."""
    if not isinstance(duration, str):
        return None
    parts = duration.strip().split(":")
    if not parts or len(parts) > 3:
        return None
    try:
        nums = [int(p) for p in parts]
    except ValueError:
        return None
    seconds = 0
    for n in nums:
        seconds = seconds * 60 + n
    return seconds * 1000


def _best_thumbnail(thumbnails) -> str | None:
    """thumbnails 리스트에서 가장 큰 width의 url. 없으면 None."""
    if not isinstance(thumbnails, list):
        return None
    best_url: str | None = None
    best_width = -1
    for t in thumbnails:
        if not isinstance(t, dict):
            continue
        url = t.get("url")
        if not isinstance(url, str) or not url:
            continue
        width = t.get("width") or 0
        if not isinstance(width, (int, float)):
            width = 0
        if width >= best_width:
            best_width = width
            best_url = url
    return best_url


def parse_playlist(pl: dict) -> tuple[str | None, list[dict]]:
    """ytmusicapi get_playlist dict → (title, tracks[]) (순수 함수, 테스트 가능).

    각 track dict: {track_id, title, artist, cover_url, duration_ms}.
    - track_id = videoId가 있으면 그대로, 없으면 f"yt_{stable_id(title+'|'+artist)[:16]}" (합성).
    - artist = artists[0].name (없으면 "Unknown").
    - title 또는 artist가 비면 그 트랙 skip.
    """
    if not isinstance(pl, dict):
        return (None, [])

    title = pl.get("title")
    raw_tracks = pl.get("tracks") or []

    tracks: list[dict] = []
    for tr in raw_tracks:
        if not isinstance(tr, dict):
            continue
        t_title = tr.get("title")
        if not t_title:
            continue

        artists = tr.get("artists") or []
        artist = None
        if isinstance(artists, list) and artists:
            first = artists[0]
            if isinstance(first, dict):
                artist = first.get("name")
        artist = artist or "Unknown"

        video_id = tr.get("videoId")
        if video_id:
            track_id = str(video_id)
        else:
            track_id = f"yt_{stable_id(f'{t_title}|{artist}')[:16]}"

        tracks.append(
            {
                "track_id": track_id,
                "title": t_title,
                "artist": artist,
                "cover_url": _best_thumbnail(tr.get("thumbnails")),
                "duration_ms": _duration_to_ms(tr.get("duration")),
            }
        )

    return (title, tracks)


class YoutubeEMPImporter(EMPImporter):
    """YouTube Music 공식 차트 importer. ytmusicapi 공개 플레이리스트 (인증 0)."""

    platform = "youtube"

    def __init__(self):
        self._yt_instance = None

    def _yt(self):
        """YTMusic 인스턴스 lazy 생성 (첫 사용 시). import도 lazy —
        ytmusicapi가 없는 환경에서 순수 함수 테스트는 영향받지 않도록."""
        if self._yt_instance is None:
            from ytmusicapi import YTMusic

            self._yt_instance = YTMusic()
        return self._yt_instance

    def _load_sources(self, conn: psycopg.Connection) -> list[str]:
        """[playlist_id, ...]. 'playlist/{id}' 라인만 인식. 비면 DEFAULT_SOURCES."""
        raw = get_setting(conn, SOURCES_SETTING_KEY) or ""
        pids: list[str] = []
        for line in raw.splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "/" not in line:
                continue
            kind, _, ident = line.partition("/")
            if kind.strip().lower() == "playlist" and ident.strip():
                pids.append(ident.strip())
        if not pids:
            for s in DEFAULT_SOURCES:
                _, _, ident = s.partition("/")
                if ident:
                    pids.append(ident)
        return pids

    async def _fetch_playlist(self, pid: str) -> dict | None:
        """ytmusicapi get_playlist를 to_thread로. 실패 시 None (graceful)."""
        try:
            return await asyncio.to_thread(self._yt().get_playlist, pid, 100)
        except Exception:
            return None

    async def import_all(self, conn: psycopg.Connection) -> dict:
        """모든 차트 플레이리스트 적재.

        반환 dict의 'playlists_processed'는 정상 처리된 차트 플리 수."""
        pids = self._load_sources(conn)

        tracks_new = 0
        tracks_existing = 0
        playlists_processed = 0
        errors: list[str] = []

        for idx, pid in enumerate(pids):
            pl = await self._fetch_playlist(pid)
            if pl is None:
                errors.append(f"fetch playlist {pid}: no data")
                continue

            try:
                pl_title, tracks = parse_playlist(pl)
            except Exception as e:
                errors.append(f"parse playlist {pid}: {fmt_exc(e, 120)}")
                continue

            if not tracks:
                errors.append(f"playlist {pid}: 0 tracks parsed")
                continue

            display_title = pl_title or f"YouTube Top 100 ({pid})"
            section_key = f"playlist:{pid}"
            source_id = f"chart:{pid}"

            # 섹션 1개 + 차트 단일 컨테이너 아이템 1개 (대표 커버 = 첫 트랙 커버).
            try:
                section_id = upsert_section(
                    conn=conn,
                    platform=self.platform,
                    section_key=section_key,
                    display_title=display_title,
                    display_order=idx,
                )
                upsert_section_item(
                    conn=conn,
                    section_id=section_id,
                    item_type="chart",
                    item_id=pid,
                    title=display_title,
                    cover_url=tracks[0].get("cover_url"),
                    display_order=0,
                )
                prune_stale_items(conn, section_id, {("chart", pid)})
            except Exception as e:
                safe_rollback(conn)  # 깨진 트랜잭션 복구 — 후속 upsert 연쇄실패 방지
                errors.append(f"section save {pid}: {fmt_exc(e, 120)}")

            for t in tracks:
                try:
                    r = upsert_track_and_emp_source(
                        conn,
                        isrc=None,
                        title=t["title"],
                        artist=t["artist"],
                        album_title=None,
                        duration_ms=t.get("duration_ms"),
                        platform=self.platform,
                        platform_track_id=t["track_id"],
                        source_type=SOURCE_TYPE,
                        source_id=source_id,
                        source_name=display_title,
                        cover_url=t.get("cover_url"),
                    )
                    if r["new"]:
                        tracks_new += 1
                    else:
                        tracks_existing += 1
                except Exception as e:
                    safe_rollback(conn)
                    errors.append(
                        f"upsert {pid}/{t.get('track_id')}: {fmt_exc(e, 120)}"
                    )

            playlists_processed += 1

        return {
            "tracks_new": tracks_new,
            "tracks_existing": tracks_existing,
            "playlists_processed": playlists_processed,
            "errors": errors,
        }
