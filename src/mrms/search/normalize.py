"""플랫폼 검색 raw 응답 → 우리 포맷. 순수 함수 (HTTP/DB 의존 없음).

emp/spotify.py(embed 스크래퍼)는 shape가 달라 미사용 — Web-API /v1/search 및
api.tidal.com/v1/search 응답 shape를 직접 다룬다. 트랙 파싱은
playback_resolve._spotify_candidate / _resolve_tidal 패턴과 동형."""
from __future__ import annotations


def _first_image(images) -> str | None:
    if isinstance(images, list) and images and isinstance(images[0], dict):
        return images[0].get("url")
    return None


def normalize_spotify_track(item) -> dict | None:
    if not isinstance(item, dict) or item.get("id") is None:
        return None
    artists = [a.get("name") for a in item.get("artists") or [] if isinstance(a, dict)]
    album = item.get("album") or {}
    return {
        "platform": "spotify",
        "platform_track_id": str(item["id"]),
        "title": item.get("name"),
        "artist": ", ".join(n for n in artists if n) or "",
        "album_title": album.get("name"),
        "album_cover": _first_image(album.get("images")),
        "duration_ms": item.get("duration_ms"),
        "isrc": (item.get("external_ids") or {}).get("isrc"),
    }


def normalize_spotify_album(item) -> dict | None:
    if not isinstance(item, dict) or item.get("id") is None:
        return None
    artists = [a.get("name") for a in item.get("artists") or [] if isinstance(a, dict)]
    return {
        "type": "album",
        "platform": "spotify",
        "platform_id": str(item["id"]),
        "title": item.get("name"),
        "subtitle": ", ".join(n for n in artists if n) or "",
        "cover_url": _first_image(item.get("images")),
        "track_count": item.get("total_tracks"),
    }


def normalize_spotify_playlist(item) -> dict | None:
    if not isinstance(item, dict) or item.get("id") is None:
        return None
    return {
        "type": "playlist",
        "platform": "spotify",
        "platform_id": str(item["id"]),
        "title": item.get("name"),
        "subtitle": (item.get("owner") or {}).get("display_name") or "",
        "cover_url": _first_image(item.get("images")),
        "track_count": (item.get("tracks") or {}).get("total"),
    }


def _tidal_cover_url(album) -> str | None:
    cover = album.get("cover") if isinstance(album, dict) else None
    if not cover:
        return None
    path = str(cover).replace("-", "/")
    return f"https://resources.tidal.com/images/{path}/1280x1280.jpg"


def normalize_tidal_track(item) -> dict | None:
    if not isinstance(item, dict) or item.get("id") is None:
        return None
    artists = [a.get("name") for a in item.get("artists") or [] if isinstance(a, dict)]
    album = item.get("album") or {}
    dur = item.get("duration")
    return {
        "platform": "tidal",
        "platform_track_id": str(item["id"]),
        "title": item.get("title"),
        "artist": ", ".join(n for n in artists if n) or "",
        "album_title": album.get("title"),
        "album_cover": _tidal_cover_url(album),
        "duration_ms": int(dur) * 1000 if dur else None,
        "isrc": item.get("isrc"),
    }


def normalize_tidal_album(item) -> dict | None:
    if not isinstance(item, dict) or item.get("id") is None:
        return None
    artists = [a.get("name") for a in item.get("artists") or [] if isinstance(a, dict)]
    return {
        "type": "album",
        "platform": "tidal",
        "platform_id": str(item["id"]),
        "title": item.get("title"),
        "subtitle": ", ".join(n for n in artists if n) or "",
        "cover_url": _tidal_cover_url(item),
        "track_count": item.get("numberOfTracks"),
    }


def normalize_tidal_playlist(item) -> dict | None:
    if not isinstance(item, dict):
        return None
    pid = item.get("uuid") or item.get("id")
    if pid is None:
        return None
    return {
        "type": "playlist",
        "platform": "tidal",
        "platform_id": str(pid),
        "title": item.get("title"),
        "subtitle": (item.get("creator") or {}).get("name") or "",
        "cover_url": _tidal_cover_url(item) if item.get("squareImage") is None else None,
        "track_count": item.get("numberOfTracks"),
    }


