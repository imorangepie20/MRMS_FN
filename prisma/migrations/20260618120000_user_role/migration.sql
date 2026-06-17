-- 역할 기반 관리자: role 컬럼(비파괴적, default 'user'로 기존 행 자동 채움).
ALTER TABLE "User" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'user';
