# Tidal 전용 진짜 스펙트럼 비주얼 이퀄라이저 — 설계

> **목표:** 하단 PlayerBar 상단 엣지에 비주얼 이퀄라이저를 띄운다. **Tidal 재생 중에만** Web Audio `AnalyserNode`로 추출한 **실제 주파수 스펙트럼**으로 막대가 율동하고, 그 외(Spotify/YouTube 재생·일시정지·정지)에는 영역 자체가 **숨겨진다**.

작성 2026-06-14. **결정 기록:** [ADR-004](../../decisions/ADR-004-tidal-spectrum-equalizer.md). 인덱스: [docs/README.md](../../README.md). 참조: my-forever-music 비주얼라이저(수학만 차용), [tidal-sdk-notes.md](../../tidal-sdk-notes.md).

---

## 1. 핵심 실현가능성 (확정)

my-forever-music은 Tidal **Web SDK iframe**이 audio element를 안 내줘서, 복잡한 우회(`tidalAudioCapture`로 fetch 후킹 → `segmentDecoder`로 MP4 세그먼트 디코드 → `simpleFft` 수동 FFT)를 했다.

**MRMS는 그 우회가 전부 불필요.** [tidal-player.ts](../../../web/src/lib/tidal-player.ts)는 SDK iframe이 아니라 **단일 `HTMLAudioElement`**(모듈 싱글톤 `audioEl`, `new Audio()`)로 재생하고, `src`는 **같은 오리진 프록시 스트림**(`/api/playback/tidal/stream/{tidalTrackId}`, `crossOrigin="use-credentials"`)이다.

→ 우리가 element를 직접 들고 있으므로 Web Audio로 바로 탭한다:
```
ctx.createMediaElementSource(audioEl) → AnalyserNode → ctx.destination
analyser.getByteFrequencyData(bins)   // 브라우저가 FFT 수행
```
세그먼트 캡처·MP4 디코드·수동 FFT 전부 0줄.

**같은 오리진 전제(검증됨):** 백엔드 `stream_track`([src/mrms/api/auth_tidal.py](../../../src/mrms/api/auth_tidal.py):140-211)이 Tidal CDN으로 302 리다이렉트하지 않고 httpx로 바이트를 직접 re-stream → audio element는 same-origin 프록시(`/api/...`)만 보므로 taint 없음, 실제 샘플 읽힘. **단, `NEXT_PUBLIC_API_BASE`가 페이지와 다른 오리진을 가리키면 cross-origin media가 되어** bins가 전부 0이 될 수 있음(EQ가 조용히 빈 채로 표시). → EQ가 동작해야 하는 환경에선 `NEXT_PUBLIC_API_BASE`를 unset(상대 `/api`) 또는 페이지와 **같은 오리진**으로 유지. (prod=`mrms.approid.team` 단일 호스트라 충족.)

**제약 3개 (모두 표준, 관리됨):**
1. `createMediaElementSource`는 element당 **1회만** 호출 가능 → audioEl 싱글톤과 같은 모듈(`tidal-player.ts`)에서 1회 생성·재사용. (EQ 컴포넌트가 직접 호출하면 리마운트 시 2회 → throw → **비채택**.)
2. 호출 즉시 오디오가 그래프로 라우팅됨 → `analyser.connect(ctx.destination)` **필수**(안 하면 무음). `AudioContext`는 suspended로 시작하니 재생 시작(유저 제스처) 시점에 `resume()`.
3. Safari/WebKit는 `AudioContext` 미노출·`webkitAudioContext`만 있을 수 있음 → `window.AudioContext ?? window.webkitAudioContext` 폴백(Tidal HiFi 유저 = Safari 가능성). 미지원이면 try/catch로 EQ만 안 뜨고 재생은 정상.

## 2. 현재 상태 (재사용/확장 대상)

