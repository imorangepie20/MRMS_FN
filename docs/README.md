# MRMS_FN Docs Index

새 세션·새 작업자는 **이 인덱스부터** 본다. 흩어진 문서를 매번 재발견하지 않도록, 모든 문서를 한 줄 설명 + 링크로 등록한다. 새 문서를 만들면 **여기에 등록**한다.

## 우선순위 문서

- [architecture.md](architecture.md): MRMS 시스템 설계 — 핵심 아키텍처(데이터 모델·파이프라인·서비스 경계)
- [deployment.md](deployment.md): Production 배포·운영 매뉴얼. 서버=home server(Ubuntu/Zorin), 도메인=`mrms.approid.team`(Cloudflare Tunnel)
- [pipeline.md](pipeline.md): 전체 데이터 처리 + 모델 학습 + DB 적재 파이프라인 런북 (7 메인 + 1 보조 스크립트)
- [setup.md](setup.md): 로컬 환경 셋업 가이드(사전 요구사항·DB·venv)

## 운영 / 스케줄링

- [cron-setup.md](cron-setup.md): MRT 갱신 스케줄링 — `scripts/09_generate_mrt.py --all` 주2회(crontab/launchd). ⚠️ [ADR-001](decisions/ADR-001-youtube-newuser-automation.md)에서 파이프라인 스테이지로 승격 예정
- [cloudflare-tunnel-setup.md](cloudflare-tunnel-setup.md): OAuth redirect용 고정 HTTPS 서브도메인(Cloudflare Tunnel) — dev
- [lambda-labs-setup.md](lambda-labs-setup.md): Lambda Labs A100에서 166k 트랙 MERT-95M 임베딩 ~1시간 추출

## 도메인 노트

- [contents_constructure.md](contents_constructure.md): 기본 컨텐츠 구조 및 구성
- [tidal-sdk-notes.md](tidal-sdk-notes.md): Tidal playback 구현 노트(E.5)

## 결정 기록 (ADR)

- [decisions/ADR-001-youtube-newuser-automation.md](decisions/ADR-001-youtube-newuser-automation.md): YouTube 신규 유저 자동화 — 미스곡 임베딩 + MRT 재생성을 EMP 파이프라인 스테이지로 통합
- [decisions/ADR-002-pgt-library-mrt-curation.md](decisions/ADR-002-pgt-library-mrt-curation.md): PGT 라이브러리(5섹션 파생 그룹핑) + MRT→PGT 이동(display 필터) + MRT prune
- [decisions/ADR-003-mrt-reactions.md](decisions/ADR-003-mrt-reactions.md): MRT 4종 반응(좋아요/취향저격/싫어요=영구차단/관심없어요=일시숨김) — UserBlocked 재사용
- [decisions/ADR-004-tidal-spectrum-equalizer.md](decisions/ADR-004-tidal-spectrum-equalizer.md): Tidal 전용 진짜 스펙트럼 비주얼 이퀄라이저 — audio element를 Web Audio AnalyserNode로 탭(SDK 우회 불필요)
- [decisions/ADR-005-search-emp-expansion.md](decisions/ADR-005-search-emp-expansion.md): 검색 → EMP 확장 — Tidal+Spotify 라이브 검색을 우리 포맷으로 정규화·표시하며 동시에 EMP 적재(사용자 주도 import)
- [decisions/ADR-006-wellness-recommendation.md](decisions/ADR-006-wellness-recommendation.md): Wellness 무드 추천(chicken soup clinic) — 기존 피처+임베딩 조합, 소프트 무드스코어+취향, 학습 없음(웰니스 프레이밍, 치료 금지)
- [decisions/ADR-007-situation-llm-recommendation.md](decisions/ADR-007-situation-llm-recommendation.md): 상황 텍스트 → LLM(Gemini) 해석 → 추천(situation desk) — wellness 일반화(LLM이 피처 중심점+가중치 산출), `google-genai`·구조화 출력, 실패=502. ⚠️ 추천 엔진은 [ADR-008](decisions/ADR-008-taste-first-embedding-recsys.md)로 대체.
- [decisions/ADR-008-taste-first-embedding-recsys.md](decisions/ADR-008-taste-first-embedding-recsys.md): 무드 추천 표현 전환 — 피처 센트로이드 → 취향-우선 임베딩(`recommend_by_taste_mood`). 자체 acousticness 피처 무의미(실데이터) → 폐기, 유저 취향 임베딩 최근접 풀 + v/e/t 재정렬. situation·wellness 공용. "몽땅 클래식" 해소
- [decisions/ADR-010-shared-playlist-page.md](decisions/ADR-010-shared-playlist-page.md): 공유 플레이리스트 페이지(Share & Play, Eat The Shared의 짝) — 내 플레이리스트를 공개 링크 `/p/{token}`로 공유, 방문자가 **우리 페이지에서** 재생. 재생하려면 본인 Spotify/Tidal을 우리 OAuth로 연결(=사이트 세션). 목적=홍보. (외부 export는 트래픽 유출로 기각)
- [decisions/ADR-009-share-url-import.md](decisions/ADR-009-share-url-import.md): 공유 URL 가져오기(Eat The Shared) — Tidal/Spotify track·playlist·album 공유 링크 붙여넣어 트랙 fetch→EMP 적재→청취. 단독 페이지 `/import`, ADR-005 fetch/normalize/persist 재사용(신규=URL 파서+단일트랙 fetch+라우트)

