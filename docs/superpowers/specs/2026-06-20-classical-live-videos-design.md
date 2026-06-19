# 클래식 공연 실황 섹션 — 설계 스펙

> 작성 2026-06-20. MRMS_FN. `/videos` 페이지에 **클래식 공연 실황(풀콘서트/리사이틀)** 섹션 추가.

## 조사 결론 (왜 YouTube인가)

- **Tidal**: 클래식 영상은 있으나 **2~13분 악장 단위 클립**(스튜디오/레이블)뿐. 풀콘서트 없음. `search?types=PLAYLISTS`로도 클래식 비디오 플레이리스트 0건. → "공연 실황" 부적합.
- **YouTube** (실측): 공식 오케스트라/레이블 채널이 **풀콘서트·리사이틀(40분~2.5시간)을 임베드 허용으로** 업로드. `videoDuration=long`+`videoEmbeddable=true` 필터로 실황만 깔끔 추출. 앱이 이미 YouTube 재생 지원 + `YOUTUBE_DATA_API_KEY` 보유.
- 그 외(medici.tv·Berlin Phil DCH·IDAGIO) = 폐쇄/프리미엄·임베드 불가. Arte Concert = 무료지만 공식 API 없음.

## 결정

- **소스 = YouTube 단독**, 큐레이션 = **공식 채널 로스터** 8개(Berliner Phil·DW Classical Music·London SO·Chicago SO·hr-Sinfonieorchester·Wiener Symphoniker·KBS교향악단·LG필하모닉).
- 채널별 `search?channelId&type=video&videoDuration=long&videoEmbeddable=true&order=date` → dedup.

## 아키텍처

**백엔드** `src/mrms/emp/youtube_videos.py`:
- `fetch_classical_videos(http, api_key)` → 로스터 순회 → `[{video_id, title, channel, cover_url}]`(dedup, html 언이스케이프).
- `import_classical_videos(conn, http)` → `EMPSection(platform='youtube', section_key='video:classical-live', display_title='클래식 공연 실황', display_order=0)` + items(`item_type='youtube_video'`, item_id=YT id) + `prune_stale_items`. 키 없거나 0건이면 no-op.
- 훅: `runner._run_importer_youtube` 래퍼(import_all 뒤). test_runner는 래퍼를 patch, youtube 단위테스트는 import_all 직접 호출 → **두 테스트 모두 실제 googleapis 미접촉**.

**격리 불변식**:
- 섹션 `platform='youtube'` → Tidal importer의 `_prune_stale_video_sections`(platform='tidal' 한정)이 안 지움.
- `list_sections_with_items(only_video=True)`는 플랫폼 무관 `video:%` 포함 → /videos에 같이 노출. `exclude_video`(EMP)는 모두 제외.

**프론트**:
- `EmpItemType`에 `'youtube_video'` 추가(+EmpItemCard TYPE_TONE).
- `useVideoPlayer.open(id, title, source)` — `source: 'tidal'|'youtube'`.
- `VideoCard` `source` prop. VideosBrowse: `youtube_video` → `VideoCard source='youtube'`(16:9 비디오 카드).
- `VideoPlayerOverlay`: `source==='youtube'`면 `youtube-nocookie.com/embed/{id}` **IFrame**(HLS 스킵, 프리뷰 CTA 없음). 극장↔풀스크린 토글 공유.

## 검증

- 단위(respx): `_normalize_yt_video`·`_yt_thumbnail`·`fetch_classical_videos`(dedup)·`import_classical_videos`(섹션 생성)·no-key no-op.
- 회귀: test_runner / test_youtube / test_tidal_videos 무영향(43 pass). tsc/eslint clean.

## 운영

- admin EMP import(youtube stage) 1회 → `video:classical-live` 채워짐. 쿼터: 8채널×100u = 800u/회(10k/일 한도 내).
