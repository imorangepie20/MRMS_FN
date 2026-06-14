# ADR-008 무드 추천 표현 전환 — 피처 센트로이드 → 취향-우선 임베딩

작성일: `2026-06-14`

## 상태

승인 · 구현(PR #1, 브랜치 `feat/situation-desk`). ADR-006(wellness)·ADR-007(situation)의 **추천 엔진을 대체**한다(피처-센트로이드 → 취향-우선 임베딩). 무드 진입점 개념·UI는 유지.

## 결정

situation desk·wellness의 추천 엔진을 **`recommend_by_taste_mood`**로 교체:
1. **후보 = 유저 취향 임베딩 최근접 풀**(`UserTrack` 임베딩 평균 = 라이브러리 센트로이드, 없으면 persona `UserEmbedding`). HNSW cosine.
2. 그 풀을 **valence/energy/tempo만으로 무드 재정렬**.
3. **acousticness/instrumentalness는 점수에서 폐기.**

후보가 '취향 이웃'이라 유저가 안 듣는 장르(클래식 등)는 애초에 들어오지 않는다. 취향 신호 없으면 빈 리스트(온보딩 필요).

## 배경

situation·wellness가 "차분/독서" 같은 상황에 **곡 전부를 오케스트라 클래식**으로 추천했다. 사용자: "몽땅 클래식이라니 / 내 취향이 안 들어 있는 게 문제." 실데이터 진단으로 두 사실이 드러났다.

## 근거 (실데이터)

- **자체 모델 오디오 피처가 무의미** — 특히 acousticness: Norah Jones(어쿠스틱 보컬) `0.15`, George Winston(솔로 피아노) `0.04`, Max Richter `0.03`. 진짜 어쿠스틱·기악곡이 오히려 낮음 → "어쿠스틱"을 측정 못 하는 노이즈. (instrumentalness는 멀쩡: Norah 0.01 vs George Winston 0.99.)
- **256d MERT 임베딩은 우수** — Norah Jones "Come Away With Me"의 임베딩 최근접 15곡이 전부 보컬(Abbey Lincoln·Leon Bridges·Chris Stapleton·ABBA…), 클래식 0곡.
- **취향 미반영이 핵심** — 기존 식 `0.6·mood_fit(망가진 피처) + 0.4·taste`에서 취향 가중치가 낮고 다수 유저는 UserEmbedding도 없어(4명뿐) 무드가 취향을 깔아뭉갬. 유저 취향 임베딩 최근접은 그들의 라이브러리(Diana Krall·IU·Billie Holiday)와 일치하고 클래식 0곡.

## 결과

좋은 점:
- "몽땅 클래식" 해소 — 결과가 유저 취향 안에서 상황별로 재정렬(검증: '비 오는 아침'→Sinatra·Elton John, '파티'→Monsta X·Red Velvet·RM).
- 코드 단순화(피처-센트로이드·SQL 무드식·build_preset·cap·prefer_instrumental 제거, 순 -129줄). situation·wellness 1개 엔진 공유.
- 망가진 피처 의존 제거.

트레이드오프:
- **취향 신호 없는 유저는 빈 결과**(온보딩/라이브러리 필요). 무드-온리 폴백 없음(의도 — 취향 없는 클래식 추천이 문제였음).
- 무드 재정렬은 valence/energy/tempo 기반이라 여전히 거칠다(예: 차분에 빠른 곡이 간혹). 후속 튜닝 여지.
- acousticness/instrumentalness는 신뢰 회복(피처 재추출) 전까지 추천에서 미사용.

## 후속 작업

1. (튜닝) 무드 재정렬 품질 — pool_size·σ·축 가중 실사용 튜닝. 임베딩 nudge(취향+무드시드 벡터 합) 검토.
2. (데이터) 오디오 피처(특히 acousticness) 재추출/검증 또는 폐기.
3. wellness(chicken soup clinic) 존치 여부 — 사용자 호불호에 따라 nav 유지/제거.

## 관련 문서

- [ADR-006 Wellness 추천](ADR-006-wellness-recommendation.md) · [ADR-007 situation desk](ADR-007-situation-llm-recommendation.md) — 이 엔진으로 대체됨
- 코드: `src/mrms/recsys/taste_mood.py`(`recommend_by_taste_mood`·`taste_vector`), `src/mrms/recsys/wellness.py`, `src/mrms/api/situation.py`, `src/mrms/llm/situation.py`
