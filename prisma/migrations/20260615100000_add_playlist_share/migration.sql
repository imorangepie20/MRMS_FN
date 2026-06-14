ALTER TABLE "Playlist" ADD COLUMN IF NOT EXISTS "shareId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_playlist_share ON "Playlist"("shareId");
