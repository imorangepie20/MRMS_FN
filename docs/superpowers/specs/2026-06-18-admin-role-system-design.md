# 관리자 시스템(역할 기반) 설계 (v1)

> 작성일 2026-06-18. MRMS_FN. 현재 `ADMIN_EMAIL` env 단일 관리자를 DB 역할 기반 티어 시스템으로 확장한다.

## 목표

`superadmin` / `admin` / `user` 3티어 역할을 도입한다. 이메일이 `ADMIN_EMAIL`인 유저는 항상 최고관리자(부트스트랩, 락아웃 불가). 최고관리자는 관리 UI에서 다른 유저를 관리자(admin)로 임명/해임한다. 관리자는 EMP 운영 패널에 접근한다. 프론트는 역할에 따라 admin 메뉴/라우트를 게이팅한다.

## 확정된 결정 (브레인스토밍)

1. **역할 티어**: `'user' | 'admin' | 'superadmin'`. (풀 RBAC 아님 — YAGNI.)
2. **부트스트랩**: 이메일 == `ADMIN_EMAIL`(env)인 유저는 **DB값 무관하게 항상 `superadmin`**(계산). 절대 락아웃 안 됨. DB role은 그 위에 얹힘.
3. **권한**: `admin` = EMP 운영 패널(`/api/admin/emp/*`, `/admin/emp`). `superadmin` = EMP 패널 + 유저·관리자 관리.
4. **관리 UI**: 유저 목록 + 역할 + 관리자 임명/해임(user↔admin 토글) + 기본정보(가입일/플랫폼/트랙수). **superadmin 전용**.
5. **role 저장**: `User.role` **String 컬럼**(`@default("user")`), 앱 레벨 검증. Prisma enum 미사용(기존 `primaryPlatform` 등 String 관용 일치).
6. **UI 토글 범위**: user↔admin만. **superadmin은 UI로 부여 불가**(env 루트 단일).

## 비목표 (v1)

- 계정 모더레이션(강제 로그아웃/비활성화/삭제), 다중 superadmin(UI 부여), 감사 로그.
- 세분 권한(RBAC) — 역할별 고정 권한만.
- 관리자 알림/초대 이메일 — 이메일 인프라 없음.

---

## 아키텍처

### 데이터 모델 — `prisma/schema.prisma` `User`

추가: `role String @default("user")` — `'user'|'admin'|'superadmin'`.

마이그레이션(비파괴적, additive): `ALTER TABLE "User" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'user';` (기존 행은 default로 채워짐 — 안전). 로컬 테스트 DB는 psycopg로 적용(psql 부재).

### 유효 역할 계산 — 신규 `src/mrms/auth/roles.py`

```python
import os
import psycopg
from fastapi import Depends, HTTPException
from mrms.api.deps import db_conn, get_current_user_id

ROLES = ("user", "admin", "superadmin")


def get_effective_role(conn: psycopg.Connection, user_id: str) -> str:
    """email == ADMIN_EMAIL이면 항상 'superadmin'(env 루트, 락아웃 불가).
    아니면 DB User.role(없으면 'user')."""
    admin_email = os.environ.get("ADMIN_EMAIL", "").strip().lower()
    with conn.cursor() as cur:
        cur.execute('SELECT email, role FROM "User" WHERE id = %s', (user_id,))
        row = cur.fetchone()
    if not row:
        raise HTTPException(404, "User not found")
    email, role = row
    if admin_email and (email or "").strip().lower() == admin_email:
        return "superadmin"
    return role if role in ROLES else "user"


def require_admin(
    user_id: str = Depends(get_current_user_id),
    conn: psycopg.Connection = Depends(db_conn),
) -> str:
    if get_effective_role(conn, user_id) not in ("admin", "superadmin"):
        raise HTTPException(403, "admin required")
    return user_id


def require_superadmin(
    user_id: str = Depends(get_current_user_id),
    conn: psycopg.Connection = Depends(db_conn),
) -> str:
    if get_effective_role(conn, user_id) != "superadmin":
        raise HTTPException(403, "superadmin required")
    return user_id
```

### 백엔드 변경

- **`src/mrms/api/admin_emp.py`**: 파일 내 `_require_admin`(이메일 비교) 제거. 각 엔드포인트의 `user_id: str = Depends(get_current_user_id)` + 본문 `_require_admin(conn, user_id)` 호출을 `user_id: str = Depends(require_admin)`로 교체(admin+ 게이팅 동일, 이제 role 기반).
- **신규 라우터 `src/mrms/api/admin_users.py`** (`prefix="/api/admin/users"`):
  - `GET /api/admin/users` (`Depends(require_superadmin)`) — 유저 목록. 각: `user_id, email, nickname, role(유효), created_at, primary_platform, track_count`. **각 행의 유효 role은 인라인 계산**(`email==ADMIN_EMAIL ? 'superadmin' : (role 또는 'user')`) — `get_effective_role` 행별 호출(N+1) 회피. primary_platform/track_count는 단일 쿼리 LEFT JOIN/집계로.
  - `PATCH /api/admin/users/{target_id}/role` (`Depends(require_superadmin)`) — body `{role: 'admin'|'user'}`.
    - 검증: role ∈ {'admin','user'}(그 외 422). 'superadmin' 요청 거부.
    - 가드: target의 email == `ADMIN_EMAIL`이면 403(env 루트 강등 불가).
    - `UPDATE "User" SET role=%s WHERE id=target_id`. 없으면 404. 응답 `{user_id, role}`.
  - `main.py`에 `admin_users_router` 등록.
