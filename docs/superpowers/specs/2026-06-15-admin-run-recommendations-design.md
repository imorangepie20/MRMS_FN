# 추천 실행 관리 페이지 (전체 / 특정 유저) 상세 설계

작성일: `2026-06-15`
상태: 설계 승인 — 구현 예정.

## 목표

관리자가 MRT 추천(persona + discovery)을 **즉시 강제 재생성**하는 admin 액션. cron(파이프라인 `regenerate_mrt` 스테이지)을 기다리지 않고, 방금 만든 discovery(연관곡 확장)를 돌려 결과를 확인·전파한다. **두 모드**: 특정 유저 1명(sync, 즉시 결과) / 전체(백그라운드, IngestionRun 기록). `generate_user_mrt`를 임포트·임베딩 없이 단독 호출한다.

직접 요청: "추천 실행하는 관리페이지 — 전체 / 특정 아이디 선택".

## 현재 구조 (배경)

- admin 게이트: `_require_admin(conn, user_id)`(`ADMIN_EMAIL` env == 유저 email), 라우트 `/api/admin/emp/*`(admin_emp.py).
- `_run_regenerate_mrt(conn)`(emp/runner.py): **stale** 유저만 `generate_user_mrt` + `conn.commit()` + `prune_playlist_history` + `clear_dismissed`. 본 설계의 per-user 로직 출처.
- `generate_user_mrt(conn, user_id) -> int | None`: SYNC. persona + (끝에) best-effort discovery. 트랙 < k면 `None`. 커밋은 호출자.
- IngestionRun: `create_run(conn, platform, triggered_by) -> run_id` / `append_stage(conn, run_id, dict)` / `finish_run(conn, run_id, status)`. `/admin/emp` runs 목록이 표시.
- 독립 커넥션 패턴: `psycopg.connect(os.environ["DATABASE_URL"])` (scripts/run_emp_pipeline.py).
- `read_discovery(conn, user_id, *, limit)`(recsys/discover.py): discovery 수 확인.
- `MODEL_VERSION = "+persona-K3"`(mrt.py).
- 프론트: `/admin/emp` → `EmpDashboard` → `components/admin/emp/*` 카드. admin 클라 = `lib/api/admin-emp.ts`(`apiFetch`).

## 핵심 결정 — "전체"의 대상

`select_stale_mrt_users`(cron 대상)는 discovery 배포 후 **거의 비어 있다**(discovery는 `MODEL_VERSION`을 안 바꿔 기존 유저가 stale 아님). 그래서 "전체"를 stale로 정의하면 아무도 안 돈다. → **"전체" = MRT(PlaylistHistory at MODEL_VERSION) 보유 전 유저를 stale 무시하고 force 재생성**한다(discovery가 모두에게 전파되도록). 대상 쿼리:
```sql
SELECT DISTINCT "userId" FROM "PlaylistHistory" WHERE "modelVersion" = %s
```

## 백엔드

**`POST /api/admin/emp/run-mrt`** (admin_emp.py, `_require_admin` 재사용), 요청 `RunMrtRequest{ target: "all" | "user", email: str | None = None }`. recsys/db 심볼은 **함수-로컬 import**(admin_emp 모듈 로드 시 무거운 import 회피, `_run_regenerate_mrt` 패턴과 일관).

**target == "user"** (특정, sync):
1. `email` 없으면 400. `email.strip().lower()` → `SELECT id FROM "User" WHERE email = %s`. 없으면 **404** "user not found".
2. `n = generate_user_mrt(conn, target_user_id)` (수 초 — 라이브 Gemini+ytmusicapi).
3. `n is None` → 200 `{ "mode":"user", "regenerated": false, "reason": "UserTrack < k (임베딩 부족)", "tracks_used": 0, "discovery_count": 0 }`.
4. 아니면 `conn.commit()` → `prune_playlist_history(conn, uid)` → `clear_dismissed(conn, uid)` → `discovery_count = len(read_discovery(conn, uid))` → 200 `{ "mode":"user", "regenerated": true, "tracks_used": n, "discovery_count": discovery_count }`.
5. `generate_user_mrt` 예외(드묾) → `safe_rollback(conn)` + **500** "regenerate failed: ...".

**target == "all"** (전체, 백그라운드):
1. 대상 수 계산: `SELECT count(DISTINCT "userId") FROM "PlaylistHistory" WHERE "modelVersion" = %(mv)s` → `N`(요청 conn).
2. FastAPI `BackgroundTasks`에 `_regenerate_all_mrt()` 등록 → 즉시 200 `{ "mode":"all", "queued": N }` 반환.
3. **`_regenerate_all_mrt()`**(요청과 별개 — **자체 conn**): `conn2 = psycopg.connect(os.environ["DATABASE_URL"])`; `run_id = create_run(conn2, platform="mrt", triggered_by="admin")`; 대상 유저 id 목록 조회(위 DISTINCT 쿼리, mv=MODEL_VERSION); 유저별 try/except로 `generate_user_mrt(conn2, uid)` → 성공 시 `conn2.commit()` + `prune_playlist_history` + `clear_dismissed` (실패 시 `safe_rollback(conn2)`, `_run_regenerate_mrt` 동형); `append_stage(conn2, run_id, {"stage":"manual_mrt","status":..., "stdout": f"total={N} regenerated={r} failed={f}", ...})`; `finish_run(conn2, run_id, "success"|"partial")`; `conn2.close()`. (`generate_user_mrt`/discovery는 자체 best-effort라 한 유저 실패가 루프를 안 막음.)

