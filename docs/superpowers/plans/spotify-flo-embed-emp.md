# Spotify embed + FLO + Melon — 토큰 없는 EMP 소스 (실측 검증)

**날짜**: 2026-06-11
**상태**: 메커니즘 실측 검증 완료 — 구현 대기
**출처**: my-forever-music (Java) 의 검증된 방식 이식. 로컬에서 전 체인 재실측.

3개 신규 소스 전부 **토큰/인증 0** 으로 동작 확인:
- **Spotify embed** — 차트/앨범/아티스트 (글로벌·US·KR)
- **FLO** — 한국 큐레이션/채널 (K-힙합·인디)
- **Melon Hot 100** — 한국 메인 차트 (실시간 100위)

## 배경 — 왜 이 방식인가

Spotify 홈/에디토리얼 컨텐츠를 가져오는 경로를 모두 타진한 결과:

| 경로 | 결과 | 비고 |
|---|---|---|
| `/v1/browse/featured-playlists` | ❌ 403 | 신규 앱 client_credentials 차단 (2024 말) |
| `/v1/browse/new-releases` | ❌ 403 | 동일 |
| Spotify 자사 playlist `/v1/playlists/{id}` | ❌ 404 | 차단 |
| `/v1/search?type=track` | ✅ 200 | 동작하나 홈 미러링 아님 (장르 검색). ISRC 포함. **현재 v2가 이걸 씀** |
| `api-partner.spotify.com/pathfinder` (홈 GraphQL) | ⚠️ 토큰 | `authorization` Bearer + `client-token` 둘 다 필요 |
| sp_dc 쿠키 → `get_access_token` | ❌ 403 / TOTP | 2025 TOTP 게이트 추가. secret rotation으로 brittle |
| **`open.spotify.com/embed/{kind}/{id}`** | ✅ **토큰 0** | **공개 위젯 HTML — 본 문서의 핵심** |

결론: pathfinder/sp_dc는 토큰 brittle. **embed 스크래핑은 토큰이 아예 없어 안정적.**
컨테이너(playlist/album/artist)의 고정 ID만 알면 토큰 없이 트랙을 가져온다.
Spotify 차트 playlist의 ID는 고정이라(내용만 주간 갱신) 이 방식이 성립.

## 1. Spotify embed 스크래핑 (검증 완료)

### 요청
```
GET https://open.spotify.com/embed/{kind}/{id}
  kind ∈ { playlist | album | artist }
Headers:
  User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36
  Referer: https://open.spotify.com/
  Accept: text/html,application/xhtml+xml
```

### 응답 파싱
HTML 내 `<script id="__NEXT_DATA__">` 의 JSON:
```
props.pageProps.state.data.entity
  ├ name / title           — 컨테이너 제목
  └ trackList[]            — 트랙 배열
       ├ uri               — "spotify:track:{id}"  → spotify_track_id
       ├ title             — 곡명
       ├ subtitle          — 아티스트 (", " 구분,   정규화 필요)
       ├ duration          — ms (정수)
       └ audioPreview.url  — 30초 프리뷰 (있을 때)
```

**주의**: ISRC 없음 (spotify track id만). 적재 시 upsert_track_and_emp_source의
platform-ID lookup-first 경로로 dedup (base.py 기존 로직). download_audio는
제목+아티스트로 iTunes 매칭하므로 ISRC 없어도 동작.

### kind별 결과 (실측)
- **playlist**: trackList = 수록곡 전체 (차트는 50곡)
- **album**: trackList = 앨범 트랙 전체
- **artist**: trackList = 인기곡 top ~10 (보너스 — 아티스트 라디오 대용)
- **track** (단일): trackList = 0 (컨테이너 아님 → 미사용)

### 검증된 고정 차트 playlist ID (2026-06-11 실측)
| ID | 이름 | 트랙 |
|---|---|---|
| `37i9dQZEVXbMDoHDwVN2tF` | Top 50 - Global | 50 |
| `37i9dQZEVXbLRQDuF5jeBp` | Top 50 - USA | 50 |
| `37i9dQZEVXbNxXF4SkHj9F` | Top 50 - South Korea | 50 |
| `37i9dQZEVXbNG2KDcFcKOF` | Top Songs - Global (weekly) | 50 |
| `37i9dQZF1DXcBWIGoYBM5M` | Today's Top Hits | 50 |
| `37i9dQZF1DX0XUsuxWHRQd` | RapCaviar | 51 |