- **`/api/auth/me`(`auth_session.py`)·`/api/user`(`main.py`)·`UserInfo`(`schemas.py`)**: 응답에 `role`(유효 역할) 추가.

### 프론트엔드

- **`web/src/lib/types.ts`** `UserInfo`: `role: "user" | "admin" | "superadmin"` 추가.
- **`web/src/lib/api/admin-users.ts`(신규)**: `fetchAdminUsers()`, `setUserRole(userId, role)`.
- **사이드바 게이팅** — `web/src/lib/nav.ts`의 admin 항목에 `minRole`(예: "EMP admin" → `admin`, "회원 관리" → `superadmin`) 메타 추가. `web/src/components/layout/app-sidebar.tsx`가 `useUser().user?.role`로 필터(역할 부족 항목 숨김). 현재 전원 노출 → 게이팅.
- **`web/src/app/(dashboard)/admin/layout.tsx`(신규)**: 서버 가드 — `getServerSideUser()` role이 `admin`/`superadmin` 아니면 `redirect("/")`. `/admin/*` 전체 보호(현재 무방비).
- **`web/src/app/(dashboard)/admin/users/page.tsx`(신규)**: superadmin 전용(페이지에서 role !== 'superadmin'이면 `redirect("/admin/emp")`). 유저 테이블(email/nickname/role/가입일/플랫폼/트랙수) + 관리자 토글(PATCH role, 낙관적). env 루트 행은 토글 비활성(강등 불가 표시).
- 기존 EMP 패널(`/admin/emp`)·컴포넌트는 그대로. admin 레이아웃 게이트만 추가로 적용.

---

## 데이터 흐름

```
역할 계산:  effective = (email==ADMIN_EMAIL) ? 'superadmin' : User.role
게이트:     /api/admin/emp/*  → require_admin(admin+)
            /api/admin/users* → require_superadmin
            /admin/* (프론트) → layout 가드(admin+), /admin/users → page 가드(superadmin)
사이드바:   admin 항목은 role>=minRole일 때만 표시
임명:       superadmin → PATCH /users/{id}/role {admin|user} (env 루트 대상 금지)
```

## 에러 처리

- 권한 부족: 백엔드 403(`admin required` / `superadmin required`). 프론트 layout/page 가드가 선제 redirect라 정상 경로에선 403 안 봄(직접 호출 시 방어).
- PATCH role 잘못된 값: 422. env 루트 강등 시도: 403. 없는 유저: 404.
- 미인증: `get_current_user_id`가 401(기존). 프론트 `getServerSideUser`가 `/login` redirect.

## 테스트 (DB 격리 준수 — 대상 파일만, 외부호출 없음, 생성 행 cleanup)

신규 `tests/auth/test_roles.py`:
- `get_effective_role`: DB role 'user'+email==ADMIN_EMAIL → 'superadmin'; DB 'admin' → 'admin'; DB 'user' → 'user'; 깨진/null role → 'user'.

신규 `tests/api/test_admin_users.py`(TestClient + 세션 주입 패턴):
- `GET /api/admin/users`: superadmin 200(목록), admin 403, user 403, 미인증 401.
- `PATCH /api/admin/users/{id}/role`: superadmin이 user→admin / admin→user 성공(DB 반영). 비superadmin 403. role='superadmin' 요청 422/거부. env 루트(ADMIN_EMAIL) 대상 강등 403. 없는 유저 404.
- monkeypatch `os.environ["ADMIN_EMAIL"]`로 결정적 테스트.

기존 `tests/api/test_admin_emp*`(있으면) `require_admin` 교체 후에도 통과 확인(admin/superadmin 접근, user 403). 없으면 admin_emp 한 엔드포인트에 대한 role 가드 회귀 테스트 추가.

`/me` role 포함 — `tests/api/test_auth_session.py`에 케이스 추가.

## 파일 구조

생성:
- `src/mrms/auth/roles.py` — 유효 역할 + 가드 의존성.
- `src/mrms/api/admin_users.py` — 유저 목록 + role PATCH.
- `prisma/migrations/<ts>_user_role/migration.sql` — role 컬럼.
- `web/src/lib/api/admin-users.ts` — 관리 API 클라이언트.
- `web/src/app/(dashboard)/admin/layout.tsx` — admin+ 게이트.
- `web/src/app/(dashboard)/admin/users/page.tsx` — 회원 관리(superadmin).
- `tests/auth/test_roles.py`, `tests/api/test_admin_users.py`.

수정:
- `prisma/schema.prisma` — User.role.
- `src/mrms/api/admin_emp.py` — `_require_admin` → `require_admin` 의존성.
- `src/mrms/api/auth_session.py`(/me)·`main.py`(/api/user, 라우터 등록)·`schemas.py`(UserInfo.role).
- `web/src/lib/types.ts` — UserInfo.role.
- `web/src/lib/nav.ts` — admin 항목 minRole.
- `web/src/components/layout/app-sidebar.tsx` — role 필터.

## 리스크 / 주의

- **락아웃**: env 루트(ADMIN_EMAIL) 우선 계산으로 방지. role 컬럼 default 'user'라 기존 유저 영향 없음.
- **부트스트랩 의존**: 실제 superadmin 동작은 prod 서버에 `ADMIN_EMAIL` 설정 + 그 이메일로 가입 필요(별도, 본 기능 범위 밖 운영 작업).
- **이중 fetch**: (dashboard) 레이아웃 + admin 레이아웃 둘 다 `getServerSideUser` — 허용(무해).
- **마이그레이션**: 비파괴적(컬럼 추가). prod는 배포 파이프라인이 적용.
