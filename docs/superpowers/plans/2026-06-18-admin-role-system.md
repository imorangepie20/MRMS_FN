# 역할 기반 관리자 시스템 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `superadmin/admin/user` 3티어 역할을 도입하고(이메일==ADMIN_EMAIL=루트 superadmin), 관리자 게이팅 + 최고관리자용 회원·역할 관리 UI를 추가한다.

**Architecture:** `User.role` String 컬럼 + 유효역할 계산(`email==ADMIN_EMAIL → superadmin`). 백엔드는 `require_admin`/`require_superadmin` 의존성으로 게이팅, 신규 `admin_users` 라우터가 목록/역할변경 제공. 프론트는 `/me`의 role로 사이드바·라우트를 게이팅하고 superadmin 회원관리 페이지를 추가.

**Tech Stack:** Python FastAPI + raw psycopg, Prisma(스키마/마이그레이션), Next.js 16(App Router). 백엔드 테스트 `.venv/bin/pytest`(로컬 PG :5433), 프론트 `npx tsc --noEmit` + `pnpm build`.

**테스트/DB 규약:** DB 격리 안 됨 → **전체 pytest 금지**, 대상 파일만. 외부 호출 없음(mock 불요). 생성 User는 `cleanup` fixture로 정리. push/merge 금지.

**런너:** 백엔드 `cd "/Volumes/MacExtend 1/MRMS_FN" && .venv/bin/pytest <file> -v`. 프론트 `cd "/Volumes/MacExtend 1/MRMS_FN/web" && npx tsc --noEmit && pnpm build`. 로컬 마이그레이션은 psql 부재 → psycopg.

**참고(기존 패턴):**
- `tests/api/conftest.py`의 `login(email=None) -> (user_id, session_id)` fixture: User+AuthSession 생성.
- `tests/conftest.py`의 `cleanup(sql, params)` fixture: teardown DELETE.
- 관리자 테스트는 `monkeypatch.setenv("ADMIN_EMAIL", email)` + `login(email)` + 쿠키 세팅 패턴.

---

## File Structure

생성:
- `src/mrms/auth/roles.py` — 유효역할 + `require_admin`/`require_superadmin` 의존성.
- `src/mrms/api/admin_users.py` — 회원 목록 + 역할 변경(superadmin).
- `prisma/migrations/20260618120000_user_role/migration.sql` — role 컬럼.
- `tests/auth/test_roles.py`, `tests/api/test_admin_users.py`.
- `web/src/lib/api/admin-users.ts` — 관리 API 클라이언트.
- `web/src/app/(dashboard)/admin/layout.tsx` — admin+ 게이트.
- `web/src/app/(dashboard)/admin/users/page.tsx` — 회원관리(superadmin).
- `web/src/components/admin/AdminUsersClient.tsx` — 회원관리 클라이언트 UI.

수정:
- `prisma/schema.prisma` — User.role.
- `src/mrms/api/admin_emp.py` — `_require_admin` → `require_admin` 의존성.
- `src/mrms/api/auth_session.py`(/me), `src/mrms/api/main.py`(/api/user + 라우터 등록), `src/mrms/api/schemas.py`(UserInfo.role).
- `web/src/lib/types.ts`(UserInfo.role), `web/src/lib/nav.ts`(NavItem.minRole + 회원관리 항목), `web/src/components/layout/app-sidebar.tsx`(role 필터).

---

## Task 1: User.role 컬럼 + 마이그레이션

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260618120000_user_role/migration.sql`

- [ ] **Step 1: schema.prisma User에 role 추가**

`model User`에서 `passwordHash String?` 줄 아래에 추가:

```prisma
  passwordHash String?
  role        String   @default("user")
  displayName String?
```

- [ ] **Step 2: 마이그레이션 SQL**

`prisma/migrations/20260618120000_user_role/migration.sql`:

```sql
-- 역할 기반 관리자: role 컬럼(비파괴적, default 'user'로 기존 행 자동 채움).
ALTER TABLE "User" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'user';
```

- [ ] **Step 3: 로컬 DB 적용 (psycopg)**

Run:
```bash
.venv/bin/python -c "
import os, psycopg
dsn = os.environ.get('DATABASE_URL','postgresql://mrms:mrms@localhost:5433/mrms')
with psycopg.connect(dsn, autocommit=True) as c, c.cursor() as cur:
    cur.execute('ALTER TABLE \"User\" ADD COLUMN IF NOT EXISTS \"role\" TEXT NOT NULL DEFAULT %s', ('user',))
    print('applied')
