# Tidal Web Playback SDK Notes (Task 0 결과)

> Discovery spike. Subsequent E.5 tasks rely on this.

## 공식 패키지

TIDAL이 공식 제공하는 Web SDK는 단일 패키지가 아니라 **모노레포의 여러 모듈 조합**이다. 재생을 위해 최소 3개가 필요하다.

| npm 패키지 | 최신 버전 (2026-06) | 역할 |
| --- | --- | --- |
| `@tidal-music/player` | **0.18.1** | 재생 엔진 (Shaka Player + browser audio) |
| `@tidal-music/auth` | **1.6.1** | OAuth 토큰 관리 + `credentialsProvider` |
| `@tidal-music/event-producer` | **2.4.1** | 재생 통계 이벤트 전송 (필수, 미설정 시 `load()` 거부) |
| `@tidal-music/common` | 0.2.1 | 타입 (peer dep, 대부분 transitive) |
| `@tidal-music/player-web-components` | 0.x | 옵션: `<tidal-play-trigger>` 등 web component shortcut. 이번 spike 에서는 직접 SDK 호출 방식 사용 |

- 공식 docs: <https://developer.tidal.com/documentation/api-sdk/api-sdk-overview>
- TypeDoc: <https://tidal-music.github.io/tidal-sdk-web/>
- GitHub: <https://github.com/tidal-music/tidal-sdk-web>
- Player 전용 specification: <https://github.com/tidal-music/tidal-sdk/blob/main/Player.md>

설치 (web/ 디렉토리):

```bash
pnpm add @tidal-music/player @tidal-music/auth @tidal-music/event-producer
```

## Init API

`@tidal-music/player`는 **클래스 인스턴스가 아니라 모듈 함수 + 글로벌 이벤트 버스** 구조다. (계획서의 `new TidalPlayer(...)` 가정은 잘못. 실제로는 import한 함수를 호출한다.)

필수 부트스트랩 순서:

```ts
import * as auth from "@tidal-music/auth"
import * as eventProducer from "@tidal-music/event-producer"
import * as Player from "@tidal-music/player"

// 1) Auth 모듈 init — 토큰 저장소 키 + clientId 필요
await auth.init({
  clientId: process.env.NEXT_PUBLIC_TIDAL_CLIENT_ID!,
  credentialsStorageKey: "mrms-tidal",
  scopes: ["r_usr", "w_usr"], // Player 데모가 사용하는 scope. 우리 백엔드의 user.read 등과 별개
})

// 2) 우리 백엔드에 저장된 OAuth 토큰을 SDK에 주입
//    (CLI 08_onboard_tidal.py가 만들어둔 UserOAuth row 활용)
await auth.setCredentials({
  accessToken: {
    clientId: process.env.NEXT_PUBLIC_TIDAL_CLIENT_ID!,
    expires: new Date(expiresAt).getTime(), // ms epoch
    grantedScopes: ["r_usr", "w_usr"],
    requestedScopes: ["r_usr", "w_usr"],
    token: accessToken, // bearer token (헤더 prefix 없이)
  },
  refreshToken,
})

// 3) Player에 credentials provider 연결
Player.setCredentialsProvider(auth.credentialsProvider)

// 4) ⚠️ 필수: event sender 설정. 없으면 load() 가 throw.
//    프로덕션은 eventProducer.init(...) 후 setEventSender(eventProducer).
//    Spike/MRMS 단계에서는 sendEvent no-op로 충분.
Player.setEventSender({
  sendEvent() {
    /* noop */
  },
})

// 5) (선택) Player 모듈 자체 bootstrap — players 우선순위 정의
Player.bootstrap?.({
  outputDevices: false,
  players: [], // 비우면 default(shaka + browser) 사용
})
```

### `credentialsProvider`의 실제 형태

`auth.credentialsProvider`는 `{ bus, getCredentials }` 객체. Player는 내부에서 `await credentialsProvider.getCredentials()`를 호출해 `{ clientId, token }`을 받는다. 즉 **재발급/만료 처리는 auth 모듈이 자동으로 처리**하므로 우리 백엔드에서 refresh를 매번 해줄 필요는 없다 (단, refreshToken을 setCredentials 시점에 같이 넘긴 경우에 한해).

## Load + Play

`MediaProduct` 객체를 만들어 `Player.load`에 넘긴다.

```ts
import * as Player from "@tidal-music/player"
import type { MediaProduct } from "@tidal-music/player"

const product: MediaProduct = {
  productId: "12345678",   // Tidal track id (문자열)
  productType: "track",    // | "video"
  sourceId: "12345678",    // event tracking용 — track id 또는 album/playlist id
  sourceType: "TRACK",     // 자유 문자열. 데모는 "ALBUM" / "VIDEO" / "TRACK" 사용
}

await Player.load(product, /* assetPosition */ 0, /* prefetch */ false)
await Player.play()
// 다른 메서드: pause, seek(seconds), reset, setNext, getPlaybackContext...
```

`Player.load` 시그니처: `load(mediaProduct: MediaProduct, assetPosition = 0, prefetch = false): Promise<void>`.

## 이벤트

이벤트는 **글로벌 EventTarget**(`Player.events`)으로 발사된다. `player.on('playing', ...)` 같은 emitter API는 없다.

```ts
Player.events.addEventListener("playback-state-change", (e) => {
  const { state } = (e as CustomEvent).detail
  // state ∈ 'IDLE' | 'NOT_PLAYING' | 'PLAYING' | 'STALLED'
})
Player.events.addEventListener("ended", (e) => {
  const { mediaProduct, reason } = (e as CustomEvent).detail
  // reason ∈ 'completed' | 'error' | 'skip'
})
Player.events.addEventListener("media-product-transition", (e) => { /* ... */ })
Player.events.addEventListener("playback-quality-changed", (e) => { /* ... */ })
Player.events.addEventListener("streaming-privileges-revoked", () => { /* 다른 디바이스에서 재생 시작 */ })
Player.events.addEventListener("error", (e) => {
  const detail = (e as CustomEvent).detail // PlayerErrorInterface.toJSON()
})
```

