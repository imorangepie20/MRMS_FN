-- 공유 켤 때 소유자 Tidal에 1회 생성한 플레이리스트 uuid 저장.
-- 공유페이지 'Tidal에서 재생' 링크용 (듣는 사람은 무인증으로 그 Tidal 플레이리스트를 염).
ALTER TABLE "Playlist" ADD COLUMN IF NOT EXISTS "tidalPlaylistId" TEXT;
