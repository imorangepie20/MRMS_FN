"""Spotify editorial 트랙 임포터 — Search API 기반 섹션 구성.

Spotify가 신규 앱에 큐레이션 endpoint를 차단 (2026-06 실측):
- /browse/featured-playlists, /browse/new-releases → 403
- Spotify 자사 playlist (37i9dQZ...) 직접 fetch → 404
- 유저 공개 playlist /tracks (client_credentials) → 403
- /v1/search?type=track 은 정상 동작 (isrc / album / cover 포함) ← 유일한 통로

소스 형식 (Setting 'spotify_emp_sources', 한 줄에 하나, # 주석):
- search-tracks/<query>  — /v1/search?type=track (client_credentials), 최대 100곡.
                           query에 year:/genre: 필드 필터 사용 가능
- playlist/<id>          — ADMIN_EMAIL 사용자의 OAuth 토큰으로 /playlists/{id}/tracks.
                           토큰 없거나 403이면 해당 소스만 에러 기록 후 skip

섹션 저장: search-tracks 소스 1개 = EMPSection 1개 (platform='spotify').
아이템은 검색 결과 트랙들의 앨범 (dedup, 첫 등장 순) — 트랙 EMPSource의
source_id를 'album:{spotify_album_id}'로 저장해 emp_browse 모달이 앨범 카드
클릭 시 해당 앨범 트랙들을 보여줄 수 있게 한다.
"""
from __future__ import annotations

import base64
import os
import re
import time
from datetime import datetime, timezone

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

SPOTIFY_API_BASE = "https://api.spotify.com/v1"
SPOTIFY_OAUTH = "https://accounts.spotify.com/api/token"

SOURCES_SETTING_KEY = "spotify_emp_sources"
SEARCH_MARKET = "US"
# 신규 앱 client_credentials는 search limit > 10이 400 'Invalid limit' (2026-06 실측).
# offset 페이지네이션은 정상 동작 — 10개씩 끊어서 가져온다.
SEARCH_PAGE_LIMIT = 10
SEARCH_MAX_TRACKS = 100  # 쿼리당 최대 (10 x 10 페이지)

# 기본 search-tracks 장르 (Setting 비었을 때) — 신선도 + 장르 다양성.
# 'k-pop'/'hip-hop'은 이 앱 티어 genre: 필터에서 항상 0건 (2026-06 실측) —
# 기본값에서 제외. 필요 시 admin Setting에서 동작하는 쿼리로 추가.
DEFAULT_GENRES = [
    "pop",
    "rock",
    "jazz",
    "r&b",
    "electronic",
    "indie",
    "classical",
]


def default_sources(year: int | None = None) -> list[str]:
    """기본 소스 목록 — 올해(year) 발매곡 위주로 신선도 유지."""
    y = year or datetime.now(timezone.utc).year
    return [f"search-tracks/year:{y}"] + [
        f"search-tracks/year:{y} genre:{g}" for g in DEFAULT_GENRES
    ]


def _pretty_genre(genre: str) -> str:
    """'k-pop' → 'K-Pop', 'r&b' → 'R&B', 'hip-hop' → 'Hip-Hop'."""
    def cap(seg: str) -> str:
        return seg[:1].upper() + seg[1:]

    out = genre
    for sep in ("-", "&", " "):
        out = sep.join(cap(p) for p in out.split(sep))
    return out


def display_title_for_query(query: str) -> str:
    """검색 쿼리 → 사람이 읽을 섹션 제목.

    'year:2026 genre:k-pop' → '2026 · K-Pop', 'year:2026' → '2026 · Hot New'."""
    year = None
    genre = None
    free: list[str] = []
    for tok in query.split():
        low = tok.lower()
        if low.startswith("year:"):
            year = tok[len("year:"):]
        elif low.startswith("genre:"):
            genre = tok[len("genre:"):]
        else:
            free.append(tok)
    parts: list[str] = []
    if year:
        parts.append(year)
    if genre:
        parts.append(_pretty_genre(genre))
    if free:
        parts.append(" ".join(free).title())
    if year and len(parts) == 1:
        parts.append("Hot New")  # year-only 쿼리
    return " · ".join(parts) if parts else query


