# ADR-001 YouTube 신규 유저 자동화 (미스곡 임베딩 + MRT 재생성)

작성일: `2026-06-13`

## 상태

제안 — 설계 승인됨, 구현 대기. (구현 완료 시 `승인`으로 갱신)

## 결정

YouTube 미스곡 임베딩(yt-dlp→MERT→TrackEmbedding)과 MRT 재생성을 **별도 cron이 아니라 기존 EMP 파이프라인(`run_pipeline`)의 스테이지로 통합**한다.

- `run_pipeline`에 두 스테이지 추가: `youtube_misses`(`scripts/13` 다운로드, `03 extract` 직전) + `regenerate_mrt`(`10 load` 직후, stale MRT 유저만).
- 온보딩은 매칭곡으로 **즉시 MRT**를 주고, 파이프라인 사이클이 미스곡을 임베딩한 뒤 영향 유저 MRT를 재생성해 **22%→~99% 자동 업그레이드**한다.
- MRT 생성 로직(현재 `run_onboarding`·`scripts/09`·임시 스크립트 3중복)을 `generate_user_mrt` 단일 함수로 추출(DRY).
- 두 스테이지는 `append_stage`로 기록되어 **`/admin/emp` 대시보드에 자동 노출**(추가 UI 불필요).

대안 B(import 시 per-user 큐/워커)는 인프라 부담이 커 현 GPU 1대 규모에 부적합 — **채택하지 않음**.

## 배경

YouTube 유저 라이브러리는 매칭곡(~22%, 임베딩 보유)과 미스곡(~78%, 임베딩 없음)으로 들어온다. 온보딩은 임베딩 보유 UserTrack만 클러스터링하므로 신규 YouTube 유저는 **취향의 22%만 반영된 MRT**를 받는다.

미스곡 임베딩 메커니즘은 Phase 2에서 구축·prod 실증됐으나(c4548: 22%→99.1%, 180→813/820) **수동 배치(`13→03→10` + MRT 재생성)였고 어떤 자동 흐름에도 없었다.** 사업모델 핵심(무료 YouTube 진입)을 위해 신규 유저 흐름이 **자동으로 완성**돼야 한다.

기존에 이미 EMP 파이프라인 runner(importer→`02`→`03`→`10`, run 추적·systemd timer·crash-safe)와 `/admin/emp` 대시보드가 있다. `10`의 `fetch_pending`은 이미 미스곡을 잡는다 — **빠진 건 `13`(미스곡 다운로드)이 어느 스케줄에도 없는 것 하나뿐.**

## 근거

- 파이프라인은 이미 `03 extract`·`10 load`를 돈다 → 미스곡 m4a만 생기면 자동 처리. 스테이지 2개만 추가하면 됨(최소 변경).
- run 추적·crash-safety·systemd timer·대시보드 노출을 **전부 재사용** → 새 인프라 0.
- stale 판정(`UserEmbedding.computedFrom < 현재 임베딩 수`)으로 신규 유저 + 미스곡 임베딩된 기존 유저만 재생성 → `09 --all`(전 유저 주2회)보다 즉각·효율적.
- 미스곡은 유저간 공유(같은 videoId 1회 임베딩)라 카탈로그가 누적되며 신규 유저 매칭률이 자연 상승.

## 결과

좋은 점:

- 신규 YouTube 유저가 추가 수동 작업 없이 풍부한 MRT로 자동 수렴.
- 새 코드 최소(스테이지 2 + DRY 추출), 기존 운영/모니터링 그대로.
- `/admin/emp`에서 미스곡·MRT 재생성 진행을 run/stage로 관찰·수동 trigger 가능.

트레이드오프:

- yt-dlp 다운로드는 느리고 rate-limit 민감 → 사이클당 `--limit` 상한 필요, 백로그는 여러 사이클에 소진.
- MRT 업그레이드에 최소 1 파이프라인 사이클 지연(즉시 아님). 온보딩 즉시 MRT로 첫 경험은 보장.
- 미스곡 임베딩은 GPU(MERT)·디스크·yt-dlp 쿼터를 소비 — 대량 신규 유입 시 스케일 재검토 필요.

## 후속 작업

1. `generate_user_mrt` 추출 + `run_onboarding`·`scripts/09` 교체 (DRY)
2. `run_pipeline`에 `youtube_misses`·`regenerate_mrt` 스테이지 추가
3. stale MRT 유저 선택 쿼리(`select_stale_mrt_users`) + 유저별 try/except 배치
4. prod 03 `--cache-dir` 상태 확인 → 필요시 미스곡 전용 audio-dir 격리
5. `cron-setup.md` 갱신(09 cron 역할 축소/백스톱)
6. 파이프라인 cadence·`youtube_misses --limit` 결정
7. 테스트: 공유 함수 단위 + 스테이지 patch + 로컬 1사이클 통합

## 관련 문서

- [상세 설계](../superpowers/specs/2026-06-13-youtube-newuser-automation-design.md) — 스테이지·DRY·stale 판정·테스트 전략 전문
- [Phase 2 임베딩 메커니즘](../superpowers/specs/2026-06-13-youtube-taste-phase2-embedding.md)
- [pipeline.md](../pipeline.md) — EMP 파이프라인 런북
- [cron-setup.md](../cron-setup.md) — 현행 MRT 갱신 cron(이 ADR로 역할 변경)
- 코드: `src/mrms/emp/runner.py`(run_pipeline), `src/mrms/onboarding/pipeline.py`(run_onboarding), `scripts/13_embed_youtube_misses.py`, `src/mrms/emp/embedding_loader.py`(fetch_pending)
