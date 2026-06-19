# Tidal Videos (뮤직비디오) — 설계 스펙 (v1)

> 작성일 2026-06-19. MRMS_FN. Tidal 에디토리얼 뮤직비디오를 가져와 **별도 `/videos` 페이지**에서 장르별로 둘러보고, 클릭하면 **풀스크린**으로 영상+음악을 보는 기능. 핵심 매력 = "뮤직비디오를 전체화면으로 보면서 그 음악을 듣는" 몰입 경험.

## 목표

1. Tidal home `videos` 페이지의 **장르 비디오 플레이리스트**(New Pop/Hip-Hop/K-Pop Videos…)를 인제스트.
2. 새 **`/videos` 페이지**(사이드바 nav)에서 장르별 가로 캐러셀로 비디오 썸네일 브라우즈. EMP와 분리.
3. 비디오 클릭 → **풀스크린 오버레이 플레이어**(`<video>` + HLS). 재생 중이던 오디오 큐는 일시정지, 닫으면 복귀.
4. 인증: **연결된 Tidal 회원 = OAuth로 FULL MV**, **게스트/미연결 = x-tidal-token으로 30초 프리뷰**(가입 유도).

## 비목표 (v1)

- 비디오 큐/연속재생(다음 MV 자동), 비디오 플레이리스트 저장, 좋아요. (후속)
- 보유곡/아티스트 매칭 MV("이 곡의 MV") — 별도 비디오 페이지 채택으로 제외.
- 비디오에 대한 스펙트럼/Web Audio 분석(비디오는 자체 오디오 — 무관).
- DRM 대응(Tidal 비디오는 비-DRM HLS로 확인됨).

---

## 확정된 결정

1. **서페이스**: 별도 `/videos` 페이지(사이드바 nav 신규). EMP와 분리 — 장르 10여 개×~50영상이라 EMP에 섞으면 과함.
2. **소스**: Tidal `/v1/pages/videos` 의 비디오 플레이리스트(에디토리얼). "전용" = Tidal MV 카탈로그(유튜브 아님).
3. **재생 UX**: 풀스크린 오버레이(영상+오디오). 열면 오디오 큐 일시정지, Esc/배경/닫기 → `/videos` 복귀.
4. **화질/길이**: 연결 회원 OAuth → FULL(`assetpresentation=FULL`, postpaywall), 게스트 → x-tidal-token PREVIEW(30초). 오디오 재생과 동일한 인증 분기.
5. **인제스트 범위**: 전체 장르 비디오 플레이리스트.

---

## 검증된 Tidal Web API (실측 2026-06-19, x-tidal-token=`txNoH4kkV41MfH25`)

기존 `TidalEMPImporter`와 동일한 `X-Tidal-Token`(Setting `tidal_x_token`) + `tidal.com` 베이스 + `_common_params`(countryCode/locale/deviceType) 사용. 새 토큰/OAuth 불필요(인제스트 한정).

1. **비디오 플레이리스트 목록**
   `GET tidal.com/v1/pages/videos?countryCode=US&locale=en_US&deviceType=BROWSER`
   → `{ rows: [{ modules: [...] }] }`. 모듈 종류:
   - `MULTIPLE_TOP_PROMOTIONS`("Featured"): 개별 비디오(`type:"VIDEO"`, `artifactId`=비디오ID, `shortHeader`=제목). 일부 `CATEGORY_PAGES`(스킵).
   - `PLAYLIST_LIST`("New Video Playlists"): `pagedList.items` = 비디오 플레이리스트(`uuid`, `title`="New Pop Videos", `type:"EDITORIAL"`, `numberOfVideos`, `image`/`squareImage`). `showMore.apiPath` = view-all.
   - view-all: `GET tidal.com/v1/pages/single-module-page/{...}/1` → 전체 비디오 플레이리스트(실측 22개).