def section_key_for_query(query: str) -> str:
    """쿼리 → 안정적인 sectionKey slug.

    'year:2026 genre:k-pop' → 'search-year-2026-genre-k-pop'."""
    slug = re.sub(r"[^a-z0-9]+", "-", query.lower()).strip("-")
    return f"search-{slug}" if slug else "search"


def _pick_album_cover(images: list) -> str | None:
    """Spotify album.images: [{url, height, width}] (보통 큰 것부터 640/300/64).

    중간 크기(~300px) 우선 — 카드용으로 충분, 트래픽 절약."""
    if not isinstance(images, list):
        return None
    best_url: str | None = None
    best_dist: int | None = None
    for img in images:
        if not isinstance(img, dict):
            continue
        url = img.get("url")
        if not isinstance(url, str) or not url.startswith("http"):
            continue
        try:
            h = int(img.get("height") or 0)
        except (TypeError, ValueError):
            h = 0
        dist = abs(h - 300)
        if best_dist is None or dist < best_dist:
            best_url, best_dist = url, dist
    return best_url


def _normalize_track(tr) -> dict | None:
    """Spotify track object → 내부 dict. id/name 없으면 None."""
    if not isinstance(tr, dict):
        return None
    tid = tr.get("id")
    title = tr.get("name")
    if not tid or not title:
        return None
    artists = tr.get("artists") or []
    artist = artists[0].get("name") if artists else "Unknown"
    album = tr.get("album") or {}
    return {
        "platform_track_id": tid,
        "title": title,
        "isrc": (tr.get("external_ids") or {}).get("isrc"),
        "artist": artist,
        "album_title": album.get("name"),
        "duration_ms": tr.get("duration_ms"),
        "album_id": album.get("id"),
        "album_cover": _pick_album_cover(album.get("images") or []),
    }


def _group_albums(tracks: list[dict]) -> list[tuple[str, str | None, str | None]]:
    """첫 등장 순으로 앨범 dedup. [(album_id, album_title, cover_url), ...]."""
    out: list[tuple[str, str | None, str | None]] = []
    seen: set[str] = set()
    for t in tracks:
        aid = t.get("album_id")
        if aid and aid not in seen:
            seen.add(aid)
            out.append((aid, t.get("album_title"), t.get("album_cover")))
    return out


