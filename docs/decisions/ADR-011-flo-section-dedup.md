# ADR-011 FLO 섹션 중복 제거 + v2 홈 패널 추가

작성일: `2026-07-02` (갱신: `2026-07-02`)

## 상태

승인 — 구현 완료. 코드 [`src/mrms/emp/flo.py`](../../src/mrms/emp/flo.py), 마이그레이션 [`20260702090000_dedup_flo_sections`](../../prisma/migrations/20260702090000_dedup_flo_sections/migration.sql).

> **갱신 이력**: 최초엔 section-level stale prune을 추가했으나, FLO `/curations/contents`(v1)가 **회전식 서브셋**(1~2개/호출)을 반환하는 것이 확인되어 **prune을 철회**했다. 대신 FLO 웹앱이 실제로 사용하는 **v2 `/recommends/home/panels`** 엔드포인트를 추가 소스로 도입해 섹션을 확보한다.

## 결정

### 1. sectionKey를 title 기반으로 (중복 제거)

FLO `/api/personal/v1/curations/contents` 응답의 `content.id` 대신 **`content.title`(정규화)을 `EMPSection.sectionKey`의 기준**으로 삼는다. 같은 title을 여러 id로 중복 반환해도 UNIQUE `(platform, "sectionKey")` 제약으로 자연히 하나로 합쳐진다.

- `_section_key(display_title, sec_id)` 헬퍼: title을 공백 축약 정규화해 `special:{title}`로. title이 없을 때만 `special:id-{sec_id}` fallback.

### 2. stale 섹션 prune 철회

FLO v1은 **회전식 서브셋**을 반환 — 매 호출마다 다른 1~2개 섹션만 보여준다. prune("이번 응답에 없으면 삭제")를 적용하면 직전 sync에서 얻은 섹션이 전부 삭제되는 파괴적 동작이 발생한다. Tidal(전체 카탈로그 반환)과 다른 콘텐츠 모델이므로 **FLO에는 section-level prune를 적용하지 않는다**. 섹션은 여러 sync에 걸쳐 자연 누적된다.

### 3. v2 홈 패널 추가 (`panels` 소스)

FLO 웹앱이 홈페이지에서 사용하는 **`/api/personal/v2/recommends/home/panels`** 엔드포인트를 추가 소스로 도입. `DEFAULT_SOURCES = ["special", "panels"]`.

- `POPULAR_CHANNEL` 타입 패널만 수집 (각 패널 = 채널 1개 + **트랙 인라인**).
- 각 패널 → EMPSection 1개 (`panel:{title}` sectionKey) + item 1개 (channel).
- **인라인 트랙**을 Phase 1에서 직접 upsert → Phase 2 fetch 불필요 (API 호출 절약).
- 패널 커버 = **첫 트랙 앨범 커버** (패널 imgList는 전부 동일한 제네릭 장르 이미지라 사용 불가).
- `_album_cover` 헬퍼: v1(`album.img.urlFormat`) + v2(`album.imgUrlFormat`, `album.imgList`) 커버 포맷 모두 대응.

## 배경

실측(2026-07-02) dev DB에서 FLO 섹션 27개 중 **4개가 중복**이었다:

| displayTitle | 중복 수 | sectionKey |
|---|---:|---|
| 음악과 즐기는 2026 북중미 월드컵 | 3 | special:11811 / 11814 / 11820 |
| 놓치면 아쉬운 주간 하이라이트 | 3 | special:11812 / 11821 / 11828 |

두 타이틀 모두 완전히 동일한 5개 채널(같은 itemId, 순서만 다름)을 가졌다. 원인은 FLO API가 같은 큐레이션을 여러 `content.id`로 반환하는 것 — 기존 코드는 `sectionKey = f"special:{sec_id}"`를 UNIQUE 키로 써서 같은 섹션이 별도 행으로 적재됐다.