2. **플레이리스트 내 비디오**
   `GET tidal.com/v1/playlists/{uuid}/items?offset=0&limit=50&countryCode=US&...`
   → `{ items: [{ "item": {...}, "type": "video" }] }`. `item` 모양:
   ```json
   { "id": 529748781, "title": "hate that i made you love me",
     "duration": 300, "quality": "MP4_1080P", "type": "Music Video",
     "imageId": "c6420d6e-...", "explicit": false,
     "artist": { "id": 4332277, "name": "Ariana Grande", "picture": "..." },
     "artists": [...], "album": {...}|null, "allowStreaming": true }
   ```
   → 비디오ID=`item.id`, 썸네일=`item.imageId`(CDN), 제목=`item.title`, 아티스트=`item.artist.name`.

3. **비디오 재생(playbackinfo)** — 실측 결과:
   - **A) `GET api.tidal.com/v1/videos/{id}/playbackinfo?videoquality=HIGH&playbackmode=STREAM&assetpresentation=FULL` + `x-tidal-token` → HTTP 200**, 단 `assetPresentation: PREVIEW`(게스트=30초).
   - B/C) `playbackinfopostpaywall`(api/tidal 둘 다) + x-tidal-token → **401**(OAuth 필요). → **FULL은 회원 OAuth Bearer로 postpaywall** 호출(오디오 스트림과 동일 토큰 경로).
   - 응답 `manifest`(base64) 디코드 → `{ "mimeType": "application/vnd.apple.mpegurl", "urls": ["https://im-cf.manifest.tidal.com/1/manifests/...m3u8"] }`. **즉 HLS(m3u8)**.

이미지 CDN: `https://resources.tidal.com/images/{imageId(/로분할)}/{size}.jpg` (기존 `_pick_image_size`/cover 변환 로직 재사용).

---

## 아키텍처

### 1) 인제스트 — `TidalEMPImporter` 확장 (`src/mrms/emp/tidal.py`)

- `import_all`에서 **항상 1회** 비디오 인제스트 수행(별도 설정 라인 불필요 — 비디오 페이지는 단일 소스). 기존 home/playlist 소스 루프와 독립된 단계로 추가.
- `_fetch_video_playlists(http)`: `/v1/pages/videos` + view-all 워크 → `[(uuid, title, numberOfVideos, cover), ...]`.
- `_fetch_playlist_videos(http, uuid)`: `/v1/playlists/{uuid}/items?limit=50` → `_normalize_video`로 `[{video_id, title, artist, image_id, duration}, ...]`. (`_fetch_playlist_tracks`와 평행, wrapper `type=="video"`).
- `_normalize_video(item)`: id/title/artist.name/imageId/duration 추출.
- **EMPSection 재사용 저장**: 플레이리스트=섹션, 비디오=아이템.
  - `upsert_section(platform="tidal", section_key=f"video:{uuid}", display_title=title)` — **`video:` 접두로 EMP와 구분**.
  - `upsert_section_item(item_type="video", item_id=str(video_id), title=video_title, cover_url=image_cdn_url, display_order=i)`.
  - 아티스트는 `title`에 병기하지 않고, 비디오 아이템 표시는 프론트가 별도 처리(현 EMPSectionItem 스키마 유지 — title=비디오제목, cover=썸네일). 아티스트가 필요하면 v1.1에서 컬럼/패킹(YAGNI: v1은 제목+썸네일).
  - `prune_stale_items` 그대로(재import 시 정리).
- 비디오 재생용 트랙 upsert는 **하지 않음**(EMPSource는 오디오 트랙용). 비디오는 EMPSection/Item에만 존재, 재생은 video id로 직접 playbackinfo.

### 2) 저장/브라우즈 분리 (`src/mrms/db/emp_section.py`, `src/mrms/api`)

- 비디오 섹션은 EMPSection에 저장하되 **EMP browse에서 제외**:
  - `list_sections_with_items(conn, platform=None, exclude_video=True)` — 기본 `"sectionKey" NOT LIKE 'video:%'`. EMP `/api/emp/sections`는 exclude_video=True.
