# 이메일/비밀번호 로그인 + 플랫폼 연결 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** OAuth 전용 로그인을 닉네임/이메일/비밀번호 계정으로 바꾸고, 스트리밍 플랫폼(Tidal/Spotify/YouTube)을 그 계정에 "연결"하는 리소스로 만든다(가입 마무리에 플랫폼 1개 이상 연결 필수).

**Architecture:** 이메일/비밀번호가 본 계정(Model X). 세션은 기존 `mrms_session` 쿠키 + `AuthSession` 테이블 재사용. OAuth 콜백은 더 이상 유저/세션을 만들지 않고 "현재 세션 유저에 플랫폼 링크"만 한다(링크 모드). 미연결(`primary_platform == null`) 유저는 서버 게이트로 `/connect`에 묶인다.

**Tech Stack:** Python FastAPI + raw psycopg(no ORM), bcrypt(신규), Prisma(스키마/마이그레이션), Next.js 16(App Router, `(auth)`/`(dashboard)` route groups). 백엔드 테스트 `.venv/bin/pytest`(로컬 PG :5433), 프론트 검증 `npx tsc --noEmit` + `pnpm build`.

**테스트/DB 규약 (필수 준수):**
- DB 격리 안 됨 → **전체 pytest 금지**, 대상 파일만 실행.
- 외부 호출은 mock/respx로 차단(bcrypt·DB는 로컬 실호출 OK).
- 헬퍼가 commit하면 롤백 보호 안 됨 → `cleanup` fixture로 생성 행 정리(FK 역순).
- push/merge 금지(배포는 사용자 "일푸" 시 컨트롤러가).

**런너 경로:** 백엔드 `cd "/Volumes/MacExtend 1/MRMS_FN" && .venv/bin/pytest <file> -v`. 프론트 `cd "/Volumes/MacExtend 1/MRMS_FN/web" && npx tsc --noEmit && pnpm build`.

---

## File Structure

생성:
- `src/mrms/auth/password.py` — bcrypt hash/verify.
- `src/mrms/db/account.py` — 계정 생성/조회 헬퍼.
- `src/mrms/api/auth_account.py` — `POST /api/auth/signup`·`/login` 라우터.
- `prisma/migrations/20260617130000_auth_email_password/migration.sql` — nickname/passwordHash 컬럼 + unique index(비파괴적).
- `tests/auth/test_password.py` — password 모듈 단위.
- `tests/api/test_auth_account.py` — signup/login 통합.
- `web/src/components/auth/PlatformConnect.tsx` — 공용 플랫폼 연결 UI.
- `web/src/app/(auth)/connect/page.tsx` — 하드게이트 착지 페이지.

수정:
- `prisma/schema.prisma` — User에 `nickname String? @unique`, `passwordHash String?`.
- `src/mrms/api/auth_account.py` 등록 → `src/mrms/api/main.py`.
- `src/mrms/api/schemas.py` — `UserInfo.nickname`.
- `src/mrms/api/main.py` `/api/user` — nickname select/반환.
- `src/mrms/api/auth_session.py` — `/me`에 nickname, Tidal poll 링크 모드.
- `src/mrms/api/auth_spotify.py` — callback 링크 모드(+authorize 가드).
- `src/mrms/api/auth_youtube.py` — callback 링크 모드(+authorize 가드).
- `tests/api/test_auth_session.py` — Tidal poll 링크 모드로 테스트 수정.
- `web/src/lib/types.ts` — `UserInfo.nickname`.
- `web/src/app/(auth)/login/page.tsx` — 이메일/비밀번호 폼.
- `web/src/app/(auth)/register/page.tsx` — 2단계 마법사.
- `web/src/app/(auth)/onboarding/page.tsx` — connect 목적지 `/login`→`/connect`.
- `web/src/app/(dashboard)/layout.tsx` — 하드 게이트.
- `web/src/app/page.tsx` — root 로그인 분기 하드 게이트.
- `pyproject.toml` — `bcrypt>=4`.

---

## Task 1: Prisma 스키마 + 비파괴적 마이그레이션 (nickname/passwordHash 컬럼)

이 태스크가 먼저여야 이후 account/signup 테스트가 통과한다(컬럼 존재 필요). 추가 컬럼은 nullable이라 로컬 테스트 DB에 안전 적용.

**Files:**
- Modify: `prisma/schema.prisma` (User 모델)
- Create: `prisma/migrations/20260617130000_auth_email_password/migration.sql`

- [ ] **Step 1: schema.prisma User에 컬럼 추가**

`model User { ... }`에서 `displayName String?` 줄 아래에 두 줄 추가:

```prisma
  email           String   @unique
  nickname        String?  @unique
  passwordHash    String?
  displayName     String?
```

(기존 필드 순서는 유지하되 nickname/passwordHash 두 줄만 삽입. 다른 필드/관계는 변경 금지.)

- [ ] **Step 2: 마이그레이션 SQL 작성**

`prisma/migrations/20260617130000_auth_email_password/migration.sql`:

```sql
-- 이메일/비밀번호 로그인: 계정 자격 컬럼 추가(비파괴적, nullable).
-- 그린필드 리셋(TRUNCATE)은 배포 시 별도 사용자-게이트 단계로 분리(이 파일엔 없음).
ALTER TABLE "User" ADD COLUMN "nickname" TEXT;
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;
CREATE UNIQUE INDEX "User_nickname_key" ON "User"("nickname");
```

- [ ] **Step 3: 로컬 테스트 DB에 적용**

Run:
```bash
psql "${DATABASE_URL:-postgresql://mrms:mrms@localhost:5433/mrms}" \
  -f "prisma/migrations/20260617130000_auth_email_password/migration.sql"
```
Expected: `ALTER TABLE` ×2, `CREATE INDEX` 출력. (이미 있으면 "column already exists" — 그 경우 무시하고 다음.)

- [ ] **Step 4: 컬럼 확인**

Run:
```bash
psql "${DATABASE_URL:-postgresql://mrms:mrms@localhost:5433/mrms}" \
  -c '\d "User"' | grep -E "nickname|passwordHash"
```
Expected: `nickname  | text` 와 `passwordHash | text` 출력.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260617130000_auth_email_password/
git commit -m "feat(auth): User에 nickname/passwordHash 컬럼 추가 마이그레이션"
```

---

## Task 2: 비밀번호 해싱 모듈 (bcrypt)

**Files:**
- Modify: `pyproject.toml`
- Create: `src/mrms/auth/password.py`
- Test: `tests/auth/test_password.py`

- [ ] **Step 1: bcrypt 의존성 추가 + 설치**

`pyproject.toml` dependencies의 `# API clients` 블록 끝(`"yt-dlp>=2026.6",` 아래)에 추가:

```toml
    "yt-dlp>=2026.6",
    "bcrypt>=4",
```

Run: `.venv/bin/pip install "bcrypt>=4"`
Expected: `Successfully installed bcrypt-4.x`

- [ ] **Step 2: 실패 테스트 작성**

`tests/auth/test_password.py`:

