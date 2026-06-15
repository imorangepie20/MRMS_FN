# 공유 플레이리스트 Open Graph 미리보기 상세 설계

작성일: `2026-06-16`
상태: 설계 승인 — 구현 예정.

## 목표

공유 플레이리스트 링크(`/p/{shareId}`)를 이지웍에디터·SNS·메신저에 붙여넣으면 뜨는 **링크 미리보기 카드**에 **플레이리스트 제목 + 앨범 이미지(2×2 그리드)** 를 조합해 보이게 한다. 동적 `og:image`(제목+커버 합성)와 og 메타(title/description)를 서버에서 생성한다.

직접 요청: "공유주소 붙여넣기 했을 때 미리보기에 페이지 정보 보이게 — 플레이리스트 제목이랑 앨범 이미지 조합해서."

## 현재 구조 (배경 — 그라운딩 확인)

- 공유 페이지: `web/src/app/p/[shareId]/page.tsx`는 **`"use client"`** — client component라 `generateMetadata`(서버 전용)를 직접 못 단다. 부모 레이아웃 `web/src/app/p/layout.tsx`(server, 헤더+PlayerBar).
- 공유 API: `GET /api/shared/{share_id}`(`src/mrms/api/shared.py`, 무인증) → `{playlist, tracks}`. `playlist`=`get_playlist_by_share_id`(name·description·owner displayName 포함). `tracks`=`get_playlist_tracks` — **`album_cover`가 현재 항상 None**(Album에 cover 컬럼 없음, EMPSource.cover_url 미조인). 그래서 공유 페이지 본문에도 커버가 안 뜬다.
- 커버 데이터: `EMPSource.cover_url`(트랙 단위). `/mrt` 서빙에서 `_fetch_track_metadata`가 `LEFT JOIN LATERAL (SELECT cover_url FROM "EMPSource" WHERE "trackId"=t.id AND cover_url IS NOT NULL LIMIT 1)`로 끌어오는 패턴이 있다(직전 커밋).
- 스택: Next 16.2.7 app router(빌트인 `ImageResponse`/`opengraph-image` 지원), editorial 토큰(`--mrms-bg`/`--mrms-paper`/`--mrms-ink`/`--mrms-rust`/`--mrms-ink-mute`), 폰트 IBM Plex Sans(display)·IBM Plex Mono.

## OG 카드 디자인 (1200×630)

editorial 톤(paper 배경·ink 텍스트·rust 포인트). 좌측 2×2 앨범 커버 그리드, 우측 제목+메타+CTA.

```
┌───────────────────────────────────────────────┐
│ MRMS                          SHARED PLAYLIST   │  상단바: 워드마크(display bold) + 라벨(mono)
│                                                 │
│   ┌─────┬─────┐    My Jazz Nights              │  제목 (display bold, ~64px, 2줄 클램프)
│   │ cv1 │ cv2 │    12 TRACKS · BY WOOSUNG        │  메타 (mono, ink-mute)
│   ├─────┼─────┤                                 │
│   │ cv3 │ cv4 │    ▶ LISTEN ON MRMS             │  CTA 힌트 (mono, rust)
│   └─────┴─────┘                                 │
└───────────────────────────────────────────────┘
```

- 좌측 커버 그리드: 앞 4곡의 `album_cover`. 영역 ~ 460×460, 2×2 각 셀 정사각.
- 커버 폴백(곡/커버 수에 따라):
  - 4개 이상: 2×2 그리드.
  - 1~3개: 있는 만큼 채우고 빈 셀은 ink 톤 placeholder(또는 단일 커버를 크게).
  - 0개: 그리드 생략, 좌측은 브랜드 패턴/대형 워드마크. 제목 카드로 성립.
- 텍스트: 제목(`playlist.name`), `{N} TRACKS · BY {owner displayName 또는 'MRMS'}`, `▶ LISTEN ON MRMS`.
- 폰트: 단순화를 위해 ImageResponse 기본 sans(system) 사용. (IBM Plex 바이너리 로딩은 폴리시 향상용 후속 — v1은 시스템 sans로 충분히 editorial.)
- ⚠️ satori 주의: 기본 `box-sizing: border-box`. border 있는 그리드 컨테이너는 `boxSizing:'content-box'`로 안쪽 폭을 유지해야 230×2 셀이 2×2로 들어간다(아니면 1열로 깨짐). 모든 자식 있는 div는 `display:'flex'` 필수.

## 데이터 흐름

1. 링크 크롤러(에디터/SNS)가 `/p/{shareId}` GET → Next가 `generateMetadata` 실행 → og:title/description + (opengraph-image 자동 연결) og:image URL 제공.
2. 크롤러가 og:image(`/p/{shareId}/opengraph-image`) GET → 서버에서 공유 API fetch → 카드 PNG 렌더.
3. 둘 다 서버에서 `GET {BACKEND}/api/shared/{shareId}` 호출(무인증). 404(해제/없음)면 기본 메타 + 브랜드 폴백 카드.

