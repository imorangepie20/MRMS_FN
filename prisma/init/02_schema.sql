-- 우리 적재에 필요한 핵심 테이블만
-- (User/Interaction 등은 나중에 OAuth 단계에서 추가)

CREATE TABLE IF NOT EXISTS "Artist" (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    "nameNormalized" TEXT NOT NULL,
    "mainGenre"     TEXT
);

CREATE INDEX IF NOT EXISTS idx_artist_normalized ON "Artist"("nameNormalized");

CREATE TABLE IF NOT EXISTS "Album" (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    "releaseDate" TIMESTAMPTZ,
    "albumType" TEXT NOT NULL,
    label       TEXT,
    "artistId"  TEXT NOT NULL REFERENCES "Artist"(id)
);

CREATE TABLE IF NOT EXISTS "Track" (
    id              TEXT PRIMARY KEY,
    isrc            TEXT UNIQUE NOT NULL,
    title           TEXT NOT NULL,
    "titleNormalized" TEXT NOT NULL,
    "durationMs"    INTEGER NOT NULL,
    explicit        BOOLEAN NOT NULL DEFAULT FALSE,
    "artistId"      TEXT NOT NULL REFERENCES "Artist"(id),
    "albumId"       TEXT REFERENCES "Album"(id),
    "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_track_artist ON "Track"("artistId");
CREATE INDEX IF NOT EXISTS idx_track_norm ON "Track"("titleNormalized");

CREATE TABLE IF NOT EXISTS "TrackPlatform" (
    id              TEXT PRIMARY KEY,
    "trackId"       TEXT NOT NULL REFERENCES "Track"(id) ON DELETE CASCADE,
    platform        TEXT NOT NULL,
    "platformTrackId" TEXT NOT NULL,
    popularity      INTEGER,
    available       BOOLEAN NOT NULL DEFAULT TRUE,
    regions         TEXT[] NOT NULL DEFAULT '{}',
    "previewUrl"    TEXT,
    "lastSyncedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE ("trackId", platform)
);

CREATE INDEX IF NOT EXISTS idx_platform_lookup ON "TrackPlatform"(platform, "platformTrackId");

CREATE TABLE IF NOT EXISTS "TrackAudioFeatures" (
    id              TEXT PRIMARY KEY,
    "trackId"       TEXT NOT NULL REFERENCES "Track"(id) ON DELETE CASCADE,
    source          TEXT NOT NULL,
    "modelVersion"  TEXT NOT NULL,
    "analyzedAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "audioSourceQuality" TEXT,

    danceability     REAL NOT NULL,
    energy           REAL NOT NULL,
    valence          REAL NOT NULL,
    acousticness     REAL NOT NULL,
    instrumentalness REAL NOT NULL,
    liveness         REAL NOT NULL,
    speechiness      REAL NOT NULL,
    tempo            REAL NOT NULL,
    loudness         REAL NOT NULL,
    key              INTEGER NOT NULL,
    mode             INTEGER NOT NULL,
    "timeSignature"  INTEGER NOT NULL,

    "energyCurve"   REAL[] NOT NULL DEFAULT '{}',
    "chorusStartMs" INTEGER,
    "chorusEndMs"   INTEGER,
    "vocalRatio"    REAL,
    "kpopMood"      TEXT,
    subgenres       TEXT[] NOT NULL DEFAULT '{}',

    confidence      REAL NOT NULL,

    UNIQUE ("trackId", "modelVersion")
);

CREATE INDEX IF NOT EXISTS idx_features_track ON "TrackAudioFeatures"("trackId");

CREATE TABLE IF NOT EXISTS "TrackEmbedding" (
    id              TEXT PRIMARY KEY,
    "trackId"       TEXT NOT NULL REFERENCES "Track"(id) ON DELETE CASCADE,
    "modelVersion"  TEXT NOT NULL,
    embedding       vector(256) NOT NULL,
    pooling         TEXT NOT NULL,
    "audioSource"   TEXT NOT NULL,
    "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE ("trackId", "modelVersion")
);

CREATE INDEX IF NOT EXISTS idx_embedding_version ON "TrackEmbedding"("modelVersion");

-- HNSW 인덱스 — pgvector 0.5+ 필요 (우리는 pg16용 최신 이미지라 OK)
CREATE INDEX IF NOT EXISTS idx_embedding_hnsw
    ON "TrackEmbedding"
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 200);
