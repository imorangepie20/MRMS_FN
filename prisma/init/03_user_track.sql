-- UserTrack DDL
-- 유저별 트랙 보관 + Core 취향 표시 (PCT/PGT 멤버십)

CREATE TABLE IF NOT EXISTS "UserTrack" (
    id        TEXT PRIMARY KEY,
    "userId"  TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    "trackId" TEXT NOT NULL REFERENCES "Track"(id) ON DELETE CASCADE,
    "isCore"  BOOLEAN NOT NULL,
    source    TEXT NOT NULL,  -- 'liked' | 'playlist:<title>' (가져온 출처)
    platform  TEXT NOT NULL,
    "addedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE ("userId", "trackId")
);

CREATE INDEX IF NOT EXISTS idx_usertrack_user_core
  ON "UserTrack"("userId", "isCore");

CREATE INDEX IF NOT EXISTS idx_usertrack_user_platform
  ON "UserTrack"("userId", platform);