- **[tidal-player.ts](../../../web/src/lib/tidal-player.ts)**: `audioEl` 싱글톤 + `ensureAudio()`. `loadAndPlay`/`resumePlayback`은 재생 버튼(유저 제스처)에서 호출됨. → 여기에 캡처 그래프 1회 생성 + analyser export 추가.
- **[player.ts](../../../web/src/lib/player.ts) `playOn`**: 모듈 변수 `active`에 현재 소리내는 플랫폼 기록(비반응형). `getActivePlatform()` getter 존재(비반응형). → 스토어에 반응형 `activePlatform` 기록 추가.
- **[store/player.ts](../../../web/src/store/player.ts)**: zustand. `isPlaying` 등 보유, **`activePlatform` 없음**. → 필드 추가.
- **[PlayerBar.tsx](../../../web/src/components/player/PlayerBar.tsx)**: `fixed bottom-0 left-0 md:left-60 right-0 ... z-40`. error/initializing 배너를 이미 `absolute bottom-full`로 바 위에 띄움. → EQ도 같은 방식으로 바 상단에 배치.
- **my-forever-music [BarsVisualizer.tsx](../../../../my-forever-music/apps/web/src/components/visualizer/animations/BarsVisualizer.tsx)**: 128 막대, 로그 밴드 버킷팅 + attack/release 스무딩 + 노이즈 게이팅 + 무지개 HSL. → **수학만 차용**, 색은 MRMS 팔레트로 교체.
- **[globals.css](../../../web/src/app/globals.css) `.mrms-eq-bar`**(L150-157): 기존 데코 keyframe — "큐 현재재생 표시"용. 이 기능과 무관, 건드리지 않음.

## 3. 설계

### 3.1 아키텍처 — 3 조각

```
[tidal-player.ts 의 audioEl]
   └─(1회) createMediaElementSource → AnalyserNode → ctx.destination
                                          │ getByteFrequencyData
                                          ▼
        [SpectrumEqualizer.tsx]  rAF 루프로 막대 높이 갱신
                                          ▲
        show = (store.activePlatform === 'tidal' && store.isPlaying)
```

캡처 그래프(AnalyserNode) 소유권은 audio element가 있는 `tidal-player.ts`에 둔다(단일 소유·1회 생성 보장). 컴포넌트는 `getTidalAnalyser()`로 **읽기만** 한다.

### 3.2 캡처 레이어 — `tidal-player.ts` 추가

```ts
let audioCtx: AudioContext | null = null;
let analyserNode: AnalyserNode | null = null;

// loadAndPlay AND resumePlayback 첫머리(유저 제스처 경로)에서 매번 호출
function ensureAnalyser(): void {
  try {
    const el = ensureAudio();
    if (!audioCtx) {
      const Ctx = window.AudioContext ?? (window as any).webkitAudioContext;
      if (!Ctx) return;                    // Web Audio 미지원 → EQ만 생략, 재생 정상
      audioCtx = new Ctx();
      const srcNode = audioCtx.createMediaElementSource(el); // element당 1회
      analyserNode = audioCtx.createAnalyser();
      analyserNode.fftSize = 256;            // frequencyBinCount = 128
      analyserNode.smoothingTimeConstant = 0; // 스무딩은 컴포넌트가 attack/release로 직접
      srcNode.connect(analyserNode);
      analyserNode.connect(audioCtx.destination); // 필수: 안 하면 무음
    }
    if (audioCtx.state === "suspended") void audioCtx.resume();
  } catch {
    audioCtx = null;
    analyserNode = null;                   // 실패 시 EQ만 안 뜨고 재생은 정상
  }
}

export function getTidalAnalyser(): AnalyserNode | null {
  return analyserNode;
}
```
- **`loadAndPlay`와 `resumePlayback` 둘 다** 첫머리에서 매번 호출(두 곳이 유저 제스처 진입점). 그래프가 한번 생기면 audioEl의 **모든** 출력이 영구히 그래프 경유 → `connect(destination)`은 필수, 볼륨은 그대로 동작. `seekTo`/`setSdkVolume`는 호출 불필요(그래프 불변).
- `el.volume`은 source node 앞단이라 기존 볼륨 컨트롤 그대로 동작. **단, 볼륨이 분석 데이터도 스케일** → 저볼륨이면 막대가 작아지고 mute면 0. (의도된 동작으로 수용; "트랙 절대 스펙트럼"이 필요하면 후속.)
- 브라우저 Web Audio 미지원/`AudioContext` 생성 실패 시 재생을 막지 않음 — try/catch로 `analyserNode=null`(EQ만 생략).

### 3.3 반응성 — 활성 플랫폼이 Tidal인지