## 설계 / 계획 (superpowers)

설계 스펙은 [superpowers/specs/](superpowers/specs/), 구현 계획은 [superpowers/plans/](superpowers/plans/)에 날짜 prefix로 누적.

- [superpowers/specs/2026-06-14-search-emp-expansion-design.md](superpowers/specs/2026-06-14-search-emp-expansion-design.md): 검색 → EMP 확장 상세 설계 ([ADR-005](decisions/ADR-005-search-emp-expansion.md)의 근거 문서)
- [superpowers/specs/2026-06-14-search-page-editorial-polish-design.md](superpowers/specs/2026-06-14-search-page-editorial-polish-design.md): 검색 페이지 editorial 폴리시(헤더·input·스켈레톤·empty/idle, shadcn 룩 전환 없음)
- [superpowers/specs/2026-06-14-wellness-mood-recommendation-design.md](superpowers/specs/2026-06-14-wellness-mood-recommendation-design.md): Wellness 무드 추천 상세 설계(실데이터 검증·보강판 — inEmp 제거·소프트 무드스코어·취향 결합) ([ADR-006](decisions/ADR-006-wellness-recommendation.md))
- [superpowers/specs/2026-06-14-situation-llm-recommendation-design.md](superpowers/specs/2026-06-14-situation-llm-recommendation-design.md): 상황 텍스트 → Gemini 해석 → 추천(situation desk) 상세 설계(wellness 엔진 일반화·구조화 출력·검증/폴백·실패 502) ([ADR-007](decisions/ADR-007-situation-llm-recommendation.md))
- [superpowers/specs/2026-06-15-shared-playlist-page-design.md](superpowers/specs/2026-06-15-shared-playlist-page-design.md): 공유 플레이리스트 페이지(Share & Play) 상세 설계 — `Playlist.shareId` 토큰·공개 `GET /api/shared/{token}`·공개 페이지 `/p/[shareId]`(브랜딩+리스트+player)·재생 시 우리 OAuth 연결 유도. player/OAuth/플레이리스트 인프라 재사용 ([ADR-010](decisions/ADR-010-shared-playlist-page.md))
- [superpowers/plans/2026-06-15-shared-playlist-page.md](superpowers/plans/2026-06-15-shared-playlist-page.md): 위 설계의 구현 계획 (마이그레이션 shareId → db 헬퍼 → share 토글 API → 무인증 공개 조회 API → 프론트 클라/공유 버튼/공개 페이지, TDD 7 태스크)
- [superpowers/specs/2026-06-15-youtube-music-search-design.md](superpowers/specs/2026-06-15-youtube-music-search-design.md): YouTube Music 검색(쿼터 밸런스) 상세 설계 — 검색에 YT Music을 Tidal/Spotify 동급 제3소스로. ytmusicapi 주력(쿼터 0)+Data API 폴백 일일 예산가드, 연결/primary 게이트, videoId 적재로 재생 resolve 쿼터 절약. v1 트랙만(앨범/플리 후속)
- [superpowers/plans/2026-06-15-youtube-music-search.md](superpowers/plans/2026-06-15-youtube-music-search.md): 위 설계의 구현 계획 (normalize_ytmusic_track+youtube_track_id → search/youtube.py(ytmusicapi+예산가드 폴백) → persist youtube + api/search.py 연결 게이트 fan-out, TDD 3 태스크)
- [superpowers/specs/2026-06-14-share-url-import-design.md](superpowers/specs/2026-06-14-share-url-import-design.md): 공유 URL 가져오기(Eat The Shared) 상세 설계 — URL 파싱(track/playlist/album×2플랫폼)·단일트랙 fetch·EMP 적재, dev/prod 토큰·`37i9` 리스크 ([ADR-009](decisions/ADR-009-share-url-import.md))
- [superpowers/plans/2026-06-14-situation-llm-recommendation.md](superpowers/plans/2026-06-14-situation-llm-recommendation.md): 위 설계의 구현 계획 (config→google-genai→엔진 일반화→llm/situation→api→프론트, TDD 8 태스크)
- [superpowers/plans/2026-06-14-wellness-mood-recommendation.md](superpowers/plans/2026-06-14-wellness-mood-recommendation.md): 위 설계의 구현 계획 (recsys/wellness mood_fit+recommend, api, /wellness 페이지, TDD 6 태스크)
- [superpowers/plans/2026-06-14-search-emp-expansion.md](superpowers/plans/2026-06-14-search-emp-expansion.md): 위 설계의 구현 계획 (백엔드-퍼스트 2단계 — search 모듈+normalize/merge/persist+2 라우트, /search 페이지, TDD 10 태스크)
- [superpowers/specs/2026-06-14-tidal-spectrum-equalizer-design.md](superpowers/specs/2026-06-14-tidal-spectrum-equalizer-design.md): Tidal 전용 진짜 스펙트럼 이퀄라이저 상세 설계 ([ADR-004](decisions/ADR-004-tidal-spectrum-equalizer.md)의 근거 문서)
- [superpowers/plans/2026-06-14-tidal-spectrum-equalizer.md](superpowers/plans/2026-06-14-tidal-spectrum-equalizer.md): 위 설계의 구현 계획 (Vitest 셋업 + binsToBarHeights + 캡처 레이어 + activePlatform + 컴포넌트, TDD 6 태스크)
- [superpowers/specs/2026-06-14-mrt-reactions-design.md](superpowers/specs/2026-06-14-mrt-reactions-design.md): MRT 4종 반응 상세 설계 ([ADR-003](decisions/ADR-003-mrt-reactions.md)의 근거 문서)
- [superpowers/plans/2026-06-14-mrt-reactions.md](superpowers/plans/2026-06-14-mrt-reactions.md): 위 설계의 구현 계획 (UserBlocked reason + 반응 엔드포인트 + 제외 3지점 + 프론트, TDD 7 태스크)
- [superpowers/specs/2026-06-13-pgt-library-mrt-curation-design.md](superpowers/specs/2026-06-13-pgt-library-mrt-curation-design.md): PGT 라이브러리 + MRT 큐레이션 상세 설계 ([ADR-002](decisions/ADR-002-pgt-library-mrt-curation.md)의 근거 문서)
- [superpowers/plans/2026-06-13-pgt-library-mrt-curation.md](superpowers/plans/2026-06-13-pgt-library-mrt-curation.md): 위 설계의 구현 계획 (A 범위 — PGT 섹션 API+화면 → MRT 이동 → prune, TDD 9 태스크)
- [superpowers/specs/2026-06-13-youtube-newuser-automation-design.md](superpowers/specs/2026-06-13-youtube-newuser-automation-design.md): 신규 유저 자동화 상세 설계 ([ADR-001](decisions/ADR-001-youtube-newuser-automation.md)의 근거 문서)
- [superpowers/plans/2026-06-13-youtube-newuser-automation.md](superpowers/plans/2026-06-13-youtube-newuser-automation.md): 위 설계의 구현 계획 (generate_user_mrt 추출 + 2 파이프라인 스테이지 + stale 판정, TDD 7 태스크)
- [superpowers/specs/2026-06-13-youtube-taste-phase2-embedding.md](superpowers/specs/2026-06-13-youtube-taste-phase2-embedding.md): Phase 2 — YouTube 미스곡 임베딩 메커니즘(yt-dlp→MERT→TrackEmbedding)

## 문서 작성 규약

- **인덱스 우선:** 새 문서는 만든 즉시 이 README에 한 줄 설명으로 등록.
- **결정은 ADR로:** 아키텍처/운영 결정은 `decisions/ADR-NNN-<topic>.md`에 `상태/결정/배경/근거/결과/후속작업/관련 문서` 포맷으로 기록.
- **상호 참조:** 각 문서 하단에 "관련 문서" 링크. 코드 참조는 `path:line`로.
- **상세 설계는 spec, 결정은 ADR:** ADR은 간결한 결정 기록 + spec 링크. 상세는 `superpowers/specs/`.
