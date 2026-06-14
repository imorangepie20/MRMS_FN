# Wellness / 정서 조절 추천 (chicken soup clinic) — 설계 [보강판]

> **메뉴명:** chicken soup clinic · **위치:** Search 하단(Discover 그룹). **상태:** 설계 확정(실데이터 검증·보강 완료), 미구현.
> **범위:** 무드를 고르면 그 무드의 정서 영역에 맞으면서 본인 취향에 가까운 곡을 추천하는 가벼운 메뉴 1개. **새 모델 학습 없음.**

작성 2026-06-14. 인덱스: [docs/README.md](../../README.md). 선행: [user-embedding-mrt-design](2026-06-08-user-embedding-mrt-design.md). **보강:** 실 dev DB 검증으로 원안의 치명 가정(`inEmp` 필터)·분포 문제(하드 범위)를 수정. ADR: [ADR-006](../../decisions/ADR-006-wellness-recommendation.md).

---

## 0. 실데이터 검증 (보강 근거)

dev DB 실측:
- `TrackAudioFeatures`: **166,579곡** 전부 valence/energy/tempo(+acousticness/instrumentalness) 채워짐. modelVersion=`our-v1.0`, source=`our_model`. 스케일: valence 0.01–0.99(avg 0.61), energy 0.04–0.90(avg 0.57), **tempo 3–155 BPM**(avg 119), acousticness 0.01–0.95, instrumentalness 0.00–1.00.
- `TrackEmbedding`: 166,587곡, mv=`our-v1.0`, **HNSW cosine 인덱스 존재**(`idx_embedding_hnsw USING hnsw (embedding vector_cosine_ops)`). 임베딩∩피처 = **166,579곡**.
- `UserEmbedding`: **4명**, mv=`our-v1.0+persona-K3`.
- `Track.inEmp=TRUE`: **8곡**(EMP=검색/크롤 풀).

**도출된 수정:**
1. **`inEmp=TRUE` 필터 제거 [치명/필수]** — inEmp는 8곡뿐 → 원안대로면 모든 무드 0건. 진짜 후보 = **임베딩+피처 있는 166k 전 카탈로그**(MRT `search_for_persona`도 inEmp 안 쓰고 catalog modelVersion으로 검색 — 동일 원칙).
2. **하드 BETWEEN → 소프트 무드 스코어 [권장]** — 하드 범위는 분포가 극단적(실측: calm 234 · energize 60,180 · focus 37,708 · **sleep 1**)이라 위험. 중심점 거리 기반 소프트 스코어로 항상 top-N 채움.
3. **결합 스코어 + 무드 우선 폴백** — UserEmbedding이 4명뿐 → 대다수가 폴백 경로. 폴백(무드 스코어)이 사실상 기본이므로 소프트 스코어가 핵심.

## 1. Goal

무드(`calm`/`energize`/`focus`/`sleep`) 선택 → ① 무드 적합도(오디오 피처 중심점 거리) + ② 취향 유사도(UserEmbedding cosine) 결합 점수로 카탈로그를 정렬 → 상위 20곡. 보유/차단 곡 제외.

## 2. 프레이밍 & 안전 (확정)

- **"정서 조절 / 웰니스"** 프레이밍만. **임상 "치료(therapy)" 표방 금지**(효능 주장엔 임상 근거·책임 필요, 백킹 없음).
- UI 카피는 웰니스 어휘만("기분 전환/이완/집중/수면 보조"). "불면증 치료" 류 금지.

## 3. Success Criteria

```
GET /api/wellness/recommendations?mood=calm
→ 200, { mood, tracks: [ {track_id, title, artist, album_cover, score, mood_fit, taste_sim, valence, energy, tempo} × 20 ] }
```
- [ ] 각 무드가 **항상 20곡** 반환(소프트 스코어 — 희소 영역도 최근접). sleep도 0건 안 남.
- [ ] UserEmbedding 있는 유저 → 결과가 무드 적합 + **취향 반영**.
- [ ] UserEmbedding 없는 유저 → **무드 스코어만**으로 정렬(폴백).
- [ ] 보유(UserTrack)·차단(UserBlocked disliked) 곡 제외.
- [ ] 웹 무드 칩 클릭 → 추천 리스트.
- [ ] 재현성: 같은 입력 같은 결과(랜덤성 없음).

## 4. Architecture

