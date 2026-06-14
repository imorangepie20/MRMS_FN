from __future__ import annotations

from fastapi.testclient import TestClient

import mrms.api.import_url as iu
from mrms.api.main import app

client = TestClient(app)


def _ntrack(platform="spotify", pid="abc", isrc="USABC1234567"):
    return {"platform": platform, "platform_track_id": pid, "title": "Song", "artist": "Artist",
            "album_title": "Alb", "album_cover": None, "duration_ms": 200000, "isrc": isrc}


async def _apptok(http, platform):
    return "apptok"


def _backfill_persist(conn, tracks, item_type, item_id):
    for t in tracks:
        t["track_id"] = "t_" + t["platform_track_id"]
    return f"{item_type}:{item_id}"


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


def test_import_works_without_user_connection(login, monkeypatch):
    # 연동(유저 토큰) 없어도 앱 토큰으로 카탈로그 조회 — 인증은 재생에만 필요
    _, sid = login()
    client.cookies.set("mrms_session", sid)

    async def no_user(user_id, conn):
        raise RuntimeError("not connected")

    async def fake_track(http, platform, item_id, tok, country):
        assert tok == "apptok"  # 앱 토큰 사용
        return _ntrack("spotify", item_id)

    monkeypatch.setattr(iu, "get_app_token", _apptok)
    monkeypatch.setattr(iu, "_spotify_tok", no_user)
    monkeypatch.setattr(iu, "fetch_track", fake_track)
    monkeypatch.setattr(iu, "persist_container_tracks", _backfill_persist)
    r = client.post("/api/import/url", json={"url": "https://open.spotify.com/track/abc"})
    assert r.status_code == 200
    assert r.json()["tracks"][0]["track_id"] == "t_abc"
    client.cookies.clear()


def test_import_track_happy(login, monkeypatch):
    _, sid = login()
    client.cookies.set("mrms_session", sid)
    monkeypatch.setattr(iu, "get_app_token", _apptok)

    async def fake_track(http, platform, item_id, tok, country):
        return _ntrack("spotify", item_id)

    monkeypatch.setattr(iu, "fetch_track", fake_track)
    monkeypatch.setattr(iu, "persist_container_tracks", _backfill_persist)
    r = client.post("/api/import/url", json={"url": "https://open.spotify.com/track/abc?si=z"})
    assert r.status_code == 200
    data = r.json()
    assert data["item_type"] == "track"
    assert data["title"] == "Artist — Song"
    assert len(data["tracks"]) == 1 and data["tracks"][0]["spotify_track_id"] == "abc"
    assert data["tracks"][0]["track_id"] == "t_abc"
    client.cookies.clear()


def test_import_playlist_happy(login, monkeypatch):
    _, sid = login()
    client.cookies.set("mrms_session", sid)
    monkeypatch.setattr(iu, "get_app_token", _apptok)

    async def fake_container(http, platform, item_type, item_id, tok, country):
        return [_ntrack("spotify", "p1", "USABC1234561"), _ntrack("spotify", "p2", "USABC1234562")]

    async def fake_title(http, platform, item_type, item_id, tok, country):
        return "My Playlist"

    monkeypatch.setattr(iu, "fetch_container_tracks", fake_container)
    monkeypatch.setattr(iu, "_container_title", fake_title)
    monkeypatch.setattr(iu, "persist_container_tracks", _backfill_persist)
    r = client.post("/api/import/url", json={"url": "https://open.spotify.com/playlist/pl?si=z"})
    assert r.status_code == 200
    data = r.json()
    assert data["item_type"] == "playlist" and data["title"] == "My Playlist"
    assert len(data["tracks"]) == 2
    assert all(t["track_id"] is not None for t in data["tracks"])
    client.cookies.clear()


def test_spotify_playlist_falls_back_to_user_token(login, monkeypatch):
    # Spotify playlist는 앱 토큰 403(빈 결과) → 연동된 유저 토큰으로 폴백
    _, sid = login()
    client.cookies.set("mrms_session", sid)

    async def user_tok(user_id, conn):
        return "usertok"

    async def fake_container(http, platform, item_type, item_id, tok, country):
        if tok == "usertok":
            return [_ntrack("spotify", "p1", "USABC1234561")]
        return []  # 앱 토큰: 403처럼 빈 결과

    async def fake_title(http, platform, item_type, item_id, tok, country):
        return "PL"

    monkeypatch.setattr(iu, "get_app_token", _apptok)
    monkeypatch.setattr(iu, "_spotify_tok", user_tok)
    monkeypatch.setattr(iu, "fetch_container_tracks", fake_container)
    monkeypatch.setattr(iu, "_container_title", fake_title)
    monkeypatch.setattr(iu, "persist_container_tracks", _backfill_persist)
    r = client.post("/api/import/url", json={"url": "https://open.spotify.com/playlist/pl"})
    assert r.status_code == 200
    assert len(r.json()["tracks"]) == 1
    client.cookies.clear()


def test_import_empty_404(login, monkeypatch):
    _, sid = login()
    client.cookies.set("mrms_session", sid)

    async def no_user(user_id, conn):
        raise RuntimeError("not connected")

    async def empty(http, platform, item_id, tok, country):
        return None

    monkeypatch.setattr(iu, "get_app_token", _apptok)
    monkeypatch.setattr(iu, "_spotify_tok", no_user)
    monkeypatch.setattr(iu, "fetch_track", empty)
    r = client.post("/api/import/url", json={"url": "https://open.spotify.com/track/x"})
    assert r.status_code == 404
    client.cookies.clear()


def test_import_no_tokens_502(login, monkeypatch):
    _, sid = login()
    client.cookies.set("mrms_session", sid)

    async def boom_app(http, platform):
        raise RuntimeError("app token fail")

    async def boom_user(user_id, conn):
        raise RuntimeError("no user")

    monkeypatch.setattr(iu, "get_app_token", boom_app)
    monkeypatch.setattr(iu, "_spotify_tok", boom_user)
    r = client.post("/api/import/url", json={"url": "https://open.spotify.com/track/abc"})
    assert r.status_code == 502
    client.cookies.clear()
