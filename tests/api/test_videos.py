"""/api/videos/sections + EMP 비디오 제외."""
from fastapi.testclient import TestClient

from mrms.api.main import app
from mrms.db.emp_section import (
    list_sections_with_items,
    upsert_section,
    upsert_section_item,
)


def _seed(conn):
    a = upsert_section(conn, "tidal", "playlist:aaa", "Audio Sec", 0)
    upsert_section_item(conn, a, "playlist", "aaa", "Aud", None, 0)
    v = upsert_section(conn, "tidal", "video:bbb", "Video Sec", 1)
    upsert_section_item(conn, v, "video", "111", "MV", None, 0)


def test_emp_excludes_video_sections(db_conn):
    _seed(db_conn)
    secs = list_sections_with_items(db_conn, exclude_video=True)
    keys = {s["section_key"] for s in secs}
    assert "playlist:aaa" in keys
    assert "video:bbb" not in keys


def test_only_video_sections(db_conn):
    _seed(db_conn)
    secs = list_sections_with_items(db_conn, only_video=True)
    keys = {s["section_key"] for s in secs}
    assert keys == {"video:bbb"}


def test_videos_sections_endpoint(db_conn):
    _seed(db_conn)
    client = TestClient(app)
    r = client.get("/api/videos/sections")
    assert r.status_code == 200
    keys = {s["section_key"] for s in r.json()["sections"]}
    assert keys == {"video:bbb"}
