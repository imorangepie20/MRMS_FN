"""FLO editorial 트랙 임포터 — music-flo.com 공개 JSON (토큰 0).

`x-gm-access-token` 빈 값으로 동작하는 공개 API (2026-06 실측). 성공 응답은
JSON의 `code == "2000000"`.

엔드포인트:
- 큐레이션 섹션: GET /api/personal/v1/curations/contents → data.list[]
- 홈 패널:     GET /api/personal/v2/recommends/home/panels → data.list[]
- playlist 트랙:  GET /api/personal/v1/playlist/{numId}     → data.track.list[]
- channel 트랙:   GET /api/meta/v1/channel/{numId}          → data.trackList[]   (CHNL 타입)

소스 형식 (Setting 'flo_emp_sources', 한 줄에 하나, # 주석):
- special           — /curations/contents 전체 자동 발견 (섹션 + playlist/channel)
- panels            — /recommends/home/panels 홈 추천 패널 (POPULAR_CHANNEL, 트랙 인라인)
- playlist/{numId}  — 직접 playlist
- channel/{numId}   — 직접 channel

비었을 때 기본값: ["special", "panels"].
"""
from __future__ import annotations

import httpx
import psycopg

from mrms.db.emp_section import (
    prune_stale_items,
    update_item_cover,
    upsert_section,
    upsert_section_item,
)
from mrms.db.settings import get_setting
from mrms.emp.base import (
    EMPImporter,
    fmt_exc,
    safe_rollback,
    upsert_track_and_emp_source,
)


FLO_BASE = "https://www.music-flo.com"
SOURCES_SETTING_KEY = "flo_emp_sources"
SUCCESS_CODE = "2000000"
COVER_SIZE = "500"

DEFAULT_SOURCES = ["special", "panels"]


def _format_cover(node: dict | None) -> str | None:
    """gridImg/img/album.img 등 dict에서 urlFormat을 꺼내 '{size}'→500 치환.

    FLO 커버 dict 모양: {urlFormat: 'https://.../{size}.jpg', ...}."""
    if not isinstance(node, dict):
        return None
    fmt = node.get("urlFormat")
    if isinstance(fmt, str) and fmt:
        return fmt.replace("{size}", COVER_SIZE)
    return None


def _item_cover(item: dict) -> str | None:
    """큐레이션 아이템 커버 — gridImg 우선, 없으면 img."""
    return _format_cover(item.get("gridImg")) or _format_cover(item.get("img"))


def _classify_item(item: dict) -> tuple[str, str, str, str | None] | None:
    """큐레이션 list 아이템 → (item_type, item_id, name, cover_url) 또는 None.

    item_type ∈ {'playlist', 'channel'}. FLO type: 'PLAYLIST' | 'CHNL'."""
    if not isinstance(item, dict):
        return None
    raw_type = (item.get("type") or "").upper()
    if raw_type == "PLAYLIST":
        item_type = "playlist"
    elif raw_type == "CHNL":
        item_type = "channel"
    else:
        return None
    ident = item.get("id")
    if ident is None:
        return None
    name = item.get("name") or str(ident)
    return (item_type, str(ident), name, _item_cover(item))


def _parse_play_time(play_time) -> int | None:
    """'mm:ss' → ms. 분:초 파싱 × 1000. 파싱 불가 시 None."""
    if not isinstance(play_time, str):
        return None
    parts = play_time.split(":")
    try:
        nums = [int(p) for p in parts]
    except ValueError:
        return None
    if len(nums) == 2:
        minutes, seconds = nums
    elif len(nums) == 3:
        hours, minutes, seconds = nums
        minutes += hours * 60
    else:
        return None
    return (minutes * 60 + seconds) * 1000


def _section_key(display_title: str | None, sec_id) -> str:
    """섹션 → EMPSection.sectionKey.

    title을 정규화(공백 축약)해 그대로 key로 쓴다 — FLO가 같은 큐레이션을
    여러 content.id로 중복 반환해도 같은 title이면 같은 sectionKey로 upsert돼
    자연히 dedup된다. title이 없을 때만 sec_id fallback.
    """
    if display_title and display_title.strip():
        normalized = " ".join(display_title.split())
        return f"special:{normalized}"
    return f"special:id-{sec_id}"


