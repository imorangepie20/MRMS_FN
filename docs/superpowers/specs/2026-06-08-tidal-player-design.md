# Sub-project E.5: Tidal Web Playback SDK 플레이어 (Design)

**날짜**: 2026-06-08
**상태**: 디자인 (사용자 리뷰 대기)
**범위**: 추천 페이지(MRT)에서 Tidal Web Playback SDK로 full track 재생. 하단 영구 PlayerBar + 큐 + auto-next + 반응형.

## 🚨 구현 결과 — 큰 pivot 있음 (READ FIRST)

> **이 spec의 SDK 접근 방식은 실패했고, 백엔드 proxy 방식으로 교체됨**. 아래 내용은 최종 구현이 아닌 **역사적 기록**으로 보존.

### 최종 아키텍처

```
Browser <audio>  ←  /api/playback/tidal/stream/{track_id}  (FastAPI proxy)  ←  Tidal CDN
```

- HTML5 `<audio>` 요소를 직접 사용 (SDK 없음)
- FastAPI proxy가 Tidal `/v1/tracks/{id}/playbackinfo` (legacy REST)를 호출 → base64 manifest 디코드 → `urls[0]` (직접 audio file URL) 추출
- proxy가 `Authorization: Bearer <token>` 헤더로 Tidal CDN에서 stream을 받아 브라우저로 relay

### SDK 접근이 실패한 이유 (6시간 디버깅 후)

1. **dev app tier 제약**: 우리 Tidal dev app의 access tier가 SDK 경로의 FULL DRM streaming을 지원하지 않음
2. **CDN segment 다운로드 실패**: DASH manifest까지는 정상 수신되지만 CDN segment 단계에서 Widevine challenge가 실패함
3. **PREVIEW 한정**: SDK로 도달 가능한 최대치는 30초 PREVIEW 뿐, FULL track 재생 불가

### Proxy 접근의 핵심

- 사용자의 Electron 앱 코드와 `my-forever-music` 프로젝트에서 발견한 패턴
- python-tidal 라이브러리의 공개 credentials (`TIDAL_CLIENT_ID=fX2JxdmntZWK0ixT`)와 Device Authorization Code flow 사용 — 원래 spec의 Authorization Code + PKCE 아님
- legacy `/v1/tracks/{id}/playbackinfo` endpoint는 DRM 없이 직접 audio URL을 반환 (`audioquality=HIGH`, `assetpresentation=FULL`)
- 결과적으로 브라우저는 일반 HTML5 audio 재생만 하면 됨

### Pivot 시점

- Commit `9b98dc9` "feat: Tidal proxy streaming" — SDK 폐기 + proxy endpoint 도입
- 후속 commit에서 `@tidal-music/*` 패키지 제거 + Device Code OAuth 도입

### 이하 내용에 대한 안내

아래 섹션 1–12는 **원래 spec 그대로** 보존되어 있음. SDK 패키지명 / Premium 체크 / Widevine DRM / `credentialsProvider` 등의 기술 결정은 **모두 실제 구현에 반영되지 않음**. 최종 구현 문서는 `docs/tidal-sdk-notes.md` 참조.

---

## 1. Goal + 사용자 의도

E.0+1+2에서 시각화된 MRT를 **브라우저에서 직접 들어볼 수 있게** 만듦. 본인 Tidal Premium 구독 활용. 추천 → 감상 루프 닫음.

핵심 가치:
- 페르소나/추천 트랙 클릭만으로 재생
- 페이지 이동해도 재생 유지
- 자동 다음 곡 (큐 기반)
- 모바일(폰) / 태블릿 / 데스크탑 모두 자연스러운 UX

## 2. Success Criteria

```bash
# 사전: 본인 Tidal Premium, A1 OAuth 완료, B-full MRT 생성됨
$ make api
$ make web
$ make tunnel
$ open https://mrms.approid.team
```

