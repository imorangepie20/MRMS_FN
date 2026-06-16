-- 아티스트 소개 팝업 캐시: Gemini bio + Spotify 이미지/장르 (nameNormalized 키)
CREATE TABLE IF NOT EXISTS "ArtistProfile" (
    "nameNormalized" TEXT PRIMARY KEY,
    name             TEXT NOT NULL,
    bio              TEXT,
    "imageUrl"       TEXT,
    genres           TEXT[] NOT NULL DEFAULT '{}',
    "fetchedAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
