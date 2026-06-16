"""아티스트 소개 팝업 엔드포인트 — 캐시/외부조회/곡/auth-optional."""
import uuid as _uuid

import httpx
import respx
from fastapi.testclient import TestClient

import mrms.api.artist as _artist_mod
from mrms.api.main import app
from mrms.db.artist_profile import upsert_artist_profile
from mrms.emp.base import upsert_track_and_emp_source

client = TestClient(app)


def test_intro_cache_hit_no_external(db_conn, cleanup, monkeypatch):
    """캐시된 프로필이면 Spotify/Gemini 호출 없이 반환."""
    name = f"Cached Artist {_uuid.uuid4().hex[:6]}"
    norm = name.lower().strip()
    cleanup('DELETE FROM "ArtistProfile" WHERE "nameNormalized" = %s', (norm,))
    upsert_artist_profile(db_conn, norm, name, "캐시된 소개.", "https://c/a.jpg", ["pop"])
    db_conn.commit()
    # 외부 호출되면 실패하도록: gemini 함수가 불리면 예외
    monkeypatch.setattr(_artist_mod, "gemini_artist_bio",
                        lambda *a, **k: (_ for _ in ()).throw(AssertionError("called")))
    r = client.get(f"/api/artist/intro?name={name}")
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["bio"] == "캐시된 소개." and d["image"] == "https://c/a.jpg"
    assert d["genres"] == ["pop"] and "tracks" in d


@respx.mock
def test_intro_miss_fetches_and_caches(db_conn, cleanup, monkeypatch):
    name = f"Fresh Artist {_uuid.uuid4().hex[:6]}"
    norm = name.lower().strip()
    sid = f"station:fresh:{_uuid.uuid4().hex[:8]}"
    # pool-gate: 외부 fetch는 우리 풀에 있는 아티스트만 → Artist 행 시드.
    r0 = upsert_track_and_emp_source(
        db_conn, isrc=None, title="Seed", artist=name, album_title=None,
        duration_ms=1, platform="youtube",
        platform_track_id=f"YT{_uuid.uuid4().hex[:8]}",
        source_type="station", source_id=sid, source_name="S",
    )
    tid = r0["track_id"]
    db_conn.commit()
    cleanup('DELETE FROM "ArtistProfile" WHERE "nameNormalized" = %s', (norm,))
    cleanup('DELETE FROM "Artist" WHERE "nameNormalized" = %s', (norm,))
    cleanup('DELETE FROM "Track" WHERE id = %s', (tid,))
    cleanup('DELETE FROM "TrackPlatform" WHERE "trackId" = %s', (tid,))
    cleanup('DELETE FROM "EMPSource" WHERE source_id = %s', (sid,))
    respx.post("https://accounts.spotify.com/api/token").mock(
        return_value=httpx.Response(200, json={"access_token": "T"}))
    respx.get(url__startswith="https://api.spotify.com/v1/search").mock(
        return_value=httpx.Response(200, json={"artists": {"items": [
            {"name": name, "genres": ["rock"], "images": [{"url": "https://i/r.jpg"}]}]}}))
    monkeypatch.setattr(_artist_mod, "gemini_artist_bio", lambda n, g, **k: "생성된 소개.")
    r = client.get(f"/api/artist/intro?name={name}")
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["bio"] == "생성된 소개." and d["image"] == "https://i/r.jpg"
    assert d["genres"] == ["rock"]
    # 캐시 저장 확인
    with db_conn.cursor() as cur:
        cur.execute('SELECT bio FROM "ArtistProfile" WHERE "nameNormalized"=%s', (norm,))
        assert cur.fetchone()[0] == "생성된 소개."


def test_intro_not_in_pool_no_external(db_conn, cleanup, monkeypatch):
    """우리 풀에 없는 임의 이름 → Spotify/Gemini 미호출, 빈 결과(곡 0). 비용 DoS 차단."""
    name = f"Ghost Artist {_uuid.uuid4().hex[:6]}"
    norm = name.lower().strip()
    cleanup('DELETE FROM "ArtistProfile" WHERE "nameNormalized" = %s', (norm,))
    # 게이트가 깨져 외부가 불리면 gemini가 예외(=500) → status!=200으로 잡힘.
    monkeypatch.setattr(
        _artist_mod, "gemini_artist_bio",
        lambda *a, **k: (_ for _ in ()).throw(AssertionError("gemini called")))
    r = client.get(f"/api/artist/intro?name={name}")
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["bio"] is None and d["image"] is None
    assert d["genres"] == [] and d["tracks"] == []


def test_intro_empty_name_400():
    r = client.get("/api/artist/intro?name=")
    assert r.status_code == 400


def test_intro_works_without_auth(db_conn, cleanup, monkeypatch):
    """무인증(쿠키 없음)에서도 200 — 공유 페이지 지원."""
    name = f"Public Artist {_uuid.uuid4().hex[:6]}"
    norm = name.lower().strip()
    cleanup('DELETE FROM "ArtistProfile" WHERE "nameNormalized" = %s', (norm,))
    upsert_artist_profile(db_conn, norm, name, "공개 소개.", None, [])
    db_conn.commit()
    monkeypatch.setattr(_artist_mod, "gemini_artist_bio", lambda *a, **k: None)
    client.cookies.clear()
    r = client.get(f"/api/artist/intro?name={name}")
    assert r.status_code == 200, r.text
    assert r.json()["bio"] == "공개 소개."