- 새 비디오 API `src/mrms/api/videos.py`:
  - `GET /api/videos/sections` — `list_sections_with_items(..., only_video=True)`(`"sectionKey" LIKE 'video:%'`). 공개(optional auth, EMP와 동일 — 게스트 둘러보기).
  - 응답 shape = EMP sections와 동일(섹션+아이템). 프론트 재사용 용이.

### 3) 재생 — 백엔드 (`src/mrms/api/auth_tidal.py` 또는 신규 `playback` 라우트)

- `GET /api/playback/tidal/video/{video_id}` (optional auth):
  1. 연결 회원(`get_current_user_id_optional` → user_id 있음 & tidal OAuth 있음) → `_get_access_token(user_id)` Bearer로 `api.tidal.com/v1/videos/{id}/playbackinfopostpaywall?videoquality=HIGH&playbackmode=STREAM&assetpresentation=FULL` 시도(FULL).
  2. 실패/게스트 → `x-tidal-token`으로 `.../playbackinfo?...assetpresentation=FULL`(PREVIEW로 내려옴).
  3. `manifest` 디코드 → HLS `urls[0]` 추출.
  4. 응답 `{ "url": "<m3u8>", "preview": <bool>, "duration_hint": <int|null> }`.
- **CORS/프록시**: m3u8 + 세그먼트는 Tidal CDN(`im-cf.manifest.tidal.com` 등). hls.js가 직접 fetch할 때 CORS 막히면 백엔드 HLS 프록시 필요(오디오 stream 프록시처럼 manifest+세그먼트 중계). → **Task 0(스파이크)에서 브라우저 직접 재생 가능 여부 먼저 검증**, 막히면 프록시 추가.

### 4) 프론트

- **라우트**: `web/src/app/(browse)/videos/page.tsx` — EMP(`/emp`)와 같은 `(browse)` 그룹(게스트 공개, 셸 재사용). `<VideosBrowse/>` 렌더.
- **사이드바 nav**: `web/src/lib/nav.ts`에 `{ title: "Videos", href: "/videos", num: "§ 04", ... }` 추가(EMP 다음).
- **`VideosBrowse`**(`web/src/components/videos/VideosBrowse.tsx`): `/api/videos/sections` fetch → 장르 섹션을 가로 캐러셀로. 셀 = `VideoCard`(썸네일 16:9 + 제목 + 아티스트, hover ▶). EMP `SectionRow`/`EmpItemCard` 패턴 차용(비디오용 16:9 카드).
- **풀스크린 플레이어**(`web/src/components/videos/VideoPlayerOverlay.tsx`):
  - 비디오 클릭 → `getVideoPlaybackUrl(id)`(`/api/playback/tidal/video/{id}`) → m3u8.
  - `<video>` + **hls.js**: `video.canPlayType('application/vnd.apple.mpegurl')`면 네이티브(Safari), 아니면 hls.js attach.
  - 풀스크린 오버레이(fixed inset-0, 검은 배경). 열 때 `usePlayerStore` 오디오 일시정지(`pausePlayback`). Esc/닫기 → 오버레이 해제(+선택적으로 오디오 복귀 안 함, 그냥 정지 유지).
  - 게스트(프리뷰)면 하단에 "가입하면 풀영상" CTA.
  - 게스트 게이팅: 재생 자체는 프리뷰로 허용(EMP "둘러보기"와 일관 — 비디오는 프리뷰가 곧 맛보기). 단 FULL은 회원만(서버가 자동 분기).
- **`item_type='video'`**: 백엔드 `VALID_ITEM_TYPES`엔 video 엔드포인트가 따로라 불필요. 프론트 타입에 video shape 추가(`EmpItemType`에 'video' 또는 별도 `VideoItem` 타입).
- **hls.js**: `pnpm add hls.js`(+ `@types`는 내장). 동적 import로 번들 분리(`await import('hls.js')`).

---

## 데이터 흐름

스케줄/admin importer → Tidal `/pages/videos` → 비디오 플레이리스트 → 각 플레이리스트 비디오 → EMPSection(`video:{uuid}`)+Item(`video`) 저장 → `/api/videos/sections` → `/videos` 페이지 캐러셀 → 클릭 → `/api/playback/tidal/video/{id}` → m3u8 → 풀스크린 `<video>`+hls.js.

