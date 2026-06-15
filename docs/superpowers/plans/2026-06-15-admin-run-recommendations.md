# 추천 실행 관리 페이지 (전체/특정) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관리자가 `/admin/emp`에서 MRT 추천(persona+discovery)을 즉시 강제 재생성 — 특정 유저(sync 즉시결과) 또는 전체(백그라운드+IngestionRun, MRT 보유 전 유저 force).

**Architecture:** `POST /api/admin/emp/run-mrt {target,email?}` (`_require_admin` 재사용). user=`generate_user_mrt` sync 후 즉시 결과; all=FastAPI BackgroundTasks로 자체 conn + IngestionRun 기록하며 force 재생성. recsys/db 심볼은 함수-로컬 import(`_run_regenerate_mrt` 패턴). 프론트는 `/admin/emp` EmpDashboard에 카드(라디오+email) 추가.

**Tech Stack:** FastAPI(+BackgroundTasks) + raw psycopg, Next.js/React(admin 카드), pytest(TestClient + monkeypatch 소스모듈 패치 — 함수-로컬 import라 호출 시 패치 반영), tsc/lint/build(프론트).

**참고 — 절대 경로:** 루트 `/Volumes/MacExtend 1/MRMS_FN`. 러너 `.venv/bin/pytest`, 린트 `.venv/bin/ruff`(line-length 100). 프론트 `web/`(`pnpm lint`, `npx tsc --noEmit`, `pnpm build`).

**⚠️ DB 격리:** dev DB 격리 안 됨. **전체 `pytest tests/` 금지** — 대상 파일만. 라이브 Gemini/ytmusicapi 차단: 테스트는 `generate_user_mrt`/`read_discovery`/`_regenerate_all_mrt`를 패치(절대 실호출 금지).

---

### Task 1: 백엔드 — `POST /api/admin/emp/run-mrt` (user sync / all background)

**Files:**
- Modify: `src/mrms/api/admin_emp.py`
- Test: `tests/api/test_admin_run_mrt.py`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/api/test_admin_run_mrt.py` 신규:

```python
"""Admin run-mrt — 특정/전체 추천 강제 재생성."""
import uuid as _uuid
from unittest.mock import MagicMock

from fastapi.testclient import TestClient

import mrms.api.admin_emp as _admin
from mrms.api.main import app
from mrms.db.user_track import get_or_create_user

client = TestClient(app)


def _login_admin(login, monkeypatch):
    admin_email = f"admin-{_uuid.uuid4().hex[:8]}@example.com"
    _, session_id = login(admin_email)
    monkeypatch.setenv("ADMIN_EMAIL", admin_email)
    client.cookies.set("mrms_session", session_id)
    return admin_email


def test_run_mrt_user_success(login, monkeypatch, db_conn, cleanup):
    _login_admin(login, monkeypatch)
    target_email = f"target-{_uuid.uuid4().hex[:8]}@example.com"
    get_or_create_user(db_conn, target_email)
    db_conn.commit()
    cleanup('DELETE FROM "User" WHERE email = %s', (target_email,))
    # 함수-로컬 import되는 심볼을 소스 모듈에서 패치 (호출 시 모듈 속성 재참조됨)
    monkeypatch.setattr("mrms.recsys.mrt.generate_user_mrt", lambda c, u, **k: 7)
    monkeypatch.setattr("mrms.recsys.discover.read_discovery", lambda c, u, **k: [{}, {}])
    monkeypatch.setattr("mrms.db.user_embedding.prune_playlist_history", lambda *a, **k: 0)
    monkeypatch.setattr("mrms.db.user_blocked.clear_dismissed", lambda *a, **k: 0)
    try:
        r = client.post("/api/admin/emp/run-mrt", json={"target": "user", "email": target_email})
        assert r.status_code == 200, r.text
        assert r.json() == {
            "mode": "user", "regenerated": True, "tracks_used": 7, "discovery_count": 2,
        }
    finally:
        client.cookies.clear()


