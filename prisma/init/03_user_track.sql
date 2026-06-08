CREATE TABLE IF NOT EXISTS "UserTrack" (
    id        TEXT PRIMARY KEY,
    "userId"  TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    "trackId" TEXT NOT NULL REFERENCES "Track"(id) ON DELETE CASCADE,
    "isCore"  BOOLEAN NOT NULL,
    source    TEXT NOT NULL,
    platform  TEXT NOT NULL,
    "addedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE ("userId", "trackId")
);

CREATE INDEX IF NOT EXISTS idx_usertrack_user_core
  ON "UserTrack"("userId", "isCore");

CREATE INDEX IF NOT EXISTS idx_usertrack_user_platform
  ON "UserTrack"("userId", platform);
