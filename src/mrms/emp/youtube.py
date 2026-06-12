"""YouTube Music 공식 차트 importer — ytmusicapi 공개 플레이리스트.

YouTube가 만든 "Top 100 Songs {Country}" 공식 차트 플리를 ytmusicapi의
get_playlist로 받아온다 (인증 없이도 동작, 2026-06 실측).

인증 (Setting 'youtube_auth_json' — ytmusicapi browser auth JSON):
- 있으면 YTMusic(json.loads(raw))로 인증 인스턴스 → videoId가 100% 채워짐 (실측).
- 없거나 파싱 실패면 무인증 폴백 — 차트 자체는 무인증도 동작 (videoId만 대부분 None).

한계/특성 (실측):
- videoId가 None인 트랙은 platform_track_id를 제목+아티스트로 합성
  (일관성 유지: f"yt_{stable_id(...)[:16]}"). 합성 ID는 재생 불가 —
  같은 곡이 나중에 real videoId와 함께 오면 합성 매핑을 real로 승격
  (_migrate_synthetic_mapping).
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
import json

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
AUTH_SETTING_KEY = "youtube_auth_json"
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

    각 track dict: {track_id, video_id, title, artist, cover_url, duration_ms}.
    - track_id = videoId가 있으면 그대로, 없으면 f"yt_{stable_id(title+'|'+artist)[:16]}" (합성).
    - video_id = real videoId (없으면 None) — 합성 매핑 마이그레이션 판단용.
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
                "video_id": str(video_id) if video_id else None,
                "title": t_title,
                "artist": artist,
                "cover_url": _best_thumbnail(tr.get("thumbnails")),
                "duration_ms": _duration_to_ms(tr.get("duration")),
            }
        )

    return (title, tracks)


def _migrate_synthetic_mapping(
    conn: psycopg.Connection, title: str, artist: str, video_id: str
) -> None:
    """합성('yt_…') TrackPlatform 매핑을 real videoId로 승격.

    인증 전 적재분은 videoId가 없어 합성 ID로 매핑돼 있다. 같은 title|artist가
    real videoId와 함께 다시 오면:
    - real 매핑이 따로 없으면 → 합성 행을 real videoId로 UPDATE
      (id도 stable_id('tp|youtube|{videoId}')로 재계산).
    - real 매핑이 이미 있으면 → 합성 행은 DELETE (잔여물 제거).
      unique 제약이 ("trackId", platform)이라 한 Track엔 youtube 행이 하나뿐 —
      real 행이 '따로' 있다는 건 다른 Track에 매핑됐다는 뜻이므로 UPDATE 불가.
    이후 upsert_track_and_emp_source가 (platform, videoId) lookup으로 같은
    Track을 재사용 → 중복 Track 생성 없음.
    """
    synthetic = f"yt_{stable_id(f'{title}|{artist}')[:16]}"
    with conn.cursor() as cur:
        cur.execute(
            '''SELECT id FROM "TrackPlatform"
               WHERE platform = %s AND "platformTrackId" = %s
               LIMIT 1''',
            ("youtube", synthetic),
        )
        synth_row = cur.fetchone()
        if not synth_row:
            return  # 마이그레이션 대상 없음 — 신규/기존 real 경로는 base가 처리

        cur.execute(
            '''SELECT 1 FROM "TrackPlatform"
               WHERE platform = %s AND "platformTrackId" = %s
               LIMIT 1''',
            ("youtube", video_id),
        )
        if cur.fetchone():
            cur.execute('DELETE FROM "TrackPlatform" WHERE id = %s', (synth_row[0],))
        else:
            cur.execute(
                '''UPDATE "TrackPlatform"
                   SET id = %s, "platformTrackId" = %s
                   WHERE id = %s''',
                (stable_id(f"tp|youtube|{video_id}"), video_id, synth_row[0]),
            )
    conn.commit()


class YoutubeEMPImporter(EMPImporter):
    """YouTube Music 공식 차트 importer. ytmusicapi 공개 플레이리스트."""

    platform = "youtube"

    def __init__(self):
        self._yt_instance = None
        self._auth_raw: str | None = None  # Setting 'youtube_auth_json' raw

    def _yt(self):
        """YTMusic 인스턴스 lazy 생성 (첫 사용 시). import도 lazy —
        ytmusicapi가 없는 환경에서 순수 함수 테스트는 영향받지 않도록.

        _auth_raw(browser auth JSON)가 있으면 인증 인스턴스 — videoId가
        채워진다. 파싱 실패는 무인증 폴백 (차트는 무인증도 동작하므로
        에러로 취급하지 않음)."""
        if self._yt_instance is None:
            from ytmusicapi import YTMusic

            auth = None
            if self._auth_raw:
                try:
                    auth = json.loads(self._auth_raw)
                except ValueError:
                    auth = None  # 무인증 폴백
            self._yt_instance = YTMusic(auth) if auth else YTMusic()
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
        # browser auth JSON — 있으면 인증 YTMusic (videoId 100% 실측)
        self._auth_raw = get_setting(conn, AUTH_SETTING_KEY)
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
                    if t.get("video_id"):
                        # 인증 전 적재된 합성 매핑이 있으면 real videoId로 승격
                        _migrate_synthetic_mapping(
                            conn, t["title"], t["artist"], t["video_id"]
                        )
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
