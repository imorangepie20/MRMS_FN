CREATE TABLE IF NOT EXISTS "ArtworkCache" (
  key         TEXT PRIMARY KEY,
  url         TEXT,
  "fetchedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
