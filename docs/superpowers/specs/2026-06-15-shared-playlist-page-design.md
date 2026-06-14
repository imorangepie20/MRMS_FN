# 공유 플레이리스트 페이지 (Share & Play) 상세 설계

작성일: `2026-06-15`
상태: 설계 승인 — 구현 예정. ADR-[ADR-010](../../decisions/ADR-010-shared-playlist-page.md).

## 목표

내 MRMS 플레이리스트를 **공개 링크로 공유**하면, 누구나 `mrms.approid.team/p/{token}`에서 곡 리스트를 보고 **MRMS 페이지 안에서 바로 재생**한다. 재생하려면 방문자가 본인 Spotify/Tidal을 **우리 OAuth로 연결**한다(= 우리 사이트 로그인/세션). 핵심 의도는 **사이트 홍보** — 공유 링크가 외부로 콘텐츠를 흘리지 않고 방문자를 우리 가입·연결 퍼널로 끌어온다.

Eat The Shared([ADR-009](../../decisions/ADR-009-share-url-import.md))의 짝: import는 "남의 공유 링크를 우리가 먹기", 이건 "우리 콘텐츠를 남이 먹되 **우리 페이지에서** 듣게 해서 트래픽을 확보"하는 방향.

## 무엇을 공유하나

**유저 플레이리스트**(`Playlist`/`PlaylistTrack`)만. **live reference** — 원본이 바뀌면 공유 페이지도 같이 바뀐다(스냅샷 복제 아님). PGT/MRT 공유는 YAGNI로 후속.

## 사용자 경험

1. **공유(소유자):** 내 플레이리스트 화면의 "공유" 버튼 → 공개 링크 `/p/{token}` 생성 → 복사 모달. 다시 누르면 공유 해제(링크 무효).
2. **방문자:** 받은 링크 `/p/{token}` 열기 → MRMS 브랜딩 헤더 + 플레이리스트 제목·설명 + 트랙 리스트 + 인페이지 플레이어. 게이트/사이드바 없음(공개).
3. **재생 = 연결 유도:**
   - 본인 플랫폼이 연결돼 있으면 → 그 자리에서 본인 구독으로 재생(기존 플레이어).
   - 미연결이면 → Play 자리에 "재생하려면 연결하세요" CTA → **Sign in with Spotify / Tidal**(우리 OAuth). 연결되면(=세션 생김) 돌아와 재생.
4. 로딩/에러(없거나 해제된 링크)/빈 상태.

## 공유 토큰

- `Playlist`에 `shareId TEXT UNIQUE`(nullable) 컬럼 추가. **값 있으면 공개, NULL이면 비공개.** 별도 boolean 불필요.
- 토큰 = `secrets.token_urlsafe(9)`(추측 불가·URL-safe·revocable). 내부 playlist id(안정 해시)를 노출하지 않는다 — 토큰은 무작위라 열거 불가하고 해제 시 즉시 무효.

## 아키텍처 / 데이터 흐름

```
[내 플레이리스트] "공유"
   → POST /api/user/playlists/{id}/share { enabled: true }      # owner 인증
       → set_playlist_share(conn, id, on=True) → shareId 생성
   ← { share_id, share_url: "/p/{shareId}" }  → 복사 모달

[방문자] /p/{shareId}   (공개 페이지, 게이트 없음)
   → GET /api/shared/{shareId}                                   # 무인증
       → get_playlist_by_share_id → get_playlist_tracks (재사용)
   ← { playlist: {name, description, owner_name}, tracks: [...] }
   → 브랜딩 헤더 + ModalTrackList + PlayerBar
   → Play 클릭:
       · 연결됨(본인 Spotify/Tidal) → 기존 player loadAndPlay 재생
       · 미연결 → "Sign in with Spotify/Tidal"(우리 OAuth=세션) → 연결 후 재생
```

## 백엔드 (신규 = share 토글 + 공개 조회 + 마이그레이션)

- **마이그레이션** `prisma/migrations/20260615100000_add_playlist_share/migration.sql`:
  ```sql
  ALTER TABLE "Playlist" ADD COLUMN IF NOT EXISTS "shareId" TEXT;
  CREATE UNIQUE INDEX IF NOT EXISTS idx_playlist_share ON "Playlist"("shareId");
  ```
- **`src/mrms/db/playlist.py`** 추가:
  - `set_playlist_share(conn, playlist_id, on: bool) -> str | None` — on이면 `shareId` 없을 때 `secrets.token_urlsafe(9)` 생성·저장(있으면 기존 유지)·반환, off면 NULL로 비우고 None 반환. commit.
  - `get_playlist_by_share_id(conn, share_id) -> dict | None` — `shareId` 매칭 플레이리스트 메타(+ owner 표시명) 반환, 없으면 None.
  - `get_playlist`(기존)에 `share_id` 필드 포함(소유자 화면이 공유 상태 알게).
- **`src/mrms/api/playlists.py`** 추가: `POST /api/user/playlists/{id}/share { enabled: bool }` — owner 인증(`get_current_user_id`), 소유자 아니면 403(기존 패턴), 토글 후 `{ share_id, share_url }`(해제면 `share_id: null`).
- **`src/mrms/api/shared.py`** 신규: `GET /api/shared/{share_id}` — **무인증**(유일한 신규 공개 read). `get_playlist_by_share_id` + `get_playlist_tracks` 재사용, 없으면 404. 좋아요/PCT 상태는 미포함(방문자별·비로그인 가능). main.py 등록.

## 프론트 (신규 = 공개 페이지 + 레이아웃 + 공유 버튼)

