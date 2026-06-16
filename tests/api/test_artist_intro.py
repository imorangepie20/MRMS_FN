"""아티스트 소개 팝업 엔드포인트 — 캐시/외부조회(Tidal+Spotify+Gemini)/곡/auth-optional."""
import uuid as _uuid

import httpx
import respx
from fastapi.testclient import TestClient

import mrms.api.artist as _artist_mod
from mrms.api.main import app
from mrms.db.artist_profile import upsert_artist_profile
from mrms.emp.base import upsert_track_and_emp_source

client = TestClient(app)


def _seed_pool_artist(db_conn, cleanup, name, norm):
    """pool-gate 통과용 Artist/Track 행 시드 + cleanup 등록. track_id 반환."""
    sid = f"station:fresh:{_uuid.uuid4().hex[:8]}"
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
    return tid


def test_intro_cache_hit_no_external(db_conn, cleanup, monkeypatch):
    """캐시된 프로필이면 Tidal/Spotify/Gemini 호출 없이 반환(bioFull 포함)."""
    name = f"Cached Artist {_uuid.uuid4().hex[:6]}"
    norm = name.lower().strip()
    cleanup('DELETE FROM "ArtistProfile" WHERE "nameNormalized" = %s', (norm,))
    upsert_artist_profile(
        db_conn, norm, name, "캐시된 소개.", "https://c/a.jpg", ["pop"],
        bio_full="캐시된 전체 전기.",
    )
    db_conn.commit()
    # 외부 호출되면 실패하도록: gemini 함수가 불리면 예외
    monkeypatch.setattr(_artist_mod, "gemini_artist_bio",
                        lambda *a, **k: (_ for _ in ()).throw(AssertionError("called")))
    r = client.get(f"/api/artist/intro?name={name}")
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["bio"] == "캐시된 소개." and d["image"] == "https://c/a.jpg"
    assert d["genres"] == ["pop"] and "tracks" in d
    assert d["bioFull"] == "캐시된 전체 전기."


@respx.mock
def test_intro_miss_fetches_and_caches(db_conn, cleanup, monkeypatch):
    """MISS+풀: Tidal(이미지/전기) 우선, Gemini 요약, Spotify 장르. bioFull은 스트립된 text."""
    name = f"Fresh Artist {_uuid.uuid4().hex[:6]}"
    norm = name.lower().strip()
    _seed_pool_artist(db_conn, cleanup, name, norm)
    # Tidal: 토큰 → 아티스트 검색(picture UUID) → bio(text에 wimpLink 마크업 포함)
    respx.post("https://auth.tidal.com/v1/oauth2/token").mock(
        return_value=httpx.Response(200, json={"access_token": "TT"}))
    respx.get(url__startswith="https://api.tidal.com/v1/search").mock(
        return_value=httpx.Response(200, json={"artists": {"items": [
            {"id": 4288, "name": name, "picture": "ab-cd-ef"}]}}))
    respx.get(url__startswith="https://api.tidal.com/v1/artists/4288/bio").mock(
        return_value=httpx.Response(200, json={
            "source": "TiVo", "lastUpdated": "2020",
            "text": 'A singer influenced by [wimpLink artistId="1"]Bing Crosby[/wimpLink].',
            "summary": "short",
        }))
    # Spotify: 토큰 → 검색(장르/이미지 폴백)
    respx.post("https://accounts.spotify.com/api/token").mock(
        return_value=httpx.Response(200, json={"access_token": "ST"}))
    respx.get(url__startswith="https://api.spotify.com/v1/search").mock(
        return_value=httpx.Response(200, json={"artists": {"items": [
            {"name": name, "genres": ["rock"], "images": [{"url": "https://i/spot.jpg"}]}]}}))
    monkeypatch.setattr(
        _artist_mod, "gemini_artist_bio", lambda n, g, **k: "요약된 소개.")
    r = client.get(f"/api/artist/intro?name={name}")
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["bio"] == "요약된 소개."
    # bioFull = Tidal text에서 마크업 스트립된 본문
    assert d["bioFull"] == "A singer influenced by Bing Crosby."
    # image = Tidal 우선(picture UUID → 750x750)
    assert d["image"] == "https://resources.tidal.com/images/ab/cd/ef/750x750.jpg"
    assert d["genres"] == ["rock"]
    # 캐시 저장 확인(bio + bioFull)
    with db_conn.cursor() as cur:
        cur.execute(
            'SELECT bio, "bioFull" FROM "ArtistProfile" WHERE "nameNormalized"=%s',
            (norm,))
        row = cur.fetchone()
    assert row[0] == "요약된 소개." and row[1] == "A singer influenced by Bing Crosby."


@respx.mock
def test_intro_miss_tidal_bio_404_falls_back(db_conn, cleanup, monkeypatch):
    """Tidal bio 404 → bioFull None, Spotify 이미지/장르 + Gemini 생성 bio로 성립."""
    name = f"NoBio Artist {_uuid.uuid4().hex[:6]}"
    norm = name.lower().strip()
    _seed_pool_artist(db_conn, cleanup, name, norm)
    respx.post("https://auth.tidal.com/v1/oauth2/token").mock(
        return_value=httpx.Response(200, json={"access_token": "TT"}))
    respx.get(url__startswith="https://api.tidal.com/v1/search").mock(
        return_value=httpx.Response(200, json={"artists": {"items": [
            {"id": 999, "name": name, "picture": "ab-cd-ef"}]}}))
    respx.get(url__startswith="https://api.tidal.com/v1/artists/999/bio").mock(
        return_value=httpx.Response(404, json={"error": "not found"}))
    respx.post("https://accounts.spotify.com/api/token").mock(
        return_value=httpx.Response(200, json={"access_token": "ST"}))
    respx.get(url__startswith="https://api.spotify.com/v1/search").mock(
        return_value=httpx.Response(200, json={"artists": {"items": [
            {"name": name, "genres": ["jazz"], "images": [{"url": "https://i/spot.jpg"}]}]}}))
    # 생성 bio: source_text(None)면 자유 생성. monkeypatch는 반환만 검사.
    monkeypatch.setattr(
        _artist_mod, "gemini_artist_bio", lambda n, g, **k: "생성된 소개.")
    r = client.get(f"/api/artist/intro?name={name}")
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["bio"] == "생성된 소개."
    assert d["bioFull"] is None
    # Tidal 이미지는 picture로 여전히 존재 → Tidal 우선
    assert d["image"] == "https://resources.tidal.com/images/ab/cd/ef/750x750.jpg"
    assert d["genres"] == ["jazz"]


def test_intro_not_in_pool_no_external(db_conn, cleanup, monkeypatch):
    """우리 풀에 없는 임의 이름 → Tidal/Spotify/Gemini 미호출, 빈 결과(곡 0). 비용 DoS 차단."""
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
    assert d["bioFull"] is None


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
