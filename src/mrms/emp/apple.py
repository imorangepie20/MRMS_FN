"""Apple Music importer — RSS 차트 + music.apple.com 페이지 스크래핑 (토큰 0).

Apple Music의 공개 RSS 피드 (Apple Marketing Tools)는 인증 없이 차트를 JSON으로
준다. songs 피드는 트랙을 직접 담는다. albums/playlists 피드는 컨테이너 목록만 주고
내부 트랙은 RSS에 없다 — 그 트랙은 music.apple.com 정식 페이지에서 가져온다 (실측:
embed 위젯은 빈 껍데기지만 정식 페이지는 server-rendered).

RSS:
  GET {RSS_BASE}/{region}/music/most-played/{limit}/songs.json
  GET {RSS_BASE}/{region}/music/most-played/{limit}/albums.json
  GET {RSS_BASE}/{region}/music/most-played/{limit}/playlists.json
  → feed.title (현지화), feed.results[] : {id, name, artistName?, artworkUrl100, url}

컨테이너 트랙 (HTML 스크래핑):
  GET https://music.apple.com/{region}/album/x/{albumId}
  GET https://music.apple.com/{region}/playlist/x/{playlistId}
  응답 HTML 안:
  - <script id=serialized-server-data> → Apple Redux state. data[0].data.sections 중
    itemKind=='trackLockup' 섹션의 items[]가 트랙. 각 item:
      {title, artistName, duration(ms int),
       contentDescriptor.identifiers.storeAdamID(트랙 id),
       artwork.dictionary.url(템플릿, album 트랙은 null → 컨테이너 커버 fallback)}.
    → artistName 포함이라 가장 완전. (1순위)
  - <script type=application/ld+json> → @type MusicAlbum/MusicPlaylist,
    track(playlist)/tracks(album)[] : {name, duration(ISO8601 'PT5M7S'),
    url('.../song/.../{id}')}. byArtist 없음(트랙 아티스트 미상). (검증/fallback)

소스 형식 (Setting 'apple_emp_sources', 한 줄에 하나, # 주석):
- songs/{region}        — 지역 인기곡 Top 50 (트랙이 RSS에 직접)
- albums/{region}       — 지역 인기 앨범 Top 50 → 각 앨범 페이지 스크래핑
- playlists/{region}    — 지역 인기 플리 Top 50 → 각 플리 페이지 스크래핑
- album/{id}            — 단일 앨범 직접 (region은 us 기본)
- playlist/{id}         — 단일 플리 직접

기본값: ['songs/kr', 'songs/us'] (album/playlist는 요청이 많아 옵트인).
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

RSS_BASE = "https://rss.marketingtools.apple.com/api/v2"
PAGE_BASE = "https://music.apple.com"
RSS_LIMIT = 50
SOURCES_SETTING_KEY = "apple_emp_sources"
DEFAULT_REGION = "us"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
)

# 기본 소스 (Setting 비었을 때) — 한국 + 미국 인기곡 Top 50.
DEFAULT_SOURCES = ["songs/kr", "songs/us"]

# 컨테이너 트랙 추출에 쓰는 정규식 (속성 순서/따옴표 유무가 제각각이라 느슨하게).
_SERIALIZED_RE = re.compile(
    r'<script\b[^>]*id="serialized-server-data"[^>]*>(.*?)</script>',
    re.DOTALL,
)
_LDJSON_RE = re.compile(
    r'<script\b[^>]*type="application/ld\+json"[^>]*>(.*?)</script>',
    re.DOTALL,
)
_SONG_ID_RE = re.compile(r"/song/[^/]+/(\d+)")


def _upsize_artwork(url: str | None) -> str | None:
    """artworkUrl100 (100x100bb.jpg) → 600x600 으로 업사이즈. None은 그대로."""
    if not url:
        return None
    return url.replace("100x100", "600x600")


def _resolve_artwork_template(url: str | None, size: int = 600) -> str | None:
    """Apple artwork URL의 {w}x{h}bb.{f} 같은 템플릿 placeholder를 실제 값으로 채운다.

    serialized-server-data의 artwork.dictionary.url은
    '.../{w}x{h}bb.{f}' 또는 '.../{w}x{h}cc.webp' 등 템플릿. None/비템플릿은 그대로."""
    if not url:
        return None
    return (
        url.replace("{w}", str(size))
        .replace("{h}", str(size))
        .replace("{f}", "jpg")
    )


def _iso8601_to_ms(value) -> int | None:
    """ISO8601 duration ('PT5M7S', 'PT3M', 'PT45S') → ms. 파싱 불가 시 None."""
    if not isinstance(value, str):
        return None
    m = re.fullmatch(
        r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?", value.strip()
    )
    if not m or not any(m.groups()):
        return None
    hours = int(m.group(1)) if m.group(1) else 0
    minutes = int(m.group(2)) if m.group(2) else 0
    seconds = float(m.group(3)) if m.group(3) else 0.0
    total = (hours * 3600 + minutes * 60) * 1000 + int(round(seconds * 1000))
    return total or None


def parse_feed(data: dict) -> tuple[str | None, list[dict]]:
    """songs 피드 JSON → (feed_title, 트랙 dict 리스트). 순수 함수.

    각 dict: {track_id, title, artist, album, cover_url}.
    name/artistName/id 없으면 그 항목은 skip (방어적)."""
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


def parse_container_feed(data: dict) -> tuple[str | None, list[dict]]:
    """albums/playlists 피드 JSON → (feed_title, 컨테이너 dict 리스트). 순수 함수.

    각 dict: {container_id, name, artist, cover_url, url}.
    id/name 없으면 skip. url은 RSS가 주면 그대로 (없으면 None → 호출자가 조립)."""
    feed = data.get("feed") or {}
    title = feed.get("title")
    results = feed.get("results") or []

    containers: list[dict] = []
    for it in results:
        if not isinstance(it, dict):
            continue
        cid = it.get("id")
        name = it.get("name")
        if not cid or not name:
            continue
        containers.append(
            {
                "container_id": str(cid),
                "name": name,
                "artist": it.get("artistName") or None,
                "cover_url": _upsize_artwork(it.get("artworkUrl100")),
                "url": it.get("url") or None,
            }
        )
    return title, containers


def _parse_serialized_tracks(html: str) -> list[dict]:
    """serialized-server-data에서 컨테이너 트랙 추출 (artistName 포함, 1순위).

    구조 (실측): {data:[{data:{sections:[...]}}]}. sections 중 itemKind=='trackLockup'
    섹션의 items[]가 트랙. 각 item:
      title, artistName, duration(ms int),
      contentDescriptor.identifiers.storeAdamID (트랙 id),
      artwork.dictionary.url (템플릿; album 트랙은 None).

    각 dict: {track_id, title, artist, cover_url, duration_ms}.
    id/title 없으면 skip. 파싱 실패 시 빈 리스트."""
    m = _SERIALIZED_RE.search(html)
    if not m:
        return []
    try:
        payload = json.loads(m.group(1))
    except (ValueError, TypeError):
        return []

    data_list = payload.get("data") if isinstance(payload, dict) else None
    if not isinstance(data_list, list) or not data_list:
        return []
    first = data_list[0]
    inner = first.get("data") if isinstance(first, dict) else None
    sections = inner.get("sections") if isinstance(inner, dict) else None
    if not isinstance(sections, list):
        return []

    track_items: list = []
    for sec in sections:
        if isinstance(sec, dict) and sec.get("itemKind") == "trackLockup":
            items = sec.get("items")
            if isinstance(items, list):
                track_items.extend(items)

    tracks: list[dict] = []
    for it in track_items:
        if not isinstance(it, dict):
            continue
        title = it.get("title")
        if not title:
            continue
        descriptor = it.get("contentDescriptor") or {}
        identifiers = (
            descriptor.get("identifiers") if isinstance(descriptor, dict) else None
        ) or {}
        track_id = identifiers.get("storeAdamID")
        if not track_id:
            continue
        duration = it.get("duration")
        duration_ms = duration if isinstance(duration, int) else None

        cover_url = None
        artwork = it.get("artwork")
        if isinstance(artwork, dict):
            dictionary = artwork.get("dictionary")
            if isinstance(dictionary, dict):
                cover_url = _resolve_artwork_template(dictionary.get("url"))

        tracks.append(
            {
                "track_id": str(track_id),
                "title": title,
                "artist": it.get("artistName") or None,
                "cover_url": cover_url,
                "duration_ms": duration_ms,
            }
        )
    return tracks


def _parse_ldjson_tracks(html: str) -> list[dict]:
    """ld+json에서 컨테이너 트랙 추출 (보조/검증, artistName 없음).

    @type MusicAlbum은 'tracks', MusicPlaylist는 'track' 키. 각 track:
      name, duration(ISO8601), url('.../song/.../{id}'), audio.thumbnailUrl.

    각 dict: {track_id, title, artist(None), cover_url, duration_ms}.
    id 추출 불가/이름 없으면 skip. 파싱 실패 시 빈 리스트."""
    for raw in _LDJSON_RE.findall(html):
        try:
            ld = json.loads(raw)
        except (ValueError, TypeError):
            continue
        if not isinstance(ld, dict):
            continue
        if ld.get("@type") not in ("MusicAlbum", "MusicPlaylist"):
            continue
        raw_tracks = ld.get("track") or ld.get("tracks") or []
        if not isinstance(raw_tracks, list):
            continue

        tracks: list[dict] = []
        for tr in raw_tracks:
            if not isinstance(tr, dict):
                continue
            name = tr.get("name")
            url = tr.get("url") or ""
            id_match = _SONG_ID_RE.search(url) if isinstance(url, str) else None
            if not name or not id_match:
                continue
            cover_url = None
            audio = tr.get("audio")
            if isinstance(audio, dict):
                cover_url = audio.get("thumbnailUrl") or None
            tracks.append(
                {
                    "track_id": id_match.group(1),
                    "title": name,
                    "artist": None,
                    "cover_url": cover_url,
                    "duration_ms": _iso8601_to_ms(tr.get("duration")),
                }
            )
        if tracks:
            return tracks
    return []


def parse_container_page(html: str) -> list[dict]:
    """컨테이너 페이지 HTML → 트랙 dict 리스트. serialized 우선, ld+json fallback.

    각 dict: {track_id, title, artist, cover_url, duration_ms}.
    serialized가 트랙을 주면 그것 (artistName 포함), 아니면 ld+json."""
    tracks = _parse_serialized_tracks(html)
    if tracks:
        return tracks
    return _parse_ldjson_tracks(html)


class AppleEMPImporter(EMPImporter):
    """Apple Music importer — RSS 차트(songs) + 컨테이너 페이지 스크래핑(albums/playlists)."""

    platform = "apple"

    def __init__(self):
        pass

    def _load_sources(self, conn: psycopg.Connection) -> list[tuple[str, str]]:
        """[(kind, target), ...].

        kind ∈ {songs, albums, playlists} → target=region.
        kind ∈ {album, playlist} → target=container id.
        비었으면 DEFAULT_SOURCES."""
        raw = get_setting(conn, SOURCES_SETTING_KEY) or ""
        sources: list[tuple[str, str]] = []
        for line in raw.splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "/" not in line:
                continue
            kind, _, target = line.partition("/")
            kind = kind.strip().lower()
            target = target.split("#", 1)[0].strip()
            if kind in ("songs", "albums", "playlists"):
                target = target.lower()
            if kind in ("songs", "albums", "playlists", "album", "playlist") and target:
                sources.append((kind, target))
        if not sources:
            for s in DEFAULT_SOURCES:
                kind, _, target = s.partition("/")
                sources.append((kind, target))
        return sources

    # ----- HTTP helpers -----

    def _rss_headers(self) -> dict[str, str]:
        return {"User-Agent": USER_AGENT, "Accept": "application/json"}

    def _page_headers(self) -> dict[str, str]:
        return {"User-Agent": USER_AGENT, "Accept": "text/html"}

    async def _fetch_feed(
        self, http: httpx.AsyncClient, kind: str, region: str
    ) -> dict | None:
        """region의 {kind} 피드 JSON (kind ∈ songs/albums/playlists). 실패 시 None."""
        url = f"{RSS_BASE}/{region}/music/most-played/{RSS_LIMIT}/{kind}.json"
        try:
            r = await http.get(
                url, headers=self._rss_headers(), follow_redirects=True
            )
            if r.status_code != 200:
                return None
            return r.json()
        except Exception:
            return None

    async def _fetch_container_tracks(
        self, http: httpx.AsyncClient, container_kind: str, region: str,
        container_id: str, url: str | None = None,
    ) -> list[dict]:
        """앨범/플리 페이지 스크래핑 → 트랙 dict 리스트. url 주어지면 그대로 사용."""
        page_url = url or f"{PAGE_BASE}/{region}/{container_kind}/x/{container_id}"
        r = await http.get(
            page_url, headers=self._page_headers(), follow_redirects=True
        )
        if r.status_code != 200:
            raise RuntimeError(f"page HTTP {r.status_code}")
        return parse_container_page(r.text)

    # ----- per-source handlers -----

    def _import_tracks(
        self,
        conn: psycopg.Connection,
        tracks: list[dict],
        source_type: str,
        source_id: str,
        source_name: str | None,
        container_cover: str | None,
        errors: list[str],
    ) -> tuple[int, int]:
        """트랙 리스트 upsert. (new, existing) 반환. 개별 실패는 errors에 기록."""
        new = existing = 0
        for t in tracks:
            try:
                r = upsert_track_and_emp_source(
                    conn,
                    isrc=None,
                    title=t["title"],
                    artist=t.get("artist") or "Unknown",
                    album_title=t.get("album"),
                    duration_ms=t.get("duration_ms"),
                    platform=self.platform,
                    platform_track_id=t["track_id"],
                    source_type=source_type,
                    source_id=source_id,
                    source_name=source_name,
                    cover_url=t.get("cover_url") or container_cover,
                )
                if r["new"]:
                    new += 1
                else:
                    existing += 1
            except Exception as e:
                safe_rollback(conn)
                errors.append(
                    f"upsert {source_id}/{t.get('track_id')}: {fmt_exc(e, 120)}"
                )
        return new, existing

    async def _import_songs(
        self, conn: psycopg.Connection, http: httpx.AsyncClient,
        region: str, section_idx: int, errors: list[str],
    ) -> tuple[int, int, bool]:
        """songs/{region}: RSS 트랙을 직접 적재. (new, existing, section_done)."""
        data = await self._fetch_feed(http, "songs", region)
        if data is None:
            errors.append(f"songs/{region}: fetch failed")
            return 0, 0, False

        feed_title, tracks = parse_feed(data)
        if not tracks:
            errors.append(f"songs/{region}: 0 tracks (RSS shape changed?)")
            return 0, 0, False

        section_key = f"songs:{region}"
        source_id = f"chart:{region}-songs"
        display = feed_title or f"{region.upper()} Top Songs"

        try:
            section_id = upsert_section(
                conn=conn, platform=self.platform, section_key=section_key,
                display_title=display, display_order=section_idx,
            )
            upsert_section_item(
                conn=conn, section_id=section_id, item_type="chart",
                item_id=f"{region}-songs", title=display,
                cover_url=tracks[0].get("cover_url"), display_order=0,
            )
            prune_stale_items(conn, section_id, {("chart", f"{region}-songs")})
        except Exception as e:
            safe_rollback(conn)
            errors.append(f"section save songs/{region}: {fmt_exc(e, 120)}")

        new, existing = self._import_tracks(
            conn, tracks, "chart", source_id, display, None, errors
        )
        return new, existing, True

    async def _import_container_feed(
        self, conn: psycopg.Connection, http: httpx.AsyncClient,
        container_kind: str, region: str, section_idx: int, errors: list[str],
    ) -> tuple[int, int, bool]:
        """albums|playlists / {region}: RSS 컨테이너 목록 → 섹션 1개 + 각 페이지 스크래핑.

        container_kind ∈ {album, playlist} (단수). (new, existing, section_done)."""
        plural = container_kind + "s"
        data = await self._fetch_feed(http, plural, region)
        if data is None:
            errors.append(f"{plural}/{region}: fetch failed")
            return 0, 0, False

        feed_title, containers = parse_container_feed(data)
        if not containers:
            errors.append(f"{plural}/{region}: 0 containers (RSS shape changed?)")
            return 0, 0, False

        section_key = f"{plural}:{region}"
        label = "Albums" if container_kind == "album" else "Playlists"
        display = feed_title or f"{region.upper()} Top {label}"

        # 섹션 + 컨테이너 아이템 (album/playlist 타입).
        try:
            section_id = upsert_section(
                conn=conn, platform=self.platform, section_key=section_key,
                display_title=display, display_order=section_idx,
            )
            seen: set[tuple[str, str]] = set()
            for idx, c in enumerate(containers):
                upsert_section_item(
                    conn=conn, section_id=section_id, item_type=container_kind,
                    item_id=c["container_id"], title=c["name"],
                    cover_url=c.get("cover_url"), display_order=idx,
                )
                seen.add((container_kind, c["container_id"]))
            prune_stale_items(conn, section_id, seen)
        except Exception as e:
            safe_rollback(conn)
            errors.append(f"section save {section_key}: {fmt_exc(e, 120)}")

        # 각 컨테이너 페이지 스크래핑 → 트랙 적재 (개별 실패 graceful).
        total_new = total_existing = 0
        for c in containers:
            cid = c["container_id"]
            try:
                tracks = await self._fetch_container_tracks(
                    http, container_kind, region, cid, c.get("url")
                )
            except Exception as e:
                safe_rollback(conn)
                errors.append(f"{container_kind}/{cid}: {fmt_exc(e, 120)}")
                continue
            if not tracks:
                errors.append(f"{container_kind}/{cid}: 0 tracks (page shape changed?)")
                continue
            n, e_ = self._import_tracks(
                conn, tracks, container_kind, f"{container_kind}:{cid}",
                c["name"], c.get("cover_url"), errors,
            )
            total_new += n
            total_existing += e_
        return total_new, total_existing, True

    async def _import_single_container(
        self, conn: psycopg.Connection, http: httpx.AsyncClient,
        container_kind: str, container_id: str, section_idx: int,
        errors: list[str],
    ) -> tuple[int, int, bool]:
        """album/{id} 또는 playlist/{id}: 단일 컨테이너 섹션. (new, existing, done)."""
        section_key = f"{container_kind}:{container_id}"
        try:
            tracks = await self._fetch_container_tracks(
                http, container_kind, DEFAULT_REGION, container_id
            )
        except Exception as e:
            safe_rollback(conn)
            errors.append(f"{container_kind}/{container_id}: {fmt_exc(e, 120)}")
            return 0, 0, False
        if not tracks:
            errors.append(
                f"{container_kind}/{container_id}: 0 tracks (page shape changed?)"
            )
            return 0, 0, False

        container_cover = tracks[0].get("cover_url")
        try:
            section_id = upsert_section(
                conn=conn, platform=self.platform, section_key=section_key,
                display_title=None, display_order=section_idx,
            )
            upsert_section_item(
                conn=conn, section_id=section_id, item_type=container_kind,
                item_id=container_id, title=container_id,
                cover_url=container_cover, display_order=0,
            )
            prune_stale_items(conn, section_id, {(container_kind, container_id)})
        except Exception as e:
            safe_rollback(conn)
            errors.append(f"section save {section_key}: {fmt_exc(e, 120)}")

        new, existing = self._import_tracks(
            conn, tracks, container_kind, section_key, None,
            container_cover, errors,
        )
        return new, existing, True

    async def import_all(self, conn: psycopg.Connection) -> dict:
        """각 소스를 처리. 반환 {tracks_new, tracks_existing, playlists_processed, errors}.

        'playlists_processed'는 처리한 섹션 수 (base 인터페이스 호환)."""
        sources = self._load_sources(conn)
        tracks_new = 0
        tracks_existing = 0
        sections_done = 0
        errors: list[str] = []

        async with httpx.AsyncClient(timeout=30.0) as http:
            for src_idx, (kind, target) in enumerate(sources):
                try:
                    if kind == "songs":
                        n, e_, done = await self._import_songs(
                            conn, http, target, src_idx, errors
                        )
                    elif kind in ("albums", "playlists"):
                        n, e_, done = await self._import_container_feed(
                            conn, http, kind[:-1], target, src_idx, errors
                        )
                    elif kind in ("album", "playlist"):
                        n, e_, done = await self._import_single_container(
                            conn, http, kind, target, src_idx, errors
                        )
                    else:
                        continue
                except Exception as e:
                    safe_rollback(conn)
                    errors.append(f"{kind}/{target}: {fmt_exc(e, 120)}")
                    continue

                tracks_new += n
                tracks_existing += e_
                if done:
                    sections_done += 1

        return {
            "tracks_new": tracks_new,
            "tracks_existing": tracks_existing,
            "playlists_processed": sections_done,
            "errors": errors,
        }