추가로, FLO는 시즌성 큐레이션(예: 월드컵)을 시즌 종료 후 응답에서 제거한다. 그러나 **v1 `/curations/contents` 자체가 회전식 서브셋(1~2개/호출)을 반환**하므로, "이번 응답에 없으면 stale"로 간주하면 정상 섹션까지 삭제되는 파괴적 동작이 된다.

## 근거

- **title이 sectionKey로 가장 자연스러운 단위** — 사용자에게 보이는 식별자이자, FLO가 중복 생성 시 변하지 않는 값. id는 플랫폼 내부 부수적 값.
- **UNIQUE 제약이 dedup를 보장** — 별도 "이미 봤던 title" 추적 로직 불필요. upsert가 자연히 병합.
- **prune 철회** — FLO 회전식 서브셋 모델에서는 section-level prune가 파괴적. 섹션은 자연 누적시키는 것이 안전.
- **v2 panels로 섹션 확보** — v1만으로는 1~2개/호출이라 섹션 확보가 느리다. v2(5개 패널 + 인라인 트랙)를 추가하면 즉시 풍부한 EMP 브라우즈 가능.
- **마이그레이션 1회로 기존 중복 정리** — 새 코드는 앞으로의 중복을 막지만, 이미 쌓인 행은 삭제 필요.

## 결과

좋은 점: FLO 중복 섹션이 근본적으로 해결(title 같으면 하나로 합쳐짐). v2 panels로 안정적 5개 섹션 + 인라인 트랙(API 호출 절약). v1은 누적형으로 시간이 지나며 풍성해짐.

트레이드오프:
- **sectionKey가 title에 의존** — FLO가 같은 title에 다른 아이템을 주는 경우(드묾) 첫 번째 섹션으로 합쳐짐. 실측에서는 같은 title = 같은 아이템 집합이므로 문제 없음.
- **prune 철회로 계절성 콘텐츠(월드컵 등)가 잔류 가능** — 시즌 종료 후 FLO가 반환하지 않아도 DB에 남음. 경미한 문제(수동 삭제 가능, 향후 시간 기반 prune로 보완 검토).
- **v2 패널 커버가 채널 고유 이미지가 아님** — 첫 트랙 앨범 커버를 대용. 패널 imgList는 전부 동일한 제네릭 이미지.

## 후속 작업

1. ✅ `_section_key` 헬퍼 (title 기반 dedup).
2. ✅ 마이그레이션 `20260702090000_dedup_flo_sections` 적용(25→21 섹션, 4행 삭제).
3. ✅ stale section prune 추가 → **철회** (FLO 회전식 모델에서 파괴적 확인).
4. ✅ v2 `/recommends/home/panels` 추가 (`panels` 소스, 인라인 트랙, 첫 트랙 앨범 커버).
5. ✅ `_album_cover` 헬퍼 (v1 + v2 앨범 커버 포맷 대응).

## 비채택 대안

- **(title + item 집합) 해시 기준** — 같은 title에 다른 아이템이면 별도 섹션 인정. 더 정교하나 FLO 실정에선 오버스펙. 기각.
- **v1 prune 유지** — 회전식 서브셋에서 섹션 2개만 남는 파괴적 동작. 기각.
- **v2로 전면 교체(v1 폐지)** — v1의 다중 아이템 에디토리얼 섹션(큐레이션 그룹)을 잃음. v1+v2 병행이 더 풍부. 기각.

## 관련 문서

- 코드: [`src/mrms/emp/flo.py`](../../src/mrms/emp/flo.py) (`_section_key`, `_fetch_home_panels`, `_album_cover`, `import_all`)
- 테스트: [`tests/emp/test_flo.py`](../../tests/emp/test_flo.py)
- 마이그레이션: [`prisma/migrations/20260702090000_dedup_flo_sections/migration.sql`](../../prisma/migrations/20260702090000_dedup_flo_sections/migration.sql)