전체 이벤트 목록 (src/api/event/):

- `playback-state-change` — `'IDLE' | 'NOT_PLAYING' | 'PLAYING' | 'STALLED'`
- `media-product-transition` — 다음 트랙으로 전환됨
- `ended` — 트랙 종료 (completed/error/skip)
- `playback-quality-changed`
- `streaming-privileges-revoked`
- `preload-request`
- `active-device-changed` / `active-device-disconnected` / `active-device-mode-changed` / `active-device-pass-through-changed`
- `device-change`
- `error` (event-bus.dispatchError 경유)

`positionupdate` / `currentTime` 같은 단발 이벤트는 **없다**. 현재 위치는 다음 방법으로 얻는다:

- `Player.getAssetPosition()` 폴링
- 또는 `Player.getMediaElement()`로 `<audio>` element를 얻어 `timeupdate` 직접 구독 (web component인 `<tidal-current-time>` / `<tidal-progress-bar>`가 이 방식 사용)

## Premium 체크

SDK는 별도의 "isPremium" 메서드를 노출하지 않는다. 실제 동작:

- Premium 미가입 사용자 또는 토큰 부족 scope 시 `Player.load()` 내부 `fetchPlaybackInfo`가 401/403을 받아 `error` 이벤트로 dispatch.
- 우리 측 UX: `error` 이벤트 detail의 errorCode를 보고 메시지 노출. 사전 가드용으로 백엔드에서 `/v1/users/me` 호출해 subscription 확인 후 UI 배지 표시도 가능 (Task 2+ 결정).

## 도메인 제약

- SDK 자체는 임의 origin에서 import 가능 (npm 패키지 + ESM, CORS 없음).
- 단, **OAuth client는 Tidal Developer Dashboard에서 redirect URI를 등록**해야 한다. CLI 08 스크립트가 사용 중인 `https://mrms.approid.team/callback/tidal`이 이미 등록되어 있다면 토큰 발급은 OK. 브라우저에서 SDK가 `auth.initializeLogin()` 같은 redirect flow를 다시 타지 않고 **기존 access_token만 `setCredentials`로 주입**하면 도메인 제약은 사실상 우회된다 (이번 spike의 핵심).
- 데모 코드가 `dev.tidal.com` hosts entry를 요구하는 것은 mkcert 인증서 / Cypress E2E 한정이며, MRMS 앱은 localhost:3000 / mrms.approid.team에서 그대로 동작한다.

## 알려진 제약

- **Premium 필수**: 무료 계정은 30초 preview만. 사용자(jacinto68@onlinecmk.com)는 Premium → OK.
- **지역**: Tidal 서비스 지역 (HK, US, KR 등 70+개국). 한국 가입자 계정이면 한국 카탈로그.
- **브라우저**: 데모/Cypress 가 Chrome 위주. Shaka Player + EME 의존 → Widevine DRM. 기본 Chrome/Edge/Firefox 데스크탑 OK. Safari는 FairPlay 분기 있으나 일부 mimeType에 제한.
- **DRM**: HiFi/Master 품질은 Widevine L1+ 필요. 브라우저는 기본 L3라서 lossy AAC로 자동 폴백. MRMS 미리듣기 용도면 충분.
- **개발자 승인**: TIDAL Developer Portal에서 OAuth Client만 생성하면 SDK 사용 가능 (별도 partner approval 불필요). 현재 .env의 TIDAL_CLIENT_ID/SECRET가 이미 발급된 상태 → 추가 신청 불필요.
- **Event sender 필수**: noop도 OK지만 반드시 `setEventSender` 호출. 안 하면 `load()` throw.
- **Client ID는 브라우저에 노출됨**: `NEXT_PUBLIC_TIDAL_CLIENT_ID` 사용. clientSecret은 SDK 브라우저 init에 넣지 않음 (백엔드 OAuth 교환에만).
- **Scope mismatch 가능성**: CLI 08 스크립트가 발급받은 토큰의 scope는 신 TIDAL OpenAPI 스코프(`user.read`, `collection.read`, `playlists.read`, `playback` 등). SDK 데모는 구 OAuth 스코프(`r_usr`, `w_usr`)를 사용한다. 실제 playback API가 어느 쪽을 요구하는지는 spike에서 확정 못함 — 브라우저 테스트에서 `error` 이벤트 detail의 status code로 판단. `403/scope` 류 에러가 뜨면 `TIDAL_SCOPES`에 `playback` 포함을 재확인하고, 그래도 안 되면 `r_usr w_usr`로 재발급 필요.

## 계획서 대비 차이 요약

| 계획서 가정 | 실제 |
| --- | --- |
| `new TidalPlayer({ credentialsProvider })` | `Player` 모듈 함수 호출. credentialsProvider는 `setCredentialsProvider(...)`로 전역 등록 |
| `player.load(trackId)` | `Player.load({ productId, productType, sourceId, sourceType })` |
| `player.on('ended', ...)` | `Player.events.addEventListener('ended', ...)` |
| event sender 옵션 | **필수**. noop 으로라도 반드시 등록 |
| credentialsProvider = `async () => ({ accessToken })` | `auth.credentialsProvider` 객체 (`{ bus, getCredentials }`) 사용 권장. 기존 token은 `auth.setCredentials({ accessToken: {...}, refreshToken })`로 주입 |