```
web: (dashboard)/wellness/page.tsx       무드 칩 + 추천 리스트 (ModalTrackList 재사용)
  ↓ GET /api/wellness/recommendations?mood=calm
src/mrms/api/wellness.py                  라우터 (deps: conn, user_id)
  ↓
src/mrms/recsys/wellness.py               MOOD_PRESETS + recommend_wellness(conn, user_id, mood, n=20)
  ↓ PostgreSQL (단일 쿼리)
  - TrackAudioFeatures(166k)  무드 적합 소프트 스코어 (중심점 거리)
  - TrackEmbedding(256d,HNSW) 취향 유사 (UserEmbedding과 cosine)
  - UserTrack/UserBlocked     제외 (search_for_persona WHERE 재사용)
```

상수(검증됨): `from mrms.config import EMBEDDING_MODEL_VERSION` → `CATALOG_MV = EMBEDDING_MODEL_VERSION`(=`our-v1.0`, features·catalog 공용), `USER_MV = EMBEDDING_MODEL_VERSION + "+persona-K3"`(=`recsys.mrt.MODEL_VERSION`).

## 5. 무드 프리셋 (중심점 + 축별 σ + 가중)

각 무드 = 5축 중심점(valence·energy·tempo·acousticness·instrumentalness) + 축별 σ. 무관 축은 σ를 크게(≈무시). **초기안, 실데이터로 튜닝.**

| 무드 | v0 | e0 | tempo0 | acoustic0 | instr0 | 메모 |
|---|---|---|---|---|---|---|
| `calm` (이완) | 0.40 | 0.25 | 85 | 0.70 | — | 차분, 어쿠스틱 가점 |
| `energize` (활력) | 0.78 | 0.80 | 135 | — | — | 밝고 높은 각성 |
| `focus` (집중) | 0.50 | 0.45 | 110 | — | 0.70 | 중각성, 인스트루멘탈 가점 |
| `sleep` (수면) | 0.28 | 0.12 | 68 | 0.80 | 0.50 | 매우 낮은 각성, 어쿠스틱 |

축별 σ(공통 기본): σ_valence=σ_energy=0.18, σ_tempo=28(BPM), σ_acoustic=0.25, σ_instr=0.30. "—"(무관) 축은 그 무드에서 σ=∞(가중 0). `recsys/wellness.py` 상수 dict로 한곳 관리.

## 6. 추천 알고리즘

**mood_fit**(0~1) = 정규화 가우시안:
```
mood_fit = exp( -0.5 * Σ_axis  ((x_axis - center_axis) / σ_axis)^2 )
```
(무관 축은 항목 생략.) tempo는 BPM 그대로(σ를 BPM로).

**taste_sim**(0~1) = `1 - (TrackEmbedding.embedding <=> UserEmbedding.embedding)`. UserEmbedding 없으면 미사용.

**최종 점수:**
```
score = W_MOOD * mood_fit + W_TASTE * taste_sim          (UserEmbedding 있음)
score = mood_fit                                          (없음 — 폴백)
```
초기 가중 `W_MOOD=0.6, W_TASTE=0.4`(튜닝 대상). 정렬 `ORDER BY score DESC LIMIT n`.

**단일 쿼리 스케치** (taste 경로):
```sql
WITH u AS (
  SELECT embedding FROM "UserEmbedding"
  WHERE "userId" = %(uid)s AND "modelVersion" = %(user_mv)s
)
SELECT t.id, t.title, ar.name AS artist, t."albumId",
       taf.valence, taf.energy, taf.tempo,
       exp(-0.5 * (
            power((taf.valence - %(v0)s)/%(sv)s, 2)
          + power((taf.energy  - %(e0)s)/%(se)s, 2)
          + power((taf.tempo   - %(t0)s)/%(st)s, 2)
          /* + acoustic/instr 항목 (무드별 동적 추가) */
       )) AS mood_fit,
       1 - (e.embedding <=> u.embedding) AS taste_sim
FROM "TrackAudioFeatures" taf
JOIN "Track"          t  ON t.id = taf."trackId"
JOIN "Artist"         ar ON ar.id = t."artistId"
JOIN "TrackEmbedding" e  ON e."trackId" = t.id AND e."modelVersion" = %(catalog_mv)s
CROSS JOIN u
WHERE taf."modelVersion" = %(features_mv)s
  AND t.id NOT IN (SELECT "trackId" FROM "UserTrack" WHERE "userId" = %(uid)s)
  AND t.id NOT IN (
        SELECT "targetId" FROM "UserBlocked"
        WHERE "userId" = %(uid)s AND "targetType" = 'track' AND reason = 'disliked'
      )
ORDER BY (%(w_mood)s * mood_fit + %(w_taste)s * taste_sim) DESC
LIMIT %(n)s;
```
- **inEmp 없음** — TrackEmbedding∩TrackAudioFeatures JOIN이 후보를 166k로 한정.
- **폴백(`u` 없음/0행)**: CROSS JOIN u가 0행 → 결과 0이 되므로, **유저 임베딩 유무를 Python에서 분기**해 taste 없는 쿼리(임베딩 JOIN·CROSS JOIN 생략, `ORDER BY mood_fit DESC`)를 실행. 동적 항목(acoustic/instr)·가중·분기는 `recsys/wellness.py`가 조립.
- **제외 절**: `search_for_persona`의 UserTrack/UserBlocked WHERE 그대로 차용(앨범 차단 확장도 동일하게).
- **성능**: 결합 스코어라 HNSW top-K가 아니라 **166k 전 스캔**(피처 산술 + 256d cosine 1회/행). 비실시간 메뉴라 수백 ms 수용. (후속 최적화: mood_fit 상위 후보로 1차 좁힌 뒤 taste 재정렬 — 범위 밖.)

