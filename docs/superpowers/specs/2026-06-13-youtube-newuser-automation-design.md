# 신규 유저 자동화 로직 (YouTube 미스곡 임베딩 + MRT 재생성) — 설계

> **목표:** 신규 유저(특히 YouTube)가 들어왔을 때, 추가 수동 작업 없이 취향 프로필이 자동으로 완성되게 한다. 온보딩은 매칭곡으로 즉시 MRT를 주고, 스케줄 파이프라인이 나머지 미스곡을 임베딩한 뒤 영향받은 유저의 MRT를 자동 재생성해 **22% → ~99%로 자동 업그레이드**한다.

작성 2026-06-13. **결정 기록: [ADR-001](../../decisions/ADR-001-youtube-newuser-automation.md)** (이 문서는 그 근거 상세 설계). 인덱스: [docs/README.md](../../README.md). 선행: [Phase 2 임베딩 메커니즘](2026-06-13-youtube-taste-phase2-embedding.md). 이 문서는 그 메커니즘을 **자동 스케줄로 승격**하는 설계다.

---

## 1. 배경 — 왜 필요한가 (재발견 방지용 박제)

YouTube 유저의 라이브러리는 두 부류로 들어온다:
- **매칭곡(~22%)**: import 시 임베딩 보유 카탈로그에 strict 텍스트 매칭됨 → 이미 `TrackEmbedding` 있음.
- **미스곡(~78%)**: 카탈로그에 없어 `upsert_youtube_track`로 신규 Track 생성, **임베딩 없음**.