체크리스트:
- [ ] 페이지 로드 시 PlayerBar 하단 표시 (빈 상태)
- [ ] 콘솔 `Tidal SDK initialized, premium: true`
- [ ] 페르소나 카드 트랙 옆 ▶ 클릭 → 소리 남
- [ ] PlayerBar에 현재 곡 메타 표시
- [ ] ⏯ 일시정지/재개 동작
- [ ] ⏭ 누르면 큐 다음 곡 재생
- [ ] 곡 끝까지 들으면 자동 다음 곡 시작
- [ ] 진행 바 드래그 seek 동작
- [ ] 추천 트랙 테이블 ▶ → 큐가 추천 트랙 전체로 교체
- [ ] /mrt → 다른 dashboard 페이지 이동해도 재생 유지
- [ ] 페이지 새로고침 시 재생 중단 (의도된 동작)
- [ ] 본인 추천 60개 → Tidal-only 필터로 42개 정도 표시
- [ ] Chrome DevTools iPhone emulation: 페르소나 1열, 추천 트랙 카드 리스트, PlayerBar 컴팩트
- [ ] iPad emulation: 페르소나 2열, PlayerBar 풀 컨트롤
- [ ] 1280+ desktop: 페르소나 3열, 앨범 5열

## 3. Architecture

```
Browser
   ↓ /mrt 페이지
[추천 페이지]
   ├── PersonaCard ▶ click
   │   → PlayerStore.setQueue(persona.playlist, idx)
   └── RecommendedTracksTable ▶ click
       → PlayerStore.setQueue(recommended_tracks, idx)

[PlayerStore — Zustand]
   ├── queue: QueueTrack[]
   ├── currentIdx, isPlaying, position, durationSec, volume
   ├── premium: boolean | null
   └── actions: play(), pause(), next(), prev(), seek(r), setVolume(v)
       ↓
[Tidal SDK Wrapper — 싱글톤]
   - 동적 import (SDK는 client-only)
   - init w/ user access_token
   - load(tidalTrackId) → play()
   - 이벤트 → PlayerStore 업데이트
       ↓
[Tidal Server (CDN + DRM)]

[FastAPI 백엔드]
   ├── GET /api/auth/tidal/token       — 토큰 + premium 반환
   ├── POST /api/auth/tidal/refresh    — 명시적 refresh
   └── GET /api/mrt/latest (수정)      — Tidal-only filter + tidal_track_id 포함

[PlayerBar — Layout에 영구]
   - NowPlaying + PlayerControls + (md+) VolumeSlider + QueueButton
   - 반응형: mobile 64px / tablet 80px
```

핵심 단순화:
- PlayerStore = 단일 상태 출처. 모든 컴포넌트 여기서 읽고 씀
- SDK = headless. UI는 100% 우리가 만듦
- Tidal track ID는 백엔드에서 미리 전달

## 4. Data Model + API

### 4.1 새 DB 테이블 없음

`TrackPlatform`에 Tidal track ID 이미 존재 (95,958 트랙).

### 4.2 Pydantic 스키마 수정

`src/mrms/api/schemas.py`:

```python
class PersonaTrack(BaseModel):
    track_id: str
    title: str
    artist: str
    album_id: str | None = None
    album_title: str | None = None
    similarity: float
    tidal_track_id: str | None = None   # NEW

class RecommendedTrack(BaseModel):
    track_id: str
    title: str
    artist: str
    album_id: str | None = None
    score: float
    persona_idx: int | None = None
    tidal_track_id: str | None = None   # NEW
```

### 4.3 /api/mrt/latest 수정

Tidal-only filter — Track ⟕ TrackPlatform (platform='tidal') INNER JOIN:

```sql
-- 트랙 메타 조회 시 Tidal platform ID도 JOIN
SELECT t.id, t.title, a.name, t."albumId", alb.title, tp."platformTrackId" AS tidal_track_id
FROM "Track" t
JOIN "Artist" a ON a.id = t."artistId"
LEFT JOIN "Album" alb ON alb.id = t."albumId"
INNER JOIN "TrackPlatform" tp ON tp."trackId" = t.id AND tp.platform = 'tidal'
WHERE t.id = ANY(%s);
```

페르소나 playlist + 추천 트랙/앨범 derive 모두 필터링된 결과 위에서.

### 4.4 신규 인증 API

**`GET /api/auth/tidal/token`**:

```json
{
  "access_token": "eyJhbGc...",
  "expires_at": "2026-06-09T03:24:42+00:00",
  "premium": true
}
```

구현:
- `mrms.db.user_track.get_oauth(conn, user_id, 'tidal')`
- 만료 60초 이내면 자동 refresh (`mrms.auth.tidal.refresh_access_token`)
- premium: `/v2/users/me` 호출하여 `attributes.subscriptionType` 추출 (또는 별도 endpoint 확인 — Task 0)

**`POST /api/auth/tidal/refresh`**:

```json
{
  "access_token": "...",
  "expires_at": "..."
}
```