def test_run_mrt_user_insufficient_tracks(login, monkeypatch, db_conn, cleanup):
    _login_admin(login, monkeypatch)
    target_email = f"target-{_uuid.uuid4().hex[:8]}@example.com"
    get_or_create_user(db_conn, target_email)
    db_conn.commit()
    cleanup('DELETE FROM "User" WHERE email = %s', (target_email,))
    monkeypatch.setattr("mrms.recsys.mrt.generate_user_mrt", lambda c, u, **k: None)
    try:
        r = client.post("/api/admin/emp/run-mrt", json={"target": "user", "email": target_email})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["mode"] == "user" and d["regenerated"] is False and "reason" in d
    finally:
        client.cookies.clear()


def test_run_mrt_user_not_found(login, monkeypatch):
    _login_admin(login, monkeypatch)
    try:
        r = client.post(
            "/api/admin/emp/run-mrt",
            json={"target": "user", "email": "nobody-xyz@example.com"},
        )
        assert r.status_code == 404
    finally:
        client.cookies.clear()


def test_run_mrt_user_email_required(login, monkeypatch):
    _login_admin(login, monkeypatch)
    try:
        r = client.post("/api/admin/emp/run-mrt", json={"target": "user"})
        assert r.status_code == 400
    finally:
        client.cookies.clear()


