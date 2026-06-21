# 공유페이지 YouTube 연결-재생 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 공유페이지 비회원 방문자가 YouTube로 인증(게스트 세션)한 뒤 같은 페이지로 복귀해 우리 페이지 안 YouTube IFrame으로 전곡 재생할 수 있게 한다.

**Architecture:** 기존 "연결=우리 OAuth=세션" 인프라 재사용. 빠진 두 연결고리만 채움 — (1) `auth_youtube`가 인증 후 공유페이지로 복귀(`next`)하도록 Spotify 패턴 미러, (2) `ConnectToPlay`에 YouTube 연결 버튼 추가. 재생 라우팅·resolve·게스트세션·primary_platform(youtube 포함)은 모두 기존대로 동작(확인됨) — 변경 없음.

**Tech Stack:** FastAPI(백엔드 OAuth, 동기 psycopg), Next.js/React(프론트). 백엔드 테스트 `.venv/bin/pytest` + `fastapi.testclient.TestClient`. 프론트 검증 `npx tsc --noEmit`(+ `pnpm build`).

**Spec:** `docs/superpowers/specs/2026-06-21-share-youtube-connect-play-design.md`

**러너:** `.venv/bin/pytest`(대상 파일만)·`.venv/bin/ruff`. 프론트는 `web/`에서 `npx tsc --noEmit`. **push/머지 금지.**

---

## File Structure

| 파일 | 변경 | 책임 |
|---|---|---|
| `src/mrms/api/auth_youtube.py` | 수정 | `next` 복귀 지원(쿠키 + authorize 파라미터 + callback 리다이렉트) |
| `tests/api/test_auth_youtube.py` | 수정(append) | `_safe_next` + authorize `next` 쿠키 테스트 |
| `web/src/components/player/ConnectToPlay.tsx` | 수정 | "YouTube로 연결" 버튼 |

---

## Task 1: 백엔드 — auth_youtube `next` 복귀

**Files:**
- Modify: `src/mrms/api/auth_youtube.py`
- Test: `tests/api/test_auth_youtube.py`

**그라운딩:** `auth_spotify.py`가 정확히 이 패턴을 갖고 있음(`OAUTH_NEXT_COOKIE="mrms_oauth_next"`, `_safe_next`, authorize `next_url=Query(...,alias="next")` → `quote` 쿠키, callback에서 `unquote`+`_safe_next` 재검증 → `next or "/onboarding"` 리다이렉트 + `delete_cookie(OAUTH_NEXT_COOKIE)`). `auth_youtube.py`는 PKCE라 state·verifier 쿠키 2개를 쓰고, 콜백 4곳(denied/token실패/userinfo실패/성공)에서 `resp.delete_cookie(OAUTH_VERIFIER_COOKIE)`를 호출함. 성공 리다이렉트는 `RedirectResponse(url="/onboarding", status_code=307)`(현재). 테스트 파일엔 이미 `client = TestClient(app)` + autouse `_yt_env` fixture(YOUTUBE_* env)가 있음.

- [ ] **Step 1: Write the failing tests** — APPEND to `tests/api/test_auth_youtube.py`. Add `from mrms.api.auth_youtube import _safe_next` to the existing imports at top (merge into the import block, not mid-file):

