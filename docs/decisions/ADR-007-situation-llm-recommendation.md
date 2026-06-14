# ADR-007 상황 텍스트 → LLM 해석 → 추천 (situation desk)

작성일: `2026-06-14`

## 상태

승인 — 구현 예정. 상세 설계 [2026-06-14-situation-llm-recommendation-design.md](../superpowers/specs/2026-06-14-situation-llm-recommendation-design.md). 위치=별도 새 페이지(`/situation`) + nav 항목, 메뉴명=situation desk.

## 결정

사용자가 **자유 텍스트로 상황**을 적으면 **Gemini가 해석**해 그 장면에 맞는 곡 20개를 추천한다. wellness(chicken soup clinic)의 일반화 — 고정 무드 칩 대신 **LLM이 연속 피처 중심점 + 축별 가중치 + 한 줄 해석을 산출**하고, 그걸 기존 `mood_fit × 취향` 스코어러에 투입. 새 추천 모델 학습 없음.

- **LLM = Google Gemini**(사용자 선택, Claude 아님). `google-genai` SDK, `gemini-2.5-flash`, JSON 구조화 출력(`response_schema`=Pydantic). env `GEMINI_API_KEY`.
- **출력형태 A1:** center + 축별 weight + 해석(sigma는 wellness 상수 재사용). 표현력 최대 + 엔진 재사용 최대.
- **엔진 일반화:** `recommend_wellness`에서 `recommend_by_preset(preset)` 추출, wellness는 래퍼로(회귀 없음).
- **실패 = 502 표면화**(랜덤/중립 폴백 추천 안 함 — 해석이 핵심 가치).
- **안전 프레이밍:** 웰니스/정서 조절만, 임상 치료 표방 금지(wellness와 동일). 무관/유해 입력은 중립값 디플렉트.

## 배경

wellness 무드 추천(ADR-006)으로 "기분 → 곡" 진입점이 생겼지만 고정 4칩뿐이라 표현이 제한적이었다. 자유 텍스트를 LLM이 해석해 같은 엔진에 먹이면, 학습/신규 추천코드 없이 임의의 상황을 커버할 수 있다. 기존엔 LLM 통합이 전무(grep 확인) → 신규 Gemini 통합 1개 추가.

## 근거

- wellness 엔진(`mood_fit` 소프트 스코어 × UserEmbedding 취향, 제외 로직, 166k 피처/임베딩)이 preset만 받으면 그대로 재사용 가능 → 신규 코드 최소(엔진 일반화 + LLM 모듈 + api + 프론트).
- 구조화 출력으로 LLM 결과를 안전한 preset으로 변환(클램프·균등 폴백) → 추천 경로는 결정적.
- Gemini 2.5 Flash = 짧은 구조화 추출에 빠르고 저렴, 인터랙티브 UX 적합.

## 결과

좋은 점:
- 임의 상황을 자유 텍스트로 커버, 학습 비용 0, 엔진 재사용.
- 해석 노출로 'LLM이 읽었다'는 가치 가시화.

트레이드오프:
- 외부 LLM 의존(지연·실패·키·비용). 1콜이라 절대값은 작지만 실패 시 502.
- 신규 의존성(`google-genai`) + prod env 키 → 배포 변경.
- 무드 프리셋 σ·프롬프트 매핑 초기안 → 실사용 튜닝 필요.

## 후속 작업

1. `recsys/wellness.py` 일반화(`recommend_by_preset`).
2. `llm/situation.py`(스키마·프롬프트·`interpret_situation`·`build_preset`).
3. `api/situation.py` + main.py 등록.
4. 프론트 `/situation` + `lib/api/situation.ts` + nav.
5. 단위·통합 테스트.
6. `pyproject.toml`에 `google-genai`, prod `GEMINI_API_KEY` 세팅.

## 관련 문서

- [상세 설계](../superpowers/specs/2026-06-14-situation-llm-recommendation-design.md)
- [ADR-006 Wellness 추천](ADR-006-wellness-recommendation.md) (일반화 모체)
- 코드: `src/mrms/recsys/wellness.py`, `src/mrms/api/wellness.py`
