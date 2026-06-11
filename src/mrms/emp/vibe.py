"""Naver VIBE editorial 임포터 — apis.naver.com/vibeWeb/musicapiweb 공개 JSON (토큰 0).

인증 없이 전 경로 동작 (2026-06 실측). 성공 응답은 `response.result.*`.

엔드포인트:
- DJ 스테이션 목록:  GET /vibe/v1/dj/station
    → response.result.stationContentList[] : {contentType('MOOD'|'GENRE'), djStationList[]}
       station: {stationNo, stationName, imageUrl}
- 스테이션 트랙:     GET /v1/station/{stationNo}/tracks?limit=50
    → response.result.stationList[0].tracks[]
- 테마 플리 모음:    GET /vibe/v1/today/timethemepl
    → response.result.playlists[] : {plId, title, image.imageUrl}
- 플리 트랙:         GET /vibe/v3/playlist/{plId}?includeOthersMix=false
    → response.result.playlist.tracks[]

소스 형식 (Setting 'vibe_emp_sources', 한 줄에 하나, # 주석):
- stations          — /dj/station 전체 자동 (MOOD/GENRE 그룹 + 각 station 트랙)
- theme             — /today/timethemepl 전체 자동 (테마 플리 + 트랙)
- station/{no}      — 직접 스테이션
- playlist/{plId}   — 직접 플리

비었을 때 기본값: ["stations", "theme"].

주의: 스테이션 42개 × 트랙 fetch = 요청 많음. timeout 넉넉히(20s), 개별 실패 graceful.
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


VIBE_BASE = "https://apis.naver.com/vibeWeb/musicapiweb"
SOURCES_SETTING_KEY = "vibe_emp_sources"
STATION_TRACK_LIMIT = 50

DEFAULT_SOURCES = ["stations", "theme"]

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
)


def _parse_play_time(play_time) -> int | None:
    """'mm:ss' (또는 'hh:mm:ss') → ms. 분:초 ×1000. 파싱 불가 시 None."""
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


def _normalize_track(tr) -> dict | None:
    """VIBE track object → 공통 dict. trackId+trackTitle 없으면 None.

    스테이션/플리 응답 공통 형태:
      {trackId, trackTitle, artists[].artistName, album.albumTitle,
       album.imageUrl, playTime 'mm:ss'}.
    artists는 ', ' join (첫번째가 대표)."""
    if not isinstance(tr, dict):
        return None
    tid = tr.get("trackId")
    title = tr.get("trackTitle")
    if tid is None or not title:
        return None

    artist_list = tr.get("artists") or []
    names = [
        a.get("artistName")
        for a in artist_list
        if isinstance(a, dict) and a.get("artistName")
    ]
    artist = ", ".join(names) if names else "Unknown"

    album = tr.get("album") or {}
    if isinstance(album, dict):
        album_title = album.get("albumTitle")
        cover_url = album.get("imageUrl")
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


def _parse_tracks(raw_list) -> list[dict]:
    """VIBE track dict 리스트 → 정규화 dict 리스트 (None drop)."""
    if not isinstance(raw_list, list):
        return []
    return [t for t in (_normalize_track(x) for x in raw_list) if t]


class VibeEMPImporter(EMPImporter):
    """Naver VIBE 공개 API importer. 인증 불필요."""

    platform = "vibe"

    def __init__(self) -> None:
        # VIBE는 토큰이 없어 conn 없이 생성 가능 (소스는 import_all(conn)에서 로딩).
        pass

    def _headers(self) -> dict[str, str]:
        return {
            "Accept": "application/json",
            "Referer": "https://vibe.naver.com/",
            "User-Agent": USER_AGENT,
        }

    def _load_sources(self, conn: psycopg.Connection) -> list[tuple[str, str]]:
        """[(kind, identifier), ...]. kind ∈ {stations, theme, station, playlist}.

        'stations'/'theme'는 identifier 없음 → (kind, ''). 비었으면 DEFAULT_SOURCES."""
        raw = get_setting(conn, SOURCES_SETTING_KEY) or ""
        sources: list[tuple[str, str]] = []
        for line in raw.splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            low = line.lower()
            if low in ("stations", "theme"):
                sources.append((low, ""))
                continue
            if "/" not in line:
                continue
            kind, _, ident = line.partition("/")
            kind = kind.strip().lower()
            ident = ident.strip()
            if kind in ("station", "playlist") and ident:
                sources.append((kind, ident))
        if not sources:
            for s in DEFAULT_SOURCES:
                if "/" in s:
                    kind, _, ident = s.partition("/")
                    sources.append((kind.lower(), ident))
                else:
                    sources.append((s.lower(), ""))
        return sources

    # ----- HTTP helpers -----

    @staticmethod
    def _result(data) -> dict | None:
        """response.result 추출. 모양 안 맞으면 None."""
        if not isinstance(data, dict):
            return None
        resp = data.get("response")
        if not isinstance(resp, dict):
            return None
        result = resp.get("result")
        return result if isinstance(result, dict) else None

    async def _fetch_station_list(
        self, http: httpx.AsyncClient
    ) -> tuple[list[dict], str | None]:
        """/dj/station → (stationContentList, error)."""
        r = await http.get(
            f"{VIBE_BASE}/vibe/v1/dj/station", headers=self._headers()
        )
        if r.status_code != 200:
            return [], f"dj/station HTTP {r.status_code}"
        result = self._result(r.json())
        if result is None:
            return [], "dj/station bad shape"
        content_list = result.get("stationContentList") or []
        return content_list if isinstance(content_list, list) else [], None

    async def _fetch_theme_playlists(
        self, http: httpx.AsyncClient
    ) -> tuple[list[dict], str | None]:
        """/today/timethemepl → (playlists, error)."""
        r = await http.get(
            f"{VIBE_BASE}/vibe/v1/today/timethemepl", headers=self._headers()
        )
        if r.status_code != 200:
            return [], f"timethemepl HTTP {r.status_code}"
        result = self._result(r.json())
        if result is None:
            return [], "timethemepl bad shape"
        playlists = result.get("playlists") or []
        return playlists if isinstance(playlists, list) else [], None

    async def _fetch_station_tracks(
        self, http: httpx.AsyncClient, station_no: str
    ) -> list[dict]:
        """/station/{stationNo}/tracks → result.stationList[0].tracks[]."""
        r = await http.get(
            f"{VIBE_BASE}/v1/station/{station_no}/tracks",
            params={"limit": STATION_TRACK_LIMIT},
            headers=self._headers(),
        )
        if r.status_code != 200:
            raise RuntimeError(f"station tracks HTTP {r.status_code}")
        result = self._result(r.json())
        if result is None:
            raise RuntimeError("station tracks bad shape")
        station_list = result.get("stationList") or []
        if not station_list:
            return []
        first = station_list[0]
        raw = first.get("tracks") if isinstance(first, dict) else None
        return _parse_tracks(raw)

    async def _fetch_playlist_tracks(
        self, http: httpx.AsyncClient, pl_id: str
    ) -> list[dict]:
        """/playlist/{plId} → result.playlist.tracks[]."""
        r = await http.get(
            f"{VIBE_BASE}/vibe/v3/playlist/{pl_id}",
            params={"includeOthersMix": "false"},
            headers=self._headers(),
        )
        if r.status_code != 200:
            raise RuntimeError(f"playlist HTTP {r.status_code}")
        result = self._result(r.json())
        if result is None:
            raise RuntimeError("playlist bad shape")
        playlist = result.get("playlist")
        raw = playlist.get("tracks") if isinstance(playlist, dict) else None
        return _parse_tracks(raw)

    async def _fetch_item_tracks(
        self, http: httpx.AsyncClient, item_type: str, item_id: str
    ) -> list[dict]:
        if item_type == "station":
            return await self._fetch_station_tracks(http, item_id)
        if item_type == "playlist":
            return await self._fetch_playlist_tracks(http, item_id)
        return []

    # ----- entrypoint -----

    async def import_all(self, conn: psycopg.Connection) -> dict:
        """모든 source 적재. 반환 {tracks_new, tracks_existing, playlists_processed, errors}.

        'playlists_processed'는 station+playlist 합산 아이템 수 (base 인터페이스 호환)."""
        sources = self._load_sources(conn)

        errors: list[str] = []
        # (item_type, item_id) → (name) — 중복 fetch 방지
        items: dict[tuple[str, str], str] = {}
        order: list[tuple[str, str]] = []

        def _add_item(item_type: str, item_id: str, name: str) -> None:
            key = (item_type, item_id)
            if key not in items:
                items[key] = name
                order.append(key)

        async with httpx.AsyncClient(timeout=20.0) as http:
            section_idx = 0

            # Phase 1: resolve sources → 섹션/아이템 저장 + 적재 대상 수집
            for kind, ident in sources:
                if kind == "stations":
                    try:
                        content_list, err = await self._fetch_station_list(http)
                    except Exception as e:
                        safe_rollback(conn)
                        errors.append(f"stations: {fmt_exc(e, 120)}")
                        continue
                    if err:
                        errors.append(f"stations: {err}")
                        continue

                    # MOOD/GENRE 각 contentType을 EMPSection 1개로 묶음
                    for content in content_list:
                        if not isinstance(content, dict):
                            continue
                        content_type = content.get("contentType") or "MOOD"
                        station_list = content.get("djStationList") or []
                        section_key = f"station:{content_type}"
                        classified: list[tuple[str, str, str | None]] = []
                        for st in station_list:
                            if not isinstance(st, dict):
                                continue
                            sno = st.get("stationNo")
                            if sno is None:
                                continue
                            sno = str(sno)
                            sname = st.get("stationName") or sno
                            classified.append((sno, sname, st.get("imageUrl")))

                        try:
                            db_section_id = upsert_section(
                                conn=conn,
                                platform=self.platform,
                                section_key=section_key,
                                display_title=content_type,
                                display_order=section_idx,
                            )
                            seen: set[tuple[str, str]] = set()
                            for item_idx, (sno, sname, cover) in enumerate(classified):
                                upsert_section_item(
                                    conn=conn,
                                    section_id=db_section_id,
                                    item_type="station",
                                    item_id=sno,
                                    title=sname,
                                    cover_url=cover,
                                    display_order=item_idx,
                                )
                                seen.add(("station", sno))
                            prune_stale_items(conn, db_section_id, seen)
                        except Exception as e:
                            safe_rollback(conn)
                            errors.append(
                                f"section save {section_key}: {fmt_exc(e, 120)}"
                            )
                        section_idx += 1

                        for sno, sname, _cover in classified:
                            _add_item("station", sno, sname)

                elif kind == "theme":
                    try:
                        playlists, err = await self._fetch_theme_playlists(http)
                    except Exception as e:
                        safe_rollback(conn)
                        errors.append(f"theme: {fmt_exc(e, 120)}")
                        continue
                    if err:
                        errors.append(f"theme: {err}")
                        continue

                    section_key = "theme"
                    classified_pl: list[tuple[str, str, str | None]] = []
                    for pl in playlists:
                        if not isinstance(pl, dict):
                            continue
                        pl_id = pl.get("plId")
                        if pl_id is None:
                            continue
                        pl_id = str(pl_id)
                        pl_title = pl.get("title") or pl_id
                        image = pl.get("image") or {}
                        cover = image.get("imageUrl") if isinstance(image, dict) else None
                        classified_pl.append((pl_id, pl_title, cover))

                    try:
                        db_section_id = upsert_section(
                            conn=conn,
                            platform=self.platform,
                            section_key=section_key,
                            display_title=None,
                            display_order=section_idx,
                        )
                        seen_pl: set[tuple[str, str]] = set()
                        for item_idx, (pl_id, pl_title, cover) in enumerate(classified_pl):
                            upsert_section_item(
                                conn=conn,
                                section_id=db_section_id,
                                item_type="playlist",
                                item_id=pl_id,
                                title=pl_title,
                                cover_url=cover,
                                display_order=item_idx,
                            )
                            seen_pl.add(("playlist", pl_id))
                        prune_stale_items(conn, db_section_id, seen_pl)
                    except Exception as e:
                        safe_rollback(conn)
                        errors.append(f"section save {section_key}: {fmt_exc(e, 120)}")
                    section_idx += 1

                    for pl_id, pl_title, _cover in classified_pl:
                        _add_item("playlist", pl_id, pl_title)

                else:
                    # 직접 station/{no} 또는 playlist/{plId} → 일관성 위해 섹션 1개로 묶음
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
                    _add_item(kind, ident, ident)

            # Phase 2: fetch tracks per item, upsert
            tracks_new = 0
            tracks_existing = 0
            for item_type, item_id in order:
                name = items[(item_type, item_id)]
                try:
                    tracks = await self._fetch_item_tracks(http, item_type, item_id)
                except Exception as e:
                    safe_rollback(conn)
                    errors.append(f"{item_type}/{item_id}: {fmt_exc(e, 120)}")
                    continue

                source_type = (
                    "vibe_station" if item_type == "station" else "vibe_theme"
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
                            source_type=source_type,
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
