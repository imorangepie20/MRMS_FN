from __future__ import annotations

import mrms.api.import_url as iu
from fastapi.testclient import TestClient

from mrms.api.main import app

client = TestClient(app)


def _ntrack(platform="spotify", pid="abc"):
    return {"platform": platform, "platform_track_id": pid, "title": "Song", "artist": "Artist",
            "album_title": "Alb", "album_cover": None, "duration_ms": 200000, "isrc": "USABC1234567"}


async def _tok(user_id, conn):
    return "tok"


def test_import_requires_auth():
    client.cookies.clear()
    r = client.post("/api/import/url", json={"url": "https://open.spotify.com/track/abc"})
    assert r.status_code in (401, 403)


def test_import_bad_url_400(login):
    _, sid = login()
    client.cookies.set("mrms_session", sid)
    r = client.post("/api/import/url", json={"url": "https://youtube.com/x"})
    assert r.status_code == 400
    client.cookies.clear()


def test_import_token_unavailable_401(login, monkeypatch):
    _, sid = login()
    client.cookies.set("mrms_session", sid)

    async def boom(user_id, conn):
        raise RuntimeError("no token")

    monkeypatch.setattr(iu, "_spotify_tok", boom)
    r = client.post("/api/import/url", json={"url": "https://open.spotify.com/track/abc"})
    assert r.status_code == 401
    client.cookies.clear()


def test_import_track_happy(login, monkeypatch):
    _, sid = login()
    client.cookies.set("mrms_session", sid)
    monkeypatch.setattr(iu, "_spotify_tok", _tok)

    async def fake_track(http, platform, item_id, tok, country):
        return _ntrack("spotify", item_id)

    monkeypatch.setattr(iu, "fetch_track", fake_track)
    monkeypatch.setattr(iu, "persist_container_tracks", lambda *a, **k: "track:abc")
    r = client.post("/api/import/url", json={"url": "https://open.spotify.com/track/abc?si=z"})
    assert r.status_code == 200
    data = r.json()
    assert data["item_type"] == "track"
    assert data["title"] == "Artist — Song"
    assert len(data["tracks"]) == 1 and data["tracks"][0]["spotify_track_id"] == "abc"
    client.cookies.clear()


def test_import_playlist_happy(login, monkeypatch):
    _, sid = login()
    client.cookies.set("mrms_session", sid)
    monkeypatch.setattr(iu, "_spotify_tok", _tok)

    async def fake_container(http, platform, item_type, item_id, tok, country):
        t1 = {**_ntrack("spotify", "p1"), "isrc": "USABC1234561"}
        t2 = {**_ntrack("spotify", "p2"), "isrc": "USABC1234562"}
        return [t1, t2]

    async def fake_title(http, platform, item_type, item_id, tok, country):
        return "My Playlist"

    monkeypatch.setattr(iu, "fetch_container_tracks", fake_container)
    monkeypatch.setattr(iu, "_container_title", fake_title)
    monkeypatch.setattr(iu, "persist_container_tracks", lambda *a, **k: "playlist:pl")
    r = client.post("/api/import/url", json={"url": "https://open.spotify.com/playlist/pl?si=z"})
    assert r.status_code == 200
    data = r.json()
    assert data["item_type"] == "playlist" and data["title"] == "My Playlist"
    assert len(data["tracks"]) == 2
    client.cookies.clear()


def test_import_empty_404(login, monkeypatch):
    _, sid = login()
    client.cookies.set("mrms_session", sid)
    monkeypatch.setattr(iu, "_spotify_tok", _tok)

    async def empty(http, platform, item_id, tok, country):
        return None

    monkeypatch.setattr(iu, "fetch_track", empty)
    r = client.post("/api/import/url", json={"url": "https://open.spotify.com/track/x"})
    assert r.status_code == 404
    client.cookies.clear()