def _detail_cover(grid_img: dict | None) -> str | None:
    """playlist/channel 상세 API의 gridImg → cover URL.

    상세 응답은 gridImg.urlFormatList(완전 URL 리스트, '{size}' 치환 불필요)를
    준다. availableSizeList와 길이가 맞으면 COVER_SIZE(500)에 가장 가까운 것,
    아니면 가장 큰 것(마지막)을 선택. (크게 받아서 CSS 축소 — 작게 받아 확대보다 깨끗.)
    """
    if not isinstance(grid_img, dict):
        return None
    urls = grid_img.get("urlFormatList") or []
    if not urls:
        return None
    sizes = grid_img.get("availableSizeList") or []
    if sizes and len(sizes) == len(urls):
        best = min(range(len(sizes)), key=lambda i: abs(sizes[i] - int(COVER_SIZE)))
        return urls[best]
    return urls[-1]


def _pick_img_url(img_list: list | None, target: int) -> str | None:
    """imgList[{size, url}]에서 target에 가장 가까운 size의 URL 선택."""
    if not isinstance(img_list, list) or not img_list:
        return None
    best = None
    best_diff = None
    for entry in img_list:
        if not isinstance(entry, dict):
            continue
        url = entry.get("url")
        if not isinstance(url, str) or not url:
            continue
        size = entry.get("size")
        if isinstance(size, (int, float)):
            diff = abs(int(size) - target)
            if best_diff is None or diff < best_diff:
                best, best_diff = url, diff
        elif best is None:
            best = url  # size 없으면 첫 URL fallback
    return best


def _album_cover(album: dict | None) -> str | None:
    """앨범 객체 → 커버 URL. v1(img.urlFormat) + v2(imgUrlFormat, imgList) 대응.

    v1 curations: album.img = {urlFormat: '.../{size}.jpg'}
    v2 panels:    album.imgUrlFormat = '.../{size}/quality/90'
                  album.imgList = [{size, url}, ...]
    """
    if not isinstance(album, dict):
        return None
    # v2: album.imgUrlFormat (inline, '{size}' 치환)
    fmt = album.get("imgUrlFormat")
    if isinstance(fmt, str) and fmt:
        return fmt.replace("{size}", COVER_SIZE)
    # v2: album.imgList[{size, url}]
    url = _pick_img_url(album.get("imgList"), int(COVER_SIZE))
    if url:
        return url
    # v1: album.img.urlFormat
    return _format_cover(album.get("img"))


def _normalize_track(tr) -> dict | None:
    """FLO track object → 공통 dict. id+name 없으면 None."""
    if not isinstance(tr, dict):
        return None
    tid = tr.get("id")
    title = tr.get("name")
    if tid is None or not title:
        return None

    artist_list = tr.get("artistList") or []
    names = [
        a.get("name")
        for a in artist_list
        if isinstance(a, dict) and a.get("name")
    ]
    if names:
        artist = ", ".join(names)
    else:
        rep = tr.get("representationArtist") or {}
        artist = (rep.get("name") if isinstance(rep, dict) else None) or "Unknown"

    album = tr.get("album") or {}
    if isinstance(album, dict):
        album_title = album.get("title")
        cover_url = _album_cover(album)
    else:
        album_title = None
        cover_url = None

    return {
        "platform_track_id": str(tid),
        "title": title,
        "isrc": None,
        "artist": artist,
        "album_title": album_title,
        "cover_url": cover_url,
        "duration_ms": _parse_play_time(tr.get("playTime")),
    }