> 깨진 ID(0 트랙): `37i9dQZEVXbLiRSasKsNU9`(Viral 50), `37i9dQZEVXbJZGli0rRP0r`(Top Songs Korea)
> — Spotify가 ID 변경/폐기. admin Setting에서 갱신 가능하게.

### 홈 3섹션 매핑 (spotify_web_emp_api.md 의 캡처 기준)
- **Popular albums** → `album:{id}` embed ✅
- **Featured Charts** → `playlist:{id}` embed ✅ (차트 playlist)
- **Trending songs** → 개별 트랙 나열이라 embed 대상 아님. 차트 playlist로 사실상 대체.

## 2. FLO public API (검증 완료, 토큰 0)

한국 가요/K-힙합 보강용. `music-flo.com` 공개 API — `x-gm-access-token` 빈 값으로 동작.

### 헤더 (전 요청 공통)
```
Accept: application/json, text/plain, */*
Referer: https://www.music-flo.com/
User-Agent: (임의)
x-gm-access-token:            (빈 값)
x-gm-app-name: FLO_WEB
x-gm-app-version: 8.1.0
x-gm-device-id: MRMS-EMS-FLO
x-gm-device-model: MRMS
x-gm-os-type: WEB
x-gm-os-version: 1.0
```
성공 응답은 `code == "2000000"`.

### 엔드포인트
```
# 1. 스페셜 큐레이션 섹션 목록
GET /api/personal/v1/curations/contents
  → data.list[]               — 섹션들
       ├ type                 — 'CURATION2' / 'CURATION3' ...
       └ content
            ├ id / title      — 섹션 제목
            └ list[]          — 아이템 (playlist/channel)
                 ├ type       — 'PLAYLIST' | 'CHNL'
                 ├ id         — playlist/channel id (숫자)
                 ├ name       — 제목
                 └ gridImg/img.urlFormat — 커버 (`{size}` → 500 치환)

# 2. playlist 트랙
GET /api/personal/v1/playlist/{numericId}
  → data.track.list[]

# 3. channel(CHNL) 트랙 — type이 CHNL이면 이쪽
GET /api/meta/v1/channel/{numericId}
  → data.trackList[]
```

### 트랙 파싱
```
track:
  id                          — FLO track id
  name                        — 곡명
  artistList[].name           — 아티스트 (", " join; 없으면 representationArtist.name)
  album.title                 — 앨범
  album.img.urlFormat         — 커버 (`{size}` 치환)
  album.releaseYmd            — 발매일
  playTime "mm:ss"            — → durationMs (분:초 파싱 × 1000)
```

### 실측 결과 (2026-06-11)
- 섹션 2개 (예: "예감 좋은 행운을 드려요", "떠나요, 여름 드라이브"), 섹션당 아이템 8개
- PLAYLIST + CHNL 혼합 (K-힙합 채널 등)
- playlist 트랙: 15곡 (데이브레이크, won.e, 원슈타인 …) — 한국 인디/힙합 신선

## 3. Melon Hot 100 (검증 완료, 토큰 0)

한국 메인 차트 (실시간 Top 100). 공개 JSON 없음 → 차트 페이지 HTML 스크래핑.

### 요청
```
GET https://www.melon.com/chart/index.htm
Headers:
  User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ... Chrome/126.0 Safari/537.36
```

### 파싱 (BeautifulSoup / lxml — Java는 Jsoup)
```
행 선택:  table tbody tr.lst50, table tbody tr.lst100   (= 100행)
각 행:
  span.rank                         → 순위 (숫자만 추출)
  tr[data-song-no]                  → Melon songId
  div.ellipsis.rank01 a|span        → 곡명
  div.ellipsis.rank02 a|span        → 아티스트
  div.ellipsis.rank03 a             → 앨범 (없으면 None)
  a.image_typeAll img[src]          → 커버 (fallback: td a img[src])
  songExternalUrl = melon.com/song/detail.htm?songId={id}
```

### 실측 결과 (2026-06-11)
- HTTP 200, 100행 전부 파싱
- 1위 "갑자기 — 아이오아이", 4위 "LEMONADE — aespa" 등 — 제목/아티스트/앨범/커버/songId 완전

