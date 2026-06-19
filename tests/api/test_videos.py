"""/api/videos/sections + EMP 비디오 제외."""
import uuid

from fastapi.testclient import TestClient

from mrms.api.main import app
from mrms.db.emp_section import (
    list_sections_with_items,
    upsert_section,
    upsert_section_item,
)


def _seed(conn, cleanup):
    """오디오/비디오 섹션 1쌍 시드 — per-test 고유 key.

    upsert_section/upsert_section_item은 내부에서 commit하므로 db_conn 롤백으로
    되돌릴 수 없음 → cleanup으로 명시 삭제 (item 먼저, section 나중: LIFO 등록).
    section_key/audio_key/video_key 반환.
    """
    suffix = uuid.uuid4().hex[:8]
    audio_key = f"playlist:aaa_{suffix}"
    video_key = f"video:bbb_{suffix}"
    # LIFO: section DELETE를 먼저 등록 → item DELETE가 나중에 등록되어 먼저 실행(FK 안전)
    cleanup('DELETE FROM "EMPSection" WHERE "sectionKey" IN (%s, %s)', (audio_key, video_key))
    a = upsert_section(conn, "tidal", audio_key, "Audio Sec", 0)
    cleanup('DELETE FROM "EMPSectionItem" WHERE "sectionId" = %s', (a,))
    upsert_section_item(conn, a, "playlist", "aaa", "Aud", None, 0)
    v = upsert_section(conn, "tidal", video_key, "Video Sec", 1)
    cleanup('DELETE FROM "EMPSectionItem" WHERE "sectionId" = %s', (v,))
    upsert_section_item(conn, v, "video", "111", "MV", None, 0)
    return audio_key, video_key


def test_emp_excludes_video_sections(db_conn, cleanup):
    audio_key, video_key = _seed(db_conn, cleanup)
    secs = list_sections_with_items(db_conn, exclude_video=True)
    keys = {s["section_key"] for s in secs}
    assert audio_key in keys
    assert video_key not in keys


def test_only_video_sections(db_conn, cleanup):
    audio_key, video_key = _seed(db_conn, cleanup)
    secs = list_sections_with_items(db_conn, only_video=True)
    keys = {s["section_key"] for s in secs}
    assert video_key in keys
    assert audio_key not in keys
    # only_video는 'video:%'만 — 우리가 시드한 오디오 key는 물론, 그 어떤 비-video key도 없어야 함
    assert all(k.startswith("video:") for k in keys)


def test_videos_sections_endpoint(db_conn, cleanup):
    audio_key, video_key = _seed(db_conn, cleanup)
    client = TestClient(app)
    r = client.get("/api/videos/sections")
    assert r.status_code == 200
    keys = {s["section_key"] for s in r.json()["sections"]}
    assert video_key in keys
    assert audio_key not in keys
    assert all(k.startswith("video:") for k in keys)