class FloEMPImporter(EMPImporter):
    """FLO 공개 API importer. 토큰 불필요 (x-gm-access-token 빈 값)."""

    platform = "flo"

    def __init__(self) -> None:
        # FLO는 토큰이 없어 conn 없이 생성 가능 (소스는 import_all(conn)에서 로딩).
        pass

    def _headers(self) -> dict[str, str]:
        return {
            "Accept": "application/json, text/plain, */*",
            "Referer": "https://www.music-flo.com/",
            "User-Agent": "MRMS-EMP/1.0",
            "x-gm-access-token": "",
            "x-gm-app-name": "FLO_WEB",
            "x-gm-app-version": "8.1.0",
            "x-gm-device-id": "MRMS-EMS-FLO",
            "x-gm-device-model": "MRMS",
            "x-gm-os-type": "WEB",
            "x-gm-os-version": "1.0",
        }

    def _load_sources(self, conn: psycopg.Connection) -> list[tuple[str, str]]:
        """[(kind, identifier), ...]. kind ∈ {special, panels, playlist, channel}.

        'special'/'panels'은 identifier 없음 → (kind, ''). 비었으면 DEFAULT_SOURCES."""
        raw = get_setting(conn, SOURCES_SETTING_KEY) or ""
        sources: list[tuple[str, str]] = []
        for line in raw.splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            lower = line.lower()
            if lower in ("special", "panels"):
                sources.append((lower, ""))
                continue
            if "/" not in line:
                continue
            kind, _, ident = line.partition("/")
            kind = kind.strip().lower()
            ident = ident.strip()
            if kind in ("playlist", "channel") and ident:
                sources.append((kind, ident))
        if not sources:
            for s in DEFAULT_SOURCES:
                if s in ("special", "panels"):
                    sources.append((s, ""))
                else:
                    kind, _, ident = s.partition("/")
                    sources.append((kind, ident))
        return sources

    # ----- HTTP helpers -----

    @staticmethod
    def _check_code(data) -> bool:
        return isinstance(data, dict) and data.get("code") == SUCCESS_CODE

    async def _fetch_curation_sections(
        self, http: httpx.AsyncClient
    ) -> tuple[list[dict], str | None]:
        """/curations/contents → (sections, error).

        sections = data.list[] (각 섹션 dict). error는 실패 사유 문자열 또는 None."""
        r = await http.get(
            f"{FLO_BASE}/api/personal/v1/curations/contents",
            headers=self._headers(),
        )
        if r.status_code != 200:
            return [], f"curations HTTP {r.status_code}"
        data = r.json()
        if not self._check_code(data):
            code = data.get("code") if isinstance(data, dict) else None
            return [], f"curations code {code}"
        sections = (data.get("data") or {}).get("list") or []
        return sections, None

    async def _fetch_home_panels(
        self, http: httpx.AsyncClient
    ) -> tuple[list[dict], str | None]:
        """/recommends/home/panels → (panels, error).

        POPULAR_CHANNEL 타입 패널만 반환 (content.type == CHNL + trackList 인라인).
        PLAY_NOW 등 다른 타입은 건너뛴다. 각 panel dict = {title, content: {id,
        type, trackList, ...}}."""
        r = await http.get(
            f"{FLO_BASE}/api/personal/v2/recommends/home/panels",
            headers=self._headers(),
        )
        if r.status_code != 200:
            return [], f"panels HTTP {r.status_code}"
        data = r.json()
        if not self._check_code(data):
            code = data.get("code") if isinstance(data, dict) else None
            return [], f"panels code {code}"
        raw_panels = (data.get("data") or {}).get("list") or []
        panels = [
            p for p in raw_panels
            if isinstance(p, dict)
            and p.get("type") == "POPULAR_CHANNEL"
            and isinstance(p.get("content"), dict)
            and p["content"].get("type", "").upper() == "CHNL"
        ]
        return panels, None

    async def _fetch_playlist_tracks(
        self, http: httpx.AsyncClient, num_id: str
    ) -> tuple[list[dict], str | None]:
        """/playlist/{numId} → (tracks, cover_url).

        상세 응답의 gridImg.urlFormatList에서 cover도 같이 뽑는다 — 큐레이션 목록의
        PLAYLIST 아이템은 커버가 빠져 있어 Phase 2에서 역채우기(backfill)한다."""
        r = await http.get(
            f"{FLO_BASE}/api/personal/v1/playlist/{num_id}",
            headers=self._headers(),
        )
        if r.status_code != 200:
            raise RuntimeError(f"playlist HTTP {r.status_code}")
        data = r.json()
        if not self._check_code(data):
            code = data.get("code") if isinstance(data, dict) else None
            raise RuntimeError(f"playlist code {code}")
        payload = data.get("data") or {}
        raw_list = (payload.get("track") or {}).get("list") or []
        tracks = [t for t in (_normalize_track(x) for x in raw_list) if t]
        cover = _detail_cover(payload.get("gridImg"))
        return tracks, cover

    async def _fetch_channel_tracks(
        self, http: httpx.AsyncClient, num_id: str
    ) -> list[dict]:
        """/channel/{numId} → data.trackList[]. channel은 큐레이션 목록에 커버 이미 있음."""
        r = await http.get(
            f"{FLO_BASE}/api/meta/v1/channel/{num_id}",
            headers=self._headers(),
        )
        if r.status_code != 200:
            raise RuntimeError(f"channel HTTP {r.status_code}")
        data = r.json()
        if not self._check_code(data):
            code = data.get("code") if isinstance(data, dict) else None
            raise RuntimeError(f"channel code {code}")
        raw_list = (data.get("data") or {}).get("trackList") or []
        return [t for t in (_normalize_track(x) for x in raw_list) if t]

    async def _fetch_item_tracks(
        self, http: httpx.AsyncClient, item_type: str, item_id: str
    ) -> tuple[list[dict], str | None]:
        """(tracks, cover_url). cover는 playlist 상세에서만 추출, channel은 None."""
        if item_type == "playlist":
            return await self._fetch_playlist_tracks(http, item_id)
        if item_type == "channel":
            return await self._fetch_channel_tracks(http, item_id), None
        return [], None

    # ----- entrypoint -----

    async def import_all(self, conn: psycopg.Connection) -> dict:
        """모든 source 적재. 반환 {tracks_new, tracks_existing, playlists_processed, errors}.

        'playlists_processed'는 playlist+channel 합산 아이템 수 (base 인터페이스 호환).
        v2 panels 소스는 트랙이 인라인이라 Phase 2 fetch 없이 Phase 1에서 직접 upsert."""
        sources = self._load_sources(conn)

        errors: list[str] = []
        # (item_type, item_id) → (name, cover, inline_tracks)
        # inline_tracks: None = Phase 2 fetch 필요, list = 이미 보유(panels)
        items: dict[tuple[str, str], tuple[str, str | None, list[dict] | None]] = {}
        order: list[tuple[str, str]] = []

        def _add_item(
            item_type: str, item_id: str, name: str, cover: str | None,
            inline_tracks: list[dict] | None = None,
        ) -> None:
            key = (item_type, item_id)
            if key not in items:
                items[key] = (name, cover, inline_tracks)
                order.append(key)

        async with httpx.AsyncClient(timeout=20.0) as http:
            # Phase 1: resolve sources → 섹션/아이템 저장 + 적재 대상 수집
            section_idx = 0
            for kind, ident in sources:
                if kind == "special":
                    try:
                        sections, err = await self._fetch_curation_sections(http)
                    except Exception as e:
                        safe_rollback(conn)
                        errors.append(f"special: {fmt_exc(e, 120)}")
                        continue
                    if err:
                        errors.append(f"special: {err}")
                        continue

                    for sec in sections:
                        content = sec.get("content") if isinstance(sec, dict) else None
                        if not isinstance(content, dict):
                            continue
                        sec_id = content.get("id")
                        if sec_id is None:
                            continue
                        display_title = content.get("title")
                        section_key = _section_key(display_title, sec_id)
                        raw_items = content.get("list") or []
                        classified = [
                            c for c in (_classify_item(i) for i in raw_items) if c
                        ]
                        try:
                            db_section_id = upsert_section(
                                conn=conn,
                                platform=self.platform,
                                section_key=section_key,
                                display_title=display_title,
                                display_order=section_idx,
                            )
                            seen: set[tuple[str, str]] = set()
                            for item_idx, (it, ii, nn, cv) in enumerate(classified):
                                upsert_section_item(
                                    conn=conn,
                                    section_id=db_section_id,
                                    item_type=it,
                                    item_id=ii,
                                    title=nn,
                                    cover_url=cv,
                                    display_order=item_idx,
                                )
                                seen.add((it, ii))
                            prune_stale_items(conn, db_section_id, seen)
                        except Exception as e:
                            safe_rollback(conn)
                            errors.append(
                                f"section save {section_key}: {fmt_exc(e, 120)}"
                            )
                        section_idx += 1

                        for it, ii, nn, cv in classified:
                            _add_item(it, ii, nn, cv)

                elif kind == "panels":
                    # v2 홈 패널 — POPULAR_CHANNEL (트랙 인라인)
                    try:
                        panels, err = await self._fetch_home_panels(http)
                    except Exception as e:
                        safe_rollback(conn)
                        errors.append(f"panels: {fmt_exc(e, 120)}")
                        continue
                    if err:
                        errors.append(f"panels: {err}")
                        continue

                    for panel in panels:
                        content = panel.get("content") or {}
                        channel_id = str(content.get("id") or "")
                        if not channel_id:
                            continue
                        display_title = panel.get("title") or channel_id
                        section_key = f"panel:{' '.join(display_title.split())}"
                        raw_tracks = content.get("trackList") or []
                        inline = [
                            t for t in (_normalize_track(x) for x in raw_tracks) if t
                        ]
                        # 패널 커버 = 첫 트랙 앨범 커버 (패널 imgList는 제네릭 장르 이미지)
                        panel_cover = None
                        if inline:
                            first_album = (
                                raw_tracks[0].get("album")
                                if isinstance(raw_tracks[0], dict) else None
                            )
                            panel_cover = _album_cover(first_album)

                        try:
                            db_section_id = upsert_section(
                                conn=conn,
                                platform=self.platform,
                                section_key=section_key,
                                display_title=display_title,
                                display_order=section_idx,
                            )
                            upsert_section_item(
                                conn=conn,
                                section_id=db_section_id,
                                item_type="channel",
                                item_id=channel_id,
                                title=display_title,
                                cover_url=panel_cover,
                                display_order=0,
                            )
                            prune_stale_items(
                                conn, db_section_id, {("channel", channel_id)}
                            )
                        except Exception as e:
                            safe_rollback(conn)
                            errors.append(
                                f"section save {section_key}: {fmt_exc(e, 120)}"
                            )
                        section_idx += 1
                        # inline tracks → Phase 2 skip
                        _add_item(
                            "channel", channel_id, display_title, panel_cover, inline
                        )

                else:
                    # 직접 playlist/channel 소스 → 일관성 위해 섹션 1개로 묶음
                    section_key = f"{kind}:{ident}"
                    try:
                        db_section_id = upsert_section(
                            conn=conn,
                            platform=self.platform,
                            section_key=section_key,
                            display_title=None,
                            display_order=section_idx,
                        )
                        upsert_section_item(
                            conn=conn,
                            section_id=db_section_id,
                            item_type=kind,
                            item_id=ident,
                            title=ident,
                            cover_url=None,
                            display_order=0,
                        )
                        prune_stale_items(conn, db_section_id, {(kind, ident)})
                    except Exception as e:
                        safe_rollback(conn)
                        errors.append(f"section save {section_key}: {fmt_exc(e, 120)}")
                    section_idx += 1
                    _add_item(kind, ident, ident, None)

            # Phase 2: fetch tracks per item, upsert (inline 보유 시 skip)
            tracks_new = 0
            tracks_existing = 0
            for item_type, item_id in order:
                name, _cover, inline_tracks = items[(item_type, item_id)]
                if inline_tracks is not None:
                    tracks = inline_tracks
                    detail_cover = None
                else:
                    try:
                        tracks, detail_cover = await self._fetch_item_tracks(
                            http, item_type, item_id
                        )
                    except Exception as e:
                        safe_rollback(conn)
                        errors.append(f"{item_type}/{item_id}: {fmt_exc(e, 120)}")
                        continue

                    # playlist 상세에서 뽑은 커버 역채우기 — 큐레이션 목록엔 빠져있음.
                    if detail_cover:
                        try:
                            update_item_cover(
                                conn, self.platform, item_type, item_id, detail_cover
                            )
                        except Exception as e:
                            safe_rollback(conn)
                            errors.append(
                                f"cover update {item_type}/{item_id}: {fmt_exc(e, 120)}"
                            )

                for t in tracks:
                    try:
                        r = upsert_track_and_emp_source(
                            conn,
                            isrc=None,
                            title=t["title"],
                            artist=t["artist"],
                            album_title=t.get("album_title"),
                            duration_ms=t.get("duration_ms"),
                            platform=self.platform,
                            platform_track_id=t["platform_track_id"],
                            source_type="flo_curation",
                            source_id=f"{item_type}:{item_id}",
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
                            f"upsert {item_type}/{item_id}/"
                            f"{t.get('platform_track_id')}: {fmt_exc(e, 120)}"
                        )

        return {
            "tracks_new": tracks_new,
            "tracks_existing": tracks_existing,
            "playlists_processed": len(order),
            "errors": errors,
        }
