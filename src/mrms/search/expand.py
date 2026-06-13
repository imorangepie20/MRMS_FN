"""컨테이너(앨범/플레이리스트) 구성 트랙 fetch + EMP 적재. source_id='{type}:{id}'.

Spotify: /v1/albums/{id}/tracks, /v1/playlists/{id}/tracks.
Tidal:   api.tidal.com/v1/albums/{id}/tracks, /v1/playlists/{uuid}/items (유저 Bearer)."""
from __future__ import annotations

import logging

from mrms.emp.base import upsert_track_and_emp_source
from mrms.search.normalize import normalize_spotify_track, normalize_tidal_track

log = logging.getLogger(__name__)

SPOTIFY = "https://api.spotify.com/v1"
TIDAL = "https://api.tidal.com/v1"


async def _spotify_album_tracks(http, token, album_id):
    r = await http.get(f"{SPOTIFY}/albums/{album_id}/tracks",
                       params={"limit": 50}, headers={"Authorization": f"Bearer {token}"})
    items = (r.json().get("items") or []) if r.status_code == 200 else []
    return [n for n in (normalize_spotify_track(i) for i in items) if n]


async def _spotify_playlist_tracks(http, token, pid):
    r = await http.get(f"{SPOTIFY}/playlists/{pid}/tracks",
                       params={"limit": 100}, headers={"Authorization": f"Bearer {token}"})
    rows = (r.json().get("items") or []) if r.status_code == 200 else []
    return [n for n in (normalize_spotify_track((row or {}).get("track")) for row in rows) if n]


async def _tidal_album_tracks(http, token, album_id, country):
    r = await http.get(f"{TIDAL}/albums/{album_id}/tracks",
                       params={"countryCode": country, "limit": 100},
                       headers={"Authorization": f"Bearer {token}"})
    items = (r.json().get("items") or []) if r.status_code == 200 else []
    return [n for n in (normalize_tidal_track(i.get("item") or i) for i in items) if n]


async def _tidal_playlist_tracks(http, token, uuid, country):
    r = await http.get(f"{TIDAL}/playlists/{uuid}/items",
                       params={"countryCode": country, "limit": 100},
                       headers={"Authorization": f"Bearer {token}"})
    items = (r.json().get("items") or []) if r.status_code == 200 else []
    out = []
    for i in items:
        track = i.get("item") or i
        if track.get("type") and track["type"] != "track":
            continue
        n = normalize_tidal_track(track)
        if n:
            out.append(n)
    return out


async def fetch_container_tracks(http, platform, item_type, item_id, token, country):
    if platform == "spotify":
        return await (_spotify_album_tracks(http, token, item_id) if item_type == "album"
                      else _spotify_playlist_tracks(http, token, item_id))
    return await (_tidal_album_tracks(http, token, item_id, country) if item_type == "album"
                  else _tidal_playlist_tracks(http, token, item_id, country))


def persist_container_tracks(conn, tracks, item_type, item_id):
    source_id = f"{item_type}:{item_id}"
    for t in tracks:
        try:
            upsert_track_and_emp_source(
                conn, isrc=t.get("isrc"), title=t["title"] or "", artist=t["artist"] or "",
                album_title=t.get("album_title"), duration_ms=t.get("duration_ms"),
                platform=t["platform"], platform_track_id=t["platform_track_id"],
                source_type="search", source_id=source_id, source_name=None,
                cover_url=t.get("album_cover"))
        except Exception as e:
            conn.rollback()
            log.warning("expand persist failed (%s): %s", t.get("platform_track_id"), e)
    return source_id
