-- UserEmbedding (사용자별 단일 vector, modelVersion으로 A/B)
CREATE TABLE IF NOT EXISTS "UserEmbedding" (
    "userId"       TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    "modelVersion" TEXT NOT NULL,
    embedding      vector(256) NOT NULL,
    "computedFrom" INTEGER NOT NULL,
    "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY ("userId", "modelVersion")
);

CREATE INDEX IF NOT EXISTS idx_userembedding_version
  ON "UserEmbedding"("modelVersion");

-- UserPersona (사용자당 K=3 페르소나, 추후 다양화 가능)
CREATE TABLE IF NOT EXISTS "UserPersona" (
    id             TEXT PRIMARY KEY,
    "userId"       TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    "personaIdx"   INTEGER NOT NULL,
    embedding      vector(256) NOT NULL,
    "inferredTag"  TEXT,
    "topGenres"    TEXT[] NOT NULL DEFAULT '{}',
    "avgBpm"       REAL,
    "contextHours" INTEGER[] NOT NULL DEFAULT '{}',
    "trackCount"   INTEGER NOT NULL,
    UNIQUE ("userId", "personaIdx")
);

CREATE INDEX IF NOT EXISTS idx_userpersona_user
  ON "UserPersona"("userId");

-- PlaylistHistory (페르소나당 1행, 갱신마다 INSERT — history 보존)
CREATE TABLE IF NOT EXISTS "PlaylistHistory" (
    id             TEXT PRIMARY KEY,
    "userId"       TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    "trackIds"     TEXT[] NOT NULL,
    "modelVersion" TEXT NOT NULL,
    context        JSONB,
    "generatedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "playedCount"  INTEGER NOT NULL DEFAULT 0,
    "skipCount"    INTEGER NOT NULL DEFAULT 0,
    "savedCount"   INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_playlisthistory_user_gen
  ON "PlaylistHistory"("userId", "generatedAt" DESC);
