"""Spotify editorial 트랙 임포터 — open.spotify.com/embed 공개 위젯 스크래핑.

기존 /v1/search 방식(신규 앱 차단·brittle)을 폐기하고 토큰이 전혀 없는
embed 위젯 HTML 스크래핑으로 전환 (2026-06 실측 검증).

엔드포인트:
    GET https://open.spotify.com/embed/{kind}/{id}   (kind ∈ playlist|album|artist)
응답 HTML의 <script id="__NEXT_DATA__">{json}</script> 안에서:
    props.pageProps.state.data.entity
      ├ name           — 컨테이너 제목
      └ trackList[]
           ├ uri       — "spotify:track:{id}"  → spotify_track_id
           ├ title     — 곡명
           ├ subtitle  — 아티스트 (", " 구분, 정규화 필요)
           └ duration  — ms (정수)

소스 형식 (Setting 'spotify_emp_sources', 한 줄에 하나, # 주석):
    playlist/{id} | album/{id} | artist/{id}

ISRC 없음 (spotify track id만). upsert_track_and_emp_source의 platform-ID
lookup-first 경로로 dedup. 차트 playlist ID는 고정이라(내용만 주간 갱신)
컨테이너 ID만 알면 토큰 없이 트랙을 가져온다.
"""
from __future__ import annotations

import json
import re

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

EMBED_BASE = "https://open.spotify.com/embed"
SOURCES_SETTING_KEY = "spotify_emp_sources"
VALID_KINDS = ("playlist", "album", "artist")

USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/125.0 Safari/537.36"
)

# 기본 소스 (Setting 비었을 때) — 문서의 검증된 차트 playlist ID (2026-06-11 실측).
DEFAULT_SOURCES = [
    "playlist/37i9dQZEVXbMDoHDwVN2tF",  # Top 50 - Global
    "playlist/37i9dQZEVXbLRQDuF5jeBp",  # Top 50 - USA
    "playlist/37i9dQZEVXbNxXF4SkHj9F",  # Top 50 - South Korea
    "playlist/37i9dQZEVXbNG2KDcFcKOF",  # Top Songs - Global
    "playlist/37i9dQZF1DXcBWIGoYBM5M",  # Today's Top Hits
    "playlist/37i9dQZF1DX0XUsuxWHRQd",  # RapCaviar
]

# <script id="__NEXT_DATA__" type="application/json">{...}</script>
_NEXT_DATA_RE = re.compile(
    r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', re.DOTALL
)


def parse_next_data(html: str) -> dict | None:
    """HTML에서 __NEXT_DATA__ JSON을 파싱해 entity dict를 반환. 실패 시 None.

    entity = props.pageProps.state.data.entity ({ name, trackList[] })."""
    m = _NEXT_DATA_RE.search(html or "")
    if not m:
        return None
    try:
        data = json.loads(m.group(1))
    except (ValueError, TypeError):
        return None
    entity = (
        ((data.get("props") or {}).get("pageProps") or {})
        .get("state", {})
        .get("data", {})
        .get("entity")
    )
    return entity if isinstance(entity, dict) else None


def normalize_artist(subtitle: str | None) -> str:
    """embed track의 subtitle('Artist A, Artist B') → 첫 아티스트.

    내부 모델은 artistId가 단일이라 첫 번째 아티스트를 대표로 쓴다 (tidal과 동일).
    빈 값/None이면 'Unknown'."""
    if not subtitle or not isinstance(subtitle, str):
        return "Unknown"
    first = subtitle.split(",")[0].strip()
    return first or "Unknown"


def _track_id_from_uri(uri) -> str | None:
    """'spotify:track:{id}' → id. 형식이 아니면 None."""
    if not isinstance(uri, str):
        return None
    parts = uri.split(":")
    if len(parts) == 3 and parts[0] == "spotify" and parts[1] == "track" and parts[2]:
        return parts[2]
    return None


def _normalize_track(node) -> dict | None:
    """embed trackList[] 항목 → 내부 dict. uri/title 없으면 None."""
    if not isinstance(node, dict):
        return None
    tid = _track_id_from_uri(node.get("uri"))
    title = node.get("title")
    if not tid or not title:
        return None
    duration = node.get("duration")
    return {
        "platform_track_id": tid,
        "title": title,
        "artist": normalize_artist(node.get("subtitle")),
        "duration_ms": int(duration) if isinstance(duration, (int, float)) else None,
    }


