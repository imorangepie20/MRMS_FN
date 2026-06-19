"""Tidal editorial 트랙 임포터 — tidal.com Web API + X-Tidal-Token.

브라우저 DevTools로 관찰한 실제 web API 사용:
- 섹션 목록: /v2/home/pages/<SECTION_NAME>/view-all
- 플레이리스트 트랙: /v1/playlists/{uuid}/items
- 앨범 페이지: /v1/pages/album?albumId={id}
- 믹스 페이지: /v1/pages/mix?mixId={id}

소스 형식 (Setting 'tidal_emp_sources', 한 줄에 하나):
- home/<SECTION>   — 섹션에서 playlist/album/mix discovery
- playlist/<uuid>  — 직접 playlist
- album/<id>       — 직접 album
- mix/<id>         — 직접 mix

토큰은 Setting 'tidal_x_token'. 없으면 importer는 graceful skip.
"""
from __future__ import annotations

import re
from typing import Iterable

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


TIDAL_BASE = "https://tidal.com"
TOKEN_SETTING_KEY = "tidal_x_token"
SOURCES_SETTING_KEY = "tidal_emp_sources"
DEFAULT_COUNTRY = "US"
DEFAULT_LOCALE = "en_US"
DEFAULT_DEVICE = "BROWSER"
CLIENT_VERSION = "2026.6.9"

# 기본 섹션 (Setting 비었을 때 fallback) — 다양한 컨텐츠 타입 다 들고 옴
DEFAULT_SOURCES = [
    "home/THE_HITS",
    "home/POPULAR_PLAYLISTS",
    "home/POPULAR_MIXES",
    "home/LATEST_SPOTLIGHTED_TRACKS",
]


def _extract_cover(node: dict) -> str | None:
    """Try multiple fields for cover URL. Returns first usable URL or None."""
    # Direct URL string fields
    for k in ("imageUrl", "image"):
        v = node.get(k)
        if isinstance(v, str) and v.startswith("http"):
            return v
    # Tidal cover ID (UUID with dashes, e.g. "b48a8d6f-...") → CDN URL
    cover = node.get("cover") or node.get("squareImage")
    if isinstance(cover, str) and "-" in cover and len(cover) >= 16:
        path = cover.replace("-", "/")
        return f"https://resources.tidal.com/images/{path}/320x320.jpg"
    # images / image dict with size keys
    images = node.get("images") or node.get("image")
    if isinstance(images, dict):
        for size_key in ("MEDIUM", "LARGE", "SMALL", "md", "lg", "sm"):
            entry = images.get(size_key)
            if isinstance(entry, dict):
                url = entry.get("url")
                if isinstance(url, str) and url.startswith("http"):
                    return url
            elif isinstance(entry, str) and entry.startswith("http"):
                return entry
    return None


def _video_cover(image_id: str | None) -> str | None:
    """Tidal 비디오 imageId(UUID) → 16:9 썸네일 CDN URL."""
    if not isinstance(image_id, str) or "-" not in image_id:
        return None
    return f"https://resources.tidal.com/images/{image_id.replace('-', '/')}/640x360.jpg"


def _promo_cover(image_id: str | None) -> str | None:
    """MULTIPLE_TOP_PROMOTIONS(Featured) 프로모 타일 imageId → CDN URL.
    프로모 이미지는 비디오 썸네일(640x360)이 없고 550x400 버킷만 존재(2026-06 실측) — 그걸로."""
    if not isinstance(image_id, str) or "-" not in image_id:
        return None
    return f"https://resources.tidal.com/images/{image_id.replace('-', '/')}/550x400.jpg"


def _video_section_key(title: str) -> str:
    """비디오 모듈 제목 → 'video:<slug>' 섹션 키(영숫자 외 → '-'). EMP와 구분 + 안정 키."""
    slug = re.sub(r"[^a-z0-9]+", "-", title.strip().lower()).strip("-")
    return f"video:{slug or 'section'}"


