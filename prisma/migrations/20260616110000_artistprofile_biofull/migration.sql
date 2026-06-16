-- ArtistProfile에 Tidal 에디토리얼 전체 전기 보관용 컬럼(모달 "더보기")
ALTER TABLE "ArtistProfile" ADD COLUMN IF NOT EXISTS "bioFull" TEXT;
