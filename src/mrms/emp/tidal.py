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

from typing import Iterable

import httpx
import psycopg

from mrms.db.emp_section import prune_stale_items, upsert_section, upsert_section_item
from mrms.db.settings import get_setting
from mrms.emp.base import EMPImporter, upsert_track_and_emp_source


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
    # Album items typically have numeric id + artists/releaseDate.
    # Guard on 'isrc' absence — tracks also have artists but always carry isrc.
    if (
        item_id
        and not node.get("isrc")
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
        self.token = token or get_setting(conn, TOKEN_SETTING_KEY)
        self._conn = conn

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

    def _load_sources(self) -> list[tuple[str, str]]:
        """[(kind, identifier), ...]. kind ∈ {home, playlist, album, mix}."""
        raw = get_setting(self._conn, SOURCES_SETTING_KEY) or ""
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
            for v in node.values():
                yield from TidalEMPImporter._walk_classify(v)
        elif isinstance(node, list):
            for v in node:
                yield from TidalEMPImporter._walk_classify(v)

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
        return {
            "platform_track_id": str(tid),
            "title": title,
            "isrc": isrc,
            "artist": artist_name,
            "album_title": album.get("title"),
            "duration_ms": int(duration_sec) * 1000 if duration_sec else None,
        }

    # ----- EMPImporter interface (base requires these but we override import_all) -----

    async def fetch_editorial_playlists(self) -> list[dict]:
        """Not used directly — see import_all."""
        return []

    async def fetch_playlist_tracks(self, playlist_id: str) -> list[dict]:
        """Not used directly — see import_all. Kept for interface compat."""
        if not self.token:
            return []
        async with httpx.AsyncClient(timeout=20.0) as http:
            return await self._fetch_playlist_tracks(http, playlist_id)

    # ----- Override base import_all to handle multiple source kinds -----

    async def import_all(self, conn: psycopg.Connection) -> dict:
        if not self.token:
            return {
                "tracks_new": 0,
                "tracks_existing": 0,
                "playlists_processed": 0,
                "errors": ["no tidal_x_token"],
            }
        sources = self._load_sources()

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
                        errors.append(
                            f"section save {ident}: {type(e).__name__}: {str(e)[:120]}"
                        )

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
                    errors.append(f"{kind}/{ident}: {type(e).__name__}: {str(e)[:120]}")
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
                        )
                        if r["new"]:
                            tracks_new += 1
                        else:
                            tracks_existing += 1
                    except Exception as e:
                        errors.append(
                            f"upsert {kind}/{ident}/{t.get('platform_track_id')}: "
                            f"{type(e).__name__}: {str(e)[:120]}"
                        )

        return {
            "tracks_new": tracks_new,
            "tracks_existing": tracks_existing,
            "playlists_processed": len(items),
            "errors": errors,
        }
