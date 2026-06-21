# 공유페이지 YouTube 연결-재생 설계

> 공유페이지(공개) 방문자가 YouTube로 인증(게스트 세션) 후, 우리 페이지 안에서
> 트랙을 YouTube IFrame으로 전곡 재생. 플레이리스트 생성/저장은 하지 않음.

**작성일:** 2026-06-21
**상태:** 설계 승인됨 → 구현 계획 대기

---

## 1. 배경 / 의도

공유페이지(`/p/{shareId}`)는 공개(비로그인)다. 현재 재생을 위한 연결은
`ConnectToPlay` 컴포넌트가 **Tidal 연결**(+ Spotify 준비중)만 제공한다. 이 컴포넌트의
원리는 "플랫폼 연결 = 우리 OAuth = 사이트 세션"이다.

사용자 요청: **"OAuth 후 우리페이지에서 유튜브 플레이만"** — YouTube를 같은
연결-재생 옵션으로 추가. 인증 후 우리 페이지 안 YouTube 플레이어로 재생.

이미 갖춰진 것(재사용):
- **`player.ts`**: YouTube를 플랫폼으로 지원(`youtubePlayer` 어댑터, fallback order
  `tidal>spotify>youtube`, youtube는 무료 baseline → primary 가능). 연결되면 IFrame 재생.
- **`/api/playback/resolve/{track_id}?platform=youtube`**: 서버 API키
  (`YOUTUBE_DATA_API_KEY`)로 트랙→embeddable 영상 resolve. **유저 YouTube 토큰 불필요.**
  단 엔드포인트가 `get_current_user_id`(세션) 요구.
- **`auth_youtube` 콜백**: 비회원이면 게스트 계정(`youtube-{id}@auto.local`) + 세션 발급.

빠진 연결고리(이 스펙의 작업):
- `auth_youtube`가 인증 후 **공유페이지로 복귀(`next`)를 미지원** — 항상 `/onboarding`으로
  리다이렉트(Spotify/Tidal은 `next` 지원).
- `ConnectToPlay`에 **YouTube 연결 버튼 없음**.

## 2. 목표 / 비목표

**목표**
- 공유페이지에서 "YouTube로 연결" → OAuth(게스트 세션) → **공유페이지로 복귀** → 우리
  페이지 안 YouTube IFrame으로 전곡 재생.

**비목표 (YAGNI / 사용자 명시)**
- YouTube 플레이리스트 생성·저장. (→ write scope 불필요)
- YouTube.com/Music으로 핸드오프 재생.
- 새 재생 엔진/플레이어 구현(기존 `player.ts` 재사용).
- scope 변경 — `youtube.readonly` 유지.

## 3. 왜 OAuth인가

재생(IFrame)은 공개 영상이라 토큰이 필요 없다. 그러나 `playback/resolve`가
**세션(`get_current_user_id`)을 요구**하므로, 공유페이지의 비회원 방문자에게는
세션이 없다. YouTube OAuth가 **가장 가벼운 게스트 로그인**(readonly) 역할을 하여
세션을 만들고, 그 세션으로 resolve+재생이 동작한다.

## 4. 작업 (딱 2개 + 검증 1개)

### 4.1 백엔드 — `src/mrms/api/auth_youtube.py`에 `next` 복귀 추가 (Spotify 패턴 미러)

`auth_spotify.py`의 패턴을 그대로 따른다:
- 상수 `OAUTH_NEXT_COOKIE = "mrms_oauth_next"`.
- `_safe_next(next_url)`: `next_url`이 `"/"` 로 시작하고 `"//"` 로 시작하지 않을 때만
  반환(아니면 None) — **open-redirect 방지**.
- `/authorize`: `next_url: str | None = Query(default=None, alias="next")` 파라미터.
  `_safe_next` 통과 시 `OAUTH_NEXT_COOKIE`에 `quote(safe_next, safe="")` 저장
  (state·verifier 쿠키와 동일 수명/속성).
