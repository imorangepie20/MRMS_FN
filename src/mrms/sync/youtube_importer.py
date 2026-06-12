"""YouTube Data API v3 → DB import.

tidal_importer.py 미러. 핵심 차이 — YouTube는 ISRC가 없어 ISRC 매칭 불가.
트랙 identity = (TrackPlatform platform='youtube', platformTrackId=videoId).
videoId로 기존 매핑을 찾으면 그 trackId를 재사용하고, 없으면 catalog
Track(+Artist)을 만들고 TrackPlatform(youtube, videoId)을 적재한다. 썸네일은
TrackPlatform."previewUrl"에 트랙 커버로 저장한다.
합성 ID는 절대 쓰지 않고 실제 videoId만 사용한다.

엔드포인트/파싱은 레퍼런스(humamAppleTeamPreject001/.../youtubeMusic.js)와 동일.
"""
from __future__ import annotations

from dataclasses import dataclass

import httpx

from mrms.db.ids import stable_id as _id
from mrms.emp.base import _get_or_create_artist, safe_rollback

YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3"
MAX_PAGES = 1000  # 무한 페이지네이션 방지 (보통 사용자는 트랙 1만개 이내)
MAX_RESULTS = 50  # API 페이지당 상한


@dataclass
class ImportStats:
    playlists_fetched: int = 0
    tracks_fetched: int = 0
    tracks_imported: int = 0
    tracks_created: int = 0
    tracks_existing: int = 0

    def summary_lines(self) -> list[str]:
        return [
            f"플레이리스트 {self.playlists_fetched}개 → 트랙 fetch {self.tracks_fetched}개",
            f"UserTrack 적재: {self.tracks_imported} "
            f"(catalog 신규 {self.tracks_created}, 기존 재사용 {self.tracks_existing})",
        ]


def parse_track_metadata(item_snippet: dict) -> tuple[str, str, str | None, str]:
    """YouTube snippet → (artist, title, thumbnail, video_id).

    레퍼런스(youtubeMusic.js) 그대로:
    - title에 ' - '가 있으면 [artist, title]로 분리.
    - 없으면 artist = videoOwnerChannelTitle(또는 channelTitle)에서 ' - Topic' 제거.
    - video_id = snippet.resourceId.videoId (playlistItems) — 없으면 ''.
    - thumbnail = snippet.thumbnails.high.url.
    """
    title = (item_snippet.get("title") or "").strip()
    owner = (
        item_snippet.get("videoOwnerChannelTitle")
        or item_snippet.get("channelTitle")
        or ""
    )
    artist = owner.replace(" - Topic", "").strip() or "Unknown"

    dash_idx = title.find(" - ")
    if dash_idx > 0:
        artist = title[:dash_idx].strip()
        title = title[dash_idx + 3:].strip()

    thumbs = item_snippet.get("thumbnails") or {}
    high = (thumbs.get("high") or {}).get("url")
    medium = (thumbs.get("medium") or {}).get("url")
    thumbnail = high or medium

    resource_id = item_snippet.get("resourceId") or {}
    video_id = resource_id.get("videoId") or ""

    return artist, title, thumbnail, video_id


def upsert_youtube_track(
    conn,
    video_id: str,
    title: str,
    artist: str,
    cover_url: str | None = None,
) -> dict:
    """videoId 기반 catalog Track 매칭/생성.

    1. (platform='youtube', platformTrackId=video_id)로 기존 매핑 조회 → 있으면 재사용.
    2. 없으면 Artist + Track 생성 후 TrackPlatform(youtube, video_id)[+cover] 적재.
    Returns: {'track_id': ..., 'new': bool}.

    base.py의 upsert_track_and_emp_source 패턴을 따르되 ISRC가 없으므로
    videoId만으로 identity를 잡는다 (합성 ISRC 사용).

    커밋하지 않는다 — 호출자(import_all)가 좋아요/플레이리스트 배치 단위로
    commit/rollback을 관리해 catalog Track + TrackPlatform + UserTrack이
    한 트랜잭션으로 묶이도록 한다 (부분 실패 시 깨끗이 복구).
    """
    track_id: str | None = None
    is_new = False

    with conn.cursor() as cur:
        cur.execute(
            '''SELECT "trackId" FROM "TrackPlatform"
               WHERE platform = 'youtube' AND "platformTrackId" = %s
               LIMIT 1''',
            (video_id,),
        )
        row = cur.fetchone()
        if row:
            track_id = row[0]

    if track_id is None:
        artist_id = _get_or_create_artist(conn, artist)
        # ISRC가 없으므로 결정론적 합성 isrc로 Track id 안정화 (videoId 기반).
        # 실제 platform ID는 항상 진짜 videoId만 TrackPlatform에 저장.
        track_isrc = f"yt_{video_id}"
        track_id = _id(f"track|{track_isrc}")
        title_norm = (title or "").lower().strip()
        with conn.cursor() as cur:
            cur.execute(
                '''INSERT INTO "Track"
                     (id, isrc, title, "titleNormalized", "durationMs", "artistId", "albumId")
                   VALUES (%s, %s, %s, %s, %s, %s, %s)
                   ON CONFLICT (id) DO NOTHING''',
                (track_id, track_isrc, title, title_norm, 0, artist_id, None),
            )
        is_new = True

    # tp_id에 track_id 포함 — base.py와 동일한 PK 충돌 방어선.
    # 썸네일은 TrackPlatform."previewUrl"에 트랙 커버로 저장 (이 컬럼은 앱에서
    # mp3 미리듣기로 쓰이지 않는다). ON CONFLICT 시 COALESCE로 기존 커버 보존 +
    # 비어 있던 row 백필.
    tp_id = _id(f"tp|youtube|{video_id}|{track_id}")
    with conn.cursor() as cur:
        cur.execute(
            '''INSERT INTO "TrackPlatform"
                 (id, "trackId", platform, "platformTrackId", "previewUrl")
               VALUES (%s, %s, 'youtube', %s, %s)
               ON CONFLICT ("trackId", platform) DO UPDATE
                 SET "previewUrl" = COALESCE(
                       "TrackPlatform"."previewUrl", EXCLUDED."previewUrl")''',
            (tp_id, track_id, video_id, cover_url),
        )

    return {"track_id": track_id, "new": is_new}


