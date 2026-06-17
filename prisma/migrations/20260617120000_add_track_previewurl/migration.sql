-- 랜딩 히어로 preview 캐시(write-through). schema.prisma:84 선언과 DB 일치.
ALTER TABLE "Track" ADD COLUMN IF NOT EXISTS "previewUrl" TEXT;
