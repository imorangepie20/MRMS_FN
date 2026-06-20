-- 합성-ISRC enrichment skip-memo: 해결 시도 시각.
-- skip(Deezer 미해결) 트랙을 RESOLVE_RETRY_DAYS 동안 재조회에서 제외 →
-- 파이프라인 enrich_isrc 스테이지가 매 run마다 영구-skip 꼬리를 재Deezer하는 비용 방지.
ALTER TABLE "Track" ADD COLUMN IF NOT EXISTS "resolveAttemptedAt" TIMESTAMP(3);
