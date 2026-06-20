# EMP 합성-ISRC enrichment 설계

> 합성 ISRC를 가진 EMP 풀 트랙을 Deezer로 real ISRC 역해결한 뒤, 카탈로그 중복은
> 머지(임베딩 재사용)하고 신곡만 임베딩 파이프라인으로 보내, 카탈로그 파편화와
> 임베딩 백로그를 동시에 해소한다. (Option C / 아키텍처 A — 별도 enrichment 스테이지)

**작성일:** 2026-06-21
**상태:** 설계 승인됨 → 구현 계획 대기

---

## 1. 배경 / 문제

`/api/...` 분석 결과(2026-06-21):

- 임베딩(`TrackEmbedding`)은 **100% `mp3_30s`** — 즉 Deezer/iTunes 30초 프리뷰에서
  MERT-95M으로 추출. 구독 플랫폼(Tidal/Spotify) 스트림은 임베딩에 안 쓰임.
- prod 임베딩 백로그 **43,478** (inEmp=TRUE 또는 유저 YouTube 미스곡인데 미임베딩).
- 백로그는 두 부류:
  - **합성-ISRC 중복** (apple ~7k, vibe ~16k 미임베딩): apple/vibe 임포터가 스토어
    프론트 HTML을 스크래핑([apple.py:367](../../../src/mrms/emp/apple.py)의
    `_fetch_container_tracks`)해 ISRC가 없음 → [base.py:394](../../../src/mrms/emp/base.py)에서
    `isrc=None` 하드코딩 → [base.py:173](../../../src/mrms/emp/base.py)에서
    `track_isrc = "emp_{platform}_{id}"` 합성 → [base.py:148](../../../src/mrms/emp/base.py)
    `if isrc:` ISRC dedup을 건너뛰어 **같은 곡이 카탈로그에 real-ISRC로 이미 있어도
    별도 Track으로 중복 생성**.
  - **real-ISRC 순수 백로그** (tidal/spotify/flo EMP ~20k): real ISRC 보유, 단지
    임베딩 파이프라인(02→03→10) 미실행. **이 스펙의 대상 아님** — 기존 파이프라인으로 처리.

검증 데이터(2026-06-21, prod 샘플 40 + 텍스트 프로브):
- apple/vibe 합성 트랙의 Deezer/iTunes **텍스트 매칭 가능률 95–100%** (진짜 백로그).
- 인기곡(Watermelon Sugar, The Power, Girl Like Me 등)은 카탈로그에 **이미
  real-ISRC·임베딩 완료**로 존재 → apple/vibe 버전은 순수 중복.

**핵심:** 백로그를 그냥 02→03→10으로 채우면(blind) 합성 중복을 **fuzzy 텍스트로
임베딩**해 (틀린 버전·커버 위험) 카탈로그 파편화가 굳어진다. 임베딩을 더 만들기 전에
**dedup이 먼저**다.

## 2. 목표 / 비목표

**목표**
- 합성-ISRC EMP 트랙을 real ISRC로 역해결.
- real ISRC가 카탈로그에 이미 있으면 **머지**(중복 제거, 기존 임베딩 재사용 — 다운로드/추출 0).
- real ISRC가 신규면 **re-key**(isrc 갱신) → 기존 02(ISRC 정밀)→03→10로 임베딩.
- 임포트마다 신규 합성도 정리(재발 방지) — `run_emp_pipeline` 스테이지로 편입.

**비목표 (YAGNI)**
- apple/vibe 임포터를 공식 API로 교체(real ISRC 원천 캡처) — 별도 큰 작업, 본 스펙 밖.
- real-ISRC 순수 백로그(~20k) 임베딩 — 기존 파이프라인 영역.
- 온보딩 full-import 미매칭 트랙(`tidal_/spotify_`, 유저 플레이리스트) — 범위 밖.
- Deezer가 못 찾는 트랙(~30–40%)을 iTunes-프리뷰로 blind 임베딩 — 합성 유지(제외).

## 3. 범위

`inEmp=TRUE` & 합성 ISRC(언더스코어 포함: `emp_*`, `{platform}_*`) & `TrackEmbedding`
없는 EMP 풀 트랙 **전부**(플랫폼 무관 — apple/vibe 주력, spotify/flo/melon 소수 포함).

## 4. 아키텍처 / 컴포넌트

기존 `01_enrich_via_deezer.py` + `run_emp_pipeline.py` 패턴을 따른 **별도 enrichment
스테이지**. 임포트 경로(검증된 코드)·02/03/10·온보딩 import 미변경.

### `src/mrms/emp/isrc_enrich.py` (공용 로직)
- `fetch_synthetic_emp_tracks(conn, limit=0) -> list[SyntheticTrack]`
  `inEmp=TRUE` & `isrc LIKE '%\_%' ESCAPE '\'` & `NOT EXISTS TrackEmbedding`.
  반환 필드: `track_id, isrc, title, artist`.
- `resolve_real_isrc(client, title, artist) -> ResolveResult`
  Deezer `search_by_text`(deezer.py — 응답에 isrc+preview 동시 포함) 호출.
  반환: `{real_isrc, deezer_artist, deezer_title, confident: bool}`.
  iTunes는 ISRC를 반환하지 않으므로 ISRC 소스로 쓰지 않음(오디오 폴백 전용, 본 단계 미사용).
- `is_confident_match(orig_title, orig_artist, dz_title, dz_artist) -> bool`
  artist 정규화 일치(필수) + title 정규화 유사도 임계.
- `merge_track(conn, synth_id, canonical_id) -> None` — §5.
- `rekey_track(conn, synth_id, real_isrc) -> None`
  `UPDATE "Track" SET isrc=%s, "updatedAt"=now() WHERE id=%s`.
