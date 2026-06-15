from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import respx
from fastapi.testclient import TestClient
from httpx import Response

from mrms.api.main import app
from mrms.db.user_track import upsert_oauth
from mrms.search import youtube as _yt_mod

client = TestClient(app)


def _spotify_body():
    return {
        "tracks": {"items": [{"id": "sp1", "name": "Ditto",
            "artists": [{"name": "NewJeans"}],
            "album": {"name": "OMG", "images": [{"url": "c"}]},
            "duration_ms": 185000, "external_ids": {"isrc": "KRSRCH00001"}}]},
        "albums": {"items": []}, "playlists": {"items": []},
    }


@respx.mock
def test_search_returns_groups_and_persists(login, db_conn, cleanup):
    user_id, session_id = login()
    client.cookies.set("mrms_session", session_id)
    expires = datetime.now(timezone.utc) + timedelta(hours=1)
    upsert_oauth(db_conn, user_id, "spotify", access_token="SP", refresh_token="R",
                 expires_at=expires, scopes=[])
    db_conn.commit()
    cleanup('DELETE FROM "UserOAuth" WHERE "userId" = %s', (user_id,))
    cleanup('DELETE FROM "Track" WHERE isrc = %s', ("KRSRCH00001",))
    respx.get("https://api.spotify.com/v1/search").mock(return_value=Response(200, json=_spotify_body()))

    r = client.get("/api/search", params={"q": "ditto", "types": "track,album,playlist"})
    assert r.status_code == 200
    data = r.json()
    assert len(data["tracks"]) == 1
    t = data["tracks"][0]
    assert t["spotify_track_id"] == "sp1" and t["track_id"]
    assert "tidal" in data["skipped_platforms"]
    client.cookies.clear()
    cleanup('DELETE FROM "EMPSource" WHERE "trackId" = %s', (t["track_id"],))
    cleanup('DELETE FROM "TrackPlatform" WHERE "trackId" = %s', (t["track_id"],))
    cleanup('DELETE FROM "Track" WHERE id = %s', (t["track_id"],))


@respx.mock
def test_expand_spotify_album_persists_tracks(login, db_conn, cleanup):
    user_id, session_id = login()
    client.cookies.set("mrms_session", session_id)
    expires = datetime.now(timezone.utc) + timedelta(hours=1)
    upsert_oauth(db_conn, user_id, "spotify", access_token="SP", refresh_token="R",
                 expires_at=expires, scopes=[])
    db_conn.commit()
    cleanup('DELETE FROM "UserOAuth" WHERE "userId" = %s', (user_id,))
    cleanup('DELETE FROM "Track" WHERE isrc = %s', ("EXPAND00001",))
    respx.get("https://api.spotify.com/v1/albums/al1/tracks").mock(return_value=Response(200, json={
        "items": [{"id": "spx1", "name": "T1", "artists": [{"name": "A"}],
                   "duration_ms": 100000, "external_ids": {"isrc": "EXPAND00001"}}]}))

    r = client.post("/api/search/expand",
                    json={"platform": "spotify", "item_type": "album", "item_id": "al1"})
    assert r.status_code == 200
    assert r.json()["source_id"] == "album:al1"
    with db_conn.cursor() as cur:
        cur.execute(
            '''SELECT COUNT(*) FROM "EMPSource" WHERE source_id='album:al1' AND source_type='search' ''')
        assert cur.fetchone()[0] >= 1
    client.cookies.clear()
    cleanup('DELETE FROM "EMPSource" WHERE source_id = %s', ("album:al1",))
    cleanup('DELETE FROM "Track" WHERE isrc = %s', ("EXPAND00001",))


class _StubYTSearch:
    def __init__(self, results):
        self._results = results

    def search(self, q):
        return self._results


def test_search_includes_youtube_for_connected_user(login, db_conn, cleanup):
    """YouTube 연결 유저 → ytmusicapi 결과가 tracks에 포함 + EMP 적재."""
    user_id, session_id = login()
    client.cookies.set("mrms_session", session_id)
    expires = datetime.now(timezone.utc) + timedelta(hours=1)
    upsert_oauth(db_conn, user_id, "youtube", access_token="YT", refresh_token="R",
                 expires_at=expires, scopes=[])
    db_conn.commit()
    cleanup('DELETE FROM "UserOAuth" WHERE "userId" = %s', (user_id,))
    cleanup('DELETE FROM "TrackPlatform" WHERE "platformTrackId" = %s', ("YTVID1",))

    items = [{
        "resultType": "song", "videoId": "YTVID1", "title": "YT Song",
        "artists": [{"name": "YT Artist"}], "album": {"name": "YT Album"},
        "duration_seconds": 200, "thumbnails": [{"url": "c", "width": 500}],
    }]
    with patch.object(_yt_mod, "_ytmusic", return_value=_StubYTSearch(items)):
        r = client.get("/api/search", params={"q": "yt song", "types": "track"})
    assert r.status_code == 200, r.text
    data = r.json()
    yt_rows = [t for t in data["tracks"] if t.get("youtube_track_id") == "YTVID1"]
    assert len(yt_rows) == 1
    tid = yt_rows[0]["track_id"]
    assert tid  # EMP 적재되어 track_id 채워짐
    client.cookies.clear()
    cleanup('DELETE FROM "EMPSource" WHERE "trackId" = %s', (tid,))
    cleanup('DELETE FROM "TrackPlatform" WHERE "trackId" = %s', (tid,))
    cleanup('DELETE FROM "Track" WHERE id = %s', (tid,))


def test_search_excludes_youtube_for_unconnected_user(login, db_conn):
    """YouTube 미연결 유저 → YT 검색 자체 안 함(트랙 없음)."""
    _, session_id = login()
    client.cookies.set("mrms_session", session_id)
    # ytmusicapi가 혹시 불려도 결과 못 내게 — 불리면 안 됨을 검증
    with patch.object(_yt_mod, "_ytmusic", return_value=_StubYTSearch([
        {"resultType": "song", "videoId": "SHOULDNOT", "title": "x",
         "artists": [{"name": "y"}], "duration_seconds": 1, "thumbnails": []}])):
        r = client.get("/api/search", params={"q": "anything", "types": "track"})
    assert r.status_code == 200
    data = r.json()
    assert not any(t.get("youtube_track_id") == "SHOULDNOT" for t in data["tracks"])
    client.cookies.clear()