"
```
Expected: `applied`.

- [ ] **Step 4: 확인**

Run:
```bash
.venv/bin/python -c "
import os, psycopg
dsn = os.environ.get('DATABASE_URL','postgresql://mrms:mrms@localhost:5433/mrms')
with psycopg.connect(dsn) as c, c.cursor() as cur:
    cur.execute(\"select column_name,column_default from information_schema.columns where table_name='User' and column_name='role'\")
    print(cur.fetchone())
"
```
Expected: `('role', \"'user'::text\")`.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260618120000_user_role/
git commit -m "feat(admin): User.role 컬럼 추가 마이그레이션"
```

---

## Task 2: 유효역할 + 가드 의존성 (`auth/roles.py`)

**Files:**
- Create: `src/mrms/auth/roles.py`
- Test: `tests/auth/test_roles.py`

- [ ] **Step 1: 실패 테스트 작성**

`tests/auth/test_roles.py`:

```python
"""유효역할 계산 단위."""
import uuid

from mrms.auth.roles import get_effective_role


def _set_role(db_conn, user_id, role):
    with db_conn.cursor() as cur:
        cur.execute('UPDATE "User" SET role=%s WHERE id=%s', (role, user_id))
    db_conn.commit()


def test_env_root_is_superadmin(login, monkeypatch, db_conn, cleanup):
    email = f"root-{uuid.uuid4().hex[:8]}@test.com"
    user_id, _ = login(email)
    cleanup('DELETE FROM "User" WHERE id = %s', (user_id,))
    monkeypatch.setenv("ADMIN_EMAIL", email)
    # DB role은 default 'user'지만 env 루트라 superadmin
    assert get_effective_role(db_conn, user_id) == "superadmin"


def test_db_admin_role(login, monkeypatch, db_conn, cleanup):
    user_id, _ = login()
    cleanup('DELETE FROM "User" WHERE id = %s', (user_id,))
    monkeypatch.setenv("ADMIN_EMAIL", "someone-else@test.com")
    _set_role(db_conn, user_id, "admin")
    assert get_effective_role(db_conn, user_id) == "admin"


def test_default_user_role(login, monkeypatch, db_conn, cleanup):
    user_id, _ = login()
    cleanup('DELETE FROM "User" WHERE id = %s', (user_id,))
    monkeypatch.setenv("ADMIN_EMAIL", "someone-else@test.com")
    assert get_effective_role(db_conn, user_id) == "user"
```

- [ ] **Step 2: 실패 확인**

Run: `.venv/bin/pytest tests/auth/test_roles.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'mrms.auth.roles'`

- [ ] **Step 3: 구현**

`src/mrms/auth/roles.py`:

```python
"""역할 기반 관리자 게이팅. 이메일==ADMIN_EMAIL은 항상 superadmin(env 루트)."""
from __future__ import annotations

import os

import psycopg
from fastapi import Depends, HTTPException

from mrms.api.deps import db_conn, get_current_user_id

ROLES = ("user", "admin", "superadmin")


def get_effective_role(conn: psycopg.Connection, user_id: str) -> str:
    """email==ADMIN_EMAIL이면 'superadmin'(env 루트, 락아웃 불가). 아니면 DB role."""
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
    """admin 또는 superadmin이 아니면 403. 통과 시 user_id 반환."""
    if get_effective_role(conn, user_id) not in ("admin", "superadmin"):
        raise HTTPException(403, "admin required")
    return user_id


def require_superadmin(
    user_id: str = Depends(get_current_user_id),
    conn: psycopg.Connection = Depends(db_conn),
) -> str:
    """superadmin이 아니면 403. 통과 시 user_id 반환."""
    if get_effective_role(conn, user_id) != "superadmin":
        raise HTTPException(403, "superadmin required")
    return user_id
```

- [ ] **Step 4: 통과 확인**

Run: `.venv/bin/pytest tests/auth/test_roles.py -v`
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add src/mrms/auth/roles.py tests/auth/test_roles.py
git commit -m "feat(admin): 유효역할 계산 + require_admin/superadmin 의존성"
```

---

## Task 3: admin_emp 게이트를 role 기반으로 교체

**Files:**
- Modify: `src/mrms/api/admin_emp.py`
- Test: `tests/api/test_admin_emp.py` (회귀 + user 403 케이스 추가)

- [ ] **Step 1: user 403 회귀 테스트 추가**

`tests/api/test_admin_emp.py` 하단에 추가:

```python
def test_admin_emp_stats_forbidden_for_non_admin(login, monkeypatch):
    """ADMIN_EMAIL과 다른 이메일(일반 유저)은 EMP stats 403."""
    user_email = "plain_user_emp@example.com"
    _, session_id = login(user_email)
    monkeypatch.setenv("ADMIN_EMAIL", "different_admin@example.com")
    client.cookies.set("mrms_session", session_id)
    try:
        r = client.get("/api/admin/emp/stats")
        assert r.status_code == 403
    finally:
        client.cookies.clear()
```

- [ ] **Step 2: 실패 확인**

Run: `.venv/bin/pytest tests/api/test_admin_emp.py::test_admin_emp_stats_forbidden_for_non_admin -v`
Expected: 현재는 `_require_admin`도 동일 동작이라 이미 PASS일 수 있음 — 그 경우 Step 3 교체 후에도 PASS 유지가 목표(가드 동등성 회귀). FAIL이면 교체로 해결.

- [ ] **Step 3: `_require_admin` → `require_admin` 의존성 교체**

`src/mrms/api/admin_emp.py`:
- import 수정: `from mrms.api.deps import db_conn, get_current_user_id` → `from mrms.api.deps import db_conn` + `from mrms.auth.roles import require_admin`. (`get_current_user_id`가 이 파일 내 다른 곳에서 안 쓰이면 제거.)
- 파일 내 `def _require_admin(...)` 함수(라인 30~38) 삭제.
- **9개 엔드포인트** 각각에서 `user_id: str = Depends(get_current_user_id),` → `user_id: str = Depends(require_admin),` 로 바꾸고, 본문 첫 줄 `_require_admin(conn, user_id)` 를 삭제. (대상: stats, users, runs, delete_run, prune, get_settings, put_setting, run_mrt, trigger.)

예) stats:
```python
@router.get("/stats")
def admin_stats(
    user_id: str = Depends(require_admin),
    conn: psycopg.Connection = Depends(db_conn),
):
    stats = get_emp_stats(conn)
    runs = list_recent_runs(conn, limit=1)
    stats["last_run"] = runs[0] if runs else None
    return stats
```

(나머지 8개도 동일 패턴: `Depends(require_admin)` + `_require_admin` 호출 줄 제거. 각 함수의 conn/다른 로직은 그대로.)

- [ ] **Step 4: 회귀 + 신규 통과 확인**

Run: `.venv/bin/pytest tests/api/test_admin_emp.py tests/api/test_admin_run_mrt.py -v`
Expected: 전부 passed (기존 admin 테스트 + 새 403 테스트). 기존 테스트는 ADMIN_EMAIL==로그인 이메일이라 effective superadmin → require_admin 통과.

- [ ] **Step 5: ruff + Commit**

Run: `.venv/bin/ruff check src/mrms/api/admin_emp.py`
Expected: 통과(미사용 import 없음).

```bash
git add src/mrms/api/admin_emp.py tests/api/test_admin_emp.py
git commit -m "feat(admin): admin_emp 게이트를 role 기반 require_admin으로 교체"
```

---

## Task 4: 회원·역할 관리 라우터 (`admin_users.py`)

**Files:**
- Create: `src/mrms/api/admin_users.py`
- Modify: `src/mrms/api/main.py` (라우터 등록)
- Test: `tests/api/test_admin_users.py`

- [ ] **Step 1: 실패 테스트 작성**

`tests/api/test_admin_users.py`:

```python
"""회원·역할 관리 API — superadmin 전용."""
import uuid

from fastapi.testclient import TestClient

from mrms.api.main import app

client = TestClient(app)


def _su(login, monkeypatch, cleanup):
    """superadmin(env 루트) 세션 준비. (user_id, session_id, email) 반환."""
    email = f"su-{uuid.uuid4().hex[:8]}@test.com"
    uid, sid = login(email)
    cleanup('DELETE FROM "User" WHERE id = %s', (uid,))
    monkeypatch.setenv("ADMIN_EMAIL", email)
    return uid, sid, email


def test_list_users_superadmin_ok(login, monkeypatch, cleanup):
    _, sid, _ = _su(login, monkeypatch, cleanup)
    tgt, _ = login(f"tgt-{uuid.uuid4().hex[:8]}@test.com")
    cleanup('DELETE FROM "User" WHERE id = %s', (tgt,))
    client.cookies.set("mrms_session", sid)
    try:
        r = client.get("/api/admin/users")
        assert r.status_code == 200, r.text
        ids = [u["user_id"] for u in r.json()["users"]]
        assert tgt in ids
    finally:
        client.cookies.clear()


def test_list_users_forbidden_for_admin(login, monkeypatch, cleanup, db_conn):
    """DB role 'admin'(env 루트 아님)은 회원관리 403."""
    monkeypatch.setenv("ADMIN_EMAIL", "root_only@test.com")
    uid, sid = login(f"adm-{uuid.uuid4().hex[:8]}@test.com")
    cleanup('DELETE FROM "User" WHERE id = %s', (uid,))
    with db_conn.cursor() as cur:
        cur.execute('UPDATE "User" SET role=%s WHERE id=%s', ("admin", uid))
    db_conn.commit()
    client.cookies.set("mrms_session", sid)
    try:
        assert client.get("/api/admin/users").status_code == 403
    finally:
        client.cookies.clear()


def test_set_role_promote_and_demote(login, monkeypatch, cleanup, db_conn):
    _, sid, _ = _su(login, monkeypatch, cleanup)
    tgt, _ = login(f"tgt2-{uuid.uuid4().hex[:8]}@test.com")
    cleanup('DELETE FROM "User" WHERE id = %s', (tgt,))
    client.cookies.set("mrms_session", sid)
    try:
        r = client.patch(f"/api/admin/users/{tgt}/role", json={"role": "admin"})
        assert r.status_code == 200, r.text
        with db_conn.cursor() as cur:
            cur.execute('SELECT role FROM "User" WHERE id=%s', (tgt,))
            assert cur.fetchone()[0] == "admin"
        r2 = client.patch(f"/api/admin/users/{tgt}/role", json={"role": "user"})
        assert r2.status_code == 200
        with db_conn.cursor() as cur:
            cur.execute('SELECT role FROM "User" WHERE id=%s', (tgt,))
            assert cur.fetchone()[0] == "user"
    finally:
        client.cookies.clear()


def test_set_role_forbidden_for_non_superadmin(login, monkeypatch, cleanup):
    monkeypatch.setenv("ADMIN_EMAIL", "root_only2@test.com")
    uid, sid = login(f"u-{uuid.uuid4().hex[:8]}@test.com")
    cleanup('DELETE FROM "User" WHERE id = %s', (uid,))
    tgt, _ = login(f"t-{uuid.uuid4().hex[:8]}@test.com")
    cleanup('DELETE FROM "User" WHERE id = %s', (tgt,))
    client.cookies.set("mrms_session", sid)
    try:
        assert client.patch(f"/api/admin/users/{tgt}/role", json={"role": "admin"}).status_code == 403
    finally:
        client.cookies.clear()


def test_set_role_rejects_superadmin_value(login, monkeypatch, cleanup):
    _, sid, _ = _su(login, monkeypatch, cleanup)
    tgt, _ = login(f"t3-{uuid.uuid4().hex[:8]}@test.com")
    cleanup('DELETE FROM "User" WHERE id = %s', (tgt,))
    client.cookies.set("mrms_session", sid)
    try:
        assert client.patch(f"/api/admin/users/{tgt}/role", json={"role": "superadmin"}).status_code == 422
    finally:
        client.cookies.clear()


def test_set_role_cannot_change_root(login, monkeypatch, cleanup):
    root_uid, sid, _ = _su(login, monkeypatch, cleanup)
    client.cookies.set("mrms_session", sid)
    try:
        # env 루트 자신을 강등 시도 → 403
        assert client.patch(f"/api/admin/users/{root_uid}/role", json={"role": "user"}).status_code == 403
    finally:
        client.cookies.clear()


def test_set_role_unknown_user_404(login, monkeypatch, cleanup):
    _, sid, _ = _su(login, monkeypatch, cleanup)
    client.cookies.set("mrms_session", sid)
    try:
        assert client.patch("/api/admin/users/nope/role", json={"role": "admin"}).status_code == 404
    finally:
        client.cookies.clear()
```

- [ ] **Step 2: 실패 확인**

Run: `.venv/bin/pytest tests/api/test_admin_users.py -v`
Expected: FAIL — 라우트 없음(404 대신 다양). 

- [ ] **Step 3: 라우터 구현**

`src/mrms/api/admin_users.py`:

```python
"""회원·역할 관리 — superadmin 전용."""
from __future__ import annotations

import os
from typing import Literal

import psycopg
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from mrms.api.deps import db_conn
from mrms.auth.roles import require_superadmin

router = APIRouter(prefix="/api/admin/users", tags=["admin_users"])


@router.get("")
def list_users(
    _su: str = Depends(require_superadmin),
    conn: psycopg.Connection = Depends(db_conn),
) -> dict:
    """전체 유저 목록(역할 포함). createdAt 오름차순."""
    admin_email = os.environ.get("ADMIN_EMAIL", "").strip().lower()
    with conn.cursor() as cur:
        cur.execute(
            '''SELECT u.id, u.email, u.nickname, u.role, u."createdAt",
                      count(ut."trackId") AS track_count,
                      (SELECT o.platform FROM "UserOAuth" o
                       WHERE o."userId" = u.id
                       ORDER BY CASE o.platform
                                  WHEN 'tidal' THEN 0 WHEN 'spotify' THEN 1
                                  WHEN 'youtube' THEN 2 ELSE 3 END
                       LIMIT 1) AS primary_platform
               FROM "User" u
               LEFT JOIN "UserTrack" ut ON ut."userId" = u.id
               GROUP BY u.id
               ORDER BY u."createdAt" ASC'''
        )
        rows = cur.fetchall()
    users = []
    for r in rows:
        uid, email, nickname, role, created_at, track_count, primary = r
        eff = (
            "superadmin"
            if admin_email and (email or "").strip().lower() == admin_email
            else (role if role in ("user", "admin", "superadmin") else "user")
        )
        users.append({
            "user_id": uid, "email": email, "nickname": nickname, "role": eff,
            "created_at": created_at.isoformat() if created_at else None,
            "track_count": track_count, "primary_platform": primary,
        })
    return {"users": users}


class RoleUpdate(BaseModel):
    role: Literal["admin", "user"]


@router.patch("/{target_id}/role")
def set_role(
    target_id: str,
    body: RoleUpdate,
    _su: str = Depends(require_superadmin),
    conn: psycopg.Connection = Depends(db_conn),
) -> dict:
    """대상 유저의 DB role 변경(admin↔user). env 루트는 변경 불가."""
    admin_email = os.environ.get("ADMIN_EMAIL", "").strip().lower()
    with conn.cursor() as cur:
        cur.execute('SELECT email FROM "User" WHERE id = %s', (target_id,))
        row = cur.fetchone()
    if not row:
        raise HTTPException(404, "user not found")
    if admin_email and (row[0] or "").strip().lower() == admin_email:
        raise HTTPException(403, "cannot change root admin")
    with conn.cursor() as cur:
        cur.execute('UPDATE "User" SET role = %s WHERE id = %s', (body.role, target_id))
    conn.commit()
    return {"user_id": target_id, "role": body.role}
```

- [ ] **Step 4: 라우터 등록**

`src/mrms/api/main.py` import 블록(다른 admin import 근처)에 추가:
```python
from mrms.api.admin_users import router as admin_users_router
```
`app.include_router(admin_emp_router)` 줄 아래에 추가:
```python
app.include_router(admin_users_router)
```

- [ ] **Step 5: 통과 확인**

Run: `.venv/bin/pytest tests/api/test_admin_users.py -v`
Expected: 7 passed

- [ ] **Step 6: Commit**

```bash
git add src/mrms/api/admin_users.py src/mrms/api/main.py tests/api/test_admin_users.py
git commit -m "feat(admin): 회원·역할 관리 라우터(목록 + role PATCH, superadmin)"
```

---

## Task 5: `/me`·`/api/user`·`UserInfo`에 role 추가

**Files:**
- Modify: `src/mrms/api/schemas.py`, `src/mrms/api/main.py`, `src/mrms/api/auth_session.py`
- Test: `tests/api/test_auth_session.py`

- [ ] **Step 1: 실패 테스트 추가**

`tests/api/test_auth_session.py` 하단에 추가:

```python
def test_me_includes_role(login, monkeypatch, cleanup):
    """env 루트는 /me·/api/user에서 role='superadmin'."""
    import uuid as _u
    email = f"role-{_u.uuid4().hex[:8]}@example.com"
    uid, sid = login(email)
    cleanup('DELETE FROM "User" WHERE id = %s', (uid,))
    monkeypatch.setenv("ADMIN_EMAIL", email)
    client.cookies.set("mrms_session", sid)
    try:
        assert client.get("/api/auth/me").json()["role"] == "superadmin"
        assert client.get("/api/user").json()["role"] == "superadmin"
    finally:
        client.cookies.clear()
```

(이 파일 상단에 `from mrms.api.main import app` / `client = TestClient(app)`는 이미 존재. `login`/`cleanup`/`monkeypatch` fixture 사용.)

- [ ] **Step 2: 실패 확인**

Run: `.venv/bin/pytest tests/api/test_auth_session.py::test_me_includes_role -v`
Expected: FAIL — `KeyError: 'role'`

- [ ] **Step 3: schemas.UserInfo에 role**

`src/mrms/api/schemas.py` `UserInfo`에서 `nickname: str | None = None` 아래에 추가:
```python
class UserInfo(BaseModel):
    user_id: str
    email: str
    nickname: str | None = None
    role: str = "user"
    displayName: str | None = None
```

- [ ] **Step 4: `/api/user`(main.py)에 role**

`src/mrms/api/main.py` `user()` 함수 상단 import는 이미 `from mrms.db.user_track import resolve_primary_platform`. `from mrms.auth.roles import get_effective_role` 추가(파일 import 블록). `user()` 반환부 수정:
```python
    primary_platform = resolve_primary_platform(conn, user_id)
    role = get_effective_role(conn, user_id)
    return UserInfo(
        user_id=user_id,
        email=email,
        nickname=nickname,
        role=role,
        displayName=display_name,
        country=country,
        personas_count=personas_count,
        user_tracks_count=tracks_count,
        primary_platform=primary_platform,
    )
```

- [ ] **Step 5: `/me`(auth_session.py)에 role**

`src/mrms/api/auth_session.py` 상단에 `from mrms.auth.roles import get_effective_role` 추가. `me()` 반환 dict에 role 추가:
```python
    primary_platform = resolve_primary_platform(conn, user_id)
    return {
        "user_id": user_id,
        "email": email,
        "nickname": nickname,
        "role": get_effective_role(conn, user_id),
        "displayName": display_name,
        "country": country,
        "personas_count": personas_count,
        "user_tracks_count": tracks_count,
        "primary_platform": primary_platform,
    }
```

- [ ] **Step 6: 통과 확인**

Run: `.venv/bin/pytest tests/api/test_auth_session.py -v`
Expected: 기존 + 새 테스트 모두 passed.

- [ ] **Step 7: Commit**

```bash
git add src/mrms/api/schemas.py src/mrms/api/main.py src/mrms/api/auth_session.py tests/api/test_auth_session.py
git commit -m "feat(admin): /me·/api/user 응답에 role"
```

---

## Task 6: 프론트 타입 + 관리 API 클라이언트

**Files:**
- Modify: `web/src/lib/types.ts`
- Create: `web/src/lib/api/admin-users.ts`

- [ ] **Step 1: UserInfo.role**

`web/src/lib/types.ts` `interface UserInfo`에서 `nickname: string | null;` 아래 추가:
```ts
export interface UserInfo {
  user_id: string;
  email: string;
  nickname: string | null;
  role: "user" | "admin" | "superadmin";
  displayName: string | null;
```

- [ ] **Step 2: admin-users API 클라이언트**

`web/src/lib/api/admin-users.ts`:
```ts
import { apiFetch } from "./http";

export interface AdminUser {
  user_id: string;
  email: string;
  nickname: string | null;
  role: "user" | "admin" | "superadmin";
  created_at: string | null;
  track_count: number;
  primary_platform: "tidal" | "spotify" | "youtube" | null;
}

export async function fetchAdminUsers(): Promise<AdminUser[]> {
  const r = await apiFetch("/api/admin/users", {}, "admin users");
  return (await r.json()).users;
}

export async function setUserRole(
  userId: string,
  role: "admin" | "user",
): Promise<void> {
  await apiFetch(
    `/api/admin/users/${userId}/role`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    },
    "set role",
  );
}
```

- [ ] **Step 3: 타입 체크 + Commit**

Run: `cd "/Volumes/MacExtend 1/MRMS_FN/web" && npx tsc --noEmit`
Expected: 에러 없음.

```bash
git add web/src/lib/types.ts web/src/lib/api/admin-users.ts
git commit -m "feat(admin): UserInfo.role + 회원관리 API 클라이언트"
```

---

## Task 7: 사이드바 역할 게이팅

**Files:**
- Modify: `web/src/lib/nav.ts`, `web/src/components/layout/app-sidebar.tsx`

- [ ] **Step 1: NavItem.minRole + 회원관리 항목**

`web/src/lib/nav.ts` `NavItem` 타입에 `minRole?` 추가:
```ts
export type NavItem = {
  title: string;
  href: string;
  num: string;
  full?: string;
  badge?: string;
  children?: NavSubItem[];
  minRole?: "admin" | "superadmin";  // 이 역할 이상만 사이드바 노출
};
```

`Settings` 그룹의 "EMP admin" 항목에 `minRole: "admin"` 추가하고, 그 아래 "회원 관리" 항목 추가:
```ts
      { title: "EMP admin", href: "/admin/emp", num: "S3", badge: "·", minRole: "admin" },
      { title: "회원 관리", href: "/admin/users", num: "S4", badge: "·", minRole: "superadmin" },
      { title: "About", href: "/about", num: "S5", badge: "v0.7" },
```
(About의 num을 S4→S5로 조정.)

- [ ] **Step 2: app-sidebar에서 role 필터**

`web/src/components/layout/app-sidebar.tsx`에서 `navGroups.map` 직전에 역할 순위 + 필터 헬퍼를 추가하고, 각 group의 items를 필터한다. `import { navGroups } from "@/lib/nav";` 아래에:
```ts
const ROLE_RANK: Record<string, number> = { user: 0, admin: 1, superadmin: 2 };
```
`AppSidebar` 본문에서 `const { user } = useUser();` 아래:
```ts
  const myRank = ROLE_RANK[user?.role ?? "user"] ?? 0;
  const visibleGroups = navGroups
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => !i.minRole || myRank >= ROLE_RANK[i.minRole]),
    }))
    .filter((g) => g.items.length > 0);
```
그리고 렌더의 `{navGroups.map((group) => (` 를 `{visibleGroups.map((group) => (` 로 교체. (group.items.length 카운트도 자동으로 필터 반영됨.)

- [ ] **Step 3: 타입 체크 + Commit**

Run: `cd "/Volumes/MacExtend 1/MRMS_FN/web" && npx tsc --noEmit`
Expected: 에러 없음.

```bash
git add web/src/lib/nav.ts web/src/components/layout/app-sidebar.tsx
git commit -m "feat(admin): 사이드바 admin 메뉴 역할 게이팅"
```

---

## Task 8: /admin 라우트 가드 + 회원관리 페이지

**Files:**
- Create: `web/src/app/(dashboard)/admin/layout.tsx`, `web/src/app/(dashboard)/admin/users/page.tsx`, `web/src/components/admin/AdminUsersClient.tsx`

- [ ] **Step 1: admin 레이아웃 가드(admin+)**

`web/src/app/(dashboard)/admin/layout.tsx`:
```tsx
import { redirect } from "next/navigation";

import { getServerSideUser } from "@/lib/server/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerSideUser(); // 미로그인 시 내부에서 /login redirect
  if (user.role !== "admin" && user.role !== "superadmin") redirect("/");
  return <>{children}</>;
}
```

- [ ] **Step 2: 회원관리 페이지(superadmin 가드) + 클라이언트**

`web/src/app/(dashboard)/admin/users/page.tsx`:
```tsx
import { redirect } from "next/navigation";

import { AdminUsersClient } from "@/components/admin/AdminUsersClient";
import { getServerSideUser } from "@/lib/server/auth";

export default async function AdminUsersPage() {
  const user = await getServerSideUser();
  if (user.role !== "superadmin") redirect("/admin/emp");
  return <AdminUsersClient />;
}
```

`web/src/components/admin/AdminUsersClient.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";

import { fetchAdminUsers, setUserRole, type AdminUser } from "@/lib/api/admin-users";

export function AdminUsersClient() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    fetchAdminUsers().then(setUsers).catch((e) => setError((e as Error).message));
  }, []);

  async function toggle(u: AdminUser) {
    const next = u.role === "admin" ? "user" : "admin";
    setBusy(u.user_id);
    setError(null);
    const prev = users;
    setUsers((list) => list.map((x) => (x.user_id === u.user_id ? { ...x, role: next } : x)));
    try {
      await setUserRole(u.user_id, next);
    } catch (e) {
      setUsers(prev); // 롤백
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-[900px] px-4 py-8">
      <h1 className="font-display font-bold text-(--mrms-ink) text-[26px] mb-1">회원 관리</h1>
      <p className="font-mono text-[11px] tracking-editorial uppercase text-(--mrms-ink-mute) mb-6">
        Members · {users.length}
      </p>
      {error && (
        <div className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
      )}
      <div className="border-t border-(--mrms-ink)">
        {users.map((u) => {
          const isRoot = u.role === "superadmin";
          return (
            <div
              key={u.user_id}
              className="grid grid-cols-[1fr_auto_auto] gap-3 items-center py-2.5 border-b border-(--mrms-rule)"
            >
              <div className="min-w-0">
                <div className="font-display font-semibold text-[14px] truncate" title={u.email}>
                  {u.nickname || u.email}
                </div>
                <div className="font-mono text-[10px] text-(--mrms-ink-mute) truncate">
                  {u.email} · {u.primary_platform ?? "no platform"} · {u.track_count} tracks
                </div>
              </div>
              <span className="font-mono text-[10px] tracking-editorial uppercase text-(--mrms-ink-soft)">
                {u.role}
              </span>
              <button
                onClick={() => toggle(u)}
                disabled={isRoot || busy === u.user_id}
                className="font-mono text-[10px] tracking-editorial uppercase border border-(--mrms-ink) px-2.5 py-1 cursor-pointer disabled:opacity-30 disabled:cursor-default hover:bg-(--mrms-ink) hover:text-(--mrms-paper)"
              >
                {isRoot ? "root" : u.role === "admin" ? "관리자 해임" : "관리자 임명"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 타입 체크 + 빌드**

Run: `cd "/Volumes/MacExtend 1/MRMS_FN/web" && npx tsc --noEmit && pnpm build`
Expected: tsc 에러 없음, `Compiled successfully`. `/admin/users` 라우트 생성 확인.

- [ ] **Step 4: Commit**

```bash
git add web/src/app/\(dashboard\)/admin/layout.tsx web/src/app/\(dashboard\)/admin/users/ web/src/components/admin/AdminUsersClient.tsx
git commit -m "feat(admin): /admin 라우트 가드 + 회원관리 페이지(superadmin)"
```

---

## 최종 검증 (모든 태스크 후)

- [ ] **백엔드(대상 파일만)**:
```bash
cd "/Volumes/MacExtend 1/MRMS_FN" && .venv/bin/pytest \
  tests/auth/test_roles.py tests/api/test_admin_users.py \
  tests/api/test_admin_emp.py tests/api/test_admin_run_mrt.py tests/api/test_auth_session.py -v
```
Expected: 전부 passed.

- [ ] **프론트**: `cd web && npx tsc --noEmit && pnpm build` → 성공, `/admin/users` 라우트 존재.

- [ ] **ruff**: `.venv/bin/ruff check src/mrms/auth/roles.py src/mrms/api/admin_users.py src/mrms/api/admin_emp.py` → 통과.

## 배포 시 주의 (운영 작업, 구현 범위 밖)

- prod superadmin 활성화: 서버 백엔드 env에 `ADMIN_EMAIL=imapplepie20@gmail.com` 설정 + 백엔드 재시작 + 그 이메일로 가입(계정 존재). 이미 `.env.example`에 문서화됨.
- 마이그레이션은 배포 파이프라인이 `prisma/migrations` 적용(비파괴적).