엔드포인트 시그니처에 `background: BackgroundTasks` 주입(`from fastapi import BackgroundTasks`).

## 프론트

**`web/src/components/admin/emp/RunMrtCard.tsx`** (신규) — `EmpDashboard`에 카드:
- 라디오: **전체** / **특정 유저**.
- 특정 선택 시 email 입력(기본값 = 관리자 본인 email, `useUser().user?.email`).
- "추천 실행" 버튼(로딩). 특정=수 초 대기 후 결과 `{regenerated · tracks_used · discovery_count}`(또는 reason); 전체=즉시 `"N명 큐잉됨 — 아래 Runs에서 확인"`.
- 에러 메시지(404/403/500).

**`web/src/lib/api/admin-emp.ts`**: `runMrt(target, email?) -> { mode, regenerated?, tracks_used?, discovery_count?, reason?, queued? }` (apiFetch POST `/api/admin/emp/run-mrt`).

**`web/src/components/admin/EmpDashboard.tsx`**: `RunMrtCard` 추가 렌더. 전체 실행 결과는 기존 Runs 목록(IngestionRun `manual_mrt` 스테이지)에 노출.

## 에러 / 엣지

- 특정: 미존재 email→404, email 누락→400, 트랙 부족→200 `regenerated:false`+reason, generate 예외→500.
- 전체: 항상 즉시 200 `{queued:N}`; 실제 유저별 실패는 IngestionRun stage(`partial` + stdout)에 기록(백그라운드라 응답엔 안 실림).
- 비-admin → 403.
- 라이브 LLM 지연: 특정=버튼 로딩, 전체=백그라운드(요청 즉시 반환).
- 백그라운드 conn은 요청 conn과 분리(요청 conn은 응답 후 닫힘) → 자체 `psycopg.connect`.

## 테스트 전략

엔드포인트 **로직**(분기·응답·백그라운드 등록)을 검증한다. 실제 임베딩 유저 셋업은 무겁고 라이브 LLM을 타므로, 함수-로컬 import되는 recsys 심볼을 **소스 모듈에서 패치**(함수-로컬 import는 호출 시 모듈 속성을 다시 읽어 패치 반영됨).

- 통합(`tests/api/test_admin_run_mrt.py` 신규), admin = `monkeypatch.setenv("ADMIN_EMAIL", <admin email>)` + `login(<admin email>)`:
  - **특정 성공**: `patch.object(mrms.recsys.mrt, "generate_user_mrt", lambda c,u,**k: 7)` + `patch.object(mrms.recsys.discover, "read_discovery", lambda c,u,**k: [{}, {}])` + prune/clear no-op 패치 → 대상 유저(`get_or_create_user`) email로 `{target:"user", email}` → 200 · `{mode:"user", regenerated:true, tracks_used:7, discovery_count:2}`.
  - **특정 트랙부족**: `generate_user_mrt`→`lambda c,u,**k: None` → 200 · `regenerated:false` + reason.
  - **특정 미존재 email** → 404. **email 누락** → 400.
  - **전체**: 대상 카운트 쿼리가 N을 세도록 PlaylistHistory 1행 심거나(또는 0이어도) → `{target:"all"}` → 200 · `{mode:"all", queued: N}`. 백그라운드 함수는 `patch.object(<admin_emp module>, "_regenerate_all_mrt", mock)`으로 호출만 확인(실DB 백그라운드 미실행 — 라이브/잔여물 방지). 또는 BackgroundTasks가 테스트에서 동기 실행되면 generate_user_mrt 패치로 no-op.
  - **비-admin**(다른 email 로그인) → 403.
- ⚠️ DB 격리: cleanup(생성 User/AuthSession/PlaylistHistory). 전체 `pytest tests/` 금지.

## 비채택 / 범위 밖 (YAGNI)

- 진행률 SSE 스트리밍 — IngestionRun runs 목록으로 충분.
- 별도 admin 페이지 — 기존 `/admin/emp` 카드로 흡수.
- discovery 단독 실행 — generate_user_mrt의 일부(persona 후행). 단독 의미 없음.
- 유저 드롭다운/검색 — email 직접 입력으로 충분(MVP).
- "전체"를 stale 기준으로 — discovery 전파엔 force-all이 맞음(핵심 결정).

## 후속 작업

1. `api/admin_emp.py`: `RunMrtRequest` + `POST /run-mrt`(user=sync / all=BackgroundTasks) + `_regenerate_all_mrt`(자체 conn + IngestionRun).
2. 프론트: `lib/api/admin-emp.ts` `runMrt` + `RunMrtCard.tsx`(라디오+email) + `EmpDashboard` 렌더.
3. 통합 테스트.

## 관련 문서

- [추천 EMP-밖 discovery](2026-06-15-recommendation-expansion-discovery-design.md) (이 액션이 실행하는 discovery)
- 코드: `src/mrms/api/admin_emp.py`(`_require_admin`·`admin_trigger`), `src/mrms/emp/runner.py`(`_run_regenerate_mrt`·create_run/finish_run), `src/mrms/recsys/mrt.py`(`generate_user_mrt`·`MODEL_VERSION`), `src/mrms/recsys/discover.py`(`read_discovery`), `web/src/components/admin/EmpDashboard.tsx`, `web/src/lib/api/admin-emp.ts`
