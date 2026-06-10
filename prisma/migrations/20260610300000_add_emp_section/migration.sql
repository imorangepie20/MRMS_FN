CREATE TABLE IF NOT EXISTS "EMPSection" (
  id              TEXT PRIMARY KEY,
  platform        TEXT NOT NULL,
  "sectionKey"    TEXT NOT NULL,
  "displayTitle"  TEXT,
  "displayOrder"  INTEGER NOT NULL DEFAULT 0,
  "lastSyncedAt"  TIMESTAMPTZ,
  UNIQUE (platform, "sectionKey")
);

CREATE TABLE IF NOT EXISTS "EMPSectionItem" (
  id              TEXT PRIMARY KEY,
  "sectionId"     TEXT NOT NULL REFERENCES "EMPSection"(id) ON DELETE CASCADE,
  "itemType"      TEXT NOT NULL,
  "itemId"        TEXT NOT NULL,
  title           TEXT,
  "coverUrl"      TEXT,
  "displayOrder"  INTEGER NOT NULL DEFAULT 0,
  "lastSeenAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("sectionId", "itemType", "itemId")
);

CREATE INDEX IF NOT EXISTS idx_emp_section_item_section ON "EMPSectionItem"("sectionId", "displayOrder");
