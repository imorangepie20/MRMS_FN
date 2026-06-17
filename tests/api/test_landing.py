"""랜딩 preview-tracks 엔드포인트."""
import uuid as _uuid

import httpx
import respx
from fastapi.testclient import TestClient

from mrms.api.main import app
from mrms.emp.base import upsert_track_and_emp_source

client = TestClient(app)


def _seed_newrelease_track(db_conn, cleanup, *, isrc, preview=None):
    """real-ISRC new_release 트랙 시드. (track_id) 반환."""
    artist = f"Land Artist {_uuid.uuid4().hex[:6]}"
    sid = f"new_release:land:{_uuid.uuid4().hex[:8]}"
    r = upsert_track_and_emp_source(
        db_conn, isrc=isrc, title="Land Song", artist=artist,
        album_title="LA", duration_ms=180000, platform="tidal",
        platform_track_id="T" + _uuid.uuid4().hex[:8], source_type="new_release",
        source_id=sid, source_name="New Releases", cover_url="https://c/l.jpg",
    )
    tid = r["track_id"]
    if preview is not None:
        with db_conn.cursor() as cur:
            cur.execute('UPDATE "Track" SET "previewUrl"=%s WHERE id=%s', (preview, tid))
    db_conn.commit()
    # cleanup은 역순 실행. FK 안전 삭제순서는 자식→부모:
    # EMPSource → TrackPlatform → Track(→Album,Artist 참조) → Album(→Artist 참조) → Artist.
    # 따라서 등록은 그 역순(Artist 먼저, EMPSource 마지막)으로 한다.
    cleanup('DELETE FROM "Artist" WHERE name = %s', (artist,))
    cleanup(
        'DELETE FROM "Album" WHERE "artistId" IN (SELECT id FROM "Artist" WHERE name = %s)',
        (artist,),
    )
    cleanup('DELETE FROM "Track" WHERE id = %s', (tid,))
    cleanup('DELETE FROM "TrackPlatform" WHERE "trackId" = %s', (tid,))
    cleanup('DELETE FROM "EMPSource" WHERE source_id = %s', (sid,))
    return tid, isrc


@respx.mock
def test_preview_tracks_cache_hit_no_external(db_conn, cleanup):
    """previewUrl 캐시된 트랙은 외부 호출 0(respx 라우트 없음 → 호출 시 실패)."""
    isrc = "US" + _uuid.uuid4().hex[:10].upper()
    tid, _ = _seed_newrelease_track(db_conn, cleanup, isrc=isrc, preview="https://cdn/p.mp3")
    r = client.get("/api/landing/preview-tracks?n=5")
    assert r.status_code == 200, r.text
    tracks = r.json()["tracks"]
    # 시드 트랙이 포함되면 preview_url은 캐시값(외부 미호출).
    # 풀이 커서 안 뽑힐 수도 있으니 존재 시만 검증.
    hit = [t for t in tracks if t["track_id"] == tid]
    if hit:
        assert hit[0]["preview_url"] == "https://cdn/p.mp3"
    assert all(t["preview_url"] for t in tracks)


@respx.mock
def test_preview_tracks_miss_resolves_and_caches(db_conn, cleanup, monkeypatch):
    """previewUrl 없는 트랙 → Deezer resolve(respx) → previewUrl write-back."""
    # 풀이 이 한 곡만 나오도록 db.landing.pick_preview_candidates를 좁혀 패치
    import mrms.api.landing as _land
    isrc = "GB" + _uuid.uuid4().hex[:10].upper()
    tid, _ = _seed_newrelease_track(db_conn, cleanup, isrc=isrc, preview=None)
    monkeypatch.setattr(
        _land, "pick_preview_candidates",
        lambda conn, limit=15: [{
            "track_id": tid, "title": "Land Song", "artist": "x",
            "album_id": None, "album_title": "LA", "album_cover": "https://c/l.jpg",
            "tidal_track_id": "T1", "spotify_track_id": None, "youtube_track_id": None,
            "duration_ms": 180000, "isrc": isrc, "preview_url": None,
        }],
    )
    respx.get(url__startswith=f"https://api.deezer.com/track/isrc:{isrc}").mock(
        return_value=httpx.Response(200, json={"id": 1, "isrc": isrc, "title": "Land Song",
            "artist": {"name": "x"}, "duration": 180, "preview": "https://dz/p.mp3"}))
    r = client.get("/api/landing/preview-tracks?n=5")
    assert r.status_code == 200, r.text
    t = next(x for x in r.json()["tracks"] if x["track_id"] == tid)
    assert t["preview_url"] == "https://dz/p.mp3"
    # write-back 확인
    with db_conn.cursor() as cur:
        cur.execute('SELECT "previewUrl" FROM "Track" WHERE id=%s', (tid,))
        assert cur.fetchone()[0] == "https://dz/p.mp3"


def test_preview_tracks_unauth_ok():
    """무인증 200(쿠키 없음)."""
    client.cookies.clear()
    r = client.get("/api/landing/preview-tracks?n=3")
    assert r.status_code == 200
