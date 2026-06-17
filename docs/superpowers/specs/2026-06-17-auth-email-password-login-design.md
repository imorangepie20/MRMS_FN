# 로그인 개편: 이메일/비밀번호 계정 + 스트리밍 플랫폼 연결 (v1)

> 작성일 2026-06-17. MRMS_FN. 기존 OAuth 전용 로그인을 이메일/비밀번호 계정 + 스트리밍 플랫폼 "연결" 모델로 개편한다.

## 목표

회원가입/로그인을 **닉네임 · 이메일 · 비밀번호**로 받고, 스트리밍 플랫폼(Tidal/Spotify/YouTube)은 그 계정에 **연결**하는 리소스로 만든다. 추천·재생에는 플랫폼 토큰이 필요하므로 가입을 마치려면 플랫폼 1개 이상 연결을 **필수**로 한다.

## 확정된 결정 (브레인스토밍)

1. **계정 모델 (Model X)** — 이메일/비밀번호가 본 계정. 스트리밍 플랫폼은 계정에 연결하는 리소스. **OAuth 단독 로그인 폐기** ("Spotify로 로그인"은 더 이상 계정 생성/로그인 수단이 아님).
2. **하드 게이트** — 가입 마법사 2단계: ① 닉네임/이메일/비밀번호 → ② 플랫폼 연결(≥1개). 연결 0개인 로그인 유저는 앱 진입 시 연결 화면으로 리다이렉트. "사용 가능한 미연결 계정"은 없음.
3. **기존 계정 리셋 (그린필드)** — 기존 OAuth 전용 User 행(자동생성 `@auto.local` 이메일, 비밀번호·닉네임 없음)을 정리하고 새 가입 플로우로 시작. 마이그레이션(보존) 코드 불필요.
4. **비밀번호 해싱: `bcrypt`** 의존성 추가.
5. **닉네임: 유니크 + 필수** (대소문자 무시 유니크, 2–20자). 표시명으로도 사용.
6. **v1 범위 밖**: 비밀번호 재설정 · 이메일 인증 (이메일 발송 인프라 없음). 템플릿 페이지(`forgot-password`/`reset-password`/`verify`)는 스텁 유지, 본 작업에서 손대지 않음.

## 비목표 (v1)

- 이메일 인증, 비밀번호 재설정/찾기 (이메일 인프라 부재).
- 소셜 로그인(Google/GitHub/Apple) — `SocialButtons`는 미사용, 회원가입 폼에서 제거.
- 다중 세션/기기 관리 — 기존대로 유저당 1세션 유지.
- 비밀번호 변경(설정 내) — 후속 작업으로 분리 가능, v1 제외.

---

## 아키텍처

### 데이터 모델 변경 — `prisma/schema.prisma` `User`

추가:
- `nickname String? @unique` — 표시명 겸용. **DB는 nullable, API(signup)에서 필수 강제.** 대소문자 무시 유니크는 앱 레벨 `lower(nickname)` 비교 + DB `@unique`로 보강.
- `passwordHash String?` — bcrypt 해시. **DB는 nullable, API에서 필수 강제.**

> **DB nullable + API required 이유**: `ADD COLUMN`을 비파괴적(additive)으로 만들어 로컬 테스트 DB에 강제 wipe 없이 적용 가능하고, 테스트/레거시 부트스트랩 헬퍼(`get_or_create_user`, nickname/pw 없이 User 생성)가 그대로 동작한다. 그린필드 리셋(TRUNCATE)은 배포 시 별도 사용자 승인 단계로 분리(아래). passwordHash 없는 레거시 `@auto.local` 계정은 어차피 로그인 불가(verify 실패)이므로 리셋 미적용 상태도 안전.

변경 없음(의미만): `email String @unique` — 이제 실제 이메일. `@auto.local` 자동생성 폐기. `displayName String?` 유지하되 가입 시 `nickname` 값으로 채움(기존 UI 참조 무회귀).

마이그레이션은 **두 부분으로 분리**:
1. **스키마 변경(비파괴적, 마이그레이션 파일)** — `nickname`/`passwordHash` nullable 컬럼 추가 + nickname unique index. 로컬 테스트 DB·prod 모두 안전 적용.
2. **그린필드 리셋(파괴적, 배포 시 별도 사용자 승인)** — `TRUNCATE "User" CASCADE` (모든 참조 테이블 연쇄 정리). 마이그레이션 파일이 아니라 배포 단계의 사용자-게이트 작업으로 실행(`dangerouslyDisableSandbox`). 미적용해도 레거시 계정은 로그인 불가라 시스템은 정상.

### 비밀번호 모듈 — 신규 `src/mrms/auth/password.py`

```python
import bcrypt

def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()

def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except ValueError:
        return False
```

`pyproject.toml` dependencies에 `bcrypt>=4` 추가.

### DB 헬퍼 — 신규 `src/mrms/db/account.py`

계정 생성/조회는 OAuth 토큰 헬퍼(`user_track.py`)와 다른 관심사이므로 별도 파일로 분리.

