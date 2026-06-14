# ADR-006 Wellness / 정서 조절 추천 (chicken soup clinic)

작성일: `2026-06-14`

## 상태

승인 — 구현 예정. 상세 설계 [2026-06-14-wellness-mood-recommendation-design.md](../superpowers/specs/2026-06-14-wellness-mood-recommendation-design.md)(실데이터 검증·보강 완료). 위치=Search 하단(Discover), 메뉴명=chicken soup clinic.

## 결정

무드(`calm`/`energize`/`focus`/`sleep`)를 고르면 그 무드의 정서 영역 + 본인 취향에 맞는 곡 20개를 추천한다. **새 모델 학습 없이** 기존 `TrackAudioFeatures`(166k) + `UserEmbedding`(MRT 인프라) + MRT 제외 로직을 조합.

- **안전 프레이밍:** "웰니스/정서 조절"만 표방, **임상 "치료(therapy)" 금지**(효능 주장엔 임상 근거·책임 필요). UI 카피도 웰니스 어휘만.
- **후보 풀 = 임베딩+피처 있는 전 카탈로그(166k)**, `inEmp` 아님. (실측: inEmp 8곡뿐 → inEmp 필터 시 전 무드 0건. MRT search_for_persona도 inEmp 안 씀.)
- **소프트 무드 스코어**(중심점 거리 가우시안) + **취향 cosine** 결합 `score = W_MOOD·mood_fit + W_TASTE·taste_sim`. UserEmbedding 없으면 mood_fit만(폴백 — 유저 임베딩 4명뿐이라 폴백이 사실상 기본). 하드 BETWEEN 비채택(분포 극단: sleep 1곡 vs energize 6만 → 소프트가 강건).

## 배경

MRMS는 추천 중심이나 "지금 기분에 맞는 음악" 진입점이 없었다. 이미 166k 트랙의 오디오 피처(valence/energy/tempo…)와 256d 임베딩, MRT의 유저 임베딩·제외 로직이 있어, **새 학습 없이** 무드 추천을 조립할 수 있다. 원안(my-forever-music 이식)은 `inEmp` 필터·하드 범위를 썼는데 실 dev DB 검증에서 둘 다 깨져(0건 / sleep 1곡) 보강했다.

## 근거

- 피처·임베딩·HNSW cosine 인덱스·제외 로직이 전부 존재 → 신규 코드 최소(recsys 1 + api 1 + 프론트 2 + test).
- 소프트 스코어는 분포에 강건(항상 top-N) + 유저 임베딩 희소(4명) 현실에 적합(폴백=기본 경로 품질 보장).
- 제외/모델버전을 MRT와 공유 → 일관·재사용.

## 결과

좋은 점:
- "무드 → 내 취향 곡" 진입점 신설, 학습 비용 0.
- 데이터 분포에 강건(하드필터의 sleep=1 문제 해소).
- MRT 인프라 재사용으로 신규 표면 최소.

트레이드오프:
- 결합 스코어라 HNSW top-K 대신 166k 전 스캔(비실시간 메뉴라 수용; 후속 narrowing 최적화).
- 무드 프리셋(중심점·σ·가중)이 초기안 → 실사용 튜닝 필요.
- 유저 임베딩 4명 → 당분간 대다수 mood-only(취향 반영은 소수).

## 후속 작업

1. `recsys/wellness.py`(MOOD_PRESETS + recommend_wellness, mood_fit/taste 분기·제외).
2. `api/wellness.py`(GET /api/wellness/recommendations) + main.py 등록.
3. 프론트 `/wellness` 페이지(무드 칩 + ModalTrackList) + `lib/api/wellness.ts` + nav.
4. 단위(mood_fit 단조·폴백·제외·항상 n곡) + 통합 테스트.

## 관련 문서

- [상세 설계](../superpowers/specs/2026-06-14-wellness-mood-recommendation-design.md)
- [user-embedding-mrt-design](../superpowers/specs/2026-06-08-user-embedding-mrt-design.md)
- 코드: `src/mrms/recsys/mrt.py`(search_for_persona·MODEL_VERSION), `src/mrms/db/user_embedding.py`, `mrms.config.EMBEDDING_MODEL_VERSION`