```python
"""bcrypt 해시/검증 단위."""
from mrms.auth.password import hash_password, verify_password


def test_hash_then_verify_roundtrip():
    h = hash_password("s3cret-pw")
    assert h != "s3cret-pw"          # 평문이 아님
    assert verify_password("s3cret-pw", h) is True


def test_verify_wrong_password():
    h = hash_password("s3cret-pw")
    assert verify_password("wrong", h) is False


def test_verify_malformed_hash_returns_false():
    assert verify_password("anything", "not-a-bcrypt-hash") is False
```

- [ ] **Step 3: 실패 확인**

Run: `.venv/bin/pytest tests/auth/test_password.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'mrms.auth.password'`

- [ ] **Step 4: 구현**

`src/mrms/auth/password.py`:

```python
"""비밀번호 해싱 — bcrypt."""
from __future__ import annotations

import bcrypt


def hash_password(plain: str) -> str:
    """평문 비밀번호 → bcrypt 해시 문자열."""
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """평문이 해시와 일치하면 True. 해시 형식이 깨졌으면 False(예외 삼킴)."""
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False
```

- [ ] **Step 5: 통과 확인**

Run: `.venv/bin/pytest tests/auth/test_password.py -v`
Expected: 3 passed

- [ ] **Step 6: Commit**

```bash
git add pyproject.toml src/mrms/auth/password.py tests/auth/test_password.py
git commit -m "feat(auth): bcrypt 비밀번호 해시/검증 모듈"
```

---

## Task 3: 계정 DB 헬퍼 (`db/account.py`)

**Files:**
- Create: `src/mrms/db/account.py`
- Test: `tests/api/test_auth_account.py` (이 태스크에선 헬퍼 단위만, signup 엔드포인트는 Task 4)

- [ ] **Step 1: 실패 테스트 작성**

`tests/api/test_auth_account.py` (헬퍼 단위 3개부터):

```python
"""계정 헬퍼 + signup/login 엔드포인트."""
import uuid

from mrms.db.account import (
    create_account, get_account_by_email, email_exists, nickname_exists,
)
from mrms.auth.password import hash_password


def _email():
    return f"acct-{uuid.uuid4().hex[:10]}@example.com"


def test_create_account_then_lookup(db_conn, cleanup):
    email = _email()
    cleanup('DELETE FROM "User" WHERE email = %s', (email,))
    uid = create_account(
        db_conn, nickname=f"nick_{uuid.uuid4().hex[:6]}",
        email=email, password_hash=hash_password("pw12345678"),
    )
    db_conn.commit()
    row = get_account_by_email(db_conn, email)
    assert row is not None
    assert row["id"] == uid
    assert row["password_hash"] is not None
    # displayName == nickname
    with db_conn.cursor() as cur:
        cur.execute('SELECT "displayName", nickname FROM "User" WHERE id=%s', (uid,))
        display, nick = cur.fetchone()
    assert display == nick


def test_email_and_nickname_exists_case_insensitive(db_conn, cleanup):
    email = _email()
    nick = f"Case_{uuid.uuid4().hex[:6]}"
    cleanup('DELETE FROM "User" WHERE email = %s', (email,))
    create_account(db_conn, nickname=nick, email=email,
                   password_hash=hash_password("pw12345678"))
    db_conn.commit()
    assert email_exists(db_conn, email.upper()) is True
    assert nickname_exists(db_conn, nick.upper()) is True
    assert email_exists(db_conn, _email()) is False
    assert nickname_exists(db_conn, f"absent_{uuid.uuid4().hex[:6]}") is False


def test_get_account_by_email_missing_returns_none(db_conn):
    assert get_account_by_email(db_conn, _email()) is None
```

- [ ] **Step 2: 실패 확인**

Run: `.venv/bin/pytest tests/api/test_auth_account.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'mrms.db.account'`

- [ ] **Step 3: 구현**

`src/mrms/db/account.py`:

```python
"""이메일/비밀번호 계정 DB ops. commit은 호출부 책임(get_or_create_user 패턴)."""
from __future__ import annotations

import psycopg

from mrms.db.ids import stable_id as _id


def create_account(
    conn: psycopg.Connection, *, nickname: str, email: str, password_hash: str
) -> str:
    """User insert(이메일은 소문자 정규화). displayName=nickname. user_id 반환.

    이메일/닉네임 중복 시 psycopg UniqueViolation 전파 — 호출부에서 사전 검증 권장.
    """
    email_norm = email.strip().lower()
    user_id = _id(f"user|{email_norm}")
    with conn.cursor() as cur:
        cur.execute(
            '''INSERT INTO "User"
                 (id, email, nickname, "passwordHash", "displayName", "createdAt")
               VALUES (%s, %s, %s, %s, %s, NOW())''',
            (user_id, email_norm, nickname, password_hash, nickname),
        )
    return user_id


def get_account_by_email(conn: psycopg.Connection, email: str) -> dict | None:
    """로그인용 — id/passwordHash/nickname 반환(이메일 대소문자 무시). 없으면 None."""
    with conn.cursor() as cur:
        cur.execute(
            'SELECT id, "passwordHash", nickname FROM "User" WHERE lower(email) = lower(%s)',
            (email.strip(),),
        )
        row = cur.fetchone()
    if row is None:
        return None
    return {"id": row[0], "password_hash": row[1], "nickname": row[2]}


def email_exists(conn: psycopg.Connection, email: str) -> bool:
    with conn.cursor() as cur:
        cur.execute('SELECT 1 FROM "User" WHERE lower(email) = lower(%s)', (email.strip(),))
        return cur.fetchone() is not None


def nickname_exists(conn: psycopg.Connection, nickname: str) -> bool:
    with conn.cursor() as cur:
        cur.execute('SELECT 1 FROM "User" WHERE lower(nickname) = lower(%s)', (nickname.strip(),))
        return cur.fetchone() is not None
```

- [ ] **Step 4: 통과 확인**

Run: `.venv/bin/pytest tests/api/test_auth_account.py -v`
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add src/mrms/db/account.py tests/api/test_auth_account.py
git commit -m "feat(auth): 계정 생성/조회 DB 헬퍼"
```

---

## Task 4: signup/login 엔드포인트 (`api/auth_account.py`)

**Files:**
- Create: `src/mrms/api/auth_account.py`
- Modify: `src/mrms/api/main.py` (라우터 등록)
- Test: `tests/api/test_auth_account.py` (엔드포인트 케이스 추가)

- [ ] **Step 1: 실패 테스트 추가**

`tests/api/test_auth_account.py` 하단에 추가(상단 import에 `from fastapi.testclient import TestClient` / `from mrms.api.main import app` / `client = TestClient(app)` 추가):

```python
from fastapi.testclient import TestClient
from mrms.api.main import app

client = TestClient(app)


def test_signup_success_sets_session_and_hashes(db_conn, cleanup):
    email = _email()
    nick = f"signup_{uuid.uuid4().hex[:6]}"
    cleanup('DELETE FROM "User" WHERE email = %s', (email.lower(),))
    client.cookies.clear()
    r = client.post("/api/auth/signup",
                    json={"nickname": nick, "email": email, "password": "pw12345678"})
    client.cookies.clear()
    assert r.status_code == 200, r.text
    assert r.json()["nickname"] == nick
    assert "mrms_session" in r.cookies
    with db_conn.cursor() as cur:
        cur.execute('SELECT "passwordHash" FROM "User" WHERE lower(email)=lower(%s)', (email,))
        ph = cur.fetchone()[0]
    assert ph and ph != "pw12345678"          # 해시됨


