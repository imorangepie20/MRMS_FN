"""EMP browse API tests — /api/emp/sections + /api/emp/items/{type}/{id}/tracks."""
import pytest
from fastapi.testclient import TestClient

from mrms.api.main import app
from mrms.db.emp import upsert_emp_source
from mrms.db.emp_section import upsert_section, upsert_section_item
from mrms.db.ids import stable_id


client = TestClient(app)


def test_sections_returns_list(db_conn, login):
    _, session_id = login()
    sid = upsert_section(db_conn, "tidal", "TEST_BROWSE_XX", "Test", 99)
    upsert_section_item(db_conn, sid, "playlist", "uuid_xx_1", "P1", None, 0)

    client.cookies.set("mrms_session", session_id)
    try:
        r = client.get("/api/emp/sections?platform=tidal")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "sections" in data
        match = [s for s in data["sections"] if s["section_key"] == "TEST_BROWSE_XX"]
        assert match, "Created section not found in response"
        assert match[0]["items"][0]["item_type"] == "playlist"
    finally:
        client.cookies.clear()
        with db_conn.cursor() as cur:
            cur.execute('DELETE FROM "EMPSection" WHERE id = %s', (sid,))
        db_conn.commit()


def test_sections_requires_auth():
    client.cookies.clear()
    r = client.get("/api/emp/sections")
    assert r.status_code in (401, 403)


def test_item_tracks_invalid_type(login):
    _, session_id = login()
    client.cookies.set("mrms_session", session_id)
    try:
        r = client.get("/api/emp/items/invalid_type/some_id/tracks")
        assert r.status_code == 400
    finally:
        client.cookies.clear()


@pytest.mark.parametrize("item_type", ["playlist", "album", "mix", "artist", "channel", "chart"])
def test_item_tracks_accepts_all_emp_item_types(login, item_type):
    """tidal(mix)/spotify(artist)/flo(channel)/melon(chart) item_type 전부 모달 조회 가능 —
    400으로 거부되면 안 됨 (빈 결과는 200)."""
    _, session_id = login()
    client.cookies.set("mrms_session", session_id)
    try:
        r = client.get(f"/api/emp/items/{item_type}/nonexistent_id/tracks")
        assert r.status_code == 200, r.text
        assert r.json()["tracks"] == []
    finally:
        client.cookies.clear()


def test_item_tracks_include_liked_pct(db_conn, login, cleanup):
    """tracks 응답의 각 트랙에 사용자별 liked/pct boolean 필드 존재."""
    _, session_id = login()  # per-test 고유 email → UserTrack 잔여물 없음
    with db_conn.cursor() as cur:
        cur.execute('SELECT id FROM "Track" LIMIT 1')
        row = cur.fetchone()
    if not row:
        pytest.skip("Track 데이터 부족")
    track_id = row[0]

    item_id = "uuid_likedpct_xx"
    source_id = f"playlist:{item_id}"
    cover = "https://cdn.example/lp_cover.jpg"
    cleanup('DELETE FROM "EMPSource" WHERE source_id = %s', (source_id,))
    upsert_emp_source(
        db_conn, track_id, "tidal", "playlist", source_id, "LikedPct",
        cover_url=cover,
    )

    client.cookies.set("mrms_session", session_id)
    try:
        r = client.get(f"/api/emp/items/playlist/{item_id}/tracks")
        assert r.status_code == 200, r.text
        tracks = r.json()["tracks"]
        assert tracks, "EMPSource로 넣은 트랙이 응답에 없음"
        # EMPSource.cover_url이 album_cover로 노출됨
        assert tracks[0]["album_cover"] == cover
        for t in tracks:
            assert isinstance(t["liked"], bool)
            assert isinstance(t["pct"], bool)
        # 새 사용자 — UserTrack row 없으므로 둘 다 False
        assert tracks[0]["liked"] is False
        assert tracks[0]["pct"] is False
    finally:
        client.cookies.clear()


