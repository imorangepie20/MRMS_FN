-- FLO EMPSection 중복 정리 — 같은 (platform, displayTitle)은 최근 동기화 1개만 남김.
--
-- 원인: FLO /api/personal/v1/curations/contents 가 같은 큐레이션을 여러 content.id로
-- 중복 반환(예: "음악과 즐기는 2026 북중미 월드컵"을 special:11811/11814/11820 세 번).
-- 기존 코드는 sectionKey = f"special:{sec_id}"를 UNIQUE 키로 써서 같은 섹션이
-- 별도 행으로 적재됐다. 이후 sectionKey를 title 기반(_section_key 헬퍼)으로 바꿔
-- 같은 title은 하나로 합쳐지지만, 이미 쌓인 중복 행은 이 마이그레이션으로 정리한다.
--
-- 규칙: 같은 (platform='flo', displayTitle) 그룹에서 가장 최근 lastSyncedAt 1개만
-- 보존. 동일 타임스탬프(같은 sync run)면 id 오름차순으로 첫 번째 보존.
-- EMPSectionItem 은 EMPSection 에 ON DELETE CASCADE → 항목도 함께 삭제된다.
--
-- 대상(실측 2026-07-02):
--   음악과 즐기는 2026 북중미 월드컵  × 3 → 1
--   놓치면 아쉬운 주간 하이라이트      × 3 → 1
DELETE FROM "EMPSection" s
USING "EMPSection" keep
WHERE s.platform = 'flo'
  AND s."displayTitle" IS NOT NULL
  AND keep.platform = 'flo'
  AND keep."displayTitle" = s."displayTitle"
  AND (
    keep."lastSyncedAt" > s."lastSyncedAt"
    OR (keep."lastSyncedAt" = s."lastSyncedAt" AND keep.id < s.id)
  );