def test_run_mrt_all_queues_background(login, monkeypatch):
    _login_admin(login, monkeypatch)
    # 백그라운드 실제 실행 차단 (TestClient는 BackgroundTasks를 동기 실행) — 호출만 확인
    fake = MagicMock()
    monkeypatch.setattr(_admin, "_regenerate_all_mrt", fake)
    try:
        r = client.post("/api/admin/emp/run-mrt", json={"target": "all"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["mode"] == "all" and isinstance(d["queued"], int)
        assert fake.called  # 백그라운드 등록·실행됨
    finally:
        client.cookies.clear()


def test_run_mrt_requires_admin(login, monkeypatch):
    # admin 아님: ADMIN_EMAIL을 다른 값으로
    _, session_id = login(f"notadmin-{_uuid.uuid4().hex[:8]}@example.com")
    monkeypatch.setenv("ADMIN_EMAIL", "someone-else@example.com")
    client.cookies.set("mrms_session", session_id)
    try:
        r = client.post("/api/admin/emp/run-mrt", json={"target": "all"})
        assert r.status_code == 403
    finally:
        client.cookies.clear()
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `.venv/bin/pytest tests/api/test_admin_run_mrt.py -v`
Expected: FAIL — `/api/admin/emp/run-mrt` 라우트 없음(404) → 단언 실패. (단 `test_run_mrt_all_queues_background`의 `monkeypatch.setattr(_admin, "_regenerate_all_mrt", ...)`는 그 심볼이 아직 없어 `AttributeError`로 fail 가능 — 정상.)

- [ ] **Step 3: 구현 — admin_emp.py**

`src/mrms/api/admin_emp.py` import 블록의 fastapi import에 `BackgroundTasks` 추가:

```python
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
```

파일 맨 끝(마지막 라우트 뒤)에 요청 모델 + 백그라운드 함수 + 라우트 추가:

```python
class RunMrtRequest(BaseModel):
    target: str  # "all" | "user"
    email: str | None = None


def _regenerate_all_mrt() -> None:
    """MRT 보유 전 유저 force 재생성 (백그라운드, 자체 conn + IngestionRun).

    generate_user_mrt(persona+discovery)는 유저별 best-effort. select_stale 무시(force).
    """
    import time

    from mrms.db.emp import append_stage, create_run, finish_run
    from mrms.db.user_blocked import clear_dismissed
    from mrms.db.user_embedding import prune_playlist_history
    from mrms.emp.base import safe_rollback
    from mrms.recsys.mrt import MODEL_VERSION, generate_user_mrt

    conn = psycopg.connect(os.environ["DATABASE_URL"])
    t0 = time.monotonic()
    try:
        run_id = create_run(conn, platform="mrt", triggered_by="admin")
        with conn.cursor() as cur:
            cur.execute(
                'SELECT DISTINCT "userId" FROM "PlaylistHistory" WHERE "modelVersion" = %s',
                (MODEL_VERSION,),
            )
            uids = [r[0] for r in cur.fetchall()]
        regenerated = failed = 0
        for uid in uids:
            try:
                if generate_user_mrt(conn, uid) is not None:
                    conn.commit()   # generate_user_mrt 쓰기 명시 커밋 (호출자 책임)
                    prune_playlist_history(conn, uid)  # 자체 commit
                    clear_dismissed(conn, uid)         # 자체 commit
                    regenerated += 1
            except Exception:
                safe_rollback(conn)
                failed += 1
        status = "success" if failed == 0 else "partial"
        # stage dict 키는 runner.py 규약(_run_regenerate_mrt)과 동일: stage/status/
        # duration_ms/stdout/stderr/error. RunRow.tsx가 duration_ms·error를 렌더.
        append_stage(conn, run_id, {
            "stage": "manual_mrt", "status": status,
            "duration_ms": int((time.monotonic() - t0) * 1000),
            "stdout": f"total={len(uids)} regenerated={regenerated} failed={failed}",
            "stderr": "", "error": None if failed == 0 else f"{failed} user(s) failed",
        })
        finish_run(conn, run_id, status)
        conn.commit()
    finally:
        conn.close()


@router.post("/run-mrt")
def admin_run_mrt(
    req: RunMrtRequest,
    background: BackgroundTasks,
    user_id: str = Depends(get_current_user_id),
    conn: psycopg.Connection = Depends(db_conn),
):
    """MRT(persona+discovery) 강제 재생성. target='user'(sync) | 'all'(백그라운드)."""
    _require_admin(conn, user_id)
    from mrms.recsys.mrt import MODEL_VERSION

    if req.target == "all":
        with conn.cursor() as cur:
            cur.execute(
                'SELECT count(DISTINCT "userId") FROM "PlaylistHistory" WHERE "modelVersion" = %s',
                (MODEL_VERSION,),
            )
            n = cur.fetchone()[0]
        background.add_task(_regenerate_all_mrt)
        return {"mode": "all", "queued": int(n)}

    if req.target == "user":
        email = (req.email or "").strip().lower()
        if not email:
            raise HTTPException(400, "email required for target=user")
        with conn.cursor() as cur:
            cur.execute('SELECT id FROM "User" WHERE email = %s', (email,))
            row = cur.fetchone()
        if not row:
            raise HTTPException(404, "user not found")
        target_uid = row[0]

        from mrms.db.user_blocked import clear_dismissed
        from mrms.db.user_embedding import prune_playlist_history
        from mrms.emp.base import fmt_exc, safe_rollback
        from mrms.recsys.discover import read_discovery
        from mrms.recsys.mrt import generate_user_mrt

        try:
            n = generate_user_mrt(conn, target_uid)
        except Exception as e:
            safe_rollback(conn)
            raise HTTPException(500, f"regenerate failed: {fmt_exc(e, 200)}") from e
        if n is None:
            return {
                "mode": "user", "regenerated": False,
                "reason": "UserTrack < k (임베딩 부족)",
                "tracks_used": 0, "discovery_count": 0,
            }
        conn.commit()   # generate_user_mrt 쓰기 명시 커밋 (호출자 책임)
        prune_playlist_history(conn, target_uid)  # 자체 commit
        clear_dismissed(conn, target_uid)         # 자체 commit
        discovery_count = len(read_discovery(conn, target_uid))
        return {
            "mode": "user", "regenerated": True,
            "tracks_used": n, "discovery_count": discovery_count,
        }

    raise HTTPException(400, "target must be 'all' or 'user'")
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `.venv/bin/pytest tests/api/test_admin_run_mrt.py -v`
Expected: PASS (6개).

- [ ] **Step 5: lint + Commit**

Run: `.venv/bin/ruff check src/mrms/api/admin_emp.py tests/api/test_admin_run_mrt.py`
Expected: **신규 위반 없음**. admin_emp.py에 **사전존재** B008(Depends-in-default)·B904(기존 raise)가 남아 있을 수 있으나 이 변경이 추가한 것이 아니어야 함(새 500 raise는 `from e`라 B904 아님). import 정렬 경고면 `.venv/bin/ruff check --fix`.

```bash
git add src/mrms/api/admin_emp.py tests/api/test_admin_run_mrt.py
git commit -m "feat(admin): POST /run-mrt — 특정(sync)/전체(백그라운드 IngestionRun) MRT 강제 재생성"
```

---

### Task 2: 프론트 — `runMrt` 클라 + `RunMrtCard` + EmpDashboard 렌더

**Files:**
- Modify: `web/src/lib/api/admin-emp.ts`
- Create: `web/src/components/admin/emp/RunMrtCard.tsx`
- Modify: `web/src/components/admin/EmpDashboard.tsx`

- [ ] **Step 1: API 클라 추가**

`web/src/lib/api/admin-emp.ts` 맨 끝에 추가:

```typescript
export interface RunMrtResult {
  mode: "user" | "all";
  regenerated?: boolean;
  tracks_used?: number;
  discovery_count?: number;
  reason?: string;
  queued?: number;
}

export async function runMrt(
  target: "all" | "user",
  email?: string,
): Promise<RunMrtResult> {
  const r = await apiFetch(
    "/api/admin/emp/run-mrt",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target, email }),
    },
    "run mrt",
  );
  return r.json();
}
```

(`apiFetch`는 이 파일 상단에서 이미 import됨 — 확인.)

- [ ] **Step 2: RunMrtCard 작성**

`web/src/components/admin/emp/RunMrtCard.tsx` 신규:

```tsx
"use client";

