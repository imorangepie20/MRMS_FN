"""EMPSection + EMPSectionItem helpers."""
from __future__ import annotations

import psycopg

from mrms.db.ids import stable_id as _id


def upsert_section(
    conn: psycopg.Connection,
    platform: str,
    section_key: str,
    display_title: str | None,
    display_order: int,
) -> str:
    """Upsert section. Updates lastSyncedAt. Returns id."""
    section_id = _id(f"empsec|{platform}|{section_key}")
    with conn.cursor() as cur:
        cur.execute(
            '''INSERT INTO "EMPSection"
                 (id, platform, "sectionKey", "displayTitle", "displayOrder", "lastSyncedAt")
               VALUES (%s, %s, %s, %s, %s, NOW())
               ON CONFLICT (platform, "sectionKey") DO UPDATE
                 SET "displayTitle" = EXCLUDED."displayTitle",
                     "displayOrder" = EXCLUDED."displayOrder",
                     "lastSyncedAt" = NOW()
               RETURNING id''',
            (section_id, platform, section_key, display_title, display_order),
        )
        row = cur.fetchone()
    conn.commit()
    return row[0]


def upsert_section_item(
    conn: psycopg.Connection,
    section_id: str,
    item_type: str,
    item_id: str,
    title: str | None,
    cover_url: str | None,
    display_order: int,
) -> str:
    """Upsert section item. Updates lastSeenAt + title + cover + order."""
    row_id = _id(f"empitem|{section_id}|{item_type}|{item_id}")
    with conn.cursor() as cur:
        cur.execute(
            '''INSERT INTO "EMPSectionItem"
                 (id, "sectionId", "itemType", "itemId", title, "coverUrl", "displayOrder")
               VALUES (%s, %s, %s, %s, %s, %s, %s)
               ON CONFLICT ("sectionId", "itemType", "itemId") DO UPDATE
                 SET title = EXCLUDED.title,
                     "coverUrl" = EXCLUDED."coverUrl",
                     "displayOrder" = EXCLUDED."displayOrder",
                     "lastSeenAt" = NOW()
               RETURNING id''',
            (row_id, section_id, item_type, item_id, title, cover_url, display_order),
        )
        row = cur.fetchone()
    conn.commit()
    return row[0]


def list_sections_with_items(
    conn: psycopg.Connection,
    platform: str | None = None,
    exclude_video: bool = False,
    only_video: bool = False,
) -> list[dict]:
    """모든 section + items (display_order 순).
    exclude_video: section_key 'video:%' 제외(EMP 페이지). only_video: 'video:%'만(/videos)."""
    clauses: list[str] = []
    params_list: list = []
    if platform:
        clauses.append("platform = %s")
        params_list.append(platform)
    if exclude_video:
        clauses.append("\"sectionKey\" NOT LIKE 'video:%%'")
    if only_video:
        clauses.append("\"sectionKey\" LIKE 'video:%%'")
    where = ("WHERE " + " AND ".join(clauses)) if clauses else ""
    params: tuple = tuple(params_list)

    with conn.cursor() as cur:
        cur.execute(
            f'''SELECT id, platform, "sectionKey", "displayTitle", "displayOrder", "lastSyncedAt"
                FROM "EMPSection"
                {where}
                ORDER BY "displayOrder", "sectionKey"''',
            params,
        )
        sections = [
            {
                "id": r[0],
                "platform": r[1],
                "section_key": r[2],
                "display_title": r[3],
                "display_order": r[4],
                "last_synced_at": r[5].isoformat() if r[5] else None,
                "items": [],
            }
            for r in cur.fetchall()
        ]

        if not sections:
            return []

        section_ids = [s["id"] for s in sections]
        cur.execute(
            '''SELECT id, "sectionId", "itemType", "itemId", title, "coverUrl", "displayOrder"
               FROM "EMPSectionItem"
               WHERE "sectionId" = ANY(%s)
               ORDER BY "sectionId", "displayOrder"''',
            (section_ids,),
        )
        items_by_section: dict[str, list[dict]] = {sid: [] for sid in section_ids}
        for r in cur.fetchall():
            items_by_section[r[1]].append({
                "id": r[0],
                "item_type": r[2],
                "item_id": r[3],
                "title": r[4],
                "cover_url": r[5],
                "display_order": r[6],
            })
        for s in sections:
            s["items"] = items_by_section.get(s["id"], [])
    return sections


def prune_stale_items(
    conn: psycopg.Connection, section_id: str, seen_keys: set[tuple[str, str]]
) -> int:
    """sync 후 더 이상 안 보이는 item은 삭제. seen_keys = {(item_type, item_id), ...}."""
    if not seen_keys:
        return 0
    # psycopg3 doesn't support row-tuple lists directly in NOT IN.
    # Use unnest with two arrays: pair-wise match via array_position equivalent.
    types = [k[0] for k in seen_keys]
    ids = [k[1] for k in seen_keys]
    with conn.cursor() as cur:
        cur.execute(
            '''DELETE FROM "EMPSectionItem"
               WHERE "sectionId" = %s
                 AND NOT EXISTS (
                   SELECT 1
                   FROM unnest(%s::text[], %s::text[]) AS t("itemType", "itemId")
                   WHERE t."itemType" = "EMPSectionItem"."itemType"
                     AND t."itemId"  = "EMPSectionItem"."itemId"
                 )''',
            (section_id, types, ids),
        )
        deleted = cur.rowcount
    conn.commit()
    return deleted


def update_item_cover(
    conn: psycopg.Connection,
    platform: str,
    item_type: str,
    item_id: str,
    cover_url: str | None,
) -> int:
    """같은 (platform, itemType, itemId)를 갖는 모든 섹션 아이템의 coverUrl 갱신.

    플랫폼이 큐레이션 목록엔 안 주고 상세 API에만 주는 커버(예: FLO playlist)를
    트랙 fetch 시점에 역채우기(backfill)하기 위함. 같은 아이템이 여러 섹션에
    걸쳐 있어도 한 번에 갱신된다."""
    with conn.cursor() as cur:
        cur.execute(
            '''UPDATE "EMPSectionItem" si
               SET "coverUrl" = %s
               FROM "EMPSection" s
               WHERE si."sectionId" = s.id
                 AND s.platform = %s
                 AND si."itemType" = %s
                 AND si."itemId" = %s''',
            (cover_url, platform, item_type, item_id),
        )
        updated = cur.rowcount
    conn.commit()
    return updated