class YouTubeImporter:
    def __init__(self, http: httpx.AsyncClient, access_token: str):
        self.http = http
        self.token = access_token

    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.token}"}

    async def _get(self, path: str, params: dict) -> dict:
        url = f"{YOUTUBE_API_BASE}{path}"
        r = await self.http.get(url, params=params, headers=self._headers())
        r.raise_for_status()
        return r.json()

    async def fetch_my_playlists(self) -> list[dict]:
        """내 플레이리스트 목록 (페이지네이션).

        Returns: [{id, name, cover_url, item_count}] 형태.
        """
        items: list[dict] = []
        page_token: str | None = None
        for _ in range(MAX_PAGES):
            params = {
                "part": "snippet,contentDetails",
                "mine": "true",
                "maxResults": MAX_RESULTS,
            }
            if page_token:
                params["pageToken"] = page_token
            body = await self._get("/playlists", params)
            for p in body.get("items", []):
                snippet = p.get("snippet") or {}
                thumbs = snippet.get("thumbnails") or {}
                cover = (thumbs.get("high") or {}).get("url") or (
                    thumbs.get("medium") or {}
                ).get("url")
                items.append({
                    "id": p.get("id"),
                    "name": snippet.get("title"),
                    "cover_url": cover,
                    "item_count": (p.get("contentDetails") or {}).get("itemCount", 0),
                })
            page_token = body.get("nextPageToken")
            if not page_token:
                break
        return items

    async def fetch_playlist_tracks(self, playlist_id: str) -> list[dict]:
        """playlist의 트랙들 (페이지네이션).

        snippet.resourceId.videoId 없는 항목(삭제 영상)은 필터.
        Returns: [{video_id, title, artist, thumbnail}].
        """
        tracks: list[dict] = []
        page_token: str | None = None
        for _ in range(MAX_PAGES):
            params = {
                "part": "snippet,contentDetails",
                "playlistId": playlist_id,
                "maxResults": MAX_RESULTS,
            }
            if page_token:
                params["pageToken"] = page_token
            body = await self._get("/playlistItems", params)
            for item in body.get("items", []):
                snippet = item.get("snippet") or {}
                resource_id = snippet.get("resourceId") or {}
                if not resource_id.get("videoId"):
                    continue  # 삭제/비공개 영상 필터
                artist, title, thumbnail, video_id = parse_track_metadata(snippet)
                tracks.append({
                    "video_id": video_id,
                    "title": title,
                    "artist": artist,
                    "thumbnail": thumbnail,
                })
            page_token = body.get("nextPageToken")
            if not page_token:
                break
        return tracks

    async def fetch_liked(self) -> list[dict]:
        """좋아요한 음악 영상 (myRating=like, videoCategoryId=10).

        videos 응답의 item은 id가 곧 videoId이고 snippet.resourceId는 없음.
        Returns: [{video_id, title, artist, thumbnail}].
        """
        tracks: list[dict] = []
        page_token: str | None = None
        for _ in range(MAX_PAGES):
            params = {
                "part": "snippet,contentDetails",
                "myRating": "like",
                "videoCategoryId": "10",
                "maxResults": MAX_RESULTS,
            }
            if page_token:
                params["pageToken"] = page_token
            body = await self._get("/videos", params)
            for item in body.get("items", []):
                video_id = item.get("id")
                if not video_id:
                    continue
                snippet = item.get("snippet") or {}
                artist, title, thumbnail, _ = parse_track_metadata(snippet)
                tracks.append({
                    "video_id": video_id,
                    "title": title,
                    "artist": artist,
                    "thumbnail": thumbnail,
                })
            page_token = body.get("nextPageToken")
            if not page_token:
                break
        return tracks


