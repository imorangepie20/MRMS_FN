-- 이메일/비밀번호 로그인: 계정 자격 컬럼 추가(비파괴적, nullable).
-- 그린필드 리셋(TRUNCATE)은 배포 시 별도 사용자-게이트 단계로 분리(이 파일엔 없음).
ALTER TABLE "User" ADD COLUMN "nickname" TEXT;
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;
CREATE UNIQUE INDEX "User_nickname_key" ON "User"("nickname");