- `/callback`: 끝부분에서 `OAUTH_NEXT_COOKIE`를 읽어 `_safe_next`로 재검증 →
  있으면 `RedirectResponse(url=unquote(next), 307)`, 없으면 기존 `/onboarding`.
  성공/실패 응답 모두에서 `OAUTH_NEXT_COOKIE` 삭제(state·verifier 삭제하는 자리와 동일).
- **scope·게스트 세션 로직은 그대로** (변경 없음).

### 4.2 프론트 — `web/src/components/player/ConnectToPlay.tsx`에 YouTube 버튼

기존 `connectSpotify` 모양 그대로 YouTube 추가:
```ts
const connectYoutube = () => {
  const next = window.location.pathname + window.location.search;
  window.location.href = `/api/auth/youtube/authorize?next=${encodeURIComponent(next)}`;
};
```
Tidal 버튼 옆에 "YouTube로 연결" 버튼 추가(활성). 카피는 기존 톤 유지.

### 4.3 재생 라우팅 — 코드 변경 없음 (확인 완료)
재생은 기존 경로로 자동 동작함을 코드에서 확인:
- `resolve_primary_platform`([db/user_track.py:84](../../../src/mrms/db/user_track.py))이
  연결 플랫폼에서 primary 계산 — 우선순위 `tidal > spotify > youtube`, **youtube 포함**.
  youtube만 연결한 게스트는 `primary_platform="youtube"`가 됨.
- `/api/me`가 그 `primary_platform` 반환 → `PlayerBar`(player.ts:372)가
  `initPlayer("youtube")` → `player.ts` youtube 어댑터로 IFrame 재생.

즉 백엔드 primary 로직·플레이어 변경 불필요. **4.1(auth `next`) + 4.2(버튼)만으로 완결.**

## 5. 데이터 플로우

```
공유페이지(비회원) → [YouTube로 연결] 클릭
  → /api/auth/youtube/authorize?next=/p/{shareId}
  → Google OAuth(readonly) → /api/auth/youtube/callback
  → 게스트 계정+세션 발급, UserOAuth(youtube) upsert
  → next(/p/{shareId})로 복귀
공유페이지(세션 있음) → 재생 클릭
  → /api/playback/resolve/{track_id}?platform=youtube (세션 OK)
  → videoId → player.ts youtube 어댑터 → IFrame 전곡 재생
```

## 6. 에러 / 보안

- **Open-redirect 방지**: `next`는 `/`로 시작하고 `//`가 아닌 사이트 내부 상대경로만 허용
  (`_safe_next`). 그 외는 무시하고 기본(`/onboarding`).
- OAuth 실패: 기존 콜백 에러 처리 유지(에러 리다이렉트), 단 `next` 쿠키도 함께 삭제.
- 게스트 계정 하이재킹 방지: 기존 로직 유지(`youtube-{id}@auto.local` 분리 계정).

## 7. 테스트

백엔드(`tests/api/` 또는 기존 auth 테스트 패턴):
- `authorize(next="/p/abc")` → 302, `mrms_oauth_next` 쿠키에 인코딩된 `/p/abc` set.
- `authorize(next="//evil.com")` / `authorize(next="https://evil")` → next 쿠키 미설정.
- `_safe_next`: `/p/x`→통과, `//x`·`http://x`·None→None.
- 콜백 next 리다이렉트는 OAuth 모킹 필요 — 최소 `_safe_next` 단위테스트 + authorize
  쿠키 테스트로 커버(콜백 전체 E2E는 기존 auth 테스트 수준에 맞춤).

프론트:
- `ConnectToPlay`에 "YouTube로 연결" 버튼 존재 + 클릭 시 `/api/auth/youtube/authorize?next=`
  로 이동(jsdom location 모킹 or 핸들러 단위 확인, 기존 컴포넌트 테스트 패턴 따름).

## 8. 성공 기준

- 공유페이지에서 YouTube 연결 → 같은 공유페이지로 복귀 → 우리 페이지 안에서 전곡 재생.
- 플레이리스트 생성/외부 핸드오프 없음. scope 변동 없음.
- open-redirect 불가.