```python
def test_safe_next_allows_internal_rejects_external():
    assert _safe_next("/p/abc") == "/p/abc"
    assert _safe_next("//evil.com") is None
    assert _safe_next("https://evil.com") is None
    assert _safe_next(None) is None


def test_authorize_sets_next_cookie_for_safe_path(db_conn):
    """authorize?next=/p/abc → 307 + mrms_oauth_next 쿠키(인코딩) set."""
    r = client.get(
        "/api/auth/youtube/authorize?next=%2Fp%2Fabc", follow_redirects=False
    )
    assert r.status_code in (302, 307)
    assert "accounts.google.com/o/oauth2/v2/auth" in r.headers.get("location", "")
    set_cookies = "; ".join(r.headers.get_list("set-cookie"))
    assert "mrms_oauth_next=" in set_cookies
    client.cookies.clear()


def test_authorize_omits_next_cookie_for_unsafe_path(db_conn):
    """외부 URL next는 쿠키로 저장 안 함(open-redirect 방지)."""
    r = client.get(
        "/api/auth/youtube/authorize?next=https%3A%2F%2Fevil.com",
        follow_redirects=False,
    )
    assert r.status_code in (302, 307)
    set_cookies = "; ".join(r.headers.get_list("set-cookie"))
    assert "mrms_oauth_next=" not in set_cookies
    client.cookies.clear()
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `.venv/bin/pytest tests/api/test_auth_youtube.py -k "safe_next or next_cookie" -v`
Expected: FAIL — `ImportError: cannot import name '_safe_next'` (and the authorize tests fail: no `mrms_oauth_next` cookie yet).

- [ ] **Step 3: Implement** — edit `src/mrms/api/auth_youtube.py`:

**(a) Imports** — add `Query` to the fastapi import and add the urllib import:

```python
from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
```
Add this line in the stdlib import group (next to `import os` / `import uuid`):
```python
from urllib.parse import quote, unquote
```

**(b) Constant** — add next to `OAUTH_STATE_COOKIE` (in the constants block near `OAUTH_VERIFIER_COOKIE`):
```python
OAUTH_NEXT_COOKIE = "mrms_oauth_next"
```

**(c) `_safe_next` helper** — add above `authorize` (e.g. right after the constants / `_client()`):
```python
def _safe_next(next_url: str | None) -> str | None:
    """오픈 리다이렉트 방지 — 사이트 내부 상대 경로(/...)만 허용, //는 거부."""
    if next_url and next_url.startswith("/") and not next_url.startswith("//"):
        return next_url
    return None
```

**(d) `authorize`** — change the signature to accept `next`, and set the next cookie before `return resp`. Replace:
```python
@router.get("/authorize")
def authorize() -> RedirectResponse:
    """state + PKCE 생성 → state·code_verifier 쿠키 set → Google authorize 302."""
```
with:
```python
@router.get("/authorize")
def authorize(
    next_url: str | None = Query(default=None, alias="next"),
) -> RedirectResponse:
    """state + PKCE 생성 → state·code_verifier(+next) 쿠키 set → Google authorize 302.

    next=인증 후 돌아올 사이트 내부 경로(예: /p/{token}). 공유페이지 연결 시 복귀.
    """
```
And replace the final `return resp` of `authorize` (right after the `OAUTH_VERIFIER_COOKIE` set_cookie block) with:
```python
    safe_next = _safe_next(next_url)
    if safe_next:
        # URL-encode — '/'가 들어가면 Set-Cookie가 값을 따옴표로 감싸므로 인코딩해 저장.
        resp.set_cookie(
            key=OAUTH_NEXT_COOKIE,
            value=quote(safe_next, safe=""),
            httponly=True,
            samesite="lax",
            max_age=OAUTH_STATE_MAX_AGE,
            secure=False,
        )
    return resp
```

**(e) `callback` success redirect** — replace:
```python
    resp = RedirectResponse(url="/onboarding", status_code=307)
```
with:
```python
    next_cookie = request.cookies.get(OAUTH_NEXT_COOKIE)
    next_target = _safe_next(unquote(next_cookie)) if next_cookie else None
    resp = RedirectResponse(url=next_target or "/onboarding", status_code=307)
```

**(f) Delete the next cookie everywhere the verifier cookie is deleted** — in EACH of the 4 places that call `resp.delete_cookie(OAUTH_VERIFIER_COOKIE)` (the `error`/denied path, the token-exchange failure path, the userinfo-failure path, and the success path's final cleanup), add immediately after it:
```python
        resp.delete_cookie(OAUTH_NEXT_COOKIE)
