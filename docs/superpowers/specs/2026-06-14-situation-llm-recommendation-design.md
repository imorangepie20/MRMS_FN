# 상황 텍스트 → LLM 해석 → 추천 (situation desk) 상세 설계

작성일: `2026-06-14`
상태: 설계 승인 — 구현 예정. [ADR-007](../../decisions/ADR-007-situation-llm-recommendation.md).

## 목표

사용자가 **자유 텍스트로 상황을 적으면**, LLM(Gemini)이 읽고 해석해 그 장면에 맞는 곡을 추천하는 별도 페이지. 직접 사용자 표현: "어느 상황을 텍스트로 적어 놓으면 LLM 모델이 읽고 해석해서 이 상황에 맞는 트랙을 선택해서 추천해주는 페이지".

핵심: **chicken soup clinic(wellness)의 일반화** — 고정 무드 칩 대신, LLM이 자유 텍스트를 해석해 **연속 피처 중심점 + 축별 가중치 + 한 줄 해석**을 만들고, 그걸 기존 `mood_fit × 취향` 스코어러에 넣어 top-20을 뽑는다. 새 추천 모델 학습 없음.

## 사용자 경험

1. 별도 새 페이지(`/situation`, nav 메뉴 항목 추가)에서 텍스트 입력란에 상황을 적는다. 예: "비 오는 일요일 아침, 혼자 커피 마시며 책 읽기".
2. 제출하면 로딩 → **LLM이 읽은 해석 한 줄 + 무드 라벨**이 결과 위에 표시되고(예: "차분하고 어쿠스틱한, 느린 템포의 일요일 아침"), 그 아래 추천 트랙 20곡 + **Play All**.
3. 해석 노출은 'LLM이 진짜 읽었다'는 가치를 드러내 신뢰를 높인다(사용자 결정).
4. 메뉴명: `situation desk`(한국어 태그라인 "상황을 적으면 그 장면에 맞는 곡을"). 변경 가능.

## 아키텍처 / 데이터 흐름

```
[/situation 페이지] 상황 텍스트
   → POST /api/situation/recommendations { text }
       → interpret_situation(text)          # Gemini 2.5 Flash, JSON 구조화 출력
           → SituationInterpretation { interpretation, mood_label, 5×(center, weight) }
       → build_preset(interp)               # {축: (center, sigma, weight)}, sigma=wellness 상수 재사용
       → recommend_by_preset(conn, user_id, preset, n=20)   # 기존 wellness 엔진 일반화
   ← { interpretation, mood_label, features, tracks }
[/situation 페이지] 해석 한 줄 + 무드 라벨 헤더 + ModalTrackList + PlayAllButton
```

## LLM 통합 (Gemini)

- **SDK:** `google-genai`(`from google import genai`, `from google.genai import types`). 신규 의존성.
- **클라이언트:** `genai.Client(api_key=settings.GEMINI_API_KEY)`. 키는 env `GEMINI_API_KEY`(dev/prod 양쪽 세팅 — dev 이미 입력됨).
- **모델:** `gemini-2.5-flash`(구조화 출력 안정 지원, 빠름/저렴). 모델 id는 설정 상수로 두어 교체 가능(더 신형 flash는 키 접근권 확인 후 옵션).
- **구조화 출력:** `config=types.GenerateContentConfig(response_mime_type="application/json", response_schema=SituationInterpretation)` → `response.parsed`로 Pydantic 인스턴스 획득.

### 출력 스키마 (Pydantic `SituationInterpretation`)

축별 **중심점(center) + 가중치(weight)**를 LLM이 직접 산출(설계 결정 A1). sigma는 LLM이 만지지 않고 wellness 상수 재사용.

| 필드 | 타입 | 범위/의미 |
|---|---|---|
| `interpretation` | str | 한국어 한 줄 해석(사용자 노출) |
| `mood_label` | str | 짧은 무드 라벨(예: "차분한 일요일 아침") |
| `valence` | float | 0~1 (밝음/긍정) |
| `energy` | float | 0~1 (에너지) |
| `tempo_bpm` | float | 40~200 (BPM) |
| `acousticness` | float | 0~1 |
| `instrumentalness` | float | 0~1 |
| `valence_weight` | float | 0~1 (이 상황에서 이 축의 중요도; 0=무시) |
| `energy_weight` | float | 0~1 |
| `tempo_weight` | float | 0~1 |
| `acousticness_weight` | float | 0~1 |
| `instrumentalness_weight` | float | 0~1 |

플랫 필드(중첩 객체 대신)로 구조화 출력 안정성 확보.

### 프롬프트 설계