def _entity_cover(entity: dict) -> str | None:
    """컨테이너 커버 — entity의 image 필드에서 추출. 없으면 None.

    embed trackList[]는 uri/title/subtitle/duration만 있어 트랙 앨범 커버가 없다 —
    컨테이너 커버가 entity에 없으면 None (cover_url 없이 저장)."""
    images = entity.get("coverArt") or entity.get("visualIdentity") or {}
    if isinstance(images, dict):
        sources = images.get("sources") or images.get("image")
        if isinstance(sources, list):
            for src in sources:
                if isinstance(src, dict):
                    url = src.get("url")
                    if isinstance(url, str) and url.startswith("http"):
                        return url
    # entity 직속 URL 필드
    for k in ("imageUrl", "image"):
        v = entity.get(k)
        if isinstance(v, str) and v.startswith("http"):
            return v
    return None


class SpotifyEMPImporter(EMPImporter):
    """open.spotify.com/embed 스크래핑 importer — 토큰 없음."""

    platform = "spotify"

    def __init__(self):
        # 토큰/시크릿 불필요 — embed는 공개 위젯.
        pass

    def _load_sources(self, conn: psycopg.Connection) -> list[tuple[str, str]]:
        """[(kind, id), ...]. kind ∈ {playlist, album, artist}. 비었으면 DEFAULT_SOURCES."""
        raw = get_setting(conn, SOURCES_SETTING_KEY) or ""
        sources: list[tuple[str, str]] = []
        for line in raw.splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "/" not in line:
                continue
            kind, _, ident = line.partition("/")
            kind = kind.strip().lower()
            # admin이 'playlist/{id}  # Top 50' 처럼 인라인 주석을 넣을 수 있다
            ident = ident.split("#", 1)[0].strip()
            if kind in VALID_KINDS and ident:
                sources.append((kind, ident))
        if not sources:
            for s in DEFAULT_SOURCES:
                kind, _, ident = s.partition("/")
                ident = ident.split("#", 1)[0].strip()
                sources.append((kind, ident))
        return sources

    async def _fetch_embed(
        self, http: httpx.AsyncClient, kind: str, ident: str
    ) -> dict | None:
        """embed 위젯 HTML을 가져와 entity dict 반환. 실패 시 None."""
        try:
            r = await http.get(
                f"{EMBED_BASE}/{kind}/{ident}",
                headers={
                    "User-Agent": USER_AGENT,
                    "Referer": "https://open.spotify.com/",
                    "Accept": "text/html,application/xhtml+xml",
                },
            )
            if r.status_code != 200:
                return None
            return parse_next_data(r.text)
        except Exception:
            return None

    async def import_all(self, conn: psycopg.Connection) -> dict:
        """모든 source 적재.

        각 소스 = 하나의 섹션(EMPSection) + 그 컨테이너 자체가 하나의 아이템.
        trackList → 트랙 upsert (source_type='editorial_embed', source_id='{kind}:{id}').

        반환 dict의 'playlists_processed'는 처리 성공한 소스 수
        (키 이름은 base 인터페이스 호환용)."""
        sources = self._load_sources(conn)
        tracks_new = 0
        tracks_existing = 0
        sources_processed = 0
        errors: list[str] = []

        async with httpx.AsyncClient(timeout=15.0) as http:
            for src_idx, (kind, ident) in enumerate(sources):
                entity = await self._fetch_embed(http, kind, ident)
                if entity is None:
                    errors.append(f"{kind}/{ident}: fetch/parse failed")
                    continue

                name = entity.get("name") or entity.get("title") or ident
                raw_tracks = entity.get("trackList") or []
                tracks = [t for t in (_normalize_track(n) for n in raw_tracks) if t]

                # 섹션 + 아이템 저장 — 이 소스 자체가 하나의 컨테이너 아이템.
                try:
                    section_id = upsert_section(
                        conn=conn,
                        platform=self.platform,
                        section_key=f"{kind}:{ident}",
                        display_title=name,
                        display_order=src_idx,
                    )
                    cover = _entity_cover(entity)
                    upsert_section_item(
                        conn=conn,
                        section_id=section_id,
                        item_type=kind,
                        item_id=ident,
                        title=name,
                        cover_url=cover,
                        display_order=0,
                    )
                    prune_stale_items(conn, section_id, {(kind, ident)})
                except Exception as e:
                    safe_rollback(conn)  # 깨진 트랜잭션 복구 — 후속 쿼리 연쇄실패 방지
                    errors.append(f"section save {kind}/{ident}: {fmt_exc(e, 120)}")

                # 트랙 upsert.
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
                            platform_track_id=t["platform_track_id"],
                            source_type="editorial_embed",
                            source_id=f"{kind}:{ident}",
                            source_name=name,
                        )
                        if r["new"]:
                            tracks_new += 1
                        else:
                            tracks_existing += 1
                    except Exception as e:
                        safe_rollback(conn)
                        errors.append(
                            f"upsert {kind}/{ident}/{t.get('platform_track_id')}: "
                            f"{fmt_exc(e, 120)}"
                        )

                sources_processed += 1

        return {
            "tracks_new": tracks_new,
            "tracks_existing": tracks_existing,
            "playlists_processed": sources_processed,
            "errors": errors,
        }
