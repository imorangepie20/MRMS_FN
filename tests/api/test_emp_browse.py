"""EMP browse API tests — /api/emp/sections + /api/emp/items/{type}/{id}/tracks."""
from fastapi.testclient import TestClient

from mrms.api.main import app
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
