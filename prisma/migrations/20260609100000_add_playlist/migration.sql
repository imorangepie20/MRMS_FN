CREATE TABLE IF NOT EXISTS "Playlist" (
  id          TEXT PRIMARY KEY,
  "userId"    TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_playlist_user ON "Playlist"("userId");

CREATE TABLE IF NOT EXISTS "PlaylistTrack" (
  "playlistId" TEXT NOT NULL REFERENCES "Playlist"(id) ON DELETE CASCADE,
  "trackId"    TEXT NOT NULL REFERENCES "Track"(id) ON DELETE CASCADE,
  position     INTEGER NOT NULL,
  "addedAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("playlistId", "trackId")
);
CREATE INDEX IF NOT EXISTS idx_playlisttrack_position ON "PlaylistTrack"("playlistId", position);