async def import_all(
    conn,
    http: httpx.AsyncClient,
    user_id: str,
    access_token: str,
    playlist_ids: list[str] | None = None,
    include_liked: bool = True,
) -> ImportStats:
    """전체 import — (선택) 좋아요 + (선택) 플레이리스트 → DB 적재.

    각 트랙: videoId로 TrackPlatform(youtube) 조회 → 없으면 catalog Track 생성
    → 그 trackId로 upsert_user_track. liked는 is_core=True/source='liked',
    playlist는 is_core=False/source='playlist:<name>'.

    playlist_ids 지정 시 그 플레이리스트만, 없으면 내 전체 플레이리스트.
    include_liked=False면 좋아요(liked) 배치를 통째로 스킵 (fetch_liked·적재
    모두 생략) — 선택적 import flow용. 기본 True로 기존 동작(전체 + 좋아요) 유지.
    """
    from mrms.db.user_track import upsert_user_track

    importer = YouTubeImporter(http, access_token)
    stats = ImportStats()
    upserted_tracks: set[str] = set()

    # 한 배치(좋아요 / 한 플레이리스트)에서 누적된 stat 델타와 신규 set 추가분을
    # 담아두고 commit 성공 시에만 stats/upserted_tracks에 반영한다. 배치 중간에
    # 예외가 나면 safe_rollback으로 DB를 되돌리고 이 델타도 버려 — 보고 수치와
    # 실제 적재 상태가 어긋나지 않게 한다 (catalog Track + UserTrack을 한
    # 트랜잭션으로 묶었으므로 둘 다 함께 롤백됨).
    class _Batch:
        def __init__(self) -> None:
            self.fetched = 0
            self.imported = 0
            self.created = 0
            self.existing = 0
            self.new_track_ids: set[str] = set()

    def _ingest(track: dict, batch: "_Batch", *, is_core: bool, source: str) -> None:
        batch.fetched += 1
        video_id = track.get("video_id")
        if not video_id:
            return
        r = upsert_youtube_track(
            conn,
            video_id=video_id,
            title=track.get("title") or "",
            artist=track.get("artist") or "Unknown",
            cover_url=track.get("thumbnail"),
        )
        track_id = r["track_id"]
        upsert_user_track(
            conn, user_id, track_id,
            is_core=is_core, source=source, platform="youtube",
        )
        if track_id not in upserted_tracks and track_id not in batch.new_track_ids:
            batch.new_track_ids.add(track_id)
            batch.imported += 1
            if r["new"]:
                batch.created += 1
            else:
                batch.existing += 1

    def _commit_batch(batch: "_Batch") -> None:
        """commit 성공 후에만 호출 — 배치 델타를 전역 stats에 반영."""
        stats.tracks_fetched += batch.fetched
        stats.tracks_imported += batch.imported
        stats.tracks_created += batch.created
        stats.tracks_existing += batch.existing
        upserted_tracks.update(batch.new_track_ids)

    # 좋아요 트랙 (실패해도 진행분 보존) — include_liked=False면 통째로 스킵.
    if include_liked:
        liked_batch = _Batch()
        try:
            liked = await importer.fetch_liked()
            for t in liked:
                _ingest(t, liked_batch, is_core=True, source="liked")
            conn.commit()
            _commit_batch(liked_batch)
        except Exception:
            safe_rollback(conn)  # 배치 델타는 반영 전 — DB와 stats 모두 깨끗이 복구

    # 플레이리스트
    playlists = await importer.fetch_my_playlists()
    if playlist_ids is not None:
        wanted = set(playlist_ids)
        playlists = [p for p in playlists if p.get("id") in wanted]
    stats.playlists_fetched = len(playlists)
    for pl in playlists:
        pl_batch = _Batch()
        try:
            name = pl.get("name") or "untitled"
            tracks = await importer.fetch_playlist_tracks(pl["id"])
            for t in tracks:
                _ingest(t, pl_batch, is_core=False, source=f"playlist:{name}")
            conn.commit()  # 플레이리스트별 커밋 — 중도 실패해도 진행분 보존
            _commit_batch(pl_batch)
        except Exception:
            safe_rollback(conn)  # DB·stats 동시 롤백 (배치 델타 폐기)
            continue

    return stats
