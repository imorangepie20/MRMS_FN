-- CreateTable (idempotent — table may not exist yet)
CREATE TABLE IF NOT EXISTS "UserBlocked" (
    "id"         TEXT        NOT NULL,
    "userId"     TEXT        NOT NULL,
    "targetId"   TEXT        NOT NULL,
    "targetType" TEXT        NOT NULL,
    "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "UserBlocked_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "UserBlocked_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "UserBlocked_userId_idx" ON "UserBlocked"("userId");

-- AddColumn reason
ALTER TABLE "UserBlocked" ADD COLUMN IF NOT EXISTS reason TEXT NOT NULL DEFAULT 'disliked';

-- AddUniqueIndex for ON CONFLICT upsert
CREATE UNIQUE INDEX IF NOT EXISTS uniq_userblocked_target
  ON "UserBlocked"("userId", "targetId", "targetType");