### 주의
- ISRC·재생 ID 없음 (Melon songId만). Spotify/Tidal 재생은 resolve API(제목+아티스트 검색)로.
  Melon은 **차트 신호(곡 식별)** 용 — 재생 가능 플랫폼 매칭은 download/resolve가 담당.
- selector 의존 (페이지 레이아웃 변경 시 깨짐). 0행이면 에러 기록 + skip, 파서 1곳 수정.

## 4. MRMS 통합 설계 (구현 대기)

### 소스 형식 (Setting `spotify_emp_sources` / 신규 `flo_emp_sources`)
```
# Spotify (한 줄에 하나, # 주석)
playlist/37i9dQZEVXbMDoHDwVN2tF      # Top 50 Global
album/{albumId}
artist/{artistId}

# FLO — special 큐레이션 자동 발견(빈 값 시 기본) 또는 직접
special                              # /curations/contents 전체 자동
playlist/{numericId}
channel/{numericId}
```

### Importer (Tidal 패턴 재사용)
- `src/mrms/emp/spotify.py` — search 방식을 embed 방식으로 교체.
  소스 kind: playlist/album/artist. embed 스크래핑 → 트랙 + 섹션 저장.
  source_type='editorial_embed', source_id='{kind}:{id}'.
- `src/mrms/emp/flo.py` (신규) — special 자동 발견 + playlist/channel 트랙.
  platform='flo'. 섹션 = FLO 큐레이션 섹션, 아이템 = playlist/channel.
- `src/mrms/emp/melon.py` (신규) — Hot 100 스크래핑.
  platform='melon'. 섹션 1개 ("Hot 100"), 아이템은 트랙 직접 (앨범 그룹핑 또는
  단일 "차트" 컨테이너). source_type='chart', source_id='melon:hot100'.
- 전부 `EMPImporter` 추상 + `import_all` 직접 구현 + `safe_rollback` 위생 (tidal.py 동일).
- 섹션/아이템 저장: `upsert_section` / `upsert_section_item` / `prune_stale_items`.
- 트랙 upsert: `upsert_track_and_emp_source` (ISRC 없음 → platform-ID dedup).
- 의존성: BeautifulSoup4 (Melon HTML). Spotify embed는 정규식으로 충분 (의존성 X).

### Runner / 스케줄
- `src/mrms/emp/runner.py`: import_flo / import_melon stage 추가 (import_tidal과 동렬).
- `make_importer`에 'flo' / 'melon' 등록.

### Frontend
- `/emp` 플랫폼 그룹 이미 구현됨 (PLATFORM_ORDER). flo/melon 추가 + 디바이더 문구.
- admin SettingsCard: flo_emp_sources textarea 추가 (Melon은 소스 고정이라 토글이면 충분).

### MERT 파이프라인
- 변경 없음 — Track.inEmp 트리거로 02→03→10 자동 픽업 (플랫폼 무관).

## 5. 장점 요약
- **토큰 0** — Spotify TOTP/sp_dc, FLO/Melon 인증 전부 회피. 유지보수 부담 없음.
- **홈 미러링** — 사용자가 원한 "메인에 떠 있는 컨텐츠" 그대로.
- **한국 보강** — FLO(K-힙합·인디) + Melon Hot 100(메인 차트) (Spotify·Tidal이 약한 영역).
- **검증됨** — my-forever-music prod에서 가동 중인 방식. 셋 다 로컬 재실측 완료.

## 6. Risk
- embed `__NEXT_DATA__` 구조 변경 가능 (Spotify Next.js 업그레이드 시). 파싱 실패 시
  해당 소스만 에러 기록 후 skip (safe_rollback). 구조 바뀌면 파서 1곳 수정.
- 차트 playlist ID 폐기 (Viral 50 사례). admin Setting에서 교체 가능하게.
- FLO `code` 체계/경로 변경 가능 — 동일하게 소스별 graceful skip.
- Melon HTML selector 변경 가능 — 0행이면 에러 기록 + skip, 파서 1곳 수정.
- ISRC 부재 → cross-platform 정밀 매칭 약화. resolve API(재생 시점 검색)가 보완.

## 7. 출처 파일 (my-forever-music, 참고)
- Spotify embed: `services/api/.../platform/infrastructure/spotify/SpotifyEmbedPlaylistScraper.java`
- FLO: `services/api/.../ems/application/FloSpecialCurationService.java`
- Melon: `services/api/.../melon/infrastructure/scraping/MelonChartScraper.java`
  + `melon/application/MelonChartService.java`
