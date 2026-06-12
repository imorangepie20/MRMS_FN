# YouTube 취향 Phase 2 — 미스곡 임베딩 (yt-dlp → MERT) 설계

> Phase 1(텍스트 매칭) 후속. Phase 1은 YouTube 라이브러리 곡을 **임베딩 보유 카탈로그에 정규화 매칭**해 취향에 반영했다(실측 22% = 178/832). 나머지 **78%(미스)**는 카탈로그에 없어 임베딩이 없고 추천에 기여하지 못한다. Phase 2는 이 미스곡을 **임베딩**해 취향 커버리지를 끌어올린다.

**상태:** 경로 검증·de-risk 완료 (아래 "검증된 사실"). 구현 전 spec 리뷰 단계.

---

## 검증된 사실 (2026-06-13 실측)

1. **Spotify 프리뷰 경로 불가** — Spotify가 `preview_url`을 API에서 폐기(2024말). 미스곡 8/8 검색되지만 preview 0/8. → "Tidal/Spotify 프리뷰 resolve" 방식 폐기.
2. **yt-dlp 동작 확인** — `yt-dlp 2026.06.09` + `ffmpeg 8.1.1` 설치/추출 OK. videoId로 오디오 스트림 확보(예: 195초 트랙, abr 134). 미스곡은 YouTube에서 왔으므로 **videoId를 이미 보유** → 재resolve 불필요.
3. **카탈로그 임베딩 입력 방식** — [03_extract_embeddings.py](../../../scripts/03_extract_embeddings.py)가 `ffmpeg -t 30`으로 **파일 앞 30초**를 MERT-95M(frozen, mean-pooled 768d→256d)에 통과. sample_rate=22050, modelVersion=`our-v1.0`(=`CATALOG_MODEL_VERSION`).

## 핵심 정합성 리스크 (설계 제1원칙)

카탈로그 임베딩은 **플랫폼이 고른 프리뷰 30초(주로 후렴/훅)**에서 나왔다. YouTube 풀트랙의 **앞 30초는 인트로**라, 같은 `-t 30`이어도 세그먼트 성격이 달라 임베딩이 카탈로그 분포와 어긋날 수 있다 → 추천 품질 저하. **Phase 2는 훅에 가까운 세그먼트를 추출해야 한다.**

- **결정:** YouTube 오디오에서 **트랙 길이의 30~40% 지점부터 30초**를 추출(인트로 스킵, 후렴 근처 확률↑). 30초 미만 트랙은 전체 사용.
- **튜닝 포인트(명시):** 앞-30초 vs 중간-30초는 향후 A/B 대상. MVP는 중간-오프셋 고정. (오프셋 비율은 설정값으로 노출.)

---

## 목표 (한 문장)

YouTube 라이브러리 미스곡(videoId 보유, 임베딩 없음)을 yt-dlp로 받아 카탈로그와 **동일 방식**(훅 30초 → MERT-95M → 256d, modelVersion `our-v1.0`)으로 임베딩해 `TrackEmbedding`에 적재, 다음 onboarding에서 취향에 기여하게 한다.

## 아키텍처 — 기존 파이프라인 확장 (신규 인프라 최소화)

기존 EMP 오디오 파이프라인(02 다운로드 → 03 MERT → 10 적재)을 재사용한다. Phase 2는 **02에 youtube-videoId 소스를 추가**하는 게 핵심. 03/10은 무변경(이미 오디오 파일·임베딩을 처리).

```
미스곡 식별 → 02(yt-dlp 다운로드 + 훅 클립) → 03(MERT, 무변경) → 10(TrackEmbedding 적재, 무변경) → 재-onboard
```

