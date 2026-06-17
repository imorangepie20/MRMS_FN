-- 랜딩 히어로 30s preview 캐시(write-through). schema.prisma Track.previewUrl 선언과 DB 일치.
ALTER TABLE "Track" ADD COLUMN IF NOT EXISTS "previewUrl" TEXT;
