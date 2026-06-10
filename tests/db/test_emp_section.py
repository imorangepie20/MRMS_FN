"""EMPSection + EMPSectionItem helpers."""
from mrms.db.emp_section import (
    list_sections_with_items,
    prune_stale_items,
    upsert_section,
    upsert_section_item,
)


def test_upsert_section_idempotent(db_conn):
    sid = upsert_section(db_conn, "tidal", "TEST_SEC_XX", "Test Section", 99)
    sid2 = upsert_section(db_conn, "tidal", "TEST_SEC_XX", "Test Updated", 99)
    assert sid == sid2

    with db_conn.cursor() as cur:
        cur.execute('SELECT "displayTitle" FROM "EMPSection" WHERE id = %s', (sid,))
        assert cur.fetchone()[0] == "Test Updated"

    # cleanup
    with db_conn.cursor() as cur:
        cur.execute('DELETE FROM "EMPSection" WHERE id = %s', (sid,))
    db_conn.commit()


def test_upsert_section_item(db_conn):
    sid = upsert_section(db_conn, "tidal", "TEST_SEC_XX", None, 99)
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

    # cleanup
    with db_conn.cursor() as cur:
        cur.execute('DELETE FROM "EMPSection" WHERE id = %s', (sid,))
    db_conn.commit()


def test_list_sections_with_items_returns_ordered(db_conn):
    sid1 = upsert_section(db_conn, "tidal", "TEST_SEC_A_XX", "A", 1)
    sid2 = upsert_section(db_conn, "tidal", "TEST_SEC_B_XX", "B", 0)  # earlier order

    upsert_section_item(db_conn, sid1, "playlist", "p1", "P1", None, 0)
    upsert_section_item(db_conn, sid1, "album", "a1", "A1", None, 1)

    result = list_sections_with_items(db_conn, platform="tidal")
    test_secs = [s for s in result if s["section_key"].startswith("TEST_SEC")]
    # sid2 (order 0) before sid1 (order 1)
    assert test_secs[0]["section_key"] == "TEST_SEC_B_XX"
    assert test_secs[1]["section_key"] == "TEST_SEC_A_XX"
    assert len(test_secs[1]["items"]) == 2

    # cleanup
    with db_conn.cursor() as cur:
        cur.execute('DELETE FROM "EMPSection" WHERE id IN (%s, %s)', (sid1, sid2))
    db_conn.commit()


def test_prune_stale_items(db_conn):
    sid = upsert_section(db_conn, "tidal", "TEST_PRUNE_XX", None, 99)
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

    # cleanup
    with db_conn.cursor() as cur:
        cur.execute('DELETE FROM "EMPSection" WHERE id = %s', (sid,))
    db_conn.commit()