## 7. 파일 변경 (최소)

| # | 파일 | 변경 |
|---|---|---|
| 1 | `src/mrms/recsys/wellness.py` | **신규** — `MOOD_PRESETS` dict + `recommend_wellness(conn, user_id, mood, n=20) -> list[dict]`(mood_fit/taste 분기·동적 쿼리 조립·제외) |
| 2 | `src/mrms/api/wellness.py` | **신규** — `GET /api/wellness/recommendations?mood=` 라우터(무드 검증, deps conn·user_id) |
| 3 | `src/mrms/api/main.py` | `app.include_router(wellness_router)` 1줄 |
| 4 | `web/src/lib/nav.ts` | Discover 그룹 Search 아래 "chicken soup clinic"(또는 약자+full) 항목 |
| 5 | `web/src/app/(dashboard)/wellness/page.tsx` | **신규** — 무드 칩(4) + 추천 리스트(`ModalTrackList` 재사용) |
| 6 | `web/src/lib/api/wellness.ts` | **신규** — `fetchWellness(mood)` 헬퍼 |
| 7 | `tests/recsys/test_wellness.py` | **신규** — mood_fit 단조성·폴백(임베딩 없음)·제외·항상 n곡 |

## 8. 폴백 / 엣지

- **UserEmbedding 없음(대다수)** → taste 미적용, mood_fit만 정렬. (Python 분기.)
- **소프트 스코어라 후보 부족 없음** — 항상 최근접 n곡. (하드 필터의 sleep=1 문제 해소.)
- **오디오 피처 없는 트랙** → TrackAudioFeatures JOIN으로 자연 제외(전 카탈로그가 피처 보유라 사실상 전부 후보).
- **재현성** — 랜덤 없음, 같은 입력 같은 결과.
- **잘못된 mood** → 400.

## 9. 테스트 전략

- **단위(`recsys/wellness.py`)**: (a) mood_fit이 중심점에서 멀수록 감소(단조), (b) 임베딩 없는 유저 → mood-only 경로(taste 쿼리 안 탐), (c) UserTrack/UserBlocked 제외, (d) 항상 ≤n·>0곡(피처 시드). 플랫폼/임베딩은 시드(소수 Track+Features+Embedding) 또는 mood_fit 순수함수 분리 테스트.
- **통합(`api/wellness.py`)**: `GET ...?mood=calm` 200 + 형태 + 잘못된 mood 400.
- DB는 dev(cleanup) — 전체 `pytest tests/` 금지(테스트 DB 위생), 파일 지정 실행.

## 10. 범위 밖 / 후속

- Iso-principle 시퀀싱(현재→목표 감정 곡선, `energyCurve` 32포인트 활용).
- 무드별 like/skip 학습으로 프리셋·가중 개인화.
- mood_fit 1차 후보 narrowing 성능 최적화.
- `kpopMood` 라벨 보조 필터.

## 11. 재사용 자산

- `recsys/mrt.py` — `search_for_persona`(제외 WHERE·cosine 패턴), `MODEL_VERSION`/`CATALOG_MODEL_VERSION`.
- `db/user_embedding.py::fetch_user_embedding(conn, user_id, mv)→{embedding,...}|None`.
- `mrms.config.EMBEDDING_MODEL_VERSION`.
- 웹: `web/src/components/track/ModalTrackList.tsx`(추천 리스트), `web/src/lib/api/http.ts`(apiFetch), `web/src/lib/nav.ts`.
- 스키마: `TrackAudioFeatures`(valence/energy/tempo/acousticness/instrumentalness/confidence), `TrackEmbedding`(vector(256)+HNSW), `UserEmbedding`, `UserTrack`, `UserBlocked`.