시스템/지시 프롬프트 고정 — 역할은 **"음악 무드 해석기"**:
- 상황 텍스트를 valence/energy/tempo/acousticness/instrumentalness 중심값과 **축별 중요도(weight)**로 매핑.
- 각 피처의 의미와 정상 범위를 명시(valence=정서 밝기 0~1, energy=강도 0~1, tempo=BPM, acousticness=어쿠스틱성, instrumentalness=보컬 적음 정도). tempo는 BPM(느림 60~80, 보통 90~120, 빠름 130~160).
- 상황과 무관한 축은 weight를 낮게/0으로(예: "집중"이면 instrumentalness 강조, "드라이브"면 tempo·energy 강조).
- `interpretation`은 한국어 한 줄, 따뜻하지만 과장 없이.
- **안전 프레이밍(웰니스/정서 조절, 임상 "치료(therapy)" 표방 금지)**. 음악과 무관하거나 유해/부적절한 입력은 중립값(모든 center 0.5·tempo 110·weight 균등)으로 디플렉트하고 그 사실을 `interpretation`에 자연스럽게 반영.

### 장르 쏠림(클래식) 완화 — 실데이터 근거

wellness calm/sleep이 클래식에 쏠려 보인 원인은 그 중심점의 **acousticness·instrumentalness가 높아** 카탈로그의 클래식/오케스트라/뉴에이지 영역에 떨어지기 때문(점수 방식 무관). 단, 실측 top-30 아티스트 다양성은 이미 충분(calm 29/30, sleep 26/30 고유) → 곡 중복이 아니라 **장르** 인상의 문제. 결정적 레버는 **instrumentalness**: 중심을 0.1로 낮추고 weight를 주면 결과가 보컬 곡으로 전환됨(검증: Joe Cocker/Etta James/The Stranglers 등, 클래식 0곡, instrumentalness 0.00~0.17).

따라서 프롬프트 규칙:
- **기본값은 '보컬 위주'** — 대부분의 일상·사회·활동 상황은 instrumentalness 중심을 낮게(~0.10~0.20) + 유의미한 weight로 둬서 보컬 팝/락/소울 영역에 머물게 한다.
- **명백히 기악/배경/집중·공부/수면/명상**일 때만 instrumentalness·acousticness의 center·weight를 올린다.
- acousticness를 습관적으로 높이지 말 것("조용함" ≠ "어쿠스틱").
- 장르 컬럼 부재(`subgenres` 전부 빈 값, `kpopMood` 0) → 다양성은 **중심점 배치**로 제어한다. 결과가 한 장르로 쏠리면 후속으로 **아티스트 단위 cap**(결과 dedup)을 추가할 수 있으나, 현 데이터상 아티스트 다양성은 충분해 초기 미도입.

### 검증 / 폴백

`build_preset`에서:
- center 클램프: valence/energy/acousticness/instrumentalness → [0,1], tempo_bpm → [40,200].
- weight 클램프: [0,1].
- 모든 weight 합이 0이면 전부 1.0으로(균등 폴백) — `mood_fit`이 빈 식이 되지 않게.
- sigma 상수(`_DEFAULT_SIGMA`): valence 0.18, energy 0.18, tempo 28, acousticness 0.25, instrumentalness 0.30 (wellness 프리셋 σ 재사용).
- preset = `{축: (center, sigma, weight)}` → 기존 `recommend_by_preset`에 그대로 투입.

### 실패 처리

- Gemini 예외/타임아웃/`response.parsed is None`(max_output_tokens 초과 포함) → `interpret_situation`이 예외 → API가 **HTTP 502 + 친절 메시지**로 표면화. 추천의 핵심이 해석이라 **랜덤/중립 결과로 속이지 않음**(설계 결정). UI가 에러 상태 표시.
- 입력: 트림 후 빈 문자열 → 400. 길이 캡 400자 — 초과분은 잘라서 사용(거부 아님).

## 백엔드

### 1) `src/mrms/recsys/wellness.py` 일반화 (회귀 없음)

현 `recommend_wellness(conn, user_id, mood, n)`의 본체(SQL 조립·제외·취향 결합·행 매핑)를 **`recommend_by_preset(conn, user_id, preset, n)`**로 추출. preset = `dict[str, tuple[float,float,float]]`(= 기존 `MOOD_PRESETS[mood]` 형태). `recommend_wellness`는 `MOOD_PRESETS[mood]`를 꺼내 `recommend_by_preset`을 호출하는 얇은 래퍼로 축소. 기존 SELECT 컬럼 순서·제외 로직·`mood_fit` SQL·취향 분기 모두 그대로 — **기존 wellness 단위/통합 테스트가 변경 없이 통과**해야 함.

### 2) `src/mrms/llm/situation.py` 신규

- `SituationInterpretation`(Pydantic) — 위 스키마.
- `_DEFAULT_SIGMA`, `_SITUATION_PROMPT`(지시문).
- `interpret_situation(text: str) -> SituationInterpretation` — Gemini 호출(클라이언트 주입 가능하게 해 테스트에서 mock).
- `build_preset(interp: SituationInterpretation) -> dict[str, tuple[float,float,float]]` — 클램프·폴백·sigma 결합(순수 함수, LLM 무관 단위 테스트 용이).

