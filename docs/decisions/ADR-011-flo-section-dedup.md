# ADR-011 FLO 섹션 중복 제거 (title 기반 sectionKey + stale prune)

작성일: `2026-07-02`

## 상태

승인 — 구현 완료. 코드 [`src/mrms/emp/flo.py`](../../src/mrms/emp/flo.py), 마이그레이션 [`20260702090000_dedup_flo_sections`](../../prisma/migrations/20260702090000_dedup_flo_sections/migration.sql).

## 결정

FLO `/api/personal/v1/curations/contents` 응답의 `content.id` 대신 **`content.title`(정규화)을 `EMPSection.sectionKey`의 기준**으로 삼는다. 같은 title을 여러 id로 중복 반환해도 UNIQUE `(platform, "sectionKey")` 제약으로 자연히 하나로 합쳐진다. 추가로 다른 importer(Tidal `_prune_stale_video_sections` 등) 패턴처럼 FLO에도 **section-level stale prune**을 넣어, 이번 sync에 보이지 않는 `special:*` 섹션을 삭제한다.

1. **sectionKey 계산** — `_section_key(display_title, sec_id)` 헬퍼(`flo.py:99`): title을 공백 축약 정규화해 `special:{title}`로. title이 없을 때만 `special:id-{sec_id}` fallback.
2. **stale 섹션 prune** — `_prune_stale_special_sections(conn, keep_keys)` 정적 메서드(`flo.py:257`): `special:%` 패턴 중 keep_keys에 없는 섹션을 DELETE(아이템은 FK CASCADE). keep_keys가 비면(빈 fetch / special 소스 누락) no-op로 보호.
3. **import_all 연결** — `special_synced` 플래그로 special 소스가 정상 처리됐을 때만 prune 호출. 에러/누락 시 보호.

## 배경

실측(2026-07-02) dev DB에서 FLO 섹션 27개 중 **4개가 중복**이었다:

| displayTitle | 중복 수 | sectionKey |
|---|---:|---|
| 음악과 즐기는 2026 북중미 월드컵 | 3 | special:11811 / 11814 / 11820 |
| 놓치면 아쉬운 주간 하이라이트 | 3 | special:11812 / 11821 / 11828 |

두 타이틀 모두 완전히 동일한 5개 채널(같은 itemId, 순서만 다름)을 가졌다. 원인은 FLO API가 같은 큐레이션을 여러 `content.id`로 반환하는 것 — 기존 코드는 `sectionKey = f"special:{sec_id}"`를 UNIQUE 키로 써서 같은 섹션이 별도 행으로 적재됐다.

추가로, FLO는 시즌성 큐레이션(예: 월드컵)을 시즌 종료 후 응답에서 제거하는데, 기존 코드엔 section-level prune가 없어 DB에 영구히 남았다. Tidal은 `_prune_stale_video_sections`(`tidal.py:501`)로 video 섹션을 정리하지만 FLO는 무방비 상태였다.

## 근거

- **title이 sectionKey로 가장 자연스러운 단위** — 사용자에게 보이는 식별자이자, FLO가 중복 생성 시 변하지 않는 값. id는 플랫폼 내부 부수적 값.
- **UNIQUE 제약이 dedup를 보장** — 별도 "이미 봤던 title" 추적 로직 불필요. upsert가 자연히 병합.
- **stale prune은 기존 패턴 재사용** — Tidal `_prune_stale_video_sections`와 동일 구조. keep_keys 비면 no-op 보호도 동일.
- **마이그레이션 1회로 기존 중복 정리** — 새 코드는 앞으로의 중복을 막지만, 이미 쌓인 행은 삭제 필요. 같은 title 그룹에서 최근 동기화 1개만 남기는 단순 DELETE.

## 결과

좋은 점: FLO 중복 섹션이 근본적으로 해결(앞으로 title이 같으면 하나로 합쳐짐). stale 시즌성 섹션(월드컵 등)이 자동 정리.EMPSectionItem이 FK CASCADE로 따라 삭제되므로 고아 아이템 없음.

트레이드오프:
- **sectionKey가 title에 의존** — FLO가 같은 title에 다른 아이템을 주는 경우(드묾) 첫 번째 섹션으로 합쳐짐. 실측에서는 같은 title = 같은 아이템 집합이므로 문제 없음.
- **빈 fetch 보호가 special 누락 시 stale를 남김** — 사용자가 sources 세팅에서 `special`을 제거하면 이전 `special:*` 섹션이 남음(안전 우선). 마이그레이션/수동 정리로 보완.
- **title 없는 섹션은 sec_id fallback** — 드문 케이스. UNIQUE 충돌 없이 별도 섹션 유지.

## 후속 작업

1. ✅ `_section_key` 헬퍼 + `_prune_stale_special_sections` + `import_all` 연결.
2. ✅ 마이그레이션 `20260702090000_dedup_flo_sections` 적용(25→21 섹션, 4행 삭제).
3. ✅ 테스트 7종(`_section_key` 단위 3 + prune 직접 3 + dedup 통합 1).

## 비채택 대안

- **(title + item 집합) 해시 기준** — 같은 title에 다른 아이템이면 별도 섹션 인정. 더 정교하나 FLO 실정에선 오버스펙(title이 같으면 아이템도 같음이 실측됨). 기각.
- **sectionKey를 그대로 두고 응답 레벨에서 title dedup만** — stale 월드컵 섹션이 남는 문제 미해결. 기각.
- **DB 전체 `special:%` 재구축(DELETE all + 다음 sync에 재적재)** — 가장 공격적이나, prune 로직 버그 시 데이터 날아감 위험. 마이그레이션은 중복만 정리하고 stale는 새 prune 코드에 맡기는 쪽이 안전. 기각.

## 관련 문서

- 코드: [`src/mrms/emp/flo.py`](../../src/mrms/emp/flo.py) (`_section_key`, `_prune_stale_special_sections`, `import_all`)
- 테스트: [`tests/emp/test_flo.py`](../../tests/emp/test_flo.py)
- 마이그레이션: [`prisma/migrations/20260702090000_dedup_flo_sections/migration.sql`](../../prisma/migrations/20260702090000_dedup_flo_sections/migration.sql)
- 선행 패턴: [`src/mrms/emp/tidal.py:501`](../../src/mrms/emp/tidal.py) (`_prune_stale_video_sections`)
- 유사 정리: [`prisma/migrations/20260619140000_remove_stale_search_year_sections`](../../prisma/migrations/20260619140000_remove_stale_search_year_sections/migration.sql)
