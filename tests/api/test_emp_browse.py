"""EMP browse API tests — /api/emp/sections + /api/emp/items/{type}/{id}/tracks."""
import pytest
from fastapi.testclient import TestClient

from mrms.api.main import app
from mrms.db.emp import upsert_emp_source
from mrms.db.emp_section import upsert_section, upsert_section_item


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