def _seed_youtube_track(db_conn, cleanup, key: str, platform_track_id: str) -> str:
    """Artist + Track + youtube TrackPlatform 시드 — track_id 반환.

    cleanup은 역순 실행 — 부모(Artist/Track) 먼저 등록 (자식 먼저 삭제)."""
    artist = f"YTB Artist {key}"
    artist_id = stable_id(f"artist|{artist.lower()}")
    isrc = f"emp_ytb_{key}"
    track_id = stable_id(f"track|{isrc}")
    cleanup('DELETE FROM "Artist" WHERE id = %s', (artist_id,))
    cleanup('DELETE FROM "Track" WHERE id = %s', (track_id,))
    cleanup('DELETE FROM "TrackPlatform" WHERE "trackId" = %s', (track_id,))
    with db_conn.cursor() as cur:
        cur.execute(
            '''INSERT INTO "Artist" (id, name, "nameNormalized")
               VALUES (%s, %s, %s) ON CONFLICT (id) DO NOTHING''',
            (artist_id, artist, artist.lower()),
        )
        cur.execute(
            '''INSERT INTO "Track"
                 (id, isrc, title, "titleNormalized", "durationMs", "artistId")
               VALUES (%s, %s, %s, %s, 0, %s) ON CONFLICT (id) DO NOTHING''',
            (track_id, isrc, f"YTB Song {key}", f"ytb song {key}", artist_id),
        )
        cur.execute(
            '''INSERT INTO "TrackPlatform" (id, "trackId", platform, "platformTrackId")
               VALUES (%s, %s, 'youtube', %s)''',
            (stable_id(f"tp|youtube|{platform_track_id}|{track_id}"), track_id, platform_track_id),
        )
    db_conn.commit()
    return track_id


def test_item_tracks_youtube_track_id_filters_synthetic(db_conn, login, cleanup):
    """youtube_track_id 노출 — real videoId('yt' prefix여도)는 그대로,
    합성('yt_…') ID는 None (IFrame 재생 불가 — 노출 차단)."""
    _, session_id = login()
    item_id = "uuid_ytbrowse_xx"
    source_id = f"chart:{item_id}"
    cleanup('DELETE FROM "EMPSource" WHERE source_id = %s', (source_id,))

    # 'yt'로 시작하지만 '_'가 없는 real videoId — escape가 틀리면('_'를
    # 와일드카드로 두면) 이것까지 필터돼 버림
    t_real = _seed_youtube_track(db_conn, cleanup, "real", "ytVID000001")
    t_synth = _seed_youtube_track(db_conn, cleanup, "synth", f"yt_{'ab' * 8}")
    upsert_emp_source(db_conn, t_real, "youtube", "chart", source_id, "YTB")
    upsert_emp_source(db_conn, t_synth, "youtube", "chart", source_id, "YTB")

    client.cookies.set("mrms_session", session_id)
    try:
        r = client.get(f"/api/emp/items/chart/{item_id}/tracks")
        assert r.status_code == 200, r.text
        by_id = {t["track_id"]: t for t in r.json()["tracks"]}
        assert by_id[t_real]["youtube_track_id"] == "ytVID000001"
        assert by_id[t_synth]["youtube_track_id"] is None
        # 기존 필드 시프트 없음
        assert by_id[t_real]["tidal_track_id"] is None
        assert by_id[t_real]["spotify_track_id"] is None
        assert by_id[t_real]["artist"] == "YTB Artist real"
    finally:
        client.cookies.clear()


def test_item_tracks_empty_for_unknown_id(login):
    """존재 안 하는 item id → 빈 리스트 (404 아님)."""
    _, session_id = login()
    client.cookies.set("mrms_session", session_id)
    try:
        r = client.get("/api/emp/items/playlist/nonexistent_uuid_xx/tracks")
        assert r.status_code == 200
        assert r.json()["tracks"] == []
    finally:
        client.cookies.clear()