SDK가 401 받았을 때 호출.

## 5. Frontend

### 5.1 새 의존성

```json
{
  "dependencies": {
    "zustand": "^5.x",
    "@tidal-music/player-web": "^?.?"   // Task 0에서 정확한 패키지명 확인
  }
}
```

### 5.2 PlayerStore (Zustand)

`web/src/store/player.ts`:

```typescript
import { create } from "zustand";

export type QueueTrack = {
  track_id: string;
  tidal_track_id: string;
  title: string;
  artist: string;
  album_title: string | null;
};

export type PlayerState = {
  queue: QueueTrack[];
  currentIdx: number;
  isPlaying: boolean;
  position: number;      // 0~1 진행률
  durationSec: number;
  volume: number;         // 0~1
  premium: boolean | null;
  setQueue: (tracks: QueueTrack[], startIdx: number) => void;
  play: () => Promise<void>;
  pause: () => void;
  next: () => Promise<void>;
  prev: () => Promise<void>;
  seek: (ratio: number) => void;
  setVolume: (v: number) => void;
  setPremium: (p: boolean) => void;
};
```

### 5.3 Tidal SDK Wrapper

`web/src/lib/tidal-player.ts` — 싱글톤, dynamic import:

```typescript
let sdkInstance: any = null;

export async function getTidalPlayer(accessToken: string) {
  if (sdkInstance) return sdkInstance;
  const { TidalPlayer } = await import("@tidal-music/player-web");  // 패키지명 Task 0
  sdkInstance = new TidalPlayer({ accessToken });
  return sdkInstance;
}

export async function loadAndPlay(tidalTrackId: string, accessToken: string) {
  const player = await getTidalPlayer(accessToken);
  await player.load(tidalTrackId);
  await player.play();
}
```

이벤트 listener (Task 0에서 정확한 API 검증):
- `onPositionUpdate(seconds)` → PlayerStore.position
- `onTrackEnd()` → next()
- `onError(err)` → PlayerStore 상태 reset + toast

### 5.4 컴포넌트 구조

```
web/src/components/player/
├── PlayerBar.tsx          # 하단 영구 (Layout에서 마운트)
├── PlayerControls.tsx     # ⏮ ⏯ ⏭ 진행바 (반응형)
├── NowPlaying.tsx          # 곡 정보 (반응형)
├── QueueDrawer.tsx         # 큐 펼쳐보기 (md+)
└── PlayButton.tsx          # 페르소나/트랙 행에서 사용

web/src/components/mrms/   # 기존 컴포넌트 수정
├── PersonaCard.tsx        # PlayButton 통합
└── RecommendedTracksTable.tsx  # PlayButton 컬럼 + 모바일 카드 리스트

web/src/app/(dashboard)/layout.tsx  # PlayerBar 마운트, 메인 padding-bottom
```

### 5.5 PlayButton 동작

```tsx
"use client";

import { usePlayerStore } from "@/store/player";
import type { PersonaTrack, RecommendedTrack } from "@/lib/types";

interface Props {
  tracks: (PersonaTrack | RecommendedTrack)[];
  trackIdx: number;
}

export function PlayButton({ tracks, trackIdx }: Props) {
  const setQueue = usePlayerStore((s) => s.setQueue);
  const play = usePlayerStore((s) => s.play);
  return (
    <button onClick={async () => {
      const queue = tracks
        .filter((t) => t.tidal_track_id)
        .map((t) => ({
          track_id: t.track_id,
          tidal_track_id: t.tidal_track_id!,
          title: t.title,
          artist: t.artist,
          album_title: "album_title" in t ? t.album_title : null,
        }));
      const actualIdx = queue.findIndex((t) => t.track_id === tracks[trackIdx].track_id);
      setQueue(queue, actualIdx);
      await play();
    }}>▶</button>
  );
}
```

### 5.6 SDK 라이프사이클

```
PlayerBar 마운트 (1번)
   ↓
GET /api/auth/tidal/token
   ├── 200 + premium=true → SDK init → ready 상태
   ├── 200 + premium=false → "Premium 필요" 표시 모드
   └── 401/404 → "Tidal 연동 필요" 안내 (scripts/08_onboard_tidal.py)
   ↓
PlayButton 클릭
   ├── SDK 미초기화 → "재생 불가" toast
   └── SDK ready → load(tidal_track_id) → play()
   ↓
이벤트
   - position update → PlayerStore.position
   - ended → next() (auto-next)
   ↓
토큰 만료 (SDK 401)
   - POST /api/auth/tidal/refresh
   - SDK 새 토큰으로 재초기화 + 재시도
```

