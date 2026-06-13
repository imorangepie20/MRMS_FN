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