def _yt_thumbnail(thumbnails) -> str | None:
    """ytmusicapi thumbnails → 가장 큰 width url. 없으면 None."""
    if not isinstance(thumbnails, list):
        return None
    best_url, best_w = None, -1
    for t in thumbnails:
        if not isinstance(t, dict):
            continue
        url, w = t.get("url"), t.get("width") or 0
        if isinstance(url, str) and url and w > best_w:
            best_url, best_w = url, w
    return best_url


def _yt_duration_ms(item) -> int | None:
    """duration_seconds(int) 우선, 없으면 'M:SS'/'H:MM:SS' 파싱. 실패 None."""
    ds = item.get("duration_seconds")
    if isinstance(ds, int):
        return ds * 1000
    d = item.get("duration")
    if not isinstance(d, str):
        return None
    parts = d.strip().split(":")
    if not parts or len(parts) > 3:
        return None
    try:
        nums = [int(p) for p in parts]
    except ValueError:
        return None
    sec = 0
    for n in nums:
        sec = sec * 60 + n
    return sec * 1000


def normalize_ytmusic_track(item) -> dict | None:
    """ytmusicapi search 항목(song/video) → 우리 포맷. videoId 없으면 None."""
    if not isinstance(item, dict):
        return None
    if item.get("resultType") not in ("song", "video"):
        return None
    vid = item.get("videoId")
    if not vid:
        return None  # 합성 ID 금지 — IFrame 재생 불가
    artists = [a.get("name") for a in (item.get("artists") or []) if isinstance(a, dict)]
    album = item.get("album")
    return {
        "platform": "youtube",
        "platform_track_id": str(vid),
        "title": item.get("title"),
        "artist": ", ".join(n for n in artists if n) or "",
        "album_title": album.get("name") if isinstance(album, dict) else None,
        "album_cover": _yt_thumbnail(item.get("thumbnails")),
        "duration_ms": _yt_duration_ms(item),
        "isrc": None,
    }


def _usable_isrc(isrc) -> bool:
    return bool(isrc) and len(str(isrc)) == 12 and str(isrc).isalnum()


def _to_flat(t: dict) -> dict:
    """단일 플랫폼 트랙 → flat 응답 트랙(track_id는 persist 후 채움)."""
    return {
        "track_id": t.get("track_id"),
        "title": t["title"],
        "artist": t["artist"],
        "album_title": t.get("album_title"),
        "album_cover": t.get("album_cover"),
        "duration_ms": t.get("duration_ms"),
        "isrc": t.get("isrc"),
        "tidal_track_id": t["platform_track_id"] if t["platform"] == "tidal" else None,
        "spotify_track_id": t["platform_track_id"] if t["platform"] == "spotify" else None,
        "youtube_track_id": t["platform_track_id"] if t["platform"] == "youtube" else None,
    }


def merge_tracks(tracks: list[dict]) -> list[dict]:
    """플랫폼별 normalize 트랙 리스트 → flat 응답 트랙. 같은 ISRC면 1행(두 플랫폼 ID).
    ISRC 없으면 개별. 입력 순서 보존."""
    by_isrc: dict[str, dict] = {}
    out: list[dict] = []
    for t in tracks:
        isrc = t.get("isrc")
        if _usable_isrc(isrc):
            key = str(isrc).upper()
            if key in by_isrc:
                flat = by_isrc[key]
                if t["platform"] == "tidal":
                    flat["tidal_track_id"] = t["platform_track_id"]
                else:
                    flat["spotify_track_id"] = t["platform_track_id"]
                flat["album_cover"] = flat["album_cover"] or t.get("album_cover")
                flat["album_title"] = flat["album_title"] or t.get("album_title")
                continue
            flat = _to_flat(t)
            by_isrc[key] = flat
            out.append(flat)
        else:
            out.append(_to_flat(t))
    return out