def _normalize_video(item) -> dict | None:
    """비디오 item dict → {video_id, title, artist, cover_url}. 부적합하면 None."""
    if not isinstance(item, dict):
        return None
    vid = item.get("id")
    title = item.get("title")
    if not vid or not title:
        return None
    artists = item.get("artists") or []
    artist = (
        (item.get("artist") or {}).get("name")
        or (artists[0].get("name") if artists else None)
        or "Unknown"
    )
    return {
        "video_id": str(vid),
        "title": title,
        "artist": artist,
        "cover_url": _video_cover(item.get("imageId")),
    }


def _first_module(page: dict, module_type: str) -> dict | None:
    """pages 응답에서 주어진 type의 첫 모듈을 찾는다."""
    if not isinstance(page, dict):
        return None
    for row in page.get("rows") or []:
        for mod in row.get("modules") or []:
            if isinstance(mod, dict) and mod.get("type") == module_type:
                return mod
    return None


def _classify_item(node: dict) -> tuple[str, str, str, str | None] | None:
    """Returns (kind, identifier, name, cover_url) or None.

    Tidal section items are wrapped:
        {type: "MIX"|"PLAYLIST"|"ALBUM", data: {...}}
    """
    if not isinstance(node, dict):
        return None

    outer = (node.get("type") or "").upper()
    data = node.get("data")

    if outer == "MIX" and isinstance(data, dict):
        return _classify_mix(data)
    if outer == "PLAYLIST" and isinstance(data, dict):
        return _classify_playlist(data)
    if outer == "ALBUM" and isinstance(data, dict):
        return _classify_album(data)

    # No wrapper — fallback for flat shapes (older /v1/pages/* responses)
    title = node.get("title")
    if not title:
        return None
    cover_url = _extract_cover(node)
    uuid = node.get("uuid")
    if uuid and isinstance(uuid, str) and len(uuid) >= 16:
        return ("playlist", uuid, title, cover_url)
    item_id = node.get("id")
    # 트랙 전용 시그널 — isrc가 없어도(spotlighted tracks 등) 트랙을 album으로
    # 오분류하지 않도록. 트랙은 trackNumber/volumeNumber 또는 nested album 객체를 가짐.
    looks_like_track = (
        node.get("isrc")
        or node.get("trackNumber") is not None
        or node.get("volumeNumber") is not None
        or isinstance(node.get("album"), dict)
    )
    # Album items typically have numeric id + artists/releaseDate, 트랙 시그널은 없음.
    if (
        item_id
        and not looks_like_track
        and (node.get("releaseDate") or node.get("artists"))
    ):
        return ("album", str(item_id), title, cover_url)
    if isinstance(item_id, str) and len(item_id) >= 16 and "-" not in item_id:
        return ("mix", item_id, title, cover_url)
    return None


def _classify_mix(data: dict) -> tuple[str, str, str, str | None] | None:
    mix_id = data.get("id")
    if not isinstance(mix_id, str):
        return None
    # Title from titleTextInfo.text, fallback to track.trackTitle, then id
    title = (
        (data.get("titleTextInfo") or {}).get("text")
        or (data.get("track") or {}).get("trackTitle")
        or mix_id
    )
    cover_url = _pick_image_size(
        data.get("mixImages") or data.get("detailMixImages") or []
    )
    return ("mix", mix_id, title, cover_url)


def _classify_playlist(data: dict) -> tuple[str, str, str, str | None] | None:
    # Playlist data has uuid field
    uuid = data.get("uuid") or data.get("id")
    if not isinstance(uuid, str) or len(uuid) < 16:
        return None
    title = data.get("title") or uuid
    cover_url = _extract_cover(data) or _pick_image_size(
        data.get("squareImages") or data.get("images") or []
    )
    return ("playlist", uuid, title, cover_url)


def _classify_album(data: dict) -> tuple[str, str, str, str | None] | None:
    album_id = data.get("id")
    if album_id is None:
        return None
    title = data.get("title") or str(album_id)
    cover_url = _extract_cover(data) or _pick_image_size(
        data.get("squareImages") or data.get("images") or []
    )
    return ("album", str(album_id), title, cover_url)