## 구현 범위

### 1) 백엔드 — 공유 트랙에 커버 채우기

`src/mrms/db/playlist.py:get_playlist_tracks`에 `EMPSource.cover_url` LATERAL 조인 추가(`/mrt` 패턴 동일):
```sql
LEFT JOIN LATERAL (
  SELECT cover_url FROM "EMPSource"
  WHERE "trackId" = t.id AND cover_url IS NOT NULL LIMIT 1
) ec ON TRUE
```
→ 반환 dict의 `album_cover`를 `ec.cover_url`로(현재 None 대신). **공유 페이지 본문 커버도 같이 살아난다**(부수 개선). docstring의 "album_cover는 None" 문구도 갱신.

### 2) 프론트 — 서버 경계 + 메타 + 동적 이미지

- `web/src/app/p/[shareId]/page.tsx`를 **server component**로 전환: 현재 client 로직 전체를 신규 `web/src/components/share/SharedPlaylistClient.tsx`("use client")로 이동, page는 `generateMetadata({ params })` + `<SharedPlaylistClient shareId={shareId} />` 렌더만.
- `generateMetadata`: 서버에서 `GET {BACKEND}/api/shared/{shareId}` → `{ title: playlist.name, description: '{N} tracks · shared on MRMS', openGraph: { title, description, type: 'music.playlist' }, twitter: { card: 'summary_large_image' } }`. opengraph-image가 og:image를 자동 주입. 404면 기본값("Shared playlist · MRMS").
- `web/src/app/p/[shareId]/opengraph-image.tsx`: `size={width:1200,height:630}`, `contentType='image/png'`, default async fn `Image({ params })` → 공유 API fetch → 위 카드 레이아웃을 `ImageResponse`(next/og)로 렌더. 커버 URL은 `<img>`로 삽입(외부 iTunes/ytmusic URL 그대로 — ImageResponse가 fetch). fetch 실패/404 → 브랜드 폴백 카드.
- 백엔드 베이스 URL: 서버 환경의 `NEXT_PUBLIC_MRMS_API_URL`(없으면 `http://127.0.0.1:8000`) 사용 — next.config rewrites와 동일 소스.

## 에러 / 엣지

- 없는/해제된 shareId → 공유 API 404 → generateMetadata 기본 메타, opengraph-image 브랜드 폴백 카드(제목 "Shared playlist", 그리드 없음). 200 PNG는 항상 반환(크롤러가 깨진 이미지 안 보게).
- 커버 0~3개 → 폴백 그리드(위).
- 제목 과길이 → 2줄 클램프(말줄임).
- 커버 URL 로드 실패(만료) → ImageResponse는 해당 `<img>`만 빈칸; 치명적 아님(나머지 셀 정상). 가능하면 onerror 대체 어려우니 best-effort.
- 백엔드 미응답(타임아웃) → 폴백 카드 + 기본 메타.

## 테스트 전략

- 백엔드: `get_playlist_tracks`가 EMPSource.cover_url 있는 트랙에 `album_cover`를 채우는지(통합, tests/db/test_playlist.py에 추가). cover 없으면 None.
- 프론트: `opengraph-image`/`generateMetadata`는 ImageResponse 렌더라 단위테스트 부적합 → **tsc/lint/build 통과 + 수동 검증**(빌드된 `/p/{token}/opengraph-image` 200 PNG, og 메타 `<meta property="og:image">` 존재). 빌드가 라우트를 잡는지 확인.
- ⚠️ DB 격리 안 됨 — 백엔드 대상 파일만.

## 비채택 / 범위 밖 (YAGNI)

- IBM Plex 폰트 바이너리 로딩(ImageResponse 커스텀 폰트) — 시스템 sans로 v1, 폴리시는 후속.
- 커버 합성 외 블러 배경/애니메이션 — editorial 카드로 충분.
- 트랙별 OG, 앨범 OG — 공유 플레이리스트만.
- twitter player card(인페이지 재생) — summary_large_image로 충분.

## 후속 작업

1. `db/playlist.py:get_playlist_tracks` EMPSource.cover_url LATERAL.
2. `p/[shareId]/page.tsx` server 전환 + `SharedPlaylistClient.tsx` 분리 + `generateMetadata`.
3. `p/[shareId]/opengraph-image.tsx` 동적 카드(2×2 그리드 + 제목/메타/CTA + 폴백).
4. tsc/lint/build + 수동 검증.

## 관련 문서

- [공유 플레이리스트 페이지(ADR-010)](2026-06-15-shared-playlist-page-design.md) — 이 OG가 붙는 페이지.
- 코드: `src/mrms/api/shared.py`·`src/mrms/db/playlist.py`(공유 API/트랙), `web/src/app/p/[shareId]/`(페이지·OG), `web/src/app/p/layout.tsx`(브랜딩), `src/mrms/api/main.py`(_fetch_track_metadata EMPSource LATERAL 패턴 참조).