- `enrich_one(conn, client, track) -> Literal["merge","rekey","skip"]`
  resolve → confident? → 카탈로그에 real_isrc 존재? → merge / rekey / skip 분기.

### `scripts/14_enrich_emp_isrc.py` (CLI 드라이버)
- 인자: `--limit`(0=전체), `--dry-run`, `--concurrency`(Deezer 호출).
- `--dry-run`: DB 변형 없이 resolve만 하고 `would: merge N / rekey M / skip K` + 샘플 리포트.
- 실행: `fetch_synthetic_emp_tracks` → 각 트랙 `enrich_one`(트랜잭션 1건/트랙) → 집계.

### `run_emp_pipeline.py`
임포트 단계 후·임베딩 적재(10) 전에 14 호출 스테이지 추가.

## 5. MERGE 메커닉 (핵심·위험부)

Track FK 6개 전부 `onDelete=CASCADE` → **synth를 그냥 지우면 EMPSource·TrackPlatform
(apple/vibe 매핑) 등이 함께 삭제됨**. 따라서 삭제 전에 canonical로 repoint한다.
트랜잭션 1건(트랙 단위), 충돌 시 "non-colliding만 이동, 나머지 drop" 공용 헬퍼:

```
_repoint_or_drop(conn, table, unique_cols, synth_id, canonical_id):
    UPDATE "{table}" SET "trackId"=canonical
      WHERE "trackId"=synth
        AND NOT EXISTS (canonical이 같은 unique_cols 값을 이미 가짐)
    DELETE FROM "{table}" WHERE "trackId"=synth   -- 충돌로 남은 것 제거
```

대상(순서) — `unique_cols`는 trackId 외 나머지 unique 컬럼(충돌 판정용, DB 확인됨):
| 테이블 | 전체 unique 제약 | 충돌 판정 cols | 비고 |
|---|---|---|---|
| TrackPlatform | (trackId, platform) | (platform) | canonical이 apple/vibe 매핑 획득 → 역추적 가능 |
| EMPSource | (trackId, platform, source_id) | (platform, source_id) | canonical이 EMP 풀/섹션 멤버십 승계 |
| UserTrack | (userId, trackId) | (userId) | |
| PlaylistTrack | PK(playlistId, trackId) | (playlistId) | position 보존 |
| TrackAudioFeatures | (trackId, modelVersion) | (modelVersion) | synth엔 보통 없음 |
| TrackEmbedding | (trackId, modelVersion) | (modelVersion) | synth엔 없음(미임베딩 대상) — canonical 임베딩 유지 |

추가:
- `PlaylistHistory.trackIds` (배열, 비-FK): `UPDATE ... SET "trackIds"=array_replace("trackIds", synth, canonical)`.
- 마지막: `DELETE FROM "Track" WHERE id=synth`.

## 6. Confidence 필터 (오매칭=카탈로그 오염 방지)

- **필수: artist 정규화 일치** — 소문자화, 공백·기호 제거, 첫 아티스트만(콤마 split).
  Deezer 결과 artist ≠ 원본 → **거부(skip)**.
- title 정규화 유사도 임계 — feat/버전 괄호(`(...)`, `feat.`, `Live`, `Remastered` 등)
  제거 후 일치 또는 충분히 높은 유사도.
- 미달이면 절대 추측 머지/re-key 하지 않고 **합성 유지(skip)**.

## 7. 에러 / 멱등 / 안전

- `--dry-run` 우선 — 변형 전 영향 규모(merge/rekey/skip) 확인.
- 트랙별 트랜잭션 — 1건 실패가 전체를 오염시키지 않음. 실패는 로그 후 다음 트랙.
- Deezer rate-limit/네트워크 — 기존 tenacity 재시도(deezer.py) 그대로.
- **멱등** — real-ISRC 트랙은 `fetch_synthetic_emp_tracks`가 애초에 제외 → 재실행
  자동 skip. 중단/재개 안전.
- **무회귀** — Deezer 못 찾는 ~30–40%는 합성 유지(현 상태와 동일). 임포터·02/03/10·
  온보딩 import 미변경.

## 8. 테스트 (TDD)

DB 테스트는 기존 `tests/` 패턴(`db_conn`, `cleanup` fixture, localhost:5433).

- `fetch_synthetic_emp_tracks`: 합성만 골라냄(real ISRC 제외, 미임베딩만, inEmp만).
- `resolve_real_isrc`: Deezer mock(isrc 반환) / 빈 결과(None) / rate-limit 재시도.
- `is_confident_match`: artist 일치=통과, artist 불일치=거부, feat/버전 괄호 정규화.
- `merge_track`: 합성 S + canonical C 픽스처 → 6 FK repoint 검증 + 충돌 시 drop +
  `PlaylistHistory.trackIds` array_replace + S 삭제 + C 임베딩 유지.
- `rekey_track`: 신규 ISRC 갱신, unique 충돌 없음.
- `enrich_one`: merge/rekey/skip 분기(카탈로그 존재 여부 × confident 여부).

## 9. 검증 / 성공 기준

- dry-run 리포트로 merge/rekey/skip 분포 확인(합성 중복률 실측).
- 적용 후: 합성-ISRC EMP 트랙 수 감소, 중복 Track 제거(같은 real ISRC 단일화),
  신규 ISRC 트랙은 02(ISRC)→03→10로 정밀 임베딩.
- 임베딩 백로그(Q7) 감소가 "임베딩 추가"가 아니라 상당 부분 "중복 제거"에서 나옴.