import { useState } from "react";

import { runMrt } from "@/lib/api/admin-emp";
import { useUser } from "@/lib/hooks/use-user";


interface Props {
  /** 전체 큐잉 후 Runs 목록 새로고침 (선택) */
  onAllQueued?: () => void;
}


export function RunMrtCard({ onAllQueued }: Props) {
  const { user } = useUser();
  const [target, setTarget] = useState<"user" | "all">("user");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const effectiveEmail = email || user?.email || "";

  const run = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await runMrt(target, target === "user" ? effectiveEmail : undefined);
      if (r.mode === "all") {
        setResult(`${r.queued}명 큐잉됨 — 아래 Runs에서 확인`);
        onAllQueued?.();
      } else if (r.regenerated) {
        setResult(`재생성 완료 — 사용 트랙 ${r.tracks_used}, discovery ${r.discovery_count}`);
      } else {
        setResult(`건너뜀 — ${r.reason}`);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-6 border border-(--mrms-rule) p-4">
      <div className="font-mono text-[10px] tracking-editorial uppercase text-(--mrms-ink-mute) mb-3">
        추천 실행 (MRT + discovery)
      </div>
      <div className="flex items-center gap-4 mb-3 text-[13px] text-(--mrms-ink)">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="radio"
            checked={target === "user"}
            onChange={() => setTarget("user")}
          />
          특정 유저
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="radio"
            checked={target === "all"}
            onChange={() => setTarget("all")}
          />
          전체
        </label>
      </div>
      {target === "user" && (
        <input
          type="email"
          value={effectiveEmail}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="user email"
          className="w-full mb-3 bg-(--mrms-paper) border border-(--mrms-ink) px-2 py-1.5 font-mono text-[12px] text-(--mrms-ink)"
        />
      )}
      <button
        onClick={run}
        disabled={busy || (target === "user" && !effectiveEmail)}
        className="bg-(--mrms-ink) text-(--mrms-paper) px-3 py-1.5 font-mono text-[11px] tracking-editorial uppercase border-0 cursor-pointer hover:bg-(--mrms-rust) disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {busy ? "실행 중…" : "추천 실행"}
      </button>
      {result && (
        <div className="mt-3 font-mono text-[11px] text-(--mrms-ink-soft)">{result}</div>
      )}
      {error && (
        <div className="mt-3 font-mono text-[11px] text-(--mrms-rust)">{error}</div>
      )}
    </div>
  );
}
```

> `useUser`는 `@/lib/hooks/use-user`에서 `{ user }` 반환(`user?.email` 보유 — UserInfo.email). 카드 스타일은 EmpDashboard의 기존 톤(`border-(--mrms-rule)`, 모노 라벨)에 맞춤.

- [ ] **Step 3: EmpDashboard에 렌더**

`web/src/components/admin/EmpDashboard.tsx` 상단 카드 import 부근에 추가:

```typescript
import { RunMrtCard } from "./emp/RunMrtCard";
```

그리고 JSX에서 **`<SettingsCard ... />` 다음·"Recent runs" `<section>` 앞**에 렌더한다. `onAllQueued`는 runs를 다시 부르는 `loadRuns`로 연결하되, **`loadRuns`는 `async (page: number)` 시그니처라 인자가 필요하다** — 0-인자 콜백으로 호출되므로 반드시 래핑:

```tsx
      <RunMrtCard onAllQueued={() => loadRuns(0)} />
