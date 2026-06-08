-- User + UserOAuth DDL
-- User 관련 핵심 테이블 (V2 단계). UserTrack 등 후속 테이블의 FK target.

CREATE TABLE IF NOT EXISTS "User" (
    id            TEXT PRIMARY KEY,
    email         TEXT UNIQUE NOT NULL,
    "displayName" TEXT,
    country       TEXT,
    explicit      BOOLEAN NOT NULL DEFAULT TRUE,
    "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "UserOAuth" (
    id             TEXT PRIMARY KEY,
    "userId"       TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    platform       TEXT NOT NULL,
    "accessToken"  TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt"    TIMESTAMPTZ NOT NULL,
    scope          TEXT[] NOT NULL DEFAULT '{}',
    UNIQUE ("userId", platform)
);