온보딩 파이프라인(`run_onboarding`)은 **임베딩 보유 UserTrack만** 클러스터링한다([pipeline.py:144](../../../src/mrms/onboarding/pipeline.py#L144), `_fetch_user_track_matrix`). 즉 신규 YouTube 유저는 **취향의 22%만 반영된 MRT**를 받는다.

미스곡을 임베딩하는 메커니즘(yt-dlp → MERT → projection → `TrackEmbedding`)은 Phase 2에서 만들었고 prod에서 실증됐다(c4548: 22%→99.1%, 180→813/820). **그러나 그건 수동 배치(`scripts/13→03→10` + MRT 재생성)였고, 어떤 자동 흐름에도 엮여 있지 않다.** 이 문서가 그 갭을 닫는다.

> 2026-06-13 세션 교훈: 문서가 없어 매 세션 "계정 4개가 왜 있지 / 앱 import가 0을 반환?"을 재발견했다. 아래 **§8 운영 사실**에 핵심을 박제한다.

---

## 2. 기존 인프라 (재사용 대상 — 새로 만들지 말 것)

| 구성요소 | 위치 | 역할 |
|---|---|---|
| **EMP 파이프라인 runner** | `src/mrms/emp/runner.py` `run_pipeline()` | importer(tidal/spotify/.../youtube charts) → `02 download_audio` → `03 extract_embeddings` → `10 load_to_db`. run 추적·crash-safe. |
| **systemd timer 진입점** | `scripts/run_emp_pipeline.py` | SIGTERM→SystemExit, 좀비 run 정리, `run_pipeline(platform="all", triggered_by="scheduler")` 호출. |
| **run 추적 DB** | `src/mrms/db/emp.py` | `create_run`/`append_stage`/`finish_run`/`fail_stale_runs`. status=running/success/partial/failed. |
| **Admin 대시보드("스케줄 관리 페이지")** | `/admin/emp` = `web/src/components/admin/EmpDashboard.tsx` | run/stage 목록(RunRow), 수동 trigger, settings, prune. API=`src/mrms/api/admin_emp.py`. |
| **미스곡 다운로드 스크립트** | `scripts/13_embed_youtube_misses.py` | `--limit/--sleep/--audio-dir`. 유저 라이브러리 youtube 미스곡 videoId → yt-dlp 훅30초 클립 → `youtube_{videoId}.m4a`. |
| **임베딩 로더** | `src/mrms/emp/embedding_loader.py` `fetch_pending()` | inEmp EMP풀 **OR** 유저 라이브러리 youtube 미스곡(실 videoId+UserTrack) union. `candidate_keys`가 `youtube_{videoId}.npy` 매칭. **이미 미스곡 대응됨.** |
| **MRT 생성 (CLI)** | `scripts/09_generate_mrt.py` `generate_for_user()` | cluster→UserEmbedding/UserPersona→search→PlaylistHistory. `MODEL_VERSION="our-v1.0+persona-K3"`. |
| **MRT 생성 (온보딩)** | `src/mrms/onboarding/pipeline.py` `run_onboarding()` 142~181 | 위와 **동일 로직** (중복!). |
| **MRT cron** | `docs/cron-setup.md` | `scripts/09_generate_mrt.py --all` 주2회. |

**핵심 관찰:** 파이프라인은 이미 `03 extract` + `10 load`를 돈다. `10`의 `fetch_pending`은 이미 youtube 미스곡을 잡는다. **빠진 건 단 하나 — `13`(미스곡 다운로드)이 어떤 스케줄에도 없다.** m4a만 생기면 03/10이 알아서 처리한다.

---

## 3. 갭 정의

1. **`scripts/13`(미스곡 다운로드)이 자동 스케줄에 없음.** → 미스곡 npy가 영영 안 생김 → 임베딩 안 됨.
2. **MRT 재생성이 미스곡 임베딩과 연동 안 됨.** 09 cron은 주2회 *전체* 유저 재생성이라 (a) 새 임베딩 반영까지 최대 3일 지연, (b) 전 유저 매번 재생성(비효율).
3. **MRT 생성 로직이 3곳에 중복** (`run_onboarding`, `scripts/09`, 임시 `/tmp/regen_mrt.py`) → DRY 위반, 드리프트 위험.

---

## 4. 설계

### 4.1 파이프라인에 2개 스테이지 추가 (`run_pipeline`)

[runner.py](../../../src/mrms/emp/runner.py)의 스테이지 순서를 다음으로 확장:

```
importers → 02 download_audio → [NEW: 13 youtube_misses] → 03 extract_embeddings → 10 load_to_db → [NEW: regenerate_mrt]
```

- **`youtube_misses` 스테이지** (`03 extract` 직전): `scripts/13_embed_youtube_misses.py --limit N --sleep S`를 `settings.audio_dir`로 다운로드. 그러면 기존 `03 extract`가 새 m4a를 그대로 추출(03은 `out_dir`에 npy 이미 있는 건 skip하므로 카탈로그 재처리 없음, [03:125-126](../../../scripts/03_extract_embeddings.py#L125-L126)). `_run_audio_download`와 동일 패턴의 `_run_youtube_misses()` 헬퍼로 추가.
  - **검증 필요:** 03 기본 `--cache-dir`에 predecode npy가 있으면 `use_cache=True`로 새 m4a를 무시할 수 있음([03:113](../../../scripts/03_extract_embeddings.py#L113)). 파이프라인의 03이 EMP 신규 오디오를 정상 처리 중이므로 현재는 문제없을 것이나, 플랜에서 prod의 cache-dir 상태를 확인하고 필요시 `13` 전용 디렉토리 + 03 `--cache-dir` 빈 경로로 격리한다(수동 배치에서 검증된 방식: `--audio-dir data/audio_yt_misses --cache-dir /tmp/empty --device cuda`).
- **`regenerate_mrt` 스테이지** (`10 load` 직후): **stale MRT 유저만** 재생성(§4.3). importer/download가 전부 fail이어도 이 스테이지는 독립 실행(기존 유저 임베딩 변화 반영).

두 스테이지 모두 `append_stage`로 기록 → **`/admin/emp` 대시보드에 자동 표시**(별도 UI 작업 불필요). status=success/partial/failed로 모니터.

### 4.2 DRY 리팩터 — 공유 MRT 생성 함수

3곳 중복을 `src/mrms/recsys/mrt.py`(또는 신규 `mrt_generate.py`)의 단일 함수로 추출:

```python
def generate_user_mrt(conn, user_id, *, k=3, top_n=20, candidate_pool=30) -> bool:
    """UserTrack 임베딩 → cluster → UserEmbedding/UserPersona → search → PlaylistHistory.
    트랙<K이면 False(skip). 호출자가 commit."""
```

`run_onboarding`의 step2, `scripts/09`의 `generate_for_user`, 새 `regenerate_mrt` 스테이지가 **모두 이 함수 호출**. `MODEL_VERSION`/`CATALOG_MODEL_VERSION`/`DEFAULT_K` 단일 출처 유지.

### 4.3 stale MRT 판정 (affected-user 감지)

전 유저 재생성(09 --all)은 비효율. **임베딩이 새로 붙어 MRT가 낡은 유저만** 골라 재생성:

```sql
-- 재생성 대상: 현재 임베딩 보유 UserTrack 수 > MRT가 계산된 시점의 수
SELECT u.id FROM "User" u
WHERE (SELECT count(*) FROM "UserTrack" ut
         JOIN "TrackEmbedding" e ON e."trackId"=ut."trackId"
        WHERE ut."userId"=u.id AND e."modelVersion"='our-v1.0') >
      COALESCE((SELECT ue."computedFrom" FROM "UserEmbedding" ue
                WHERE ue."userId"=u.id AND ue."modelVersion"='our-v1.0+persona-K3'), 0)
  AND (현재 임베딩 수 >= K);
```

`upsert_user_embedding`이 `computed_from=len(track_ids)`를 저장하므로([pipeline.py:157](../../../src/mrms/onboarding/pipeline.py#L157)), "그 후 임베딩이 늘었나"를 정확히 잡는다. 신규 유저(UserEmbedding 없음=baseline 0) + 미스곡 임베딩으로 카운트 오른 기존 유저 둘 다 포착. 각 대상에 `generate_user_mrt` 호출.

### 4.4 스케줄 / 관리 페이지

- **스케줄:** 기존 systemd timer 그대로 재사용(`run_emp_pipeline.py`). youtube 미스곡 다운로드(yt-dlp)는 느리고 rate-limit 민감하므로 `youtube_misses --limit`로 사이클당 상한(예 500). 백로그는 여러 사이클에 걸쳐 소진. cadence가 catalog 빌드와 달라야 하면 `platform` 인자처럼 별도 trigger 모드 추가 가능(아래 §7 결정).
- **관리 페이지:** 두 신규 스테이지가 `append_stage`로 기록되어 `/admin/emp` RunRow에 자동 노출. **추가 UI 불필요.** (명시적 on/off·cadence UI는 out of scope — §7.)
- **09 cron 처리:** `regenerate_mrt` 스테이지가 affected-user를 매 사이클 처리하므로 주2회 `09 --all` cron은 **백스톱으로 축소 또는 제거**(플랜에서 결정).

---

## 5. 신규 유저 end-to-end 흐름 (이 설계의 결과)

1. 유저가 YouTube 연결 → playlist import → `UserTrack`(매칭곡 임베딩 보유 + 미스곡 임베딩 없음).
2. **온보딩 즉시:** precheck가 매칭곡 ≥K면 `run` → `run_onboarding`이 매칭곡으로 **즉시 MRT**(빠른 첫 화면, ~22%).
3. **다음 파이프라인 사이클:** `youtube_misses` 스테이지가 이 유저 미스곡 다운로드 → `03/10`이 임베딩 → `TrackEmbedding` 적재.
4. **같은 사이클 끝:** `regenerate_mrt`가 이 유저를 stale로 감지 → MRT 재생성(~99%).
5. 유저 체감: 가입 직후 추천 → 잠시 후 **자동으로 풍부해짐**.
6. 미스곡은 유저간 공유(같은 videoId 1회 임베딩)라 **카탈로그가 누적되며 신규 유저 매칭률이 자연 상승** → 갈수록 per-user 다운로드 감소.

tidal/spotify 신규 유저는 ISRC 매칭이라 미스곡 문제 없음(`run_onboarding`이 즉시 완결). 단 카탈로그 임베딩 커버리지(현재 39k중 ~6k)가 추천 풀 품질을 좌우 — 별개 과제(EMP 백로그, `scripts/02`).

---

## 6. 에러 처리 / 안전성

- 두 스테이지는 기존 `run_pipeline`의 try/except + `finish_run(status=partial/failed)` + `fail_stale_runs` 좀비 정리를 그대로 상속.
- `youtube_misses`: yt-dlp 개별 실패(삭제/Premium전용 영상)는 스크립트 내부에서 카운트만(전체 fail 아님). 13개/694 같은 실패율 정상.
- `regenerate_mrt`: 유저별 try/except로 한 명 실패가 배치를 멈추지 않게(09 `--all` 패턴). 트랙<K는 skip.
- 단일 인스턴스: systemd oneshot이 동시 실행 방지(기존 보장).

---

## 7. 미결 결정 / out of scope

- **MRT 재생성 cadence:** 매 파이프라인 사이클 vs 별도(자주). → 플랜에서 timer 주기와 함께 결정. 기본안: 파이프라인 사이클마다 affected-user 재생성.
- **youtube_misses 격리 디렉토리:** 기본 `audio_dir` 공유 vs 전용 `data/audio_yt_misses`. → prod cache-dir 상태 확인 후 결정(§4.1).
- **명시적 스케줄 UI**(잡 on/off, cadence 슬라이더): **out of scope.** 지금은 stage 노출 + 수동 trigger로 충분.
- **per-user 즉시 큐**(Option B): 인프라(큐/워커) 필요, 현 GPU 1대 규모엔 불필요. **채택 안 함.**
- **EMP 카탈로그 백로그**(34k 미임베딩, `scripts/02`): 추천 품질 향상 레버지만 별개 과제.

---

## 8. 운영 사실 (박제 — 재발견 금지)

- **prod `.env.production`은 `mrms` 유저가 직접 못 읽음**(systemd가 root로 주입). 스크립트 수동 실행 시 `DATABASE_URL=$(grep ... .env.production | cut -d= -f2-)`로 변수만 주입하거나, 전체 env 필요 시 root로 mrms-전용 임시본 복사.
- **YouTube 유저 식별 = google_id 합성 email**(`youtube-{id}@auto.local`, [auth_youtube.py:144](../../../src/mrms/api/auth_youtube.py#L144)). 같은 구글 계정=같은 user_id. **중복 유저 버그 아님.**
- **계정 정책:** 사용자는 4개 계정(YouTube 2 + Tidal + Spotify)을 **합치지 않고 구독 티어별로 각각** 유지(무료 youtube 진입 → 구독 갈아타기 데모). MRMS는 한 세션에서 연결한 플랫폼만 같은 유저로 묶음.
- **앱 import 경로 정상.** (c22f 88곡이 앱 경유 적재된 증거. 과거 "0 반환"은 import 前 측정/빈 테스트계정 착각.)
- **prod 검증된 수동 배치 런북:** `13 --audio-dir data/audio_yt_misses` → `03 --audio-dir data/audio_yt_misses --cache-dir /tmp/empty --device cuda`(GPU) → `10` → MRT 재생성(user_id 직접, email 합성이라 `09 --email` 대신).

---

## 9. 테스트 전략

- **단위:** `generate_user_mrt`(추출된 공유 함수) — 합성 임베딩 행렬로 cluster/persona/PlaylistHistory 검증. stale 판정 SQL — computedFrom 경계값.
- **스테이지:** `_run_youtube_misses`/`regenerate_mrt`를 기존 `tests/emp/test_runner.py` 패턴으로 patch 후 stage 기록·status 검증.
- **통합(로컬):** seed 유저 + 미스곡 → `run_pipeline` 1사이클 → 미스곡 임베딩 + 해당 유저 MRT `computedFrom` 상승 확인.
- **회귀:** 미스곡 0일 때 두 스테이지가 no-op success인지(빈 배치 안전).

---

## 파일 영향 요약

- **수정:** `src/mrms/emp/runner.py`(2 스테이지 추가), `src/mrms/onboarding/pipeline.py`·`scripts/09_generate_mrt.py`(공유 함수 호출로 교체).
- **신규:** `generate_user_mrt`(recsys), `_run_youtube_misses`/`regenerate_mrt`/`select_stale_mrt_users` 헬퍼.
- **문서:** `docs/cron-setup.md` 갱신(09 cron 역할 변경), 이 설계 문서.
- **UI:** 변경 없음(스테이지 자동 노출).
