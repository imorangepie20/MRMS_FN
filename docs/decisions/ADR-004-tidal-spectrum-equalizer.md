# ADR-004 Tidal 전용 진짜 스펙트럼 비주얼 이퀄라이저

작성일: `2026-06-14`

## 상태

승인 — **구현 완료 + prod 배포** (2026-06-14). 브랜치 `feat/tidal-spectrum-equalizer` → main 머지 후 수동 verify 기반 시각 튜닝(`f5a1be1`: dB 헤드룸 + 게인 + fftSize 1024 + MAX_BIN_RATIO 0.35 + 띠 높이/VSCALE). 단위테스트 7/7, prod 배포 smoke test 통과. 상세 설계 [2026-06-14-tidal-spectrum-equalizer-design.md](../superpowers/specs/2026-06-14-tidal-spectrum-equalizer-design.md).

## 결정

하단 PlayerBar 상단 엣지에 비주얼 이퀄라이저를 띄운다. **Tidal 재생 중에만** Web Audio `AnalyserNode`로 추출한 **실제 주파수 스펙트럼**으로 막대가 율동하고, 그 외(Spotify/YouTube 재생·일시정지·정지)에는 **영역 자체가 숨겨진다**.

- **캡처**: MRMS Tidal 재생은 SDK iframe이 아니라 같은 오리진 프록시 스트림을 트는 **단일 `HTMLAudioElement`**. → `ctx.createMediaElementSource(audioEl) → AnalyserNode → ctx.destination` + `getByteFrequencyData`. my-forever-music의 SDK 우회(세그먼트 캡처·MP4 디코드·수동 FFT) **전부 불필요**.
- **소유권**: AnalyserNode는 audio element가 있는 `tidal-player.ts`에 1회 생성·싱글톤(컴포넌트가 직접 `createMediaElementSource` 호출 시 리마운트로 "element당 1회" 위반). 컴포넌트는 `getTidalAnalyser()`로 읽기만.
- **반응성**: 스토어에 `activePlatform` 추가, facade `playOn`이 기록 → 컴포넌트가 `activePlatform==='tidal' && isPlaying`으로 표시 판단.
- **시각**: my-forever-music BarsVisualizer의 **수학만 차용**(로그 밴드·게이팅·attack/release 스무딩), 색은 무지개 HSL 대신 **MRMS `--mrms-rust` 단색**. 막대 48개, DOM span.
- **비Tidal**: 숨김(사용자 선택). 데코 막대·Spotify/YouTube 비주얼은 범위 밖.

## 배경

사용자가 "하단 뮤직플레이어 바로 위에 비주얼 이퀄라이저"를 요청, "이전 프로젝트(my-forever-music) 참조"를 지시. my-forever-music은 Tidal Web SDK iframe이 오디오를 안 내줘서 fetch 후킹+MP4 디코드+수동 FFT로 우회한다. MRMS는 SDK 방식이 아니라 audio element를 직접 들고 있어(사용자 확인: "타이달 SDK 방식 아냐") Web Audio로 바로 탭 가능 → 훨씬 단순. 데코(전 플랫폼) vs 진짜 스펙트럼(Tidal 전용)에서 사용자가 **진짜 스펙트럼·Tidal 전용**을, 비Tidal 상태는 **숨김**을 선택.

## 근거

- audio element 직접 보유 → Web Audio가 표준 경로. 우회 머신러리 0줄, 회귀면 1곳(그래프 라우팅)만.
- AnalyserNode를 player 모듈 싱글톤으로 둬 "element당 1회" 제약을 구조적으로 만족.
- 스무딩/밴드 수학은 검증된 BarsVisualizer를 차용하되 색만 팔레트에 맞춰 템플릿 톤 보존.
- 단위테스트는 순수 변환(`binsToBarHeights`)에 집중(Web Audio/canvas는 jsdom 미지원).

## 결과

좋은 점:
- 진짜 음악 주파수로 율동 — 데코가 아닌 실제 시각화.
- my-forever-music 대비 코드량·복잡도 급감(SDK 우회 불필요).
- 비Tidal 숨김으로 "진짜일 때만 보인다"는 시각적 정직성.

트레이드오프:
- Spotify/YouTube 재생 시 비주얼 없음(SDK iframe 한계 — 후속도 어려움).
- Tidal 오디오를 Web Audio 그래프로 라우팅 → 재생/볼륨/전환 회귀를 수동 확인해야 함(위험 낮음, 표준 API).
- **same-origin 전제:** 실제 스펙트럼은 스트림이 페이지와 same-origin일 때만(검증됨: 백엔드가 CDN re-stream, 302 아님). `NEXT_PUBLIC_API_BASE`가 cross-origin이면 bins=0 → EQ 빈 표시. prod 단일 호스트라 충족.
- 볼륨이 분석 데이터도 스케일(저볼륨=막대 작아짐) — 수용.
- web에 JS 단위 러너 부재 → **Vitest 신규 도입**(부수 효과: 첫 web 단위테스트 인프라).
- 막대 색/수 등 시각 커스텀·EQ 토글은 후속.

## 후속 작업

1. Vitest 셋업(web 첫 단위 러너) + `binsToBarHeights` 순수 함수·단위테스트(로그밴드·게이팅·스무딩).
2. 캡처 레이어(`ensureAnalyser` webkit 폴백·try/catch / `getTidalAnalyser` + `loadAndPlay`·`resumePlayback` 호출 지점).
3. 반응성(store `activePlatform` 로컬 유니온 + facade `playOn` 기록).
4. 컴포넌트(`SpectrumEqualizer.tsx` + PlayerBar 배너 앞 마운트) + 수동 verify(회귀 + bins 비-제로 포함).

## 관련 문서

- [상세 설계](../superpowers/specs/2026-06-14-tidal-spectrum-equalizer-design.md)
- [tidal-sdk-notes.md](tidal-sdk-notes.md) — Tidal playback 구현 노트(audio element + 프록시 스트림)
- 코드: `web/src/lib/tidal-player.ts`, `web/src/lib/player.ts`, `web/src/store/player.ts`, `web/src/components/player/PlayerBar.tsx`