## 6. 반응형 디자인 (Mobile-first)

### 6.1 브레이크포인트 (Tailwind 기본)

```
default:  <640px   (mobile)
sm:       640px+   (large mobile)
md:       768px+   (tablet)
lg:       1024px+  (desktop)
xl:       1280px+  (wide)
```

### 6.2 PlayerBar 반응형

| 화면 | 레이아웃 |
|---|---|
| mobile (<md) | 높이 64px. 좌: 곡 정보 truncated. 중: ⏯ 1개 (대형). 우: ⏭. 진행바: PlayerBar 상단 가장자리 얇은 progress |
| tablet (md+) | 높이 80px. 좌: 곡 정보 + 아트. 중: ⏮ ⏯ ⏭ + 진행바. 우: 볼륨 + 큐 |
| desktop (lg+) | tablet과 유사. 모든 컨트롤 풀 사이즈 |

**확장 모드 (mobile)**:
- PlayerBar 탭 → 전체 화면 모달 (NowPlaying full + 큐)
- 상단 ↓ 버튼으로 닫기

```tsx
<div className="fixed bottom-0 left-0 right-0 h-16 md:h-20 bg-background border-t">
  <div className="flex items-center h-full px-2 md:px-4 gap-2 md:gap-4">
    <NowPlaying className="flex-1 min-w-0" />
    <PlayerControls compact={true} />
    <div className="hidden md:flex items-center gap-2">
      <VolumeSlider />
      <QueueButton />
    </div>
  </div>
</div>
```

### 6.3 PersonaCard 그리드

| 화면 | 컬럼 |
|---|---|
| mobile | 1 |
| md | 2 |
| lg | 3 |

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
```

### 6.4 RecommendedTracksTable

데스크탑 = 정상 테이블. 모바일 = 카드 리스트 변형:

```tsx
<div className="md:hidden space-y-2">
  {tracks.map(t => (
    <div className="flex items-center gap-3 p-3 rounded bg-card">
      <PlayButton ... />
      <div className="flex-1 min-w-0">
        <div className="truncate font-medium">{t.title}</div>
        <div className="truncate text-xs">{t.artist}</div>
      </div>
      <span className="text-xs tabular-nums">{t.score.toFixed(2)}</span>
    </div>
  ))}
</div>
<div className="hidden md:block">
  <Table>...</Table>
</div>
```

### 6.5 RecommendedAlbumCard 그리드

| 화면 | 컬럼 |
|---|---|
| mobile | 2 |
| md | 3 |
| lg | 5 |

### 6.6 터치 친화성

- 버튼 최소 44x44px (Apple HIG / WCAG)
- PlayButton: 데스크탑 24px, 모바일 32px+ (padding 포함)
- 진행바 두께: 모바일 16px (탭 영역), 데스크탑 8px
- 드래그 seek: touch + mouse (Pointer Events)
- 볼륨 슬라이더: 모바일 숨김 (시스템 볼륨)

### 6.7 메인 컨텐츠 padding

`app/(dashboard)/layout.tsx`:

```tsx
<main className="pb-20 md:pb-24">  {/* PlayerBar 높이 */}
  {children}