class SpotifyEMPImporter(EMPImporter):
    """Search API 기반 importer — 소스 목록은 Setting에서 로딩."""

    platform = "spotify"

    def __init__(self, client_id: str, client_secret: str):
        self.client_id = client_id
        self.client_secret = client_secret
        # client_credentials 토큰 캐시 — 쿼리마다 재발급하지 않음
        self._access_token: str | None = None
        self._token_expires_at: float = 0.0
        # ADMIN_EMAIL 사용자 OAuth 토큰 (playlist 소스용) — run당 1회만 시도
        self._user_token: str | None = None
        self._user_token_error: str = "not attempted"
        self._user_token_checked = False

    async def _get_access_token(self) -> str:
        """client_credentials 토큰. 만료 전이면 캐시 재사용 (기본 1시간 유효)."""
        if self._access_token and time.monotonic() < self._token_expires_at:
            return self._access_token
        basic = base64.b64encode(f"{self.client_id}:{self.client_secret}".encode()).decode()
        async with httpx.AsyncClient(timeout=10.0) as http:
            r = await http.post(
                SPOTIFY_OAUTH,
                data={"grant_type": "client_credentials"},
                headers={
                    "Authorization": f"Basic {basic}",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            )
            r.raise_for_status()
            payload = r.json()
        self._access_token = payload["access_token"]
        # 60초 마진 두고 만료 처리
        self._token_expires_at = time.monotonic() + int(payload.get("expires_in", 3600)) - 60
        return self._access_token

    async def _get_admin_user_token(self, conn: psycopg.Connection) -> str | None:
        """playlist 소스용 — ADMIN_EMAIL 사용자의 Spotify OAuth access_token.

        client_credentials로는 playlist /tracks가 403이라 사용자 토큰이 필요.
        실패 사유는 _user_token_error에 남기고 None 반환 (호출부에서 소스별 skip)."""
        if self._user_token_checked:
            return self._user_token
        self._user_token_checked = True
        admin_email = os.environ.get("ADMIN_EMAIL", "").strip().lower()
        if not admin_email:
            self._user_token_error = "ADMIN_EMAIL not set"
            return None
        with conn.cursor() as cur:
            cur.execute('SELECT id FROM "User" WHERE LOWER(email) = %s', (admin_email,))
            row = cur.fetchone()
        if not row:
            self._user_token_error = f"admin user not found: {admin_email}"
            return None
        try:
            # lazy import — FastAPI 의존을 EMP 파이프라인 기본 경로에서 격리
            from mrms.api.auth_spotify import get_token

            payload = await get_token(user_id=row[0], conn=conn)
        except Exception as e:
            safe_rollback(conn)
            self._user_token_error = fmt_exc(e, 120)
            return None
        self._user_token = payload.get("access_token")
        if not self._user_token:
            self._user_token_error = "empty access_token"
        return self._user_token

    def _load_sources(self, conn: psycopg.Connection) -> list[tuple[str, str]]:
        """[(kind, ident), ...]. kind ∈ {search-tracks, playlist}."""
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
            if kind in ("search-tracks", "playlist") and ident:
                sources.append((kind, ident))
        if not sources:
            for s in default_sources():
                kind, _, ident = s.partition("/")
                sources.append((kind, ident))
        return sources

    # ----- HTTP fetch helpers -----

    async def _search_tracks(self, http: httpx.AsyncClient, query: str) -> list[dict]:
        """/v1/search?type=track 페이지네이션 — 최대 SEARCH_MAX_TRACKS곡."""
        token = await self._get_access_token()
        out: list[dict] = []
        seen: set[str] = set()
        offset = 0
        while offset < SEARCH_MAX_TRACKS:
            r = await http.get(
                f"{SPOTIFY_API_BASE}/search",
                params={
                    "q": query,
                    "type": "track",
                    "limit": SEARCH_PAGE_LIMIT,
                    "offset": offset,
                    "market": SEARCH_MARKET,
                },
                headers={"Authorization": f"Bearer {token}"},
            )
            if r.status_code != 200:
                if not out:
                    raise RuntimeError(f"search HTTP {r.status_code}")
                break  # 일부 페이지만 실패 — 수집분으로 진행
            items = ((r.json().get("tracks") or {}).get("items")) or []
            if not items:
                break
            for tr in items:
                t = _normalize_track(tr)
                # source_id가 album 기반이라 album_id 없는 트랙은 제외 (드묾)
                if t and t["album_id"] and t["platform_track_id"] not in seen:
                    seen.add(t["platform_track_id"])
                    out.append(t)
            offset += len(items)
            if len(items) < SEARCH_PAGE_LIMIT:
                break
        return out

    async def _fetch_playlist_tracks(
        self, http: httpx.AsyncClient, playlist_id: str, token: str
    ) -> list[dict]:
        """/v1/playlists/{id}/tracks 페이지네이션. 첫 페이지부터 비정상이면 raise."""
        result: list[dict] = []
        url = (
            f"{SPOTIFY_API_BASE}/playlists/{playlist_id}/tracks"
            "?limit=100&fields=items(track(id,name,duration_ms,external_ids,"
            "artists(name),album(id,name,images))),next"
        )
        while url:
            r = await http.get(url, headers={"Authorization": f"Bearer {token}"})
            if r.status_code != 200:
                if not result:
                    raise RuntimeError(f"playlist tracks HTTP {r.status_code}")
                break
            data = r.json()
            for it in data.get("items", []):
                t = _normalize_track(it.get("track") or {})
                if t:
                    result.append(t)
            url = data.get("next")
        return result

    # ----- DB save helpers -----

    def _save_search_section(
        self,
        conn: psycopg.Connection,
        query: str,
        display_order: int,
        tracks: list[dict],
        errors: list[str],
    ) -> None:
        """search 결과 앨범들을 EMPSection/EMPSectionItem으로 저장 (/emp 카드용)."""
        albums = _group_albums(tracks)
        try:
            section_id = upsert_section(
                conn=conn,
                platform=self.platform,
                section_key=section_key_for_query(query),
                display_title=display_title_for_query(query),
                display_order=display_order,
            )
            seen: set[tuple[str, str]] = set()
            for item_idx, (album_id, title, cover) in enumerate(albums):
                upsert_section_item(
                    conn=conn,
                    section_id=section_id,
                    item_type="album",
                    item_id=album_id,
                    title=title,
                    cover_url=cover,
                    display_order=item_idx,
                )
                seen.add(("album", album_id))
            prune_stale_items(conn, section_id, seen)
        except Exception as e:
            safe_rollback(conn)  # 깨진 트랜잭션 복구 — 후속 쿼리 연쇄실패 방지
            errors.append(f"section save {query}: {fmt_exc(e, 120)}")

    def _upsert_tracks(
        self,
        conn: psycopg.Connection,
        tracks: list[dict],
        source_type: str,
        source_for,
        label: str,
        errors: list[str],
    ) -> tuple[int, int]:
        """트랙들 upsert. source_for(track) → (source_id, source_name).
        Returns (new, existing)."""
        n_new = 0
        n_existing = 0
        for t in tracks:
            source_id, source_name = source_for(t)
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
                    source_id=source_id,
                    source_name=source_name,
                )
                if r["new"]:
                    n_new += 1
                else:
                    n_existing += 1
            except Exception as e:
                safe_rollback(conn)
                errors.append(
                    f"upsert {label}/{t.get('platform_track_id')}: {fmt_exc(e, 120)}"
                )
        return n_new, n_existing

    # ----- EMPImporter entrypoint -----

    async def import_all(self, conn: psycopg.Connection) -> dict:
        """모든 source 적재.

        주의: 반환 dict의 'playlists_processed'는 처리 성공한 소스 수
        (키 이름은 base 인터페이스 호환용)."""
        sources = self._load_sources(conn)
        tracks_new = 0
        tracks_existing = 0
        sources_processed = 0
        errors: list[str] = []

        async with httpx.AsyncClient(timeout=15.0) as http:
            for src_idx, (kind, ident) in enumerate(sources):
                if kind == "search-tracks":
                    try:
                        tracks = await self._search_tracks(http, ident)
                    except Exception as e:
                        errors.append(f"search-tracks/{ident}: {fmt_exc(e, 120)}")
                        continue
                    if not tracks:
                        # 결과 0이면 빈 섹션을 만들지 않고 기록만 — 일부 genre:
                        # 필터(k-pop, hip-hop)는 이 앱 티어에서 0건 (2026-06 실측)
                        errors.append(f"search-tracks/{ident}: 0 tracks")
                        continue
                    self._save_search_section(conn, ident, src_idx, tracks, errors)
                    n_new, n_existing = self._upsert_tracks(
                        conn,
                        tracks,
                        source_type="editorial_search",
                        # emp_browse 모달 정합 — 앨범 카드 클릭 시 album:{id}로 조회
                        source_for=lambda t: (f"album:{t['album_id']}", t.get("album_title")),
                        label=f"search-tracks/{ident}",
                        errors=errors,
                    )
                elif kind == "playlist":
                    token = await self._get_admin_user_token(conn)
                    if not token:
                        errors.append(f"playlist/{ident}: skip — {self._user_token_error}")
                        continue
                    try:
                        tracks = await self._fetch_playlist_tracks(http, ident, token)
                    except Exception as e:
                        errors.append(f"playlist/{ident}: {fmt_exc(e, 120)}")
                        continue
                    n_new, n_existing = self._upsert_tracks(
                        conn,
                        tracks,
                        source_type="editorial_playlist",
                        source_for=lambda t, _id=ident: (f"playlist:{_id}", _id),
                        label=f"playlist/{ident}",
                        errors=errors,
                    )
                else:  # pragma: no cover — _load_sources가 이미 필터링
                    continue

                tracks_new += n_new
                tracks_existing += n_existing
                sources_processed += 1

        return {
            "tracks_new": tracks_new,
            "tracks_existing": tracks_existing,
            "playlists_processed": sources_processed,
            "errors": errors,
        }