- **`web/src/app/p/layout.tsx`** 신규: `(dashboard)` 밖의 전용 공개 레이아웃 — MRMS 브랜딩 헤더(로고 + "Listening on MRMS" + 홈/가입 링크 = 홍보) + `{children}` + `<PlayerBar />`(자체 `useUser` 부트스트랩 재사용). 사이드바·게이트 없음.
- **`web/src/app/p/[shareId]/page.tsx`** 신규: `GET /api/shared/{shareId}` → 제목·설명 헤더 + `ModalTrackList`(+ Play All). 없는 링크면 안내. 미연결 방문자에겐 Play 대신 연결 CTA(아래).
- **연결 CTA**: `useUser()`로 `primary_platform` 확인 → 없으면 Play 영역에 "재생하려면 연결" 버튼 → Spotify는 `window.location.href="/api/auth/spotify/authorize"`, Tidal은 기존 `TidalConnectModal`(device-code) 재사용 — login 페이지 메커니즘 그대로.
- **공유 버튼**: 내 플레이리스트 화면에 "공유" → `POST /api/user/playlists/{id}/share` → URL 복사 모달. 재클릭 = 해제.
- **`web/src/lib/api/shared.ts`**: `getShared(shareId)`, `togglePlaylistShare(id, enabled)`; 타입 `SharedPlaylist`(기존 트랙 형태 재사용).

## 인증 모델

- **조회:** 무인증(`/api/shared/{id}`, `/p/{id}`). middleware는 현재 `/mrt`+`/onboarding`만 게이트하므로 추가 작업 없음.
- **공유 토글:** 소유자 인증 + owner 체크(기존 403 패턴).
- **재생:** 방문자 본인 플랫폼 연결 필요(기존 player 그대로). 연결 = 우리 OAuth(`/api/auth/*/authorize`) = 사이트 세션 — 이게 홍보 퍼널의 핵심.

## 에러 / 엣지

- shareId 없음/해제됨 → `/api/shared/{id}` 404 → 페이지 "공유가 없거나 해제된 링크" 안내.
- 미연결 방문자 → 리스트는 보이고 Play는 **연결 CTA**(disabled 대신). 연결 후 재생 가능.
- 비프리미엄/재생 불가 트랙 → 기존 player fallback/에러 그대로(Tidal→Spotify→YouTube).
- 빈 플레이리스트 → 헤더만 + "곡 없음".

## 제약 / 리스크

- 재생은 방문자 본인 구독에 의존(미연결이면 못 들음 — 그래서 연결 유도). 우리가 대신 재생해주지 않는다(라이선스).
- 공유 토큰은 무작위지만 링크를 받은 사람은 누구나 본다(의도된 "공개"). 비공개가 필요하면 해제(NULL).
- live reference라 공유 후 원본을 비우면 공유 페이지도 빈다(의도).

## 테스트 전략

- 단위(`tests/db/test_playlist.py`): `set_playlist_share`(on→토큰 생성·재호출 시 유지, off→None), `get_playlist_by_share_id`(hit/miss).
- 통합(`tests/api/`): `POST /api/user/playlists/{id}/share`(owner 200, 비owner 403, 미인증 401), `GET /api/shared/{id}`(무인증 200, 없는 토큰 404).
- ⚠️ DB 격리: dev DB cleanup fixture. 전체 `pytest tests/` 금지(dev DB 격리 안 됨 — 대상 테스트만 실행).
- 프론트: 공개 페이지 렌더(연결/미연결 분기) — 기존 패턴 따라(과하지 않게).

## 비채택 대안

- **실제 Spotify/Tidal 플레이리스트로 export**(원래 ADR-010 방향): 외부 플랫폼에 진짜 플레이리스트를 만들어 그 링크를 공유. 폐기 — 트래픽이 그 플랫폼으로 빠져 **홍보 역효과**. 우리 페이지에서 듣게 해야 유입된다.
- **공개 리스트만(재생 X):** 핵심(인페이지 청취 + 연결 퍼널) 누락 → 기각.
- **PGT/MRT도 공유 단위:** YAGNI. v1은 유저 플레이리스트만.
- **로그인 강제(공개 X):** 홍보 목적상 비로그인도 리스트는 봐야 함 → 조회 무인증, 재생만 연결 유도.

## 후속 작업

1. 마이그레이션 `20260615100000_add_playlist_share`(shareId + unique index).
2. `db/playlist.py` `set_playlist_share`/`get_playlist_by_share_id` + `get_playlist`에 share_id.
3. `api/playlists.py` share 토글 + `api/shared.py` 공개 조회 + main 등록.
4. 프론트 `p/layout.tsx` + `p/[shareId]/page.tsx` + 공유 버튼 + `lib/api/shared.ts`.
5. 단위·통합·프론트 테스트.
6. (후속) 로그인 방문자에게 좋아요/담기 행 액션 노출, PGT/MRT 공유, 조회수/인입 트래킹.

## 관련 문서

- [ADR-010](../../decisions/ADR-010-shared-playlist-page.md)
- [ADR-009 Eat The Shared](../../decisions/ADR-009-share-url-import.md) (역방향 짝 — import)
- 코드: `src/mrms/db/playlist.py`, `src/mrms/api/playlists.py`, `web/src/components/player/PlayerBar.tsx`(`useUser`→`primary_platform` 부트스트랩), `web/src/lib/player.ts`(`loadAndPlay`), `web/src/components/track/ModalTrackList.tsx`, `web/src/app/(auth)/login/page.tsx`(OAuth 연결 메커니즘)