</main>
<PlayerBar />
```

## 7. 에러 처리

| 케이스 | 처리 |
|---|---|
| `/api/auth/tidal/token` 401/404 | "Tidal 연동 필요" — `scripts/08_onboard_tidal.py` 안내 |
| `premium: false` | "Premium 구독 필요" 표시. PlayButton 비활성 |
| SDK init 실패 | 콘솔 로그 + Toast: "플레이어 초기화 실패. 새로고침" |
| SDK load/play 실패 (region/license) | Toast: "재생 불가 — 다음 곡으로" + 1초 후 next() |
| 네트워크 끊김 | SDK 자체 처리 (재연결 시도) |
| Token refresh 실패 | "재인증 필요" — `08_onboard_tidal.py` 재실행 안내 |
| 큐 끝 도달 (다음 곡 없음) | 재생 멈춤, PlayerBar 빈 상태로 |

## 8. 가정 + 명시적 결정

- 본인 Tidal **Premium 보유**. 비-Premium은 OOS (V2.x)
- 단일 사용자 (DEFAULT_USER_EMAIL) — multi-user는 E.8
- Tidal Web Playback SDK가 우리 dev app에서 접근 가능 (Task 0 검증)
- region restriction은 SDK 자체에서 거부 → toast + auto-next로 처리
- 페이지 새로고침 시 큐/재생 상태 lost (sessionStorage 안 씀)
- Spotify-only 트랙은 추천에서 **제외** (Tidal-only filter)
- 앨범 아트는 V2.x (SDK 제공하면 사용, 안 하면 placeholder)
- 추천 앨범 카드는 ▶ 없음 (앨범 단위 재생은 V2.x)
- Zustand 추가 (~1KB) — React Context보다 re-render 제어 쉬움

## 9. 구현 시 검증 필요 사항 (Task 0)

1. **Tidal Web Playback SDK 실제 사양**
   - npm 패키지명 (`@tidal-music/player-web` 추정)
   - init signature, 이벤트 이름 정확한 명세
   - 우리 dev app에서 접근 가능한지 (Tidal Dashboard scope/제한 확인)
   - **본인 토큰으로 sample load + play 검증 필수**

2. **Premium 체크 방법**
   - SDK init 시 자동 감지? 별도 호출 필요?
   - `/v2/users/me` 응답에 subscriptionType이나 유사 필드 있는지

3. **CORS / 도메인 허용**
   - SDK가 `mrms.approid.team` 호출 허용하는지
   - Tidal app 설정에서 추가 등록 필요할 수도

## 10. Out of Scope

- ❌ 큐 드래그앤드롭 정렬
- ❌ 셔플 / 반복 (E.5.2)
- ❌ 음질 선택 (Tidal HiFi/Master)
- ❌ 가사 표시
- ❌ 앨범 아트 fetch (V2.x)
- ❌ 좋아요 / 저장 액션 (E.6)
- ❌ 비주얼 EQ (E.7)
- ❌ 미디어 세션 API (브라우저 OS 컨트롤) — V2.x
- ❌ 모바일 lock screen 컨트롤
- ❌ DRM 직접 처리 (SDK가 알아서)
- ❌ 멀티 유저 (E.8)
- ❌ 30s preview fallback (E.5.3)
- ❌ sessionStorage 영속화 (E.5.4)
- ❌ 앨범 단위 재생 (E.5.1)
- ❌ PWA / 오프라인

## 11. 파일 변경 목록

### 신규
- `src/mrms/api/auth_tidal.py` (~80줄: token/refresh endpoints)
- `tests/api/test_auth_tidal.py`
- `web/src/store/player.ts` (~120줄)
- `web/src/lib/tidal-player.ts` (~150줄)
- `web/src/components/player/PlayerBar.tsx`
- `web/src/components/player/PlayerControls.tsx`
- `web/src/components/player/NowPlaying.tsx`
- `web/src/components/player/QueueDrawer.tsx`
- `web/src/components/player/PlayButton.tsx`

### 수정
- `src/mrms/api/schemas.py` — tidal_track_id 필드 추가
- `src/mrms/api/main.py` — /api/mrt/latest에 Tidal-only filter + tidal_track_id
- `tests/api/test_main.py` — filter 검증 추가
- `web/src/lib/types.ts` — TS 타입 동기화
- `web/src/app/(dashboard)/layout.tsx` — PlayerBar 마운트 + main padding
- `web/src/components/mrms/PersonaCard.tsx` — PlayButton 통합 + 반응형
- `web/src/components/mrms/RecommendedTracksTable.tsx` — PlayButton + 모바일 카드 리스트
- `web/src/components/mrms/RecommendedAlbumCard.tsx` — 반응형 그리드
- `web/src/app/(dashboard)/mrt/page.tsx` — 반응형 그리드 클래스
- `web/package.json` — zustand + tidal SDK

### 의존성
- `pyproject.toml`: 변경 없음 (httpx 이미 있음)
- `web/package.json`: + zustand + @tidal-music/player-web

## 12. 후속 작업 (E.5.x)

- **E.5.1**: 앨범 카드 재생 (album_id → Tidal album → play)
- **E.5.2**: 셔플 / 반복
- **E.5.3**: 비-Premium fallback (30s preview)
- **E.5.4**: sessionStorage 큐 영속화
- **E.5.5**: 미디어 세션 API
- **E.6**: 재생 중 "내 취향이에요" → UserTrack 추가
- **E.7**: 비주얼 이퀄라이저
- **E.A**: Web OAuth flow (CLI 의존 제거)
