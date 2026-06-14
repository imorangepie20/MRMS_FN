# 검색 페이지 Editorial 폴리시 — 설계

> **목표:** `/search` 페이지를 MRMS **editorial 정체성(mono·rust·ink/paper, tracking-editorial)을 유지**한 채, SDTPL_ADM(베이스 shadcn 템플릿)에서 **구조·상태처리 패턴만 빌려** 완성도를 올린다. **shadcn 룩 전환 없음.** 검색이 첫 페이지이고, 이후 다른 페이지 폴리시의 기준이 된다.

작성 2026-06-14. 인덱스: [docs/README.md](../../README.md). 선행: [2026-06-14-search-emp-expansion-design.md](2026-06-14-search-emp-expansion-design.md)(검색 기능 자체). 방향 결정: 사용자 선택 **"Editorial 유지 + 폴리시"**(템플릿 룩 채용/하이브리드 비채택).

---

## 1. 현재 상태 (개선 대상)

`web/src/app/(dashboard)/search/page.tsx` + `web/src/components/search/SearchResults.tsx`:
- input = bare 하단보더, 아이콘/clear 없음.
- 로딩 = `"검색 중…"` 텍스트 한 줄.
- 빈 결과(0건)·초기(검색 전) 상태 = **없음**(blank).
- 페이지 헤더 = **없음**.
- 결과 요약/쿼리 echo = 없음.
- `SearchResults`는 섹션(Tracks/Albums/Playlists) 구조는 OK(`SectionHeading` + `ContainerGrid` + `ModalTrackList`).
- 가용 자산: `web/src/components/ui/skeleton.tsx`(shadcn Skeleton) 존재, `lucide-react`(Search/X), `--mrms-*` 토큰.

## 2. 폴리시 항목 (editorial 일관)

1. **페이지 헤더(masthead)** — 상단 `SEARCH` 타이틀(`font-display`) + mono kicker(예: "Tidal · Spotify 라이브") + 상단 `border-(--mrms-rule)`. 사이드바 브랜드/다른 페이지 헤더 톤과 일관.
2. **input 폴리시** — editorial 하단보더 유지 + 좌측 `Search` 아이콘 + 입력 시 우측 `×`(clear) 버튼 + focus 시 `--mrms-rust` 언더라인 + 우측에 "Enter" 힌트(mono). 제출=Enter(기존).
3. **결과 요약 줄** — 검색 후 `"{q}" — N tracks · M albums · K playlists`(mono, `--mrms-ink-mute`). 0건/부분 결과도 여기 반영.
4. **로딩 스켈레톤** — `"검색 중…"` → editorial 스켈레톤(트랙 행 ~5개 + 카드 그리드 placeholder). 기존 `ui/skeleton` `Skeleton`을 `--mrms-rule` 톤으로. 신규 `SearchSkeleton`.
5. **빈 결과 상태** — 0건이면 editorial empty: `"{q}"에 대한 결과 없음` + 힌트(다른 검색어 시도 / 미연동 플랫폼 안내). 신규 `SearchEmptyState`(또는 SearchResults 내 인라인).
6. **초기(idle) 상태** — 검색 전: editorial 프롬프트("트랙 · 앨범 · 플레이리스트를 검색하세요" + 예시 검색어 칩 몇 개를 클릭하면 검색 실행). 신규 `SearchIdle`(또는 page 인라인).
7. **섹션 헤더·여백 리듬** — 기존 `SectionHeading` 유지하며 간격/계층 미세 정돈.

> SDTPL_ADM에서 빌리는 것 = **패턴/구조**(헤더 마스트헤드, input 어포던스, 스켈레톤 로딩, empty/idle 상태, 결과 요약). **스타일 토큰·타이포·색은 MRMS 그대로**(shadcn 카드/oklch/sans 미사용).

## 3. 파일 구조

- **수정** `web/src/app/(dashboard)/search/page.tsx` — 헤더 + input 폴리시 + 상태 오케스트레이션(idle / loading / error / empty / results 분기).
- **수정** `web/src/components/search/SearchResults.tsx` — 결과 요약 줄 + 0건 처리 위임 + 섹션 여백 정돈.
- **신규(작게)** `web/src/components/search/SearchStates.tsx` — `SearchSkeleton` / `SearchEmptyState` / `SearchIdle`(한 파일에 작은 프레젠테이션 컴포넌트 묶음). 또는 page 인라인(YAGNI 판단).
- 재사용: `ui/skeleton`(Skeleton), `lucide-react`(Search, X). 토큰 `--mrms-*`.

## 4. 상태 분기 (page.tsx)

```
idle (data===null && !loading && !error)         → SearchIdle (프롬프트 + 예시 칩)
loading                                          → SearchSkeleton
error                                            → editorial 에러 줄(기존, rust)
data && 총결과 0                                  → SearchEmptyState("{q}" 결과 없음)
data && 총결과 >0                                 → 결과 요약 + SearchResults
```
(총결과 = tracks+albums+playlists 길이 합.)

## 5. 범위 밖 (후속)

- 다른 페이지(EMP·PGT 등) 폴리시 — 이 페이지를 기준으로 후속.
- 검색 히스토리 / 인기 검색어(예시 칩은 정적 샘플만).
- 페이지네이션·정렬·필터.
- ⌘K 팔레트.

## 6. 테스트

- 빌드(`pnpm build`) 통과 + lint.
- 수동 시각 verify: idle/loading/empty/results/부분결과 5개 상태 + input clear/아이콘 + 헤더. editorial 톤 유지 확인.
- (선택) idle 예시 칩 클릭 → 검색 실행 동작.

## 관련 문서

- [검색 기능 설계](2026-06-14-search-emp-expansion-design.md) · 코드: `web/src/app/(dashboard)/search/page.tsx`, `web/src/components/search/SearchResults.tsx`, `web/src/components/ui/skeleton.tsx`
