from __future__ import annotations

import respx
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from httpx import Response

from mrms.api.main import app
from mrms.db.user_track import upsert_oauth

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