### 대상 곡 식별 (쿼리)
```sql
SELECT DISTINCT t.id, tp."platformTrackId" AS video_id, t.title, a.name AS artist
FROM "Track" t
JOIN "TrackPlatform" tp ON tp."trackId" = t.id AND tp.platform = 'youtube'
JOIN "Artist" a ON a.id = t."artistId"
WHERE tp."platformTrackId" NOT LIKE 'yt\_%'           -- 합성 ID 제외 (실 videoId만)
  AND EXISTS (SELECT 1 FROM "UserTrack" ut WHERE ut."trackId" = t.id)  -- 사용자 라이브러리에 속함
  AND NOT EXISTS (SELECT 1 FROM "TrackEmbedding" e WHERE e."trackId" = t.id)  -- 아직 임베딩 없음
LIMIT %s
```

### 다운로드 + 클립 (02 확장)
- 소스 우선순위에 `youtube_video` 추가: preview_url 없고 youtube videoId 있으면 yt-dlp.
- yt-dlp 옵션: `format='bestaudio'`, `quiet`, `noplaylist`. 스트림 URL 확보 후 ffmpeg로 **오프셋부터 30초** 추출 → `{AUDIO_DIR}/{track_id}.{ext}` (또는 .npy 캐시), 03이 읽는 형식과 동일.
- **클립:** 트랙 길이 확보(yt-dlp info의 `duration`) → `offset = duration * OFFSET_RATIO`(기본 0.30), `ffmpeg -ss {offset} -t 30`. duration < 40s면 `-ss 0`.

### 스로틀/안정성 (YouTube IP 보호)
- 다운로드 간 `--sleep`(기본 2~4초 랜덤), 동시성 1~2.
- 실패(차단/삭제/지역제한) → `logs/youtube_download_failed.csv` 기록 후 스킵(Phase 1 미스처럼 무해).
- `--limit`로 1회 처리량 상한. 야간 배치 또는 수동 트리거.

### 트리거 정책
- **MVP:** 수동/배치 스크립트(`scripts/13_embed_youtube_misses.py` 또는 02 `--youtube-misses` 플래그). EMP 야간 타이머에 선택적 단계로 편입 가능.
- import 시 동기 실행 금지(느림). import은 미스곡을 만들어두기만, 임베딩은 비동기.
- 임베딩 적재 후 사용자 onboarding 재실행 시 자동 반영(파이프라인 step2가 임베딩 UserTrack을 다시 집계).

## 컴포넌트/파일

- **pyproject.toml** — `yt-dlp` 의존성 추가. (ffmpeg는 시스템 의존, 배포 문서에 명시.)
- **scripts/02_download_audio.py** — youtube_video 소스 분기(yt-dlp + 훅 클립) + 대상 식별 쿼리(`--youtube-misses`).
- **src/mrms/config.py** — `youtube_clip_offset_ratio: float = 0.30`(튜닝 노출).
- **scripts/03, 10** — 무변경(검증만).
- **docs/deployment.md** — ffmpeg/yt-dlp 설치 + 야간 배치 안내.

## 스코프 밖 (YAGNI)
- 실시간/동기 임베딩, 풀트랙 멀티청크 임베딩(카탈로그가 30초라 불일치), Tidal 프리뷰 fallback(우선순위 낮음 — videoId 직행이 단순), 사용자별 우선순위 큐(MVP는 전체 배치).

## 테스트 전략
- yt-dlp 클립: 알려진 videoId → 30초 wav 추출 + sample_rate/길이 검증(네트워크 의존이라 통합 테스트로 분리, CI 스킵 마커).
- 대상 식별 쿼리: 합성 ID 제외 + UserTrack 보유 + 임베딩 없음 정확.
- e2e(수동): 미스곡 N개 임베딩 → TrackEmbedding 256d 적재 확인 → 사용자 재-onboard → 페르소나에 신규 곡 반영 확인(매칭률 22% → 상승).

## 리스크 / 미해결
- **YouTube ToS/차단** — 개인 라이브러리 한정·저빈도라 방어 가능하나, 스케일·데이터센터 IP에선 차단 위험. prod는 가정용 회선(192.168.x)이라 유리.
- **클립 정합성** — 중간-30초 휴리스틱이 후렴을 못 잡는 곡 존재. A/B 튜닝 필요(설정값으로 대비).
- **스토리지** — 미스곡 다수 시 오디오 누적. 임베딩 후 원본 삭제 옵션 고려.