def _pick_image_size(images: list) -> str | None:
    """Tidal image arrays: [{size: 'SMALL'|'MEDIUM'|'LARGE', url: '...', ...}].
    Prefer MEDIUM (640x640) — LARGE (1500x1500)는 카드용으로 과대, 트래픽 낭비."""
    if not isinstance(images, list):
        return None
    by_size: dict[str, str] = {}
    for img in images:
        if isinstance(img, dict):
            sz = (img.get("size") or "").upper()
            url = img.get("url")
            if isinstance(url, str) and sz:
                by_size[sz] = url
    for sz in ("MEDIUM", "LARGE", "SMALL"):
        if sz in by_size:
            return by_size[sz]
    return None


class TidalEMPImporter(EMPImporter):
    """Tidal Web API 기반 importer. token + sources 둘 다 Setting에서 로딩."""

    platform = "tidal"

    def __init__(self, conn: psycopg.Connection, token: str | None = None):
        # conn은 토큰 로딩에만 사용 — 데이터 적재/설정 조회는 import_all(conn) 기준
        self.token = token or get_setting(conn, TOKEN_SETTING_KEY)

    def _headers(self) -> dict[str, str]:
        return {
            "X-Tidal-Token": self.token or "",
            "X-Tidal-Client-Version": CLIENT_VERSION,
            "Accept": "application/json",
        }

    def _common_params(self) -> dict[str, str]:
        return {
            "countryCode": DEFAULT_COUNTRY,
            "locale": DEFAULT_LOCALE,
            "deviceType": DEFAULT_DEVICE,
        }

    def _load_sources(self, conn: psycopg.Connection) -> list[tuple[str, str]]:
        """[(kind, identifier), ...]. kind ∈ {home, playlist, album, mix}."""
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
            ident = ident.strip()
            if kind in ("home", "playlist", "album", "mix") and ident:
                sources.append((kind, ident))
        if not sources:
            for s in DEFAULT_SOURCES:
                kind, _, ident = s.partition("/")
                sources.append((kind, ident))
        return sources

    # ----- discovery / detail HTTP helpers -----

    async def _fetch_section_items(
        self, http: httpx.AsyncClient, section: str
    ) -> list[tuple[str, str, str, str | None]]:
        """Walk /v2/home/pages/{SECTION}/view-all response.
        Returns [(kind, id, name, cover_url), ...]."""
        try:
            r = await http.get(
                f"{TIDAL_BASE}/v2/home/pages/{section}/view-all",
                headers=self._headers(),
                params={
                    **self._common_params(),
                    "platform": "WEB",
                    "limit": 50,
                    "offset": 0,
                },
            )
            if r.status_code != 200:
                return []
            data = r.json()
        except Exception:
            return []
        return list(self._walk_classify(data))

    @staticmethod
    def _walk_classify(node) -> Iterable[tuple[str, str, str, str | None]]:
        """Recursively walk; yield + STOP recursion when a node classifies."""
        if isinstance(node, dict):
            classified = _classify_item(node)
            if classified is not None:
                yield classified
                return  # Don't recurse into matched items
            # 트랙/비디오 래퍼({type:"TRACK"|"VIDEO", data:{...}})는 컨테이너가 아니다.
            # 내부 data로 재귀하면 그 트랙 dict이 fallback에서 album으로 오분류된다
            # (LATEST_SPOTLIGHTED_TRACKS 등 트랙 섹션이 앨범 카드로 뜨던 버그) → 재귀 차단.
            if (node.get("type") or "").upper() in ("TRACK", "VIDEO"):
                return
            for v in node.values():
                yield from TidalEMPImporter._walk_classify(v)
        elif isinstance(node, list):
            for v in node:
                yield from TidalEMPImporter._walk_classify(v)

    async def _fetch_video_page_modules(
        self, http: httpx.AsyncClient
    ) -> list[dict]:
        """/v1/pages/videos의 모든 모듈을 페이지 순서 그대로 → 섹션 리스트.
        각 섹션 = {key, title, kind, items}. kind: 'video'(개별 비디오 카드) |
        'video_playlist'(플레이리스트 카드). 화면(Tidal /videos)을 그대로 미러:
        - MULTIPLE_TOP_PROMOTIONS("Featured") → 개별 비디오(type=='VIDEO'만)
        - VIDEO_LIST("New Music Videos"/"Classics") → 개별 비디오
        - PLAYLIST_LIST("New Video Playlists"/"Classics Video Playlists") → 플레이리스트
          (showMore view-all로 전체 확장)."""
        try:
            r = await http.get(
                f"{TIDAL_BASE}/v1/pages/videos",
                headers=self._headers(),
                params={**self._common_params()},
            )
            if r.status_code != 200:
                return []
            data = r.json()
        except Exception:
            return []

        sections: list[dict] = []
        for row in data.get("rows") or []:
            for m in row.get("modules") or []:
                if not isinstance(m, dict):
                    continue
                title = (m.get("title") or "").strip()
                mtype = m.get("type")
                if not title:
                    continue
                if mtype == "MULTIPLE_TOP_PROMOTIONS":
                    items, kind = self._featured_from_module(m), "video"
                elif mtype == "VIDEO_LIST":
                    items, kind = self._videos_from_module(m), "video"
                elif mtype == "PLAYLIST_LIST":
                    items = await self._playlists_from_module(http, m)
                    kind = "video_playlist"
                else:
                    continue
                if items:
                    sections.append({
                        "key": _video_section_key(title),
                        "title": title,
                        "kind": kind,
                        "items": items,
                    })
        return sections

    @staticmethod
    def _featured_from_module(module: dict) -> list[dict]:
        """MULTIPLE_TOP_PROMOTIONS items → 개별 비디오. type=='VIDEO'만(CATEGORY_PAGES 등 스킵)."""
        out: list[dict] = []
        seen: set[str] = set()
        for it in module.get("items") or []:
            if not isinstance(it, dict) or it.get("type") != "VIDEO":
                continue
            vid = it.get("artifactId")
            title = it.get("shortHeader") or it.get("header")
            if not vid or not title or str(vid) in seen:
                continue
            seen.add(str(vid))
            out.append({
                "video_id": str(vid),
                "title": title,
                "cover_url": _promo_cover(it.get("imageId")),
            })
        return out

    @staticmethod
    def _videos_from_module(module: dict) -> list[dict]:
        """VIDEO_LIST pagedList.items → 개별 비디오(_normalize_video). video_id dedup."""
        out: list[dict] = []
        seen: set[str] = set()
        for it in (module.get("pagedList") or {}).get("items") or []:
            v = _normalize_video(it)
            if not v or v["video_id"] in seen:
                continue
            seen.add(v["video_id"])
            out.append(v)
        return out

    async def _playlists_from_module(
        self, http: httpx.AsyncClient, module: dict
    ) -> list[dict]:
        """PLAYLIST_LIST pagedList.items(+showMore view-all) → 플레이리스트 카드
        [{uuid, title, cover_url}, ...]. uuid dedup."""
        items = (module.get("pagedList") or {}).get("items") or []
        api_path = ((module.get("showMore") or {}).get("apiPath")) or None
        if api_path:
            try:
                r = await http.get(
                    f"{TIDAL_BASE}/v1/{api_path}",
                    headers=self._headers(),
                    params={**self._common_params()},
                )
                if r.status_code == 200:
                    m2 = _first_module(r.json(), "PLAYLIST_LIST")
                    if m2:
                        items = (m2.get("pagedList") or {}).get("items") or items
            except Exception:
                pass
        out: list[dict] = []
        seen: set[str] = set()
        for it in items:
            if not isinstance(it, dict):
                continue
            uuid = it.get("uuid")
            title = it.get("title")
            if not uuid or not title or uuid in seen:
                continue
            seen.add(uuid)
            out.append({
                "uuid": uuid,
                "title": title.strip(),
                "cover_url": _extract_cover(it),
            })
        return out

    async def _fetch_playlist_videos(
        self, http: httpx.AsyncClient, playlist_uuid: str
    ) -> list[dict]:
        """/v1/playlists/{uuid}/items → 비디오들 [{video_id, title, artist, cover_url}, ...]."""
        try:
            r = await http.get(
                f"{TIDAL_BASE}/v1/playlists/{playlist_uuid}/items",
                headers=self._headers(),
                params={**self._common_params(), "limit": 50, "offset": 0},
            )
            if r.status_code != 200:
                return []
            data = r.json()
        except Exception:
            return []
        out: list[dict] = []
        for entry in data.get("items") or []:
            if entry.get("type") != "video":
                continue
            v = _normalize_video(entry.get("item"))
            if v:
                out.append(v)
        return out

    async def _import_videos(
        self, conn: psycopg.Connection, http: httpx.AsyncClient, base_order: int
    ) -> tuple[int, set[str]]:
        """Tidal /v1/pages/videos의 모든 모듈을 페이지 순서·제목 그대로 EMPSection으로 미러.
        반환 = (저장 아이템 총개수, 생성된 video:% 키 집합 — import_all이 stale 정리에 사용).
        - PLAYLIST_LIST → 플레이리스트 카드(item_type='video_playlist') → 클릭 시 영상 모달.
        - MULTIPLE_TOP_PROMOTIONS/VIDEO_LIST → 개별 비디오(item_type='video') → 클릭 시 풀스크린.
        영상은 평면화하지 않고 플레이리스트는 카드로(클릭 시 라이브 fetch). (EMP 음악과 동일 구조.)
        ※ 섹션 단위 stale 정리는 import_all에서(빈 fetch로 전체 삭제 방지)."""
        sections = await self._fetch_video_page_modules(http)
        total = 0
        created_keys: set[str] = set()
        for offset, sec in enumerate(sections):
            item_type = "video_playlist" if sec["kind"] == "video_playlist" else "video"
            sec_id = upsert_section(
                conn=conn, platform="tidal", section_key=sec["key"],
                display_title=sec["title"], display_order=base_order + offset,
            )
            seen: set[tuple[str, str]] = set()
            for idx, it in enumerate(sec["items"]):
                item_id = it["uuid"] if item_type == "video_playlist" else it["video_id"]
                upsert_section_item(
                    conn=conn, section_id=sec_id, item_type=item_type,
                    item_id=item_id, title=it["title"],
                    cover_url=it["cover_url"], display_order=idx,
                )
                seen.add((item_type, item_id))
            prune_stale_items(conn, sec_id, seen)
            created_keys.add(sec["key"])
            total += len(sec["items"])
        return total, created_keys

    @staticmethod
    def _prune_stale_video_sections(
        conn: psycopg.Connection, keep_keys: set[str]
    ) -> int:
        """이번 sync에 없는 video:% 섹션 삭제(모듈 제거/리네임 정리). items는 FK CASCADE.
        keep_keys 비면 아무것도 안 지움(빈 fetch로 전체 삭제 방지)."""
        if not keep_keys:
            return 0
        with conn.cursor() as cur:
            cur.execute(
                '''DELETE FROM "EMPSection"
                   WHERE platform = 'tidal' AND "sectionKey" LIKE 'video:%%'
                     AND "sectionKey" <> ALL(%s)''',
                (list(keep_keys),),
            )
            deleted = cur.rowcount
        conn.commit()
        return deleted

    async def _fetch_playlist_tracks(
        self, http: httpx.AsyncClient, playlist_id: str
    ) -> list[dict]:
        """/v1/playlists/{uuid}/items pagination."""
        result: list[dict] = []
        offset = 0
        while True:
            params = {**self._common_params(), "limit": 50, "offset": offset}
            r = await http.get(
                f"{TIDAL_BASE}/v1/playlists/{playlist_id}/items",
                headers=self._headers(),
                params=params,
            )
            if r.status_code != 200:
                break
            data = r.json()
            items = data.get("items") or []
            if not items:
                break
            for entry in items:
                tr = entry.get("item") if isinstance(entry.get("item"), dict) else entry
                track = self._normalize_track(tr)
                if track:
                    result.append(track)
            total = data.get("totalNumberOfItems") or len(items)
            offset += len(items)
            if offset >= total:
                break
        return result

    async def _fetch_album_tracks(
        self, http: httpx.AsyncClient, album_id: str
    ) -> list[dict]:
        """/v1/pages/album?albumId=... — walk response for tracks."""
        try:
            r = await http.get(
                f"{TIDAL_BASE}/v1/pages/album",
                headers=self._headers(),
                params={**self._common_params(), "albumId": album_id},
            )
            if r.status_code != 200:
                return []
            data = r.json()
        except Exception:
            return []
        return self._extract_tracks(data)

    async def _fetch_mix_tracks(
        self, http: httpx.AsyncClient, mix_id: str
    ) -> list[dict]:
        """/v1/pages/mix?mixId=... — walk response for tracks."""
        try:
            r = await http.get(
                f"{TIDAL_BASE}/v1/pages/mix",
                headers=self._headers(),
                params={**self._common_params(), "mixId": mix_id},
            )
            if r.status_code != 200:
                return []
            data = r.json()
        except Exception:
            return []
        return self._extract_tracks(data)

    def _extract_tracks(self, node) -> list[dict]:
        """Walk a /pages/* response and pull every track-shaped object."""
        out: list[dict] = []
        seen_ids: set[str] = set()
        for tr in self._walk_tracks(node):
            track = self._normalize_track(tr)
            if track and track["platform_track_id"] not in seen_ids:
                seen_ids.add(track["platform_track_id"])
                out.append(track)
        return out

    @staticmethod
    def _walk_tracks(node) -> Iterable[dict]:
        """Yield dicts that look like tracks. Track items typically have
        'id' (numeric) + 'title' + 'isrc' (or 'artists' + 'duration')."""
        if isinstance(node, dict):
            tid = node.get("id")
            title = node.get("title")
            # Heuristic: tracks have id + title + (isrc OR (duration + artists))
            if (
                tid is not None
                and title
                and (
                    node.get("isrc")
                    or (node.get("duration") and node.get("artists"))
                )
                # Exclude album/playlist shapes (no isrc and no duration on those)
                and not node.get("numberOfTracks")
                and not node.get("uuid")
            ):
                yield node
            for v in node.values():
                yield from TidalEMPImporter._walk_tracks(v)
        elif isinstance(node, list):
            for v in node:
                yield from TidalEMPImporter._walk_tracks(v)

    @staticmethod
    def _normalize_track(tr) -> dict | None:
        if not isinstance(tr, dict):
            return None
        tid = tr.get("id")
        title = tr.get("title")
        if not tid or not title:
            return None
        isrc = tr.get("isrc")
        duration_sec = tr.get("duration") or 0
        artists = tr.get("artists") or []
        artist_name = artists[0].get("name") if artists else "Unknown"
        album = tr.get("album") or {}
        cover_url = _extract_cover(album) if isinstance(album, dict) else None
        return {
            "platform_track_id": str(tid),
            "title": title,
            "isrc": isrc,
            "artist": artist_name,
            "album_title": album.get("title"),
            "cover_url": cover_url,
            "duration_ms": int(duration_sec) * 1000 if duration_sec else None,
        }

    # ----- EMPImporter entrypoint — multiple source kinds (home/playlist/album/mix) -----

    async def import_all(self, conn: psycopg.Connection) -> dict:
        """모든 source 적재.

        주의: 반환 dict의 'playlists_processed'는 Tidal에서는 playlist+album+mix
        합산 아이템 수 (키 이름은 base 인터페이스 호환용)."""
        if not self.token:
            return {
                "tracks_new": 0,
                "tracks_existing": 0,
                "playlists_processed": 0,
                "errors": ["no tidal_x_token"],
            }
        sources = self._load_sources(conn)

        # Phase 1: resolve sources → flat list of (kind, id, name, cover_url)
        # Also save EMPSection + EMPSectionItem for home/* sources.
        items: list[tuple[str, str, str, str | None]] = []
        seen_keys: set[tuple[str, str]] = set()
        errors: list[str] = []

        async with httpx.AsyncClient(timeout=20.0) as http:
            for src_idx, (kind, ident) in enumerate(sources):
                if kind == "home":
                    classified = await self._fetch_section_items(http, ident)

                    # Save section hierarchy to DB
                    display_title = ident.replace("_", " ").title()
                    try:
                        section_id = upsert_section(
                            conn=conn,
                            platform="tidal",
                            section_key=ident,
                            display_title=display_title,
                            display_order=src_idx,
                        )
                        seen_in_section: set[tuple[str, str]] = set()
                        for item_idx, (k, i, n, cover) in enumerate(classified):
                            upsert_section_item(
                                conn=conn,
                                section_id=section_id,
                                item_type=k,
                                item_id=i,
                                title=n,
                                cover_url=cover,
                                display_order=item_idx,
                            )
                            seen_in_section.add((k, i))
                        prune_stale_items(conn, section_id, seen_in_section)
                    except Exception as e:
                        safe_rollback(conn)  # 깨진 트랜잭션 복구 — 후속 쿼리 연쇄실패 방지
                        errors.append(f"section save {ident}: {fmt_exc(e, 120)}")

                    for k, i, n, cover in classified:
                        if (k, i) not in seen_keys:
                            seen_keys.add((k, i))
                            items.append((k, i, n, cover))
                else:
                    # Direct item — no section save
                    if (kind, ident) not in seen_keys:
                        seen_keys.add((kind, ident))
                        items.append((kind, ident, ident, None))

            # Phase 2: fetch tracks per item, upsert
            tracks_new = 0
            tracks_existing = 0
            for kind, ident, name, _cover in items:
                try:
                    if kind == "playlist":
                        tracks = await self._fetch_playlist_tracks(http, ident)
                        source_type = "editorial_playlist"
                    elif kind == "album":
                        tracks = await self._fetch_album_tracks(http, ident)
                        source_type = "editorial_album"
                    elif kind == "mix":
                        tracks = await self._fetch_mix_tracks(http, ident)
                        source_type = "editorial_mix"
                    else:
                        continue
                except Exception as e:
                    safe_rollback(conn)
                    errors.append(f"{kind}/{ident}: {fmt_exc(e, 120)}")
                    continue

                for t in tracks:
                    try:
                        r = upsert_track_and_emp_source(
                            conn,
                            isrc=t.get("isrc"),
                            title=t["title"],
                            artist=t["artist"],
                            album_title=t.get("album_title"),
                            duration_ms=t.get("duration_ms"),
                            platform=self.platform,
                            platform_track_id=t["platform_track_id"],
                            source_type=source_type,
                            source_id=f"{kind}:{ident}",
                            source_name=name,
                            cover_url=t.get("cover_url"),
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

            # === 비디오 인제스트 (항상 1회) — Tidal /pages/videos 전체 모듈 미러 ===
            try:
                video_count, video_keys = await self._import_videos(
                    conn, http, base_order=len(sources) + 10
                )
                # stale 섹션 정리 — 정상 fetch(키 있음) 때만(빈 결과로 전체 삭제 방지)
                self._prune_stale_video_sections(conn, video_keys)
            except Exception as e:
                video_count = 0
                safe_rollback(conn)
                errors.append(f"videos: {fmt_exc(e, 120)}")

        return {
            "tracks_new": tracks_new,
            "tracks_existing": tracks_existing,
            "playlists_processed": len(items),
            "videos": video_count,
            "errors": errors,
        }
