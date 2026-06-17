"""랜딩 preview-tracks 엔드포인트.

풀(pick_preview_candidates)을 monkeypatch로 고정해 결정적으로 테스트한다(실 dev 풀·라이브 호출
의존 0). resolve 외부 호출은 respx로 차단. preview URL은 만료 서명이라 캐시(write-back) 안 함."""
import uuid as _uuid

import httpx
import respx
from fastapi.testclient import TestClient

import mrms.api.landing as _land
from mrms.api.main import app

client = TestClient(app)


def _candidate(isrc: str, *, preview=None, track_id="t1"):
    return {
        "track_id": track_id, "title": "Land Song", "artist": "x",
        "album_id": None, "album_title": "LA", "album_cover": "https://c/l.jpg",
        "tidal_track_id": None, "spotify_track_id": None, "youtube_track_id": None,
        "duration_ms": 1, "isrc": isrc, "preview_url": preview,
    }


@respx.mock
def test_preview_tracks_cached_no_external(monkeypatch):
    """후보에 preview_url이 이미 있으면 외부 호출 0(respx 라우트 없음 → 호출 시 실패)."""
    monkeypatch.setattr(
        _land, "pick_preview_candidates",
        lambda conn, limit=10: [_candidate("USABC1234567", preview="https://cdn/p.mp3")],
    )
    r = client.get("/api/landing/preview-tracks?n=5")
    assert r.status_code == 200, r.text
    tracks = r.json()["tracks"]
    assert tracks and tracks[0]["preview_url"] == "https://cdn/p.mp3"


@respx.mock
def test_preview_tracks_resolves_via_deezer(monkeypatch):
    """preview_url 없는 후보 → Deezer resolve(respx) → 결과에 resolve된 URL."""
    isrc = "GB" + _uuid.uuid4().hex[:10].upper()
    monkeypatch.setattr(
        _land, "pick_preview_candidates",
        lambda conn, limit=10: [_candidate(isrc, preview=None, track_id="t-miss")],
    )
    respx.get(url__startswith=f"https://api.deezer.com/track/isrc:{isrc}").mock(
        return_value=httpx.Response(200, json={
            "id": 1, "isrc": isrc, "title": "Land Song",
            "artist": {"name": "x"}, "duration": 180, "preview": "https://dz/p.mp3"}))
    r = client.get("/api/landing/preview-tracks?n=5")
    assert r.status_code == 200, r.text
    t = next(x for x in r.json()["tracks"] if x["track_id"] == "t-miss")
    assert t["preview_url"] == "https://dz/p.mp3"


@respx.mock
def test_preview_tracks_unauth_ok(monkeypatch):
    """무인증 200. 빈 후보 고정 → resolve 미실행(라이브 호출 0)."""
    monkeypatch.setattr(_land, "pick_preview_candidates", lambda conn, limit=10: [])
    client.cookies.clear()
    r = client.get("/api/landing/preview-tracks?n=3")
    assert r.status_code == 200
    assert r.json()["tracks"] == []