스토어에 `activePlatform: ActivePlatform | null` 추가(초기 `null`). facade `playOn`은 현재 모듈 변수 `active = platform`([player.ts:262](../../../web/src/lib/player.ts#L262))만 쓰는데, **그 한 줄 옆에** `usePlayerStore.setState({ activePlatform: platform })` 추가 — `active`가 할당되는 유일한 지점이라 진짜 활성 플랫폼을 정확히 반영. EQ는 `activePlatform === "tidal" && isPlaying`일 때만 표시.

- **타입 순환 회피:** `Platform`은 `lib/player.ts`에 정의돼 있고 store가 거길 import하면 facade↔store 순환 → store에 **로컬 리터럴 유니온** `type ActivePlatform = "tidal" | "spotify" | "youtube"`을 두거나 그냥 `string`. (facade의 `Platform`과 값 동일.)
- **null 리셋은 방어적(load-bearing 아님):** 어떤 stop 경로도 모듈 `active`를 비우지 않지만, EQ가 `isPlaying`도 함께 게이트하고 모든 정지/종료/에러 경로가 `isPlaying:false`로 가며 `isPlaying:true`는 가드된 per-platform 'playing' 리스너에서만 켜지므로([tidal-player.ts:49](../../../web/src/lib/tidal-player.ts#L49)), stale한 `activePlatform`이 EQ를 잘못 띄우지 않음. hygiene로 store `reset()`에 `activePlatform: null`만 추가.
- **resume는 playOn을 우회**([player.ts:470](../../../web/src/lib/player.ts#L470)는 `PLAYERS[routed()].resumePlayback()` 직행) — 직전 playOn의 `activePlatform` + 'playing' 리스너의 `isPlaying` 복원에 의존하므로 의도된 동작. (미래 유지보수자가 resume을 playOn 재진입으로 "고치지" 않도록 §5에 명시.)

> 비채택: 컴포넌트가 `getActivePlatform()`(모듈 변수) 폴링 — 비반응형이라 별도 폴링 필요, 더 복잡.

### 3.4 컴포넌트 — `SpectrumEqualizer.tsx` (신규)

- 스토어 구독: `const show = activePlatform === "tidal" && isPlaying`.
- `!show` → **`return null`** (영역 자체가 사라짐 = "숨김") + rAF 미가동.
- `show` → `getTidalAnalyser()`로 analyser 획득(null이면 `return null`). rAF 루프:
  1. `analyser.getByteFrequencyData(bins)` (`bins = Uint8Array(analyser.frequencyBinCount)`, ref로 1회 할당).
  2. 순수 변환 함수 `binsToBarHeights(bins, prevHeights) → number[]`(별도 파일 `lib/spectrum.ts`)로 막대 높이 산출.
  3. 막대 ref들의 `style.height` 직접 갱신(리렌더 없이, BarsVisualizer 패턴).
- **rAF 생명주기(재가동 계약 명시):** rAF 루프는 `show`를 의존성으로 한 `useEffect`로 (재)시작 — `show` false→true, 마운트 시 시작. `visibilitychange`: 탭이 hidden이면 `cancelAnimationFrame`, **visible로 복귀 + `show` true면 루프를 재시작**(cancel만이 아니라 re-arm). 언마운트/`show` false 전환 시 rAF cancel + 리스너 제거.

**`binsToBarHeights` (순수 함수, `web/src/lib/spectrum.ts`, 단위테스트 대상)** — BarsVisualizer 수학 차용. React/Web Audio 의존 없는 순수 함수로 분리(테스트·재사용 용이):
- 로그 밴드 버킷팅: `BAR_COUNT`개 막대 각각이 `[start,end)` 주파수 빈을 로그 간격으로 차지.
- 밴드별 평균 → 고주파 게인(`1 + bandPos*HIGH_FREQ_GAIN`) → 노이즈 게이팅(`max(0, avg-NOISE_FLOOR)/(1-NOISE_FLOOR)`) → `pow(gated, GAMMA)*PEAK_GAIN`.
- attack/release 스무딩: 상승 시 `ATTACK`, 하강 시 `RELEASE` 계수로 `prev + (target-prev)*k`.
- 반환: `0..1` 정규화 높이 배열. (컴포넌트가 `%`로 변환, 최소 가시 높이 보장.)
- 상수: `BAR_COUNT=48`, `MIN_VISIBLE=2`, `PEAK_GAIN=0.8`, `GAMMA=0.95`, `NOISE_FLOOR=0.04`, `HIGH_FREQ_GAIN=2.6`, `ATTACK=0.95`, `RELEASE=0.32`.

### 3.5 시각 스타일 — 에디토리얼 팔레트로 적응

my-forever-music의 무지개 HSL 회전은 MRMS 톤과 안 맞음 → **MRMS 팔레트로 교체**(메모리: 템플릿 자산 보존·제자리 적응):
- 막대 **48개**, 색 **`--mrms-rust` 단색**, 어두운 `--mrms-ink`(PlayerBar 배경) 위.
- 배치: PlayerBar 내부 `absolute bottom-full left-0 right-0`, 높이 ~40px, `pointer-events-none`. 바 너비(`md:left-60` 오프셋) 자동 상속.
- 막대: `flex items-end justify-center gap-[2px]`, 각 막대 `flex-1 max-w-[10px] rounded-t-[1px] bg-[var(--mrms-rust)]`, 높이는 rAF가 인라인 갱신.
- **stacking 명시:** error/initializing 배너도 같은 `bottom-full` 앵커(동일 사각형) → positioned 형제 z-auto는 **DOM 순서 = paint 순서**. EQ가 error 배너 위로 그려지면 안 되므로, `<SpectrumEqualizer />`를 배너 블록보다 **JSX 앞**에 두거나(이른 형제=아래로 그려짐) EQ에 명시적 낮은 z-index. (init 배너는 sdkReady 전이라 Tidal 재생 중 EQ와 사실상 동시 발생 안 함; error만 실제 겹침 가능.) EQ는 `left-0 right-0` 풀폭, 배너는 자체 `px-14` — 수평 정렬은 다르지만 의도된 차이.

### 3.6 배치 — `PlayerBar.tsx`

`PlayerBar`의 최상위 `<div>`(고정 바) 안, 기존 error/initializing 배너 블록 **앞**에 `<SpectrumEqualizer />` 추가(위 stacking 규칙). 컴포넌트가 자체적으로 `absolute bottom-full ...`을 들고 표시/숨김을 판단하므로 PlayerBar는 무조건 렌더만 한다.

## 4. 범위 밖 (후속)

- **Spotify/YouTube 비주얼**: SDK iframe이라 Web Audio 탭 불가 → 이번 범위는 Tidal 전용. (데코 막대는 비채택 — 사용자가 "숨김" 선택.)
- **다른 비주얼 모드**(radial bloom 등): my-forever-music엔 있으나 이번은 막대만.
- **사용자 토글/설정**(EQ on/off, 색·막대 수 커스텀): 후속.
- **Canvas 렌더**: 막대 48개는 DOM span으로 충분(BarsVisualizer도 DOM). WebGL/canvas 불필요(YAGNI).

## 5. 데이터/생명주기 흐름

1. 유저가 재생 버튼 → facade `loadAndPlay`/`resumePlayback` → Tidal이면 `playOn('tidal')` → `tidalPlayer.loadAndPlay`가 `ensureAnalyser()` 호출(그래프 1회 생성·`resume()`) + 스토어 `activePlatform='tidal'`.
2. `SpectrumEqualizer`가 `activePlatform==='tidal' && isPlaying` 감지 → `getTidalAnalyser()`로 rAF 루프 시작 → 막대 율동.
3. 일시정지 → `isPlaying=false` → `show` false → `return null`(영역 사라짐) + rAF 정지.
4. Spotify/YouTube로 전환 → `activePlatform` 변경 → `show` false → 숨김(Tidal audioEl은 어차피 pause).
5. 다시 Tidal 재생 → 그래프는 이미 존재(재생성 없음) → 즉시 율동 재개.
6. **resume 주의:** 일시정지 후 재생은 facade `resumePlayback`이 `playOn`을 거치지 않고([player.ts:470](../../../web/src/lib/player.ts#L470)) 직전 플랫폼으로 직행 → `activePlatform`은 이전 playOn 값 유지, `isPlaying`은 'playing' 리스너가 복원. **resume을 playOn 재진입으로 리팩터링하지 말 것**(불필요·이중재생 위험). 단 `tidalPlayer.resumePlayback`은 `ensureAnalyser()`를 호출(AudioContext suspended 복귀 대비).

## 6. 테스트 전략

- **단위(`binsToBarHeights`)**: 순수 함수만 테스트(Web Audio/canvas/rAF 없이).
  - 무음 입력(전부 0) → 모든 막대 ≈ 0(최소 가시 높이 이하 raw).
  - 풀 스케일(전부 255) → 막대 상한(1.0 클램프) 근처.
  - 로그 밴드 매핑: `BAR_COUNT`개 막대가 빈 전체를 겹침 없이 덮고 각 `start < end`.
  - attack/release: 상승은 빠르게(ATTACK), 하강은 느리게(RELEASE) — prev 대비 변화량 부호별 계수 검증.
- **단위 제외**: `ensureAnalyser`/`getTidalAnalyser`(Web Audio는 단위테스트 환경 미지원) — 순수 변환만 테스트.
- **러너:** web에 JS 단위 러너 없음(Playwright e2e만) → **Vitest 추가**(§7·§8). `binsToBarHeights`는 순수 함수라 jsdom 불필요(`environment: 'node'`).
- **수동 verify(회귀 포함)**:
  - Tidal 재생 시 막대 율동 + 음악과 동기. **`analyser.getByteFrequencyData(bins)`가 전부 0이 아님**(same-origin/taint 경계 실증 — 콘솔에서 1회 확인).
  - 비Tidal(Spotify/YouTube)·일시정지·정지 시 영역 사라짐.
  - **기존 재생 정상**: 재생/일시정지/볼륨/곡 전환/seek — Web Audio 그래프 라우팅 후에도 회귀 없음(MediaElementSource 표준이나 반드시 확인).

## 7. 파일 구조

- **신규** `web/src/lib/spectrum.ts` — 순수 함수 `binsToBarHeights(bins, prevHeights)` + 상수(BAR_COUNT 등). React/Web Audio 의존 0.
- **신규** `web/src/lib/spectrum.test.ts` — `binsToBarHeights` 단위(Vitest, `environment: 'node'`).
- **신규** `web/src/components/player/SpectrumEqualizer.tsx` — 막대 렌더 + rAF 루프 + 표시/숨김(`lib/spectrum`에서 import).
- **수정** `web/package.json` — `vitest` devDep + `"test:unit": "vitest run"` 스크립트.
- **신규** `web/vitest.config.ts` — `test: { include: ['src/**/*.test.ts'], environment: 'node' }` (Playwright의 `e2e/*.spec.ts`와 분리 — `*.test.ts`만 vitest, `*.spec.ts`는 Playwright).
- **수정** `web/src/lib/tidal-player.ts` — `ensureAnalyser()` + `getTidalAnalyser()`, `loadAndPlay`/`resumePlayback` 둘 다에서 호출.
- **수정** `web/src/lib/player.ts` — `playOn`의 `active = platform` 옆에서 `activePlatform` 스토어 기록.
- **수정** `web/src/store/player.ts` — `activePlatform: ActivePlatform | null` 필드(로컬 리터럴 유니온) + 초기값 `null` + `reset()`에 `activePlatform: null`.
- **수정** `web/src/components/player/PlayerBar.tsx` — 배너 블록 **앞**에 `<SpectrumEqualizer />` 마운트.

## 8. 구현 순서 (한 plan)

1. **Vitest 셋업**: `web`에 `vitest` 추가 + `vitest.config.ts`(`src/**/*.test.ts`, node env) + `test:unit` 스크립트. 빈 통과 테스트로 러너 동작 확인.
2. **`binsToBarHeights` 순수 함수 + 단위테스트**(TDD) — `lib/spectrum.ts`. 로그밴드·게이팅·스무딩(무음→0, 풀스케일→상한, 밴드 커버리지, attack/release).
3. **캡처 레이어**: `tidal-player.ts` `ensureAnalyser`(webkit 폴백·try/catch)/`getTidalAnalyser` + `loadAndPlay`·`resumePlayback` 호출 지점.
4. **반응성**: store `activePlatform`(로컬 유니온)+`reset` null + facade `playOn` 기록.
5. **컴포넌트**: `SpectrumEqualizer.tsx`(rAF·재가동 계약·표시/숨김·막대) + PlayerBar 배너 앞 마운트.
6. **수동 verify**(회귀 + bins 비-제로 포함).

## 관련 문서

- [ADR-004](../../decisions/ADR-004-tidal-spectrum-equalizer.md) — 결정 기록
- [tidal-sdk-notes.md](../../tidal-sdk-notes.md) — Tidal playback 구현 노트(audio element + 프록시 스트림)
- 참조 구현: my-forever-music `apps/web/src/components/visualizer/animations/BarsVisualizer.tsx`(수학), `hooks/useTidalAudioAnalyser.ts`(그쪽은 SDK 우회 — MRMS는 불필요)
- 코드: `web/src/lib/tidal-player.ts`, `web/src/lib/player.ts`, `web/src/store/player.ts`, `web/src/components/player/PlayerBar.tsx`
