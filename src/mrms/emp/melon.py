"""Melon Hot 100 importer — melon.com 차트 페이지 HTML 스크래핑 (토큰 0).

Melon은 공개 JSON 차트 API가 없어 차트 페이지 HTML을 직접 파싱한다 (실측 검증).
- 차트 페이지: https://www.melon.com/chart/index.htm  (실시간 Top 100)
- ISRC·재생 ID 없음 (Melon songId만). Melon은 **차트 신호(곡 식별)** 용 —
  재생 가능 플랫폼 매칭은 download/resolve(제목+아티스트 검색)가 담당.

섹션 모델: Melon은 album id가 없을 수 있어 앨범 dedup 대신 차트 자체를 단일
컨테이너로 둔다. EMPSection 1개('hot100') + EMPSectionItem 1개(chart:hot100)에
모든 트랙을 매단다 (source_id='chart:hot100').

selector 의존 — 페이지 레이아웃 변경 시 0행이 되며, 그 경우 에러를 기록하고
파서 1곳(parse_chart)만 고치면 된다.
"""
from __future__ import annotations

import re

import httpx
import psycopg
from bs4 import BeautifulSoup

from mrms.db.emp_section import prune_stale_items, upsert_section, upsert_section_item
from mrms.emp.base import (
    EMPImporter,
    fmt_exc,
    safe_rollback,
    upsert_track_and_emp_source,
)

CHART_URL = "https://www.melon.com/chart/index.htm"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
)

SECTION_KEY = "hot100"
SECTION_TITLE = "Melon Hot 100"
SOURCE_TYPE = "chart"
SOURCE_ID = "chart:hot100"
SOURCE_NAME = "Melon Hot 100"

_DIGITS = re.compile(r"\d+")


def _text_or_none(node) -> str | None:
    """엘리먼트의 텍스트 (양끝 공백 제거). 없거나 빈 문자열이면 None."""
    if node is None:
        return None
    text = node.get_text(strip=True)
    return text or None


def parse_chart(html: str) -> list[dict]:
    """Melon 차트 HTML → 트랙 dict 리스트 (순수 함수, 테스트 가능).

    각 dict: {rank, song_id, title, artist, album, cover_url}.
    rank/song_id/title/artist가 없으면 그 행은 skip (방어적).
    """
    soup = BeautifulSoup(html, "html.parser")
    rows = soup.select("table tbody tr.lst50, table tbody tr.lst100")

    tracks: list[dict] = []
    for row in rows:
        song_id = row.get("data-song-no")
        if not song_id:
            continue

        rank_text = _text_or_none(row.select_one("span.rank"))
        rank = None
        if rank_text:
            m = _DIGITS.search(rank_text)
            if m:
                rank = int(m.group())

        # 곡명 — div.ellipsis.rank01 안의 a(없으면 span)
        title_box = row.select_one("div.ellipsis.rank01")
        title = None
        if title_box is not None:
            title = _text_or_none(title_box.select_one("a") or title_box.select_one("span"))

        # 아티스트 — div.ellipsis.rank02 안의 a(없으면 span)
        artist_box = row.select_one("div.ellipsis.rank02")
        artist = None
        if artist_box is not None:
            artist = _text_or_none(
                artist_box.select_one("a") or artist_box.select_one("span")
            )

        # 앨범 — div.ellipsis.rank03 a (없으면 None)
        album_box = row.select_one("div.ellipsis.rank03")
        album = _text_or_none(album_box.select_one("a")) if album_box is not None else None

        # 커버 — a.image_typeAll img[src] (fallback: td a img[src])
        cover_url = None
        img = row.select_one("a.image_typeAll img") or row.select_one("td a img")
        if img is not None:
            src = img.get("src")
            if isinstance(src, str) and src.strip():
                cover_url = src.strip()

        if not title or not artist:
            # 핵심 필드 누락 — 레이아웃 변경 가능성. 해당 행만 skip.
            continue

        tracks.append(
            {
                "rank": rank,
                "song_id": str(song_id),
                "title": title,
                "artist": artist,
                "album": album,
                "cover_url": cover_url,
            }
        )

    return tracks


class MelonEMPImporter(EMPImporter):
    """Melon Hot 100 importer. 소스 고정 (Setting 불필요) — 항상 hot100."""

    platform = "melon"

    def __init__(self):
        pass

    async def _fetch_chart_html(self) -> str:
        async with httpx.AsyncClient(timeout=20.0) as http:
            r = await http.get(
                CHART_URL,
                headers={"User-Agent": USER_AGENT},
                follow_redirects=True,
            )
            r.raise_for_status()
            return r.text

    async def import_all(self, conn: psycopg.Connection) -> dict:
        """Hot 100 적재.

        반환 dict의 'playlists_processed'는 섹션 1개 처리 시 1 (base 인터페이스 호환).
        """
        errors: list[str] = []

        try:
            html = await self._fetch_chart_html()
        except Exception as e:
            return {
                "tracks_new": 0,
                "tracks_existing": 0,
                "playlists_processed": 0,
                "errors": [f"fetch chart: {fmt_exc(e, 120)}"],
            }

        try:
            tracks = parse_chart(html)
        except Exception as e:
            return {
                "tracks_new": 0,
                "tracks_existing": 0,
                "playlists_processed": 0,
                "errors": [f"parse chart: {fmt_exc(e, 120)}"],
            }

        if not tracks:
            # 0행 = selector가 더 이상 안 맞음 (레이아웃 변경). 섹션 안 건드림.
            return {
                "tracks_new": 0,
                "tracks_existing": 0,
                "playlists_processed": 0,
                "errors": ["0 rows parsed — Melon chart layout changed?"],
            }

        # 섹션 1개 + 차트 단일 컨테이너 아이템 1개.
        try:
            section_id = upsert_section(
                conn=conn,
                platform=self.platform,
                section_key=SECTION_KEY,
                display_title=SECTION_TITLE,
                display_order=0,
            )
            # 대표 커버 = 1위 곡 커버 (없으면 None).
            upsert_section_item(
                conn=conn,
                section_id=section_id,
                item_type="chart",
                item_id=SECTION_KEY,
                title=SECTION_TITLE,
                cover_url=tracks[0].get("cover_url"),
                display_order=0,
            )
            prune_stale_items(conn, section_id, {("chart", SECTION_KEY)})
        except Exception as e:
            safe_rollback(conn)  # 깨진 트랜잭션 복구 — 후속 upsert 연쇄실패 방지
            errors.append(f"section save: {fmt_exc(e, 120)}")

        tracks_new = 0
        tracks_existing = 0
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
                    platform_track_id=t["song_id"],
                    source_type=SOURCE_TYPE,
                    source_id=SOURCE_ID,
                    source_name=SOURCE_NAME,
                    cover_url=t.get("cover_url"),
                )
                if r["new"]:
                    tracks_new += 1
                else:
                    tracks_existing += 1
            except Exception as e:
                safe_rollback(conn)
                errors.append(
                    f"upsert song {t.get('song_id')}: {fmt_exc(e, 120)}"
                )

        return {
            "tracks_new": tracks_new,
            "tracks_existing": tracks_existing,
            "playlists_processed": 1,
            "errors": errors,
        }