def test_signup_duplicate_email_409(db_conn, cleanup):
    email = _email()
    cleanup('DELETE FROM "User" WHERE email = %s', (email.lower(),))
    create_account(db_conn, nickname=f"e_{uuid.uuid4().hex[:6]}", email=email,
                   password_hash=hash_password("pw12345678"))
    db_conn.commit()
    client.cookies.clear()
    r = client.post("/api/auth/signup",
                    json={"nickname": f"new_{uuid.uuid4().hex[:6]}",
                          "email": email, "password": "pw12345678"})
    assert r.status_code == 409
    assert r.json()["detail"] == "email_taken"


def test_signup_duplicate_nickname_409_case_insensitive(db_conn, cleanup):
    nick = f"Dup_{uuid.uuid4().hex[:6]}"
    email1 = _email()
    cleanup('DELETE FROM "User" WHERE email = %s', (email1.lower(),))
    create_account(db_conn, nickname=nick, email=email1,
                   password_hash=hash_password("pw12345678"))
    db_conn.commit()
    client.cookies.clear()
    r = client.post("/api/auth/signup",
                    json={"nickname": nick.upper(), "email": _email(),
                          "password": "pw12345678"})
    assert r.status_code == 409
    assert r.json()["detail"] == "nickname_taken"


def test_signup_weak_password_422():
    client.cookies.clear()
    r = client.post("/api/auth/signup",
                    json={"nickname": f"w_{uuid.uuid4().hex[:6]}",
                          "email": _email(), "password": "short"})
    assert r.status_code == 422


def test_login_success(db_conn, cleanup):
    email = _email()
    cleanup('DELETE FROM "User" WHERE email = %s', (email.lower(),))
    create_account(db_conn, nickname=f"l_{uuid.uuid4().hex[:6]}", email=email,
                   password_hash=hash_password("pw12345678"))
    db_conn.commit()
    client.cookies.clear()
    r = client.post("/api/auth/login", json={"email": email, "password": "pw12345678"})
    client.cookies.clear()
    assert r.status_code == 200, r.text
    assert "mrms_session" in r.cookies


def test_login_wrong_password_401(db_conn, cleanup):
    email = _email()
    cleanup('DELETE FROM "User" WHERE email = %s', (email.lower(),))
    create_account(db_conn, nickname=f"lw_{uuid.uuid4().hex[:6]}", email=email,
                   password_hash=hash_password("pw12345678"))
    db_conn.commit()
    client.cookies.clear()
    r = client.post("/api/auth/login", json={"email": email, "password": "WRONG"})
    assert r.status_code == 401
    assert r.json()["detail"] == "invalid_credentials"


def test_login_unknown_email_401():
    client.cookies.clear()
    r = client.post("/api/auth/login", json={"email": _email(), "password": "whatever12"})
    assert r.status_code == 401
    assert r.json()["detail"] == "invalid_credentials"