## 에러 처리

- playbackinfo 실패(지역/만료/삭제) → 오버레이에 "재생할 수 없는 영상" + 닫기.
- 회원 OAuth FULL 실패 → 자동으로 x-tidal-token 프리뷰 폴백.
- hls.js 로드/재생 에러 → 에러 메시지, 오버레이 유지(닫기 가능).
- 인제스트: 플레이리스트별 try/except + `safe_rollback`(기존 패턴), 섹션 단위 실패 격리.
- 비디오 섹션 0개여도 `/videos` 페이지는 빈 상태 표시(깨지지 않음).

## 성능·접근성

- 캐러셀 비디오 썸네일 lazy-load(EMP와 동일). hls.js 동적 import로 초기 번들 영향 최소.
- 풀스크린 비디오는 사용자 제스처(클릭)로 시작 → autoplay 정책 OK.
- 오버레이 닫기 Esc + 닫기 버튼 + 배경 클릭, `aria-label`.

## 테스트

- **백엔드(pytest, respx mock)**:
  - `_normalize_video` 단위(비디오 item → {video_id,title,artist,image_id}).
  - `_fetch_video_playlists`/`_fetch_playlist_videos` (mock JSON → 정규화).
  - 인제스트 → EMPSection(`video:` 키)+Item(`video`) 저장 검증, EMP browse에서 제외 확인.
  - `/api/videos/sections`(video 섹션만), `/api/playback/tidal/video/{id}`(manifest 디코드 → m3u8, 회원=postpaywall/게스트=preview 분기) — respx mock.
- **프론트**: `npx tsc` + `pnpm build`. (hls.js 재생은 수동 확인 — Task 0 스파이크 + 배포 후 실측.)

## 파일 구조

생성:
- `src/mrms/api/videos.py` — `/api/videos/sections`, `/api/playback/tidal/video/{id}`.
- `src/mrms/emp/tidal.py`에 비디오 함수 추가(별도 모듈 분리 가능하나 토큰/헤더 공유라 동일 importer 내 권장).
- `web/src/app/(browse)/videos/page.tsx`, `web/src/components/videos/VideosBrowse.tsx`, `VideoCard.tsx`, `VideoPlayerOverlay.tsx`.
- `web/src/lib/api/videos.ts`(fetchVideoSections, getVideoPlaybackUrl).
- 단위 테스트(`tests/emp/test_tidal_videos.py`, `tests/api/test_videos.py`).

수정:
- `src/mrms/db/emp_section.py`(`list_sections_with_items` exclude/only video 필터).
- `src/mrms/api/emp_browse.py`(EMP는 비디오 제외).
- `src/mrms/api/main.py`(videos 라우터 등록).
- `web/src/lib/nav.ts`(Videos nav), `web/src/lib/types.ts`(video item 타입).
- `web/package.json`(hls.js).

## 리스크 / 주의

- **HLS CORS**: 가장 큰 불확실성. 브라우저가 Tidal CDN m3u8/세그먼트를 직접 못 가져오면 백엔드 프록시 필요. → **Task 0 스파이크로 우선 검증**(배포 전).
- **프리뷰 한계**: 게스트는 30초. "가입하면 풀영상" 동선으로 보완.
- **x-tidal-token 만료/차단**: 기존 importer와 공유 — 끊기면 인제스트+게스트 프리뷰 동시 영향(회원 FULL은 OAuth라 무관). 기존 graceful skip 패턴 유지.
- **EMPSection 재사용**: 비디오 섹션이 EMP browse에 새어나가지 않도록 `video:` 접두 필터 양쪽(EMP 제외/videos 포함) 정확히. 회귀 테스트 필수.
- **저작권/약관**: Tidal 공개 웹 API + 프리뷰는 기존 EMP/오디오와 동일 선상(개인 프로젝트). FULL은 회원 본인 계정 OAuth.
