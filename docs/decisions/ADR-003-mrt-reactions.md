# ADR-003 MRT 4종 반응 (좋아요 / 취향저격 / 싫어요 / 관심없어요)

작성일: `2026-06-14`

## 상태

제안 — 설계 승인됨, 구현 대기. (구현 완료 시 `승인`으로 갱신)

## 결정

MRT 추천 아이템(트랙·앨범)에 4종 반응을 단다. 모두 누르면 MRT에서 즉시 제거(이동 inbox 일관). 긍정은 기존 UserTrack(PGT), 부정은 **`UserBlocked`** 재사용:

- **좋아요/취향저격** = 기존 `UserTrack`(`source='liked'` / `isCore=true`) → PGT.
- **싫어요** = `UserBlocked reason='disliked'` → **영구 제외**(`mrt_latest` 표시 + `search_for_persona` 둘 다 제외).
- **관심없어요** = `UserBlocked reason='dismissed'` → **일시 숨김**(`mrt_latest` 표시만 제외; `search_for_persona`는 제외 안 함; `_run_regenerate_mrt`가 재생성 후 dismissed 클리어 → 다음 사이클 재추천 가능).
- **트랙 + 앨범** 둘 다. 앨범 반응 = `UserBlocked targetType='album'` 1행, 제외 시 그 앨범 트랙으로 확장.

데이터: `UserBlocked`에 `reason` 컬럼 추가(마이그레이션 1개) + `targetType='album'` 값. 별도 테이블/모델 신설 안 함.

대안(비채택): (a) dismissed용 별도 테이블 — UserBlocked + reason 한 컬럼이 더 단순. (b) PlaylistHistory mutate로 제거 — 이력 훼손, ADR-002의 display-필터 원칙과 불일치.

## 배경

ADR-002로 MRT→PGT "이동"(UserTrack 보유 트랙을 추천에서 display-제외)을 구현했다. 사용자가 추천을 **거부**하는 경로(싫어요·관심없어요)가 없어, 싫은 곡이 계속 추천되거나 한 번 본 곡을 다시 보게 된다. `UserBlocked`/`TrackInteraction` 모델은 스키마에만 있고 미사용. 이 ADR은 부정 반응을 `UserBlocked`로 실체화하고, 영구(차단) vs 일시(숨김)를 구분한다.

## 근거

- `UserBlocked`는 이미 "추천에서 빼기" 의미의 모델 → reason 한 컬럼만 더해 dislike/dismiss 구분.
- 제외를 ADR-002의 단일 신호 패턴(존재=제외)에 합류 — `mrt_latest`/`search_for_persona`에 제외 소스만 추가. 이력(PlaylistHistory) 불변 유지.
- dismissed 클리어를 `_run_regenerate_mrt`(이미 prune 호출하는 지점)에 얹어 "다음 사이클 재추천" 자연 구현.

## 결과

좋은 점:
- 사용자가 추천을 능동적으로 거부 → MRT가 더 정확한 inbox로 수렴.
- 싫어요(영구)/관심없어요(일시) 의미 구분이 명확하고 구현이 단순(한 모델·한 컬럼).
- 클러스터링·이력 불변(차단곡은 PGT 아님 → 페르소나 영향 없음).

트레이드오프:
- 부정 신호가 추천모델을 적극적으로 밀어내진 않음(순수 제외) — 유사곡 회피는 후속(TrackInteraction/SASRec).
- 차단곡 해제/관리 UI 없음(후속). MRT에서 반응하면 아이템이 떠나므로 그 자리 undo는 불필요.
- 많이 차단할수록 추천 풀(임베딩 카탈로그 − 라이브러리 − 차단) 더 좁아짐(EMP 백로그 임베딩이 완화).

## 후속 작업

1. `UserBlocked` 마이그레이션(reason + unique) + `db/user_blocked.py`(block/clear_dismissed/blocked_track_ids).
2. 반응 엔드포인트(dislike/dismiss × 트랙/앨범).
3. 제외 3지점(`mrt_latest` blocked 필터 + `search_for_persona` disliked + `_run_regenerate_mrt` clear_dismissed).
4. 프론트 4 아이콘 + 풍선 툴팁(트랙·앨범).

## 관련 문서

- [상세 설계](../superpowers/specs/2026-06-14-mrt-reactions-design.md)
- [ADR-002](ADR-002-pgt-library-mrt-curation.md) — MRT→PGT 이동(display 필터, 이 ADR이 부정 반응으로 확장)
- 코드: `src/mrms/api/main.py`(mrt_latest), `src/mrms/recsys/mrt.py`(search_for_persona), `src/mrms/emp/runner.py`(_run_regenerate_mrt), `src/mrms/api/user_tracks.py`