### 3) `src/mrms/api/situation.py` 신규 + `main.py` 등록

- `POST /api/situation/recommendations` body `{ text }` → 인증(`get_current_user_id`) → `interpret_situation` → `build_preset` → `recommend_by_preset(n=20)` → `{ interpretation, mood_label, features:{valence,energy,tempo,acousticness,instrumentalness, weights...}, tracks }`.
- 빈 텍스트 400, LLM 실패 502.

## 프론트

- 신규 페이지 `web/src/app/(dashboard)/situation/page.tsx` — masthead(에디토리얼, 소문자 영문 + 한국어 태그라인), textarea 입력 + 제출 버튼, 로딩/에러/idle 상태. 결과: 해석 한 줄 + 무드 라벨 헤더 → `ModalTrackList` + `PlayAllButton`(기존 재사용).
- `web/src/lib/api/situation.ts` — `fetchSituation(text)`; 타입은 `web/src/lib/types.ts`에 `SituationResult`(해석 + tracks). 트랙 타입은 wellness와 동일 형태 재사용.
- **nav 항목 추가**(기존 nav 컴포넌트). chicken soup clinic 옆/Discover 영역.

## 데이터 검증 / 엣지

- 유저 임베딩 없는 경우: `recommend_by_preset`이 mood_fit-only 폴백(기존 동작 그대로).
- 모든 weight 0(LLM이 전부 0): 균등 폴백으로 항상 유효 preset.
- 후보 풀: 기존과 동일(임베딩∩피처 전 카탈로그, inEmp 아님). prod에 TAF 166k 적재 완료(wellness에서 검증됨) → 즉시 동작.

## 테스트 전략

- 단위:
  - `build_preset` — center/weight 클램프, 전부-0 균등 폴백, sigma 결합, tempo 범위.
  - `recommend_by_preset` — 임의 preset으로 항상 n곡·제외(UserTrack/UserBlocked)·유저임베딩 유무 분기. (시드 트랙 사용, wellness 테스트 패턴 재사용; 전체 카탈로그 중 시드 찾기 위해 n 크게)
  - `recommend_wellness` 회귀 — 기존 테스트 무변경 통과.
  - `interpret_situation` — Gemini 클라이언트 mock으로 스키마 파싱·정상/None(실패) 분기.
- 통합:
  - 라우트 — 인증, 빈 텍스트 400, LLM mock 정상 경로(해석+tracks), LLM 실패 502.
- ⚠️ DB 격리: dev DB에서 cleanup fixture 사용. 전체 `pytest tests/` 금지(tidal 토큰 오염) — 해당 파일만 실행.

## 배포 영향 (신규)

- 신규 의존성 `google-genai` → `pyproject.toml`의 `[project] dependencies` 추가. deploy.sh의 `pip install`이 처리.
- 신규 env `GEMINI_API_KEY` → **prod 서버에도 세팅 필요**(dev 입력 완료). Google AI Studio 키 권장.

## 비채택 대안

- **출력 A2(center만, weight 균등):** "이 상황엔 템포 무관" 같은 표현 불가 → A1 채택.
- **출력 A3(기존 4무드 중 택1):** 자유 텍스트 의미 소멸 → 기각.
- **LLM 실패 시 중립 폴백 추천:** 해석이 핵심 가치라 속임 → 502 표면화 채택.
- **`YOUTUBE_DATA_API_KEY` 재사용:** Generative Language API 활성화·키 제한에 의존 → 전용 `GEMINI_API_KEY` 채택.
- **결과 캐싱:** 1콜 비용 미미 → 초기 미도입(후속 가능).

## 후속 작업

1. `recsys/wellness.py` 일반화(`recommend_by_preset` 추출 + 래퍼).
2. `llm/situation.py`(스키마·프롬프트·`interpret_situation`·`build_preset`).
3. `api/situation.py` + `main.py` 등록.
4. 프론트 `/situation` 페이지 + `lib/api/situation.ts` + 타입 + nav.
5. 단위·통합 테스트.
6. `pyproject.toml`에 `google-genai` + prod `GEMINI_API_KEY` 세팅.

## 관련 문서

- [ADR-007](../../decisions/ADR-007-situation-llm-recommendation.md)
- [Wellness 무드 추천 설계](2026-06-14-wellness-mood-recommendation-design.md) (일반화 모체)
- 코드: `src/mrms/recsys/wellness.py`(`recommend_wellness`·`mood_fit`·`_mood_fit_sql`), `src/mrms/api/wellness.py`, `web/src/components/track/ModalTrackList.tsx`(`ModalTrackList`·`PlayAllButton`)