```

> ⚠️ `onAllQueued={loadRuns}`로 직접 넘기면 `loadRuns(undefined)` → `offset = undefined * RUNS_PAGE_SIZE = NaN`. 반드시 `() => loadRuns(0)`로 래핑(또는 무인자 `refresh` 사용). `loadRuns`/`refresh`는 EmpDashboard에 이미 정의돼 있음(`loadRuns = useCallback(async (page) => ...)`, `refresh = async () => ...`).

- [ ] **Step 4: 타입체크 + lint + 빌드**

Run:
```bash
cd web && npx tsc --noEmit -p tsconfig.json
```
Expected: 에러 없음.

```bash
cd web && pnpm lint 2>&1 | grep -E "RunMrtCard|admin-emp|EmpDashboard" | grep -iv "canonical" || echo "NO NON-CANONICAL FINDINGS IN CHANGED FILES"
```
Expected: `NO NON-CANONICAL FINDINGS IN CHANGED FILES` (또는 pre-existing canonical-class 경고만).

```bash
cd web && pnpm build 2>&1 | grep -E "Compiled successfully|Failed|Error:|/admin" | head
```
Expected: `Compiled successfully` + `/admin/emp` 라우트 존재, 컴파일 에러 없음.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/api/admin-emp.ts web/src/components/admin/emp/RunMrtCard.tsx web/src/components/admin/EmpDashboard.tsx
git commit -m "feat(admin): /admin/emp 추천 실행 카드 (전체/특정 라디오 + runMrt)"
```

---

## 수동 검증 (전체 완료 후, dev/prod)

1. ADMIN_EMAIL 계정으로 `/admin/emp` → "추천 실행" 카드.
2. 특정 = 본인 email → 실행 → "재생성 완료 — 트랙 N, discovery M" → `/mrt`에서 블렌드 추천 확인.
3. 전체 → "N명 큐잉됨" → Runs 목록에 `manual_mrt` 스테이지(`total/regenerated/failed`) 확인.
4. 트랙 부족 유저 email → "건너뜀 — UserTrack < k".

---

## Self-Review (작성자 체크 결과)

**Spec coverage:** 엔드포인트 user(sync)/all(background)·`_require_admin`·404/400/500·트랙부족=regenerated:false(Task1) / `_regenerate_all_mrt` 자체conn+IngestionRun(Task1) / 프론트 runMrt·RunMrtCard 라디오+email·EmpDashboard 렌더(Task2) 전부 매핑. "전체"=force-all-with-MRT(MODEL_VERSION PlaylistHistory) 반영.

**Placeholder scan:** 모든 스텝 실제 코드·명령·기대출력. Task2 Step3의 `onAllQueued` 연결만 "기존 runs 로드 함수에 연결, 없으면 생략"으로 위임(실재 함수명은 구현자가 확인 — prop optional이라 미연결도 동작). 그 외 placeholder 없음.

**Type consistency:** `RunMrtRequest{target,email?}`(Task1) ↔ 프론트 `runMrt(target,email?)`(Task2) ↔ 테스트 json 페이로드 일치. 응답 `{mode, regenerated?, tracks_used?, discovery_count?, reason?, queued?}`(Task1) ↔ `RunMrtResult`(Task2) ↔ 테스트 단언 일치. `_regenerate_all_mrt`(Task1) ↔ 테스트 `monkeypatch.setattr(_admin, "_regenerate_all_mrt", ...)` 일치. 함수-로컬 import 심볼(`generate_user_mrt`/`read_discovery`/`prune_playlist_history`/`clear_dismissed`/`safe_rollback`/`fmt_exc`/`MODEL_VERSION`/`create_run`/`append_stage`/`finish_run`) 전부 실재 시그니처(그라운딩 확인).