```
(match the indentation of the adjacent `delete_cookie` calls.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `.venv/bin/pytest tests/api/test_auth_youtube.py -v`
Expected: PASS — the 3 new tests plus all pre-existing youtube auth tests (no regression).

- [ ] **Step 5: ruff + Commit**

Run: `.venv/bin/ruff check src/mrms/api/auth_youtube.py tests/api/test_auth_youtube.py` → fix import ordering (I001) if flagged. Expected `All checks passed!`.
```bash
git add src/mrms/api/auth_youtube.py tests/api/test_auth_youtube.py
git commit -m "feat(auth): youtube OAuth next 복귀 — 공유페이지 연결 후 원래 경로로"
```

---

## Task 2: 프론트 — ConnectToPlay "YouTube로 연결" 버튼

**Files:**
- Modify: `web/src/components/player/ConnectToPlay.tsx`

**그라운딩:** 현재 `ConnectToPlay`는 `connectSpotify`(= `window.location.href = /api/auth/spotify/authorize?next=<현재경로>`)와 Tidal 모달 버튼을 가짐. YouTube는 같은 `connectSpotify` 모양으로 추가. 프론트엔 컴포넌트 테스트 하니스(@testing-library)가 없고 `connectSpotify`도 무테스트 → YouTube도 동일 패턴으로 추가하고 `npx tsc --noEmit`로 타입 검증(컨벤션 일치, 테스트 미추가는 의도적).

- [ ] **Step 1: Implement** — edit `web/src/components/player/ConnectToPlay.tsx`.

Add a `connectYoutube` handler next to the existing `connectSpotify` (same shape):
```ts
  const connectYoutube = () => {
    const next = window.location.pathname + window.location.search;
    window.location.href = `/api/auth/youtube/authorize?next=${encodeURIComponent(next)}`;
  };
```

Add a "YouTube로 연결" button in the button row, after the Tidal button and before (or after) the Spotify(준비 중) button:
```tsx
        <Button onClick={connectYoutube} variant="outline" size="sm">
          YouTube로 연결
        </Button>
```

- [ ] **Step 2: Type-check**

Run: `cd web && npx tsc --noEmit`
Expected: no errors (exit 0). The new handler/button are well-typed (mirrors `connectSpotify` + existing `Button`).

- [ ] **Step 3: Build (fuller check)**

Run: `cd web && pnpm build`
Expected: build succeeds. (If the build OOMs/takes long in this environment, the `tsc --noEmit` pass in Step 2 is the authoritative type gate for this trivial change — note it and proceed.)

- [ ] **Step 4: Commit**

```bash
git add web/src/components/player/ConnectToPlay.tsx
git commit -m "feat(share): ConnectToPlay에 'YouTube로 연결' 버튼 — 공유페이지 YT 재생"
```

---

## Self-Review

**1. Spec coverage:**
- §4.1 백엔드 `next`(OAUTH_NEXT_COOKIE·_safe_next·authorize 파라미터·callback 리다이렉트·쿠키 삭제) → Task 1 (a)-(f). ✓
- §4.2 프론트 YouTube 버튼(connectYoutube → authorize?next=) → Task 2. ✓
- §4.3 재생 라우팅 변경 없음(확인됨) → 태스크 없음(의도적, primary_platform youtube 포함). ✓
- §6 open-redirect 방지(`/` 시작·`//` 거부) → `_safe_next` (Task 1c) + 테스트(Task 1 Step 1). ✓
- §2 비목표(생성/write/핸드오프/새 플레이어 없음) → scope·게스트세션 미변경. ✓
- §7 테스트(authorize next 쿠키 set / unsafe 거부 / _safe_next) → Task 1 Step 1. ✓

**2. Placeholder scan:** TBD/TODO 없음. 모든 편집에 정확한 before/after 코드. 4곳 쿠키 삭제는 명시적 앵커(`delete_cookie(OAUTH_VERIFIER_COOKIE)`)에 1줄 추가 — 기계적·구체적. ✓

**3. Type consistency:** `_safe_next(next_url) -> str|None` (Task 1c) ↔ authorize/callback 사용 일치. `OAUTH_NEXT_COOKIE` 상수명 일치. 프론트 `connectYoutube` ↔ 기존 `connectSpotify` 시그니처 동일. `Query`/`quote`/`unquote` import 추가 명시. ✓
