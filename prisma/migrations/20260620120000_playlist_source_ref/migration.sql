-- 구독 플랫폼(YouTube/Tidal)에서 가져온 플레이리스트를 일반 Playlist로 흡수.
-- sourceRef = "youtube:{id}" / "tidal:{id}" — 재import 시 멱등(중복 생성 방지)용 식별자.
ALTER TABLE "Playlist" ADD COLUMN IF NOT EXISTS "sourceRef" TEXT;
CREATE INDEX IF NOT EXISTS idx_playlist_source ON "Playlist"("userId", "sourceRef");
