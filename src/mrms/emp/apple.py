"""Apple Music RSS importer — rss.marketingtools.apple.com (토큰 0).

Apple Music의 공개 RSS 피드 (Apple Marketing Tools)는 인증 없이 차트를 JSON으로
준다 (실측 검증). songs 피드만 트랙을 직접 담는다 — albums/playlists 피드는
컨테이너 목록만 주고 내부 트랙은 RSS에 없어(Apple Music API는 토큰 필요) EMP에
쓰지 않는다.

피드: https://rss.marketingtools.apple.com/api/v2/{region}/music/most-played/{limit}/songs.json
  → feed.title (현지화 제목, 예: '인기곡' / 'Top Songs')
  → feed.results[] : {id, name, artistName, collectionName?, artworkUrl100, url}

ISRC·duration 없음 (Apple track id만). Apple은 **차트 신호** 용 — 재생 가능
플랫폼 매칭은 download/resolve(제목+아티스트 검색)가 담당.

소스 형식 (Setting 'apple_emp_sources', 한 줄에 하나, # 주석): songs/{region}
기본값: ['songs/kr', 'songs/us'].
"""
from __future__ import annotations

import httpx
import psycopg

from mrms.db.emp_section import prune_stale_items, upsert_section, upsert_section_item
from mrms.db.settings import get_setting
from mrms.emp.base import (
    EMPImporter,
    fmt_exc,
    safe_rollback,
    upsert_track_and_emp_source,
)

RSS_BASE = "https://rss.marketingtools.apple.com/api/v2"
RSS_LIMIT = 50
SOURCES_SETTING_KEY = "apple_emp_sources"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
)

# 기본 소스 (Setting 비었을 때) — 한국 + 미국 인기곡 Top 50.
DEFAULT_SOURCES = ["songs/kr", "songs/us"]


def _upsize_artwork(url: str | None) -> str | None:
    """artworkUrl100 (100x100bb.jpg) → 600x600 으로 업사이즈. None은 그대로."""
    if not url:
        return None
    return url.replace("100x100", "600x600")


def parse_feed(data: dict) -> tuple[str | None, list[dict]]:
    """songs 피드 JSON → (feed_title, 트랙 dict 리스트). 순수 함수 (테스트 가능).

    각 dict: {track_id, title, artist, album, cover_url}.
    name/artistName/id 없으면 그 항목은 skip (방어적).
    """
    feed = data.get("feed") or {}
    title = feed.get("title")
    results = feed.get("results") or []

    tracks: list[dict] = []
    for it in results:
        if not isinstance(it, dict):
            continue
        track_id = it.get("id")
        name = it.get("name")
        artist = it.get("artistName")
        if not track_id or not name or not artist:
            continue
        tracks.append(
            {
                "track_id": str(track_id),
                "title": name,
                "artist": artist,
                "album": it.get("collectionName") or None,
                "cover_url": _upsize_artwork(it.get("artworkUrl100")),
            }
        )
    return title, tracks


class AppleEMPImporter(EMPImporter):
    """Apple Music RSS importer — region별 songs 차트."""

    platform = "apple"

    def __init__(self):
        pass

    def _load_sources(self, conn: psycopg.Connection) -> list[tuple[str, str]]:
        """[(kind, region), ...]. kind는 'songs' 고정. 비었으면 DEFAULT_SOURCES."""
        raw = get_setting(conn, SOURCES_SETTING_KEY) or ""
        sources: list[tuple[str, str]] = []
        for line in raw.splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "/" not in line:
                continue
            kind, _, region = line.partition("/")
            kind = kind.strip().lower()
            region = region.split("#", 1)[0].strip().lower()
            # songs 피드만 트랙을 담는다 (albums/playlists는 트랙 없음).
            if kind == "songs" and region:
                sources.append((kind, region))
        if not sources:
            for s in DEFAULT_SOURCES:
                kind, _, region = s.partition("/")
                sources.append((kind, region))
        return sources

    async def _fetch_feed(
        self, http: httpx.AsyncClient, region: str
    ) -> dict | None:
        """region songs 피드 JSON. 실패 시 None."""
        url = f"{RSS_BASE}/{region}/music/most-played/{RSS_LIMIT}/songs.json"
        try:
            r = await http.get(
                url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
                follow_redirects=True,
            )
            if r.status_code != 200:
                return None
            return r.json()
        except Exception:
            return None

    async def import_all(self, conn: psycopg.Connection) -> dict:
        """각 region songs 피드 = 섹션 1개 + 차트 단일 컨테이너 + 트랙 적재.

        반환 dict의 'playlists_processed'는 처리한 섹션 수 (base 인터페이스 호환).
        """
        sources = self._load_sources(conn)
        tracks_new = 0
        tracks_existing = 0
        sections_done = 0
        errors: list[str] = []

        async with httpx.AsyncClient(timeout=20.0) as http:
            for src_idx, (kind, region) in enumerate(sources):
                data = await self._fetch_feed(http, region)
                if data is None:
                    errors.append(f"{kind}/{region}: fetch failed")
                    continue

                feed_title, tracks = parse_feed(data)
                if not tracks:
                    errors.append(f"{kind}/{region}: 0 tracks (RSS shape changed?)")
                    continue

                section_key = f"{kind}:{region}"
                source_id = f"chart:{region}-{kind}"
                display = feed_title or f"{region.upper()} Top Songs"

                # 섹션 + 차트 단일 컨테이너 아이템.
                try:
                    section_id = upsert_section(
                        conn=conn,
                        platform=self.platform,
                        section_key=section_key,
                        display_title=display,
                        display_order=src_idx,
                    )
                    upsert_section_item(
                        conn=conn,
                        section_id=section_id,
                        item_type="chart",
                        item_id=f"{region}-{kind}",
                        title=display,
                        cover_url=tracks[0].get("cover_url"),
                        display_order=0,
                    )
                    prune_stale_items(
                        conn, section_id, {("chart", f"{region}-{kind}")}
                    )
                except Exception as e:
                    safe_rollback(conn)
                    errors.append(f"section save {region}: {fmt_exc(e, 120)}")

                for t in tracks:
                    try:
                        r = upsert_track_and_emp_source(
                            conn,
                            isrc=None,
                            title=t["title"],
                            artist=t["artist"],
                            album_title=t.get("album"),
                            duration_ms=None,
                            platform=self.platform,
                            platform_track_id=t["track_id"],
                            source_type="chart",
                            source_id=source_id,
                            source_name=display,
                        )
                        if r["new"]:
                            tracks_new += 1
                        else:
                            tracks_existing += 1
                    except Exception as e:
                        safe_rollback(conn)
                        errors.append(
                            f"upsert {region}/{t.get('track_id')}: {fmt_exc(e, 120)}"
                        )

                sections_done += 1

        return {
            "tracks_new": tracks_new,
            "tracks_existing": tracks_existing,
            "playlists_processed": sections_done,
            "errors": errors,
        }