- `create_account(conn, *, nickname, email, password_hash) -> str` — `User` insert. id는 기존 `get_or_create_user`와 동일한 id 생성 관용구(`stable_id(email)`)를 따름. `displayName=nickname`. 반환 user_id. 이메일/닉네임 유니크 위반은 `psycopg.errors.UniqueViolation`으로 표면화.
- `get_account_by_email(conn, email) -> dict | None` — `id, passwordHash, nickname` 조회(로그인용).
- `nickname_exists(conn, nickname) -> bool` / `email_exists(conn, email) -> bool` — 대소문자 무시(`lower()`) 사전 검증.
- 기존 `get_or_create_user`는 **OAuth 콜백에서 더 이상 호출하지 않음**(아래 링크 모드 참조). 다른 사용처 없으면 제거, 있으면 유지.

### 백엔드 엔드포인트

**신규 — `src/mrms/api/auth_account.py`** (`prefix="/api/auth"`):

- `POST /api/auth/signup` — body `{nickname, email, password}`.
  - 검증: 이메일 형식(pydantic `EmailStr`), 비밀번호 ≥8자, 닉네임 2–20자. 닉네임/이메일 중복 시 409 `{detail: "email_taken" | "nickname_taken"}`.
  - `hash_password` → `create_account` → `AuthSession` 1개 생성(기존 세션 삭제 패턴 동일) → `mrms_session` 쿠키 set.
  - 응답 `{user_id, nickname, email}`. 프론트는 이후 플랫폼 연결 스텝으로.
- `POST /api/auth/login` — body `{email, password}`.
  - `get_account_by_email` → `verify_password`. 실패(이메일 없음/PW 불일치) 시 401 `{detail: "invalid_credentials"}` (이메일 존재 여부 노출 안 함).
  - 성공 시 `AuthSession` 생성 + 쿠키 set. 응답 `{user_id, nickname, email}`.

**변경 — OAuth 콜백을 "링크 모드"로** (`auth_session.py` Tidal poll, `auth_spotify.py` callback, `auth_youtube.py` callback):

- 더 이상 유저/세션을 생성하지 않는다. 대신 **현재 세션 유저**에 플랫폼을 연결한다.
  - Tidal `device-code/poll`: `Depends(get_current_user_id)` 추가. 세션 없으면 401. `get_or_create_user`/`AuthSession` 생성 블록 삭제, `upsert_oauth(현재 user_id, ...)`만 수행. 응답 `{status, has_mrt}` 유지.
  - Spotify `callback`, YouTube `callback`: GET 리다이렉트지만 브라우저가 `mrms_session` 쿠키를 실어 보냄. `get_current_user_id_optional`로 현재 유저 확인 → 없으면 `/login`으로 리다이렉트(연결하려면 로그인 필요). 있으면 `upsert_oauth(현재 user_id)`만, 유저/세션 생성·`set_cookie` 제거.
  - 콜백 성공 후 리다이렉트 기본 목적지: `?next` 우선, 기본 `/onboarding`(추천 생성 플로우 착지).
- `auth_spotify.authorize`/`auth_youtube.authorize`도 로그인 유저 전제(미로그인이면 `/login`). 기존 `?next` 파라미터 유지.

**`/me` (`auth_session.py`)** — 응답에 `nickname` 추가. `UserInfo` 타입도 동기화.

**`/logout`** — 변경 없음.

### 프론트엔드 — `web/src/app/(auth)/` (템플릿 제자리 적응)

- **공용 컴포넌트 신규** `web/src/components/auth/PlatformConnect.tsx` — Tidal(`TidalConnectModal`) + Spotify/YouTube 연결 버튼(각각 `/api/auth/{spotify,youtube}/authorize?next=...`로 이동). props `{ next?: string }`. 연결 성공 후 `next`(기본 `/onboarding`)로 이동. `/login`에 있던 3버튼 UI를 여기로 이전.
- **`login/page.tsx`** — 플랫폼 버튼 → **이메일/비밀번호 폼**으로 교체. `POST /api/auth/login` 호출, 실패 시 에러 표시, 성공 시 라우팅(아래 게이트 로직과 동일하게 `/onboarding` 또는 `/mrt`로). "회원가입" 링크는 `/register`. `AuthCard` 유지.
- **`register/page.tsx`** — 기존 폼 필드를 **닉네임/이메일/비밀번호**로(현재 name→nickname). 2단계 마법사:
  - 스텝1: 폼 → `POST /api/auth/signup`. 중복(409) 인라인 에러. 성공 → 스텝2.
  - 스텝2: `<PlatformConnect next="/onboarding" />`. 약관 체크박스는 유지(템플릿 자산). `SocialButtons` 제거.
- **`/connect` 신규 페이지** `web/src/app/(auth)/connect/page.tsx` — 하드 게이트 착지점. 로그인됐지만 플랫폼 0개인 유저용. `<PlatformConnect next="/onboarding" />` 렌더. `AuthCard` 톤 일치.
- **`onboarding/page.tsx`** — `connect` 페이즈 버튼 목적지를 `/login` → **`/connect`**로 변경(이미 로그인된 유저이므로). 그 외 로직 보존.

