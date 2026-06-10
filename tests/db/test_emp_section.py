"""EMPSection + EMPSectionItem helpers."""
import uuid

from mrms.db.emp_section import (
    list_sections_with_items,
    prune_stale_items,
    upsert_section,
    upsert_section_item,
)


def _key(prefix: str) -> str:
    """per-test 고유 section key — 잔여 데이터/병렬 충돌 방지."""
    return f"{prefix}_{uuid.uuid4().hex[:8].upper()}"


def test_upsert_section_idempotent(db_conn, cleanup):
    key = _key("TEST_SEC")
    sid = upsert_section(db_conn, "tidal", key, "Test Section", 99)
    cleanup('DELETE FROM "EMPSection" WHERE id = %s', (sid,))
    sid2 = upsert_section(db_conn, "tidal", key, "Test Updated", 99)
    assert sid == sid2

    with db_conn.cursor() as cur:
        cur.execute('SELECT "displayTitle" FROM "EMPSection" WHERE id = %s', (sid,))
        assert cur.fetchone()[0] == "Test Updated"


def test_upsert_section_item(db_conn, cleanup):
    sid = upsert_section(db_conn, "tidal", _key("TEST_SEC"), None, 99)
    cleanup('DELETE FROM "EMPSection" WHERE id = %s', (sid,))
    item_id = upsert_section_item(
        db_conn, sid, "playlist", "uuid-test-xx", "Title A", "https://cover/a.jpg", 0
    )

    with db_conn.cursor() as cur:
        cur.execute(
            'SELECT title, "coverUrl" FROM "EMPSectionItem" WHERE id = %s', (item_id,)
        )
        title, cover = cur.fetchone()
        assert title == "Title A"
        assert cover == "https://cover/a.jpg"


def test_list_sections_with_items_returns_ordered(db_conn, cleanup):
    # 고유 prefix로 필터 — 다른 테스트의 잔여 행이 끼어들지 못함
    prefix = _key("TEST_SEC")
    sid1 = upsert_section(db_conn, "tidal", f"{prefix}_A", "A", 1)
    cleanup('DELETE FROM "EMPSection" WHERE id = %s', (sid1,))
    sid2 = upsert_section(db_conn, "tidal", f"{prefix}_B", "B", 0)  # earlier order
    cleanup('DELETE FROM "EMPSection" WHERE id = %s', (sid2,))

    upsert_section_item(db_conn, sid1, "playlist", "p1", "P1", None, 0)
    upsert_section_item(db_conn, sid1, "album", "a1", "A1", None, 1)

    result = list_sections_with_items(db_conn, platform="tidal")
    test_secs = [s for s in result if s["section_key"].startswith(prefix)]
    # sid2 (order 0) before sid1 (order 1)
    assert test_secs[0]["section_key"] == f"{prefix}_B"
    assert test_secs[1]["section_key"] == f"{prefix}_A"
    assert len(test_secs[1]["items"]) == 2


def test_prune_stale_items(db_conn, cleanup):
    sid = upsert_section(db_conn, "tidal", _key("TEST_PRUNE"), None, 99)
    cleanup('DELETE FROM "EMPSection" WHERE id = %s', (sid,))
    upsert_section_item(db_conn, sid, "playlist", "old1", "old", None, 0)
    upsert_section_item(db_conn, sid, "playlist", "keep", "k", None, 1)

    deleted = prune_stale_items(db_conn, sid, {("playlist", "keep")})
    assert deleted == 1

    with db_conn.cursor() as cur:
        cur.execute(
            'SELECT "itemId" FROM "EMPSectionItem" WHERE "sectionId" = %s', (sid,)
        )
        ids = [r[0] for r in cur.fetchall()]
        assert ids == ["keep"]