```

- [ ] **Step 2: 실패 확인**

Run: `.venv/bin/pytest tests/api/test_auth_account.py -v`
Expected: FAIL — signup/login은 404(라우트 없음).

- [ ] **Step 3: 엔드포인트 구현**

`src/mrms/api/auth_account.py`:

```python
"""이메일/비밀번호 계정 — signup/login. 세션은 기존 AuthSession 쿠키 재사용."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import psycopg
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr, Field

from mrms.api.deps import db_conn
from mrms.auth.password import hash_password, verify_password
from mrms.db.account import (
    create_account, email_exists, get_account_by_email, nickname_exists,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

SESSION_COOKIE_NAME = "mrms_session"
SESSION_MAX_AGE = 30 * 24 * 60 * 60  # 30 days


class SignupRequest(BaseModel):
    nickname: str = Field(min_length=2, max_length=20)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


def _issue_session(conn: psycopg.Connection, response: Response, request: Request, user_id: str) -> None:
    """AuthSession 1개 생성(기존 세션 삭제) + mrms_session 쿠키 set."""
    session_id = uuid.uuid4().hex
    expires = datetime.now(timezone.utc) + timedelta(seconds=SESSION_MAX_AGE)
    with conn.cursor() as cur:
        cur.execute('DELETE FROM "AuthSession" WHERE "userId" = %s', (user_id,))
        cur.execute(
            'INSERT INTO "AuthSession" (id, "userId", "expiresAt", "userAgent") VALUES (%s, %s, %s, %s)',
            (session_id, user_id, expires, request.headers.get("user-agent")),
        )
    conn.commit()
    response.set_cookie(
        key=SESSION_COOKIE_NAME, value=session_id, httponly=True,
        samesite="lax", max_age=SESSION_MAX_AGE, secure=False,  # prod는 True
    )


@router.post("/signup")
def signup(
    body: SignupRequest, request: Request, response: Response,
    conn: psycopg.Connection = Depends(db_conn),
) -> dict:
    """닉네임/이메일/비밀번호로 계정 생성 + 세션. 중복은 409."""
    if email_exists(conn, body.email):
        raise HTTPException(409, "email_taken")
    if nickname_exists(conn, body.nickname):
        raise HTTPException(409, "nickname_taken")
    user_id = create_account(
        conn, nickname=body.nickname.strip(), email=body.email,
        password_hash=hash_password(body.password),
    )
    conn.commit()
    _issue_session(conn, response, request, user_id)
    return {"user_id": user_id, "nickname": body.nickname.strip(), "email": str(body.email).lower()}


@router.post("/login")
def login(
    body: LoginRequest, request: Request, response: Response,
    conn: psycopg.Connection = Depends(db_conn),
) -> dict:
    """이메일+비밀번호 검증 → 세션. 실패는 401(이메일 존재 여부 비노출)."""
    acct = get_account_by_email(conn, body.email)
    if not acct or not acct["password_hash"] or not verify_password(body.password, acct["password_hash"]):
        raise HTTPException(401, "invalid_credentials")
    _issue_session(conn, response, request, acct["id"])
    return {"user_id": acct["id"], "nickname": acct["nickname"], "email": str(body.email).lower()}
```

- [ ] **Step 4: 라우터 등록**

`src/mrms/api/main.py` import 블록(다른 `auth_*` import 근처)에 추가:

```python
from mrms.api.auth_account import router as auth_account_router
```

`app.include_router(auth_session_router)` 줄 **위**에 추가:

```python
app.include_router(auth_account_router)
```

- [ ] **Step 5: 통과 확인**

Run: `.venv/bin/pytest tests/api/test_auth_account.py -v`
Expected: 모두 passed (헬퍼 3 + 엔드포인트 7 = 10 passed)

- [ ] **Step 6: Commit**

```bash
git add src/mrms/api/auth_account.py src/mrms/api/main.py tests/api/test_auth_account.py
git commit -m "feat(auth): signup/login 엔드포인트(이메일/비밀번호)"
```

---

## Task 5: `/me`·`/api/user`·`UserInfo`에 nickname 추가

**Files:**
- Modify: `src/mrms/api/schemas.py`, `src/mrms/api/main.py`, `src/mrms/api/auth_session.py`
- Test: `tests/api/test_auth_session.py` (nickname 검증 추가)

- [ ] **Step 1: 실패 테스트 추가**

`tests/api/test_auth_session.py` 하단에 추가:

```python
def test_me_includes_nickname(db_conn, cleanup):
    """signup으로 만든 계정의 /me·/api/user에 nickname 포함."""
    import uuid as _u
    from mrms.db.account import create_account
    from mrms.auth.password import hash_password

    email = f"nick-{_u.uuid4().hex[:8]}@example.com"
    nick = f"NK_{_u.uuid4().hex[:6]}"
    cleanup('DELETE FROM "User" WHERE email = %s', (email.lower(),))
    user_id = create_account(db_conn, nickname=nick, email=email,
                             password_hash=hash_password("pw12345678"))
    session_id = _u.uuid4().hex
    expires_at = datetime.now(timezone.utc) + timedelta(days=30)
    with db_conn.cursor() as cur:
        cur.execute('INSERT INTO "AuthSession" (id, "userId", "expiresAt") VALUES (%s, %s, %s)',
                    (session_id, user_id, expires_at))
    db_conn.commit()

    client.cookies.set("mrms_session", session_id)
    r1 = client.get("/api/auth/me")
    r2 = client.get("/api/user")
    client.cookies.clear()
    assert r1.json()["nickname"] == nick
    assert r2.json()["nickname"] == nick
```

- [ ] **Step 2: 실패 확인**

Run: `.venv/bin/pytest tests/api/test_auth_session.py::test_me_includes_nickname -v`
Expected: FAIL — `KeyError: 'nickname'` (응답에 없음)

- [ ] **Step 3: schemas.UserInfo에 nickname 추가**

`src/mrms/api/schemas.py` `UserInfo`에서 `email: str` 아래에 추가:

```python
class UserInfo(BaseModel):
    user_id: str
    email: str
    nickname: str | None = None
    displayName: str | None = None
```

- [ ] **Step 4: `/api/user` (main.py) nickname select/반환**

`src/mrms/api/main.py` `user()` 함수에서 SELECT와 반환 수정:

```python
        cur.execute(
            'SELECT email, nickname, "displayName", country FROM "User" WHERE id = %s',
            (user_id,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "User not found")
        email, nickname, display_name, country = row
```

그리고 `return UserInfo(`에 `nickname=nickname,` 추가:

```python
    return UserInfo(
        user_id=user_id,
        email=email,
        nickname=nickname,
        displayName=display_name,
        country=country,
        personas_count=personas_count,
        user_tracks_count=tracks_count,
        primary_platform=primary_platform,
    )
```

- [ ] **Step 5: `/me` (auth_session.py) nickname 추가**

`src/mrms/api/auth_session.py` `me()` 함수의 SELECT·반환 수정:

```python
        cur.execute('SELECT email, nickname, "displayName", country FROM "User" WHERE id = %s', (user_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "User not found")
        email, nickname, display_name, country = row
```

반환 dict에 `"nickname": nickname,` 추가:

```python
    return {
        "user_id": user_id,
        "email": email,
        "nickname": nickname,
        "displayName": display_name,
        "country": country,
        "personas_count": personas_count,
        "user_tracks_count": tracks_count,
        "primary_platform": primary_platform,
    }
```

- [ ] **Step 6: 통과 확인**

Run: `.venv/bin/pytest tests/api/test_auth_session.py -v`
Expected: 기존 + 새 테스트 모두 passed (이 단계에서 기존 Tidal poll 테스트는 아직 그대로 — Task 6에서 수정).

- [ ] **Step 7: Commit**

```bash
git add src/mrms/api/schemas.py src/mrms/api/main.py src/mrms/api/auth_session.py tests/api/test_auth_session.py
git commit -m "feat(auth): /me·/api/user 응답에 nickname"
```

---

## Task 6: OAuth 콜백 링크 모드 (유저/세션 생성 제거)

OAuth는 더 이상 로그인/가입 수단이 아니라 "현재 세션 유저에 플랫폼 연결". 세션 없으면 거부.

**Files:**
- Modify: `src/mrms/api/auth_session.py` (Tidal poll)
- Modify: `src/mrms/api/auth_spotify.py` (callback)
- Modify: `src/mrms/api/auth_youtube.py` (callback)
- Test: `tests/api/test_auth_session.py` (Tidal poll 테스트 교체)

- [ ] **Step 1: Tidal poll 테스트 링크 모드로 교체**

`tests/api/test_auth_session.py`의 `test_device_code_poll_success_creates_session`를 아래로 **교체**(이름도 변경), 그리고 미로그인 거부 테스트 추가:

```python
def test_device_code_poll_links_to_current_user(db_conn, cleanup):
    """세션 있으면 그 유저에 tidal 연결(새 유저/세션 생성 안 함)."""
    from mrms.db.user_track import get_or_create_user
    import uuid as _u

    email = f"link-{_u.uuid4().hex[:8]}@example.com"
    cleanup('DELETE FROM "User" WHERE email = %s', (email,))
    user_id = get_or_create_user(db_conn, email)
    session_id = _u.uuid4().hex
    expires_at = datetime.now(timezone.utc) + timedelta(days=30)
    with db_conn.cursor() as cur:
        cur.execute('INSERT INTO "AuthSession" (id, "userId", "expiresAt") VALUES (%s, %s, %s)',
                    (session_id, user_id, expires_at))
    db_conn.commit()

    jwt = _make_tidal_jwt(uid=12345)
    fake_response = AsyncMock()
    fake_response.status_code = 200
    fake_response.json = lambda: {"access_token": jwt, "refresh_token": "rx", "expires_in": 86400}
    client.cookies.set("mrms_session", session_id)
    with patch("httpx.AsyncClient.post", return_value=fake_response):
        r = client.post("/api/auth/tidal/device-code/poll", json={"device_code": "DEVICE_XYZ"})
    client.cookies.clear()
    assert r.status_code == 200
    assert r.json()["status"] == "success"
    with db_conn.cursor() as cur:
        cur.execute('SELECT "accessToken" FROM "UserOAuth" WHERE "userId"=%s AND platform=%s',
                    (user_id, "tidal"))
        assert cur.fetchone()[0] == jwt
        # tidal-12345@auto.local 새 유저가 생기지 않았다
        cur.execute('SELECT COUNT(*) FROM "User" WHERE email=%s', ("tidal-12345@auto.local",))
        assert cur.fetchone()[0] == 0


def test_device_code_poll_without_session_rejected(db_conn):
    """세션 없으면 연결 거부(error/login_required) — 새 유저 생성 안 함."""
    jwt = _make_tidal_jwt(uid=55555)
    fake_response = AsyncMock()
    fake_response.status_code = 200
    fake_response.json = lambda: {"access_token": jwt, "refresh_token": "rx", "expires_in": 86400}
    client.cookies.clear()
    with patch("httpx.AsyncClient.post", return_value=fake_response):
        r = client.post("/api/auth/tidal/device-code/poll", json={"device_code": "DEVICE_XYZ"})
    assert r.status_code == 200
    assert r.json()["status"] == "error"
    with db_conn.cursor() as cur:
        cur.execute('SELECT COUNT(*) FROM "User" WHERE email=%s', ("tidal-55555@auto.local",))
        assert cur.fetchone()[0] == 0
```

- [ ] **Step 2: 실패 확인**

Run: `.venv/bin/pytest tests/api/test_auth_session.py -k "poll" -v`
Expected: 새 두 테스트 FAIL(현재 poll은 세션 무관하게 유저 생성).

- [ ] **Step 3: Tidal poll 링크 모드 구현**

`src/mrms/api/auth_session.py`:
- import에 `get_current_user_id_optional` 추가: `from mrms.api.deps import db_conn, get_current_user_id, get_current_user_id_optional`
- `device_code_poll` 시그니처에 `user_id: str | None = Depends(get_current_user_id_optional)` 추가.
- 토큰 성공(`tokens = r.json()`) 이후 블록을 아래로 **교체**(JWT email 파생·`get_or_create_user`·AuthSession 생성·set_cookie 제거):

```python
    if user_id is None:
        return {"status": "error", "detail": "login_required"}

    tokens = r.json()
    access_token = tokens["access_token"]
    refresh_token = tokens.get("refresh_token", "")
    expires_in = tokens.get("expires_in", 86400)

    token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
    upsert_oauth(
        conn, user_id=user_id, platform="tidal",
        access_token=access_token, refresh_token=refresh_token,
        expires_at=token_expires_at, scopes=TIDAL_SCOPES.split(),
    )

    with conn.cursor() as cur:
        cur.execute('SELECT COUNT(*) FROM "PlaylistHistory" WHERE "userId" = %s', (user_id,))
        has_mrt = cur.fetchone()[0] > 0
    conn.commit()
    return {"status": "success", "has_mrt": has_mrt}
```

- 이제 안 쓰는 import 정리: `base64`, `json`(JWT 파싱에만 쓰였으면), `get_or_create_user`. 파일 내 다른 사용처 확인 후 제거(미사용 시). `Response`도 set_cookie 제거로 미사용이면 시그니처에서 빼되, 함수에 다른 쓰임 없으면 `response` 파라미터 제거.

- [ ] **Step 4: Tidal poll 통과 확인**

Run: `.venv/bin/pytest tests/api/test_auth_session.py -v`
Expected: 전체 passed (poll 2개 + 기존).

- [ ] **Step 5: Spotify callback 링크 모드**

`src/mrms/api/auth_spotify.py` `callback`에서 `me = me_r.json()` 이후 "User upsert ~ AuthSession 생성 ~ has_mrt" 블록을 아래로 **교체**:

```python
    # 링크 모드 — 현재 세션 유저에 spotify 연결(유저/세션 생성 안 함).
    session_id_cookie = request.cookies.get(SESSION_COOKIE_NAME)
    user_id: str | None = None
    if session_id_cookie:
        with conn.cursor() as cur:
            cur.execute('SELECT "userId", "expiresAt" FROM "AuthSession" WHERE id = %s',
                        (session_id_cookie,))
            srow = cur.fetchone()
        if srow:
            su, se = srow
            if se is not None and se.tzinfo is None:
                se = se.replace(tzinfo=timezone.utc)
            if se is None or se >= datetime.now(timezone.utc):
                user_id = su
    if user_id is None:
        resp = RedirectResponse(url="/login?error=spotify_login_required", status_code=307)
        resp.delete_cookie(OAUTH_STATE_COOKIE)
        resp.delete_cookie(OAUTH_NEXT_COOKIE)
        return resp

    display_name = me.get("display_name")
    country = me.get("country")
    with conn.cursor() as cur:
        cur.execute(
            'UPDATE "User" SET "displayName" = COALESCE("displayName", %s), country = COALESCE(country, %s) WHERE id = %s',
            (display_name, country, user_id),
        )
    conn.commit()

    token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
    upsert_oauth(
        conn, user_id=user_id, platform="spotify",
        access_token=access_token, refresh_token=refresh_token,
        expires_at=token_expires_at, scopes=granted,
    )
    conn.commit()

    next_cookie = request.cookies.get(OAUTH_NEXT_COOKIE)
    next_target = _safe_next(unquote(next_cookie)) if next_cookie else None
    target = next_target or "/onboarding"
    resp = RedirectResponse(url=target, status_code=307)
    resp.delete_cookie(OAUTH_STATE_COOKIE)
    resp.delete_cookie(OAUTH_NEXT_COOKIE)
    return resp
```

(`email = me.get(...)` 줄은 더 이상 user 식별에 안 쓰이므로 제거. `get_or_create_user` import도 다른 사용처 없으면 제거.)

- [ ] **Step 6: YouTube callback 링크 모드**

`src/mrms/api/auth_youtube.py` `callback`에서 `existing_user_id` 블록 이후를 정리: 세션 없으면 거부, `get_or_create_user` 폴백 제거, AuthSession 생성·set_cookie 제거. `email = profile.get(...)` 이후를 아래로 **교체**:

```python
    display_name = profile.get("name")

    # 링크 모드 — 현재 세션 유저에 youtube 연결(유저/세션 생성 안 함).
    user_id: str | None = None
    session_id_cookie = request.cookies.get(SESSION_COOKIE_NAME)
    if session_id_cookie:
        with conn.cursor() as cur:
            cur.execute('SELECT "userId", "expiresAt" FROM "AuthSession" WHERE id = %s',
                        (session_id_cookie,))
            srow = cur.fetchone()
        if srow:
            su, se = srow
            if se is not None and se.tzinfo is None:
                se = se.replace(tzinfo=timezone.utc)
            if se is None or se >= datetime.now(timezone.utc):
                user_id = su
    if user_id is None:
        resp = RedirectResponse(url="/login?error=youtube_login_required", status_code=307)
        resp.delete_cookie(OAUTH_STATE_COOKIE)
        resp.delete_cookie(OAUTH_VERIFIER_COOKIE)
        return resp

    with conn.cursor() as cur:
        cur.execute('UPDATE "User" SET "displayName" = COALESCE("displayName", %s) WHERE id = %s',
                    (display_name, user_id))
    conn.commit()

    token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
    upsert_oauth(
        conn, user_id=user_id, platform="youtube",
        access_token=access_token, refresh_token=refresh_token,
        expires_at=token_expires_at, scopes=granted,
    )
    conn.commit()

    resp = RedirectResponse(url="/onboarding", status_code=307)
    resp.delete_cookie(OAUTH_STATE_COOKIE)
    resp.delete_cookie(OAUTH_VERIFIER_COOKIE)
    return resp
```

(`google_id`/`email` 식별 줄 제거. `get_or_create_user` import도 미사용 시 제거.)

- [ ] **Step 7: Spotify 콜백 테스트 링크 모드로 교체**

`tests/api/test_auth_spotify.py`의 두 테스트를 아래로 **교체**. 세션 없이 콜백이 유저를 만들던 가정을 버리고, 미리 만든 세션 유저에 spotify를 연결(새 유저 X)하는지 검증한다. (`datetime, timedelta, timezone`은 파일 상단에 이미 import됨.)

`test_callback_success_creates_session_and_redirects` → 교체:

```python
def test_callback_links_spotify_to_current_user(db_conn, cleanup):
    """유효 세션 + code/me → 현재 유저에 spotify 연결, /onboarding redirect(새 유저 X)."""
    import uuid as _u
    from mrms.db.user_track import get_or_create_user

    email = f"sp-link-{_u.uuid4().hex[:8]}@example.com"
    cleanup('DELETE FROM "User" WHERE email = %s', (email,))
    user_id = get_or_create_user(db_conn, email)
    session_id = _u.uuid4().hex
    with db_conn.cursor() as cur:
        cur.execute('INSERT INTO "AuthSession" (id, "userId", "expiresAt") VALUES (%s, %s, %s)',
                    (session_id, user_id, datetime.now(timezone.utc) + timedelta(days=30)))
    db_conn.commit()

    token_response = MagicMock(); token_response.status_code = 200
    token_response.json = MagicMock(return_value={
        "access_token": "AT_xyz", "refresh_token": "RT_xyz", "expires_in": 3600,
        "scope": "user-read-email", "token_type": "Bearer"})
    me_response = MagicMock(); me_response.status_code = 200
    me_response.json = MagicMock(return_value={"id": "sp_user_12345", "email": "alice@example.com",
        "display_name": "Alice", "country": "KR", "product": "premium"})
    fake_client = MagicMock()
    fake_client.__aenter__ = AsyncMock(return_value=fake_client)
    fake_client.__aexit__ = AsyncMock(return_value=None)
    fake_client.post = AsyncMock(return_value=token_response)
    fake_client.get = AsyncMock(return_value=me_response)

    client.cookies.set("mrms_session", session_id)
    client.cookies.set("mrms_oauth_state", "S2")
    with patch("httpx.AsyncClient", return_value=fake_client):
        r = client.get("/api/auth/spotify/callback?code=CODE_XYZ&state=S2", follow_redirects=False)
    client.cookies.clear()
    assert r.status_code in (302, 307)
    assert r.headers["location"] == "/onboarding"
    with db_conn.cursor() as cur:
        cur.execute('SELECT COUNT(*) FROM "UserOAuth" WHERE "userId"=%s AND platform=%s', (user_id, "spotify"))
        assert cur.fetchone()[0] == 1
        cur.execute('SELECT COUNT(*) FROM "User" WHERE email=%s', ("alice@example.com",))
        assert cur.fetchone()[0] == 0  # me email로 새 유저 생성 안 됨
```

`test_callback_redirects_to_next_when_set` → 교체:

```python
def test_callback_redirects_to_next_when_set(db_conn, cleanup):
    """유효 세션 + next 쿠키 → 콜백이 그 페이지로 복귀(링크 모드)."""
    import uuid as _u
    from mrms.db.user_track import get_or_create_user

    email = f"sp-next-{_u.uuid4().hex[:8]}@example.com"
    cleanup('DELETE FROM "User" WHERE email = %s', (email,))
    user_id = get_or_create_user(db_conn, email)
    session_id = _u.uuid4().hex
    with db_conn.cursor() as cur:
        cur.execute('INSERT INTO "AuthSession" (id, "userId", "expiresAt") VALUES (%s, %s, %s)',
                    (session_id, user_id, datetime.now(timezone.utc) + timedelta(days=30)))
    db_conn.commit()

    token_response = MagicMock(); token_response.status_code = 200
    token_response.json = MagicMock(return_value={"access_token": "AT_next", "refresh_token": "RT_next",
        "expires_in": 3600, "scope": "user-read-email", "token_type": "Bearer"})
    me_response = MagicMock(); me_response.status_code = 200
    me_response.json = MagicMock(return_value={"id": "sp_next_1", "email": "bob_next@example.com",
        "display_name": "Bob", "country": "KR", "product": "premium"})
    fake_client = MagicMock()
    fake_client.__aenter__ = AsyncMock(return_value=fake_client)
    fake_client.__aexit__ = AsyncMock(return_value=None)
    fake_client.post = AsyncMock(return_value=token_response)
    fake_client.get = AsyncMock(return_value=me_response)

    client.cookies.set("mrms_session", session_id)
    client.cookies.set("mrms_oauth_state", "S_NEXT")
    client.cookies.set("mrms_oauth_next", "/p/share-token-xyz")
    with patch("httpx.AsyncClient", return_value=fake_client):
        r = client.get("/api/auth/spotify/callback?code=CODE_XYZ&state=S_NEXT", follow_redirects=False)
    client.cookies.clear()
    assert r.status_code in (302, 307)
    assert r.headers["location"] == "/p/share-token-xyz"
```

(다른 spotify 테스트 — authorize/state mismatch/denied/next-cookie/unsafe-next/token — 은 세션 생성에 의존하지 않으므로 그대로 둔다.)

- [ ] **Step 8: YouTube 콜백 테스트 링크 모드로 교체**

`tests/api/test_auth_youtube.py`의 `test_callback_success_creates_session_and_redirects` → 아래로 **교체**(원본의 inline cleanup은 불필요 — 새 유저 bob_yt가 안 생김, 사전 유저는 cleanup fixture가 정리):

```python
def test_callback_links_youtube_to_current_user(db_conn, cleanup):
    """유효 세션 + code/userinfo → 현재 유저에 youtube 연결, /onboarding(새 유저 X)."""
    import uuid as _u
    from mrms.db.user_track import get_or_create_user

    email = f"yt-link-{_u.uuid4().hex[:8]}@example.com"
    cleanup('DELETE FROM "User" WHERE email = %s', (email,))
    user_id = get_or_create_user(db_conn, email)
    session_id = _u.uuid4().hex
    with db_conn.cursor() as cur:
        cur.execute('INSERT INTO "AuthSession" (id, "userId", "expiresAt") VALUES (%s, %s, %s)',
                    (session_id, user_id, datetime.now(timezone.utc) + timedelta(days=30)))
    db_conn.commit()

    token_response = MagicMock(); token_response.status_code = 200
    token_response.json = MagicMock(return_value={"access_token": "AT_yt", "refresh_token": "RT_yt",
        "expires_in": 3600, "scope": "https://www.googleapis.com/auth/youtube.readonly", "token_type": "Bearer"})
    userinfo_response = MagicMock(); userinfo_response.status_code = 200
    userinfo_response.json = MagicMock(return_value={"id": "g_user_12345", "email": "bob_yt@example.com", "name": "Bob YT"})
    fake_client = MagicMock()
    fake_client.__aenter__ = AsyncMock(return_value=fake_client)
    fake_client.__aexit__ = AsyncMock(return_value=None)
    fake_client.post = AsyncMock(return_value=token_response)
    fake_client.get = AsyncMock(return_value=userinfo_response)

    client.cookies.set("mrms_session", session_id)
    client.cookies.set("mrms_yt_oauth_state", "S2")
    client.cookies.set("mrms_yt_pkce_verifier", "VERIFIER_S2")
    with patch("httpx.AsyncClient", return_value=fake_client):
        r = client.get("/api/auth/youtube/callback?code=CODE_XYZ&state=S2", follow_redirects=False)
    client.cookies.clear()
    assert r.status_code in (302, 307)
    assert r.headers["location"] == "/onboarding"
    _, kwargs = fake_client.post.call_args
    assert kwargs["data"]["code_verifier"] == "VERIFIER_S2"
    with db_conn.cursor() as cur:
        cur.execute('SELECT COUNT(*) FROM "UserOAuth" WHERE "userId"=%s AND platform=%s', (user_id, "youtube"))
        assert cur.fetchone()[0] == 1
        cur.execute('SELECT COUNT(*) FROM "User" WHERE email=%s', ("bob_yt@example.com",))
        assert cur.fetchone()[0] == 0
```

(다른 youtube 테스트 — authorize/state mismatch/denied/token/playlists/import/refresh — 은 이미 세션을 선주입하므로 그대로 둔다.)

- [ ] **Step 9: 백엔드 회귀 확인**

Run:
```bash
.venv/bin/pytest tests/auth/test_password.py tests/api/test_auth_account.py \
  tests/api/test_auth_session.py tests/api/test_auth_spotify.py tests/api/test_auth_youtube.py -v
```
Expected: 전부 passed.

- [ ] **Step 10: ruff + Commit**

Run: `.venv/bin/ruff check src/mrms/api/auth_session.py src/mrms/api/auth_spotify.py src/mrms/api/auth_youtube.py`
Expected: 통과(미사용 import 없음). 위반 시 정리.

```bash
git add src/mrms/api/auth_session.py src/mrms/api/auth_spotify.py src/mrms/api/auth_youtube.py tests/api/
git commit -m "feat(auth): OAuth 콜백 링크 모드(유저/세션 생성 제거, 세션 필수)"
```

---

## Task 7: 프론트 타입 + 공용 PlatformConnect 컴포넌트

**Files:**
- Modify: `web/src/lib/types.ts` (`UserInfo.nickname`)
- Create: `web/src/components/auth/PlatformConnect.tsx`

- [ ] **Step 1: UserInfo에 nickname**

`web/src/lib/types.ts` `interface UserInfo`에서 `email: string;` 아래 추가:

```ts
export interface UserInfo {
  user_id: string;
  email: string;
  nickname: string | null;
  displayName: string | null;
```

- [ ] **Step 2: PlatformConnect 구현**

`web/src/components/auth/PlatformConnect.tsx`:

```tsx
"use client";

import { useState } from "react";

import { TidalConnectModal } from "@/components/auth/TidalConnectModal";
import { Button } from "@/components/ui/button";

interface Props {
  /** Spotify/YouTube 연결 후 돌아올 사이트 내부 경로. 기본 /onboarding. */
  next?: string;
}

export function PlatformConnect({ next = "/onboarding" }: Props) {
  const [tidalOpen, setTidalOpen] = useState(false);
  const q = `?next=${encodeURIComponent(next)}`;

  return (
    <div className="space-y-3">
      <Button onClick={() => setTidalOpen(true)} className="w-full" size="lg">
        Tidal 연결하기
      </Button>
      <Button
        onClick={() => (window.location.href = `/api/auth/spotify/authorize${q}`)}
        variant="outline"
        className="w-full"
        size="lg"
      >
        Spotify 연결하기
      </Button>
      <Button
        onClick={() => (window.location.href = `/api/auth/youtube/authorize${q}`)}
        variant="outline"
        className="w-full"
        size="lg"
      >
        YouTube 연결하기
      </Button>
      <TidalConnectModal open={tidalOpen} onOpenChange={setTidalOpen} />
    </div>
  );
}
```

> 참고: YouTube `/authorize`는 현재 `?next`를 안 받지만(콜백이 항상 `/onboarding`), 쿼리는 무시되어 무해. Tidal은 모달이 자체적으로 `has_mrt ? /mrt : /onboarding`로 이동(이미 구현됨).

- [ ] **Step 3: 타입 체크**

Run: `cd "/Volumes/MacExtend 1/MRMS_FN/web" && npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 4: Commit**

```bash
git add web/src/lib/types.ts web/src/components/auth/PlatformConnect.tsx
git commit -m "feat(auth): UserInfo nickname + 공용 PlatformConnect 컴포넌트"
```

---

## Task 8: 로그인 페이지 — 이메일/비밀번호 폼

**Files:**
- Modify: `web/src/app/(auth)/login/page.tsx`

- [ ] **Step 1: 로그인 폼으로 교체**

`web/src/app/(auth)/login/page.tsx` 전체를 아래로 교체(플랫폼 버튼 제거, 이메일/PW 폼):

```tsx
"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function LoginContent() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });
      if (r.status === 401) {
        setError("이메일 또는 비밀번호가 올바르지 않습니다.");
        return;
      }
      if (!r.ok) {
        setError("로그인에 실패했습니다. 잠시 후 다시 시도해주세요.");
        return;
      }
      // 플랫폼 미연결이면 서버 게이트가 /connect로 보냄.
      router.push("/");
      router.refresh();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard
      title="로그인"
      description="이메일과 비밀번호로 로그인하세요"
      footer={
        <span className="text-muted-foreground">
          계정이 없으신가요?{" "}
          <Link href="/register" className="text-foreground underline-offset-4 hover:underline font-medium">
            회원가입
          </Link>
        </span>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">이메일</Label>
          <Input id="email" type="email" autoComplete="email" required
                 value={email} onChange={(e) => setEmail(e.target.value)} placeholder="m@example.com" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">비밀번호</Label>
          <Input id="password" type="password" autoComplete="current-password" required
                 value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button type="submit" className="w-full mt-1" disabled={busy}>
          {busy ? "로그인 중..." : "로그인"}
        </Button>
      </form>
    </AuthCard>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
```

- [ ] **Step 2: 타입 체크 + Commit**

Run: `cd "/Volumes/MacExtend 1/MRMS_FN/web" && npx tsc --noEmit`
Expected: 에러 없음.

```bash
git add web/src/app/\(auth\)/login/page.tsx
git commit -m "feat(auth): 로그인 페이지 이메일/비밀번호 폼"
```

---

## Task 9: 회원가입 페이지 — 2단계 마법사

**Files:**
- Modify: `web/src/app/(auth)/register/page.tsx`

- [ ] **Step 1: 2단계 마법사로 교체**

`web/src/app/(auth)/register/page.tsx` 전체 교체(닉네임/이메일/PW → signup → 스텝2 PlatformConnect):

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { PlatformConnect } from "@/components/auth/PlatformConnect";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RegisterPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("비밀번호는 8자 이상이어야 합니다.");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname, email, password }),
        credentials: "include",
      });
      if (r.status === 409) {
        const d = await r.json();
        setError(d.detail === "nickname_taken" ? "이미 사용 중인 닉네임입니다." : "이미 가입된 이메일입니다.");
        return;
      }
      if (r.status === 422) {
        setError("입력값을 확인해주세요(닉네임 2–20자, 올바른 이메일, 비밀번호 8자 이상).");
        return;
      }
      if (!r.ok) {
        setError("가입에 실패했습니다. 잠시 후 다시 시도해주세요.");
        return;
      }
      setStep(2); // 세션 발급됨 → 플랫폼 연결 단계
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  if (step === 2) {
    return (
      <AuthCard
        title="음악 플랫폼 연결"
        description="추천과 재생을 위해 스트리밍 플랫폼을 1개 이상 연결하세요."
      >
        <PlatformConnect next="/onboarding" />
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="회원가입"
      footer={
        <span className="text-muted-foreground">
          이미 계정이 있으신가요?{" "}
          <Link href="/login" className="text-foreground underline-offset-4 hover:underline font-medium">
            로그인
          </Link>
        </span>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nickname">닉네임</Label>
          <Input id="nickname" type="text" autoComplete="nickname" required minLength={2} maxLength={20}
                 value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="2–20자" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">이메일</Label>
          <Input id="email" type="email" autoComplete="email" required
                 value={email} onChange={(e) => setEmail(e.target.value)} placeholder="m@example.com" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">비밀번호</Label>
          <Input id="password" type="password" autoComplete="new-password" required minLength={8}
                 value={password} onChange={(e) => setPassword(e.target.value)} placeholder="8자 이상" />
        </div>
        <div className="flex items-start gap-2">
          <Checkbox id="terms" checked={agreed}
                    onCheckedChange={(c) => setAgreed(!!c)} className="mt-0.5" />
          <Label htmlFor="terms" className="font-normal cursor-pointer leading-snug">
            <Link href="#" className="underline underline-offset-4 hover:text-foreground">이용약관</Link>
            {" 및 "}
            <Link href="#" className="underline underline-offset-4 hover:text-foreground">개인정보처리방침</Link>
            에 동의합니다
          </Label>
        </div>
        <Button type="submit" className="w-full mt-1" disabled={busy || !agreed}>
          {busy ? "처리 중..." : "다음 — 플랫폼 연결"}
        </Button>
      </form>
    </AuthCard>
  );
}
```

(`SocialButtons`·`Separator` import 제거 — 미사용.)

- [ ] **Step 2: 타입 체크 + Commit**

Run: `cd "/Volumes/MacExtend 1/MRMS_FN/web" && npx tsc --noEmit`
Expected: 에러 없음.

```bash
git add web/src/app/\(auth\)/register/page.tsx
git commit -m "feat(auth): 회원가입 2단계 마법사(계정→플랫폼 연결)"
```

---

## Task 10: /connect 페이지 + onboarding connect 목적지 변경

**Files:**
- Create: `web/src/app/(auth)/connect/page.tsx`
- Modify: `web/src/app/(auth)/onboarding/page.tsx`

- [ ] **Step 1: /connect 페이지 생성**

`web/src/app/(auth)/connect/page.tsx`:

```tsx
import { AuthCard } from "@/components/auth/auth-card";
import { PlatformConnect } from "@/components/auth/PlatformConnect";

export default function ConnectPage() {
  return (
    <AuthCard
      title="음악 플랫폼 연결"
      description="추천과 재생을 위해 스트리밍 플랫폼을 1개 이상 연결하세요."
    >
      <PlatformConnect next="/onboarding" />
    </AuthCard>
  );
}
```

- [ ] **Step 2: onboarding connect 목적지 변경**

`web/src/app/(auth)/onboarding/page.tsx`의 connect 페이즈 버튼 onClick을 `/login`→`/connect`로:

```tsx
        <Button onClick={() => router.push("/connect")} className="w-full">
          음악 플랫폼 연결하기
        </Button>
```

또한 `YouTubePlaylistPicker`의 `onUnauthorized={() => setPhase("connect")}`는 유지(연결 안내 화면 그대로). connect 페이즈는 이제 `/connect`로 보냄.

- [ ] **Step 3: 타입 체크 + Commit**

Run: `cd "/Volumes/MacExtend 1/MRMS_FN/web" && npx tsc --noEmit`
Expected: 에러 없음.

```bash
git add web/src/app/\(auth\)/connect/ web/src/app/\(auth\)/onboarding/page.tsx
git commit -m "feat(auth): /connect 페이지 + onboarding connect→/connect"
```

---

## Task 11: 하드 게이트 (플랫폼 미연결 차단)

`primary_platform == null`인 로그인 유저는 앱 진입 시 `/connect`로.

**Files:**
- Modify: `web/src/app/(dashboard)/layout.tsx`
- Modify: `web/src/app/page.tsx`

- [ ] **Step 1: (dashboard) 레이아웃 게이트**

`web/src/app/(dashboard)/layout.tsx` 전체 교체(서버 컴포넌트로 게이트 추가):

```tsx
import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/layout/DashboardShell";
import { getServerSideUser } from "@/lib/server/auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerSideUser(); // 미로그인이면 내부에서 /login redirect
  if (!user.primary_platform) redirect("/connect");
  return <DashboardShell>{children}</DashboardShell>;
}
```

- [ ] **Step 2: root 로그인 분기 게이트**

`web/src/app/page.tsx` 전체 교체:

```tsx
import { redirect } from "next/navigation";

import { getServerSideUserOptional } from "@/lib/server/auth";
import { HomeMarketing } from "@/components/landing/HomeMarketing";
import { HomeLoggedIn } from "@/components/landing/HomeLoggedIn";
import { DashboardShell } from "@/components/layout/DashboardShell";

export default async function RootPage() {
  const user = await getServerSideUserOptional();
  if (!user) return <HomeMarketing />;
  if (!user.primary_platform) redirect("/connect");
  return (
    <DashboardShell>
      <HomeLoggedIn user={user} />
    </DashboardShell>
  );
}
```

- [ ] **Step 3: 타입 체크 + 빌드**

Run: `cd "/Volumes/MacExtend 1/MRMS_FN/web" && npx tsc --noEmit && pnpm build`
Expected: tsc 에러 없음, `Compiled successfully`.

- [ ] **Step 4: Commit**

```bash
git add web/src/app/\(dashboard\)/layout.tsx web/src/app/page.tsx
git commit -m "feat(auth): 플랫폼 미연결 하드 게이트(/connect 리다이렉트)"
```

---

## 최종 검증 (모든 태스크 후)

- [ ] **백엔드 전체(대상 파일만)**:
```bash
cd "/Volumes/MacExtend 1/MRMS_FN" && .venv/bin/pytest \
  tests/auth/test_password.py tests/api/test_auth_account.py \
  tests/api/test_auth_session.py tests/api/test_auth_spotify.py tests/api/test_auth_youtube.py -v
```
Expected: 전부 passed.

- [ ] **프론트**: `cd web && npx tsc --noEmit && pnpm build` → 성공.

- [ ] **ruff**: `.venv/bin/ruff check src/mrms/api/ src/mrms/db/account.py src/mrms/auth/password.py` → 통과.

## 배포 시 주의 (사용자 "일푸" 시 컨트롤러가 수행 — 구현 태스크 아님)

- **그린필드 리셋(파괴적, 사용자 명시 승인 필요)**: prod DB에서 레거시 `@auto.local` 계정 정리.
  ```sql
  TRUNCATE "User" CASCADE;
  ```
  `dangerouslyDisableSandbox` + 사용자 승인 후에만. 미실행해도 레거시 계정은 passwordHash 없어 로그인 불가(안전), 단 사이드바/추천에 잔존 데이터가 보일 수 있으니 정리 권장.
- 마이그레이션은 prod 배포 파이프라인이 `prisma/migrations`를 적용(비파괴적 컬럼 추가).
- 쿠키 `secure=False` → prod HTTPS에선 True 검토(기존 코드 일관성 유지, 별도 작업).
```
