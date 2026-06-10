-- 모달 트랙 조회 (WHERE source_id = ...) 가 UNIQUE(trackId, platform, source_id)
-- 인덱스를 못 타고 풀스캔하던 문제. source_id 단독 인덱스 추가.
CREATE INDEX IF NOT EXISTS idx_empsource_source_id ON "EMPSource"(source_id);