### 하드 게이트 (플랫폼 미연결 차단)

- `/me`가 반환하는 `primary_platform`이 `null`이면 = 연결된 플랫폼 0개.
- **앱 레이아웃 게이트** — `(dashboard)` 레이아웃(및 root `/` 로그인 분기 `HomeLoggedIn`)에서 `getServerSideUser` → `primary_platform == null`이면 `redirect('/connect')`.
- 로그인/회원가입 성공 후 프론트 라우팅도 동일 규칙: 플랫폼 없으면 `/connect`, 있으면 `/onboarding`(MRT 없으면 생성) 또는 `/mrt`.

---

## 데이터 흐름 (요약)

```
회원가입:  /register 스텝1(signup) → 세션 → 스텝2 PlatformConnect → OAuth(link) → /onboarding → /mrt
로그인:    /login(email+pw) → 세션 → [플랫폼 有? /onboarding|/mrt : /connect]
게이트:    앱 진입 시 primary_platform==null → /connect
```

## 에러 처리

- signup 중복: 409 `email_taken`/`nickname_taken` → 폼 필드 인라인 메시지.
- login 실패: 401 `invalid_credentials`(이메일 존재 여부 비노출) → 폼 상단 메시지.
- 검증 실패(형식/길이): 422(pydantic) → 필드 메시지. 프론트도 사전 검증(즉시 피드백).
- OAuth 콜백 미로그인: `/login`으로 리다이렉트.
- OAuth 콜백 실패: 기존 `?error=` 쿼리 패턴 유지하되 `/connect`(또는 진입점)에서 표시.

## 테스트 (DB 격리 준수 — 대상 파일만, 외부호출 차단/정리)

신규 `tests/api/test_auth_account.py`:
- signup 정상 → 200 + 세션 쿠키 + User 행(passwordHash 해시됨, displayName==nickname).
- signup 이메일 중복 → 409 `email_taken`.
- signup 닉네임 중복(대소문자 무시) → 409 `nickname_taken`.
- signup 약한 비밀번호(<8) → 422.
- login 정상 → 200 + 세션. login 틀린 PW → 401. login 없는 이메일 → 401(동일 메시지).
- 각 테스트 생성 User cleanup(FK 순서 주의).

`src/mrms/auth/` 단위 — `test_password.py`: hash/verify 라운드트립, 잘못된 해시 → False.

기존 OAuth 테스트(`test_auth_session.py`/`_spotify`/`_youtube`) 링크 모드로 수정:
- 콜백/poll에 유효 세션 없으면 거부(401 또는 `/login` 리다이렉트).
- 유효 세션 있으면 `upsert_oauth`만 호출, 새 User/세션 생성 안 함.

## 파일 구조

생성:
- `src/mrms/auth/password.py` — bcrypt 해시/검증.
- `src/mrms/db/account.py` — 계정 생성/조회 헬퍼.
- `src/mrms/api/auth_account.py` — signup/login 라우터.
- `web/src/components/auth/PlatformConnect.tsx` — 공용 플랫폼 연결 UI.
- `web/src/app/(auth)/connect/page.tsx` — 하드게이트 착지 페이지.
- `tests/api/test_auth_account.py`, `tests/.../test_password.py`.
- Prisma migration(파괴적 리셋 + 컬럼 추가).

수정:
- `prisma/schema.prisma` — User에 nickname/passwordHash.
- `src/mrms/db/user_track.py` — `get_or_create_user`가 OAuth 콜백 외 사용처 없으면 제거(있으면 유지).
- `src/mrms/api/auth_session.py` — Tidal poll 링크 모드, `/me`에 nickname.
- `src/mrms/api/auth_spotify.py` / `auth_youtube.py` — 콜백/authorize 링크 모드.
- `src/mrms/api/main.py` — `auth_account` 라우터 등록.
- `web/src/app/(auth)/login/page.tsx` — 이메일/PW 폼.
- `web/src/app/(auth)/register/page.tsx` — 닉네임/이메일/PW + 2단계 마법사.
- `web/src/app/(auth)/onboarding/page.tsx` — connect 목적지 `/connect`.
- `web/src/app/(dashboard)/layout.tsx`(+ root `/` 로그인 분기) — 하드 게이트.
- `web/src/lib/types.ts` — `UserInfo`에 nickname.
- `pyproject.toml` — bcrypt 추가.

## 리스크 / 주의

- **파괴적 리셋**: 배포 시 명시 승인 필수. 본인 Tidal 연결·임베딩·MRT도 삭제됨(재가입·재연결·재생성 필요).
- **링크 모드 회귀**: 기존 OAuth 콜백이 세션 생성에 의존하던 사용처(리다이렉트 목적지, has_mrt 분기) 점검.
- **secure 쿠키**: 기존 `secure=False`(프로덕션 True) 패턴 유지/일관성.
