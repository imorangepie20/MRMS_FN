"""Tidal/Spotify 공유 URL → (platform, item_type, item_id). 쿼리/프래그먼트·browse 무시."""
from __future__ import annotations

from urllib.parse import urlparse

_HOSTS = {
    "open.spotify.com": "spotify",
    "spotify.com": "spotify",
    "tidal.com": "tidal",
    "www.tidal.com": "tidal",
    "listen.tidal.com": "tidal",
}
_TYPES = {"track", "playlist", "album"}


def parse_share_url(url: str) -> tuple[str, str, str] | None:
    """예: open.spotify.com/track/<id>?si=… → ('spotify','track',<id>). 미지원/깨진 URL → None."""
    try:
        u = urlparse((url or "").strip())
    except ValueError:
        return None
    host = (u.netloc or "").lower().split(":")[0]
    platform = _HOSTS.get(host)
    if not platform:
        return None
    segs = [s for s in (u.path or "").split("/") if s]
    for i, seg in enumerate(segs):
        if seg.lower() in _TYPES and i + 1 < len(segs):
            return (platform, seg.lower(), segs[i + 1])
    return None
