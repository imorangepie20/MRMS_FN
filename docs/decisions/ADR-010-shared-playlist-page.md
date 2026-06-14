# ADR-010 공유 플레이리스트 페이지 (Share & Play, Eat The Shared의 짝)

작성일: `2026-06-15`

## 상태

승인 — 구현 예정. 상세 설계 [2026-06-15-shared-playlist-page-design.md](../superpowers/specs/2026-06-15-shared-playlist-page-design.md). 공개 페이지 `/p/{token}`, 엔드포인트 `POST /api/user/playlists/{id}/share` + 공개 `GET /api/shared/{token}`.

> 처음엔 "실제 Spotify/Tidal 플레이리스트로 export"를 검토했으나(아래 비채택), 트래픽이 외부로 빠져 홍보에 역효과 → **우리 페이지에서 듣는 공유**로 방향 전환.

## 결정

내 MRMS 플레이리스트를 **공개 링크로 공유**하고, 방문자가 **MRMS 페이지(`/p/{token}`) 안에서 직접 재생**하게 한다. 재생하려면 방문자가 본인 Spotify/Tidal을 **우리 OAuth로 연결**(= 사이트 로그인/세션). 목적 = **사이트 홍보**(공유 링크 = 가입·연결 퍼널).

- **공유 단위 = 유저 플레이리스트**(live reference, 스냅샷 아님). PGT/MRT는 후속.
- **share 토큰** — `Playlist.shareId`(무작위 `token_urlsafe`, nullable·unique). 값 있으면 공개, NULL이면 비공개·해제.
- **조회 무인증** — 공개 `GET /api/shared/{token}` + 공개 페이지 `/p/{token}`(middleware 게이트 밖). 토글만 소유자 인증.
- **재생 = 우리 OAuth 연결** — 미연결 방문자는 Play 자리에 "Sign in with Spotify/Tidal"(login 메커니즘 재사용). 연결되면 본인 구독으로 기존 player 재생.
- 위치 = 내 플레이리스트의 "공유" 버튼 + 공개 페이지(`/p/[shareId]`).

## 배경

Eat The Shared([ADR-009](ADR-009-share-url-import.md))의 짝으로 "남들 먹을거"가 필요. 단, 외부 플랫폼으로 export하면 트래픽이 그쪽으로 빠진다. 사용자 의도는 **사이트 홍보** — 그래서 우리 도메인의 공개 페이지에서 듣게 하고, 들으려면 우리 OAuth로 연결(=가입)하도록 한다. 플레이리스트 인프라(`playlists.py`/`db/playlist.py`)와 멀티플랫폼 player(`lib/player.ts`), OAuth 연결(login 페이지)이 이미 있어 share 토큰 + 공개 조회 + 공개 페이지만 더하면 된다.

## 근거

- 공개 페이지에서 들으면 트래픽이 우리에게 남고, 재생을 위해 연결하면서 신규 유입(홍보 목적 직결).
- player·OAuth·플레이리스트 조회가 전부 존재 → 신규 코드 최소(토큰·공개 라우트·공개 페이지).
- 무작위 토큰 = 열거 불가·즉시 해제(revocable).

## 결과

좋은 점: 외부 공유가 우리 도메인 트래픽 + 연결 퍼널로 전환, 신규 표면 최소, 라이선스 안전(방문자 본인 구독으로 재생).

트레이드오프:
- 재생은 방문자 본인 구독 의존(미연결이면 못 들음 → 그래서 연결 유도). 우리가 대신 재생하지 않음.
- 공유 토큰을 받은 사람은 누구나 봄(의도된 공개). 비공개는 해제(NULL).
- live reference라 원본 변경이 공유 페이지에 즉시 반영(의도).

## 후속 작업

1. 마이그레이션 `_add_playlist_share`(shareId + unique index).
2. `db/playlist.py` `set_playlist_share`/`get_playlist_by_share_id`.
3. `api/playlists.py` share 토글 + `api/shared.py` 공개 조회 + main 등록.
4. 프론트 공개 페이지 `/p/[shareId]` + 레이아웃 + 공유 버튼 + `lib/api/shared.ts`.
5. 단위·통합·프론트 테스트.
6. (후속) 로그인 방문자에게 좋아요/담기 노출, PGT/MRT 공유, 인입 트래킹.

## 비채택 대안

- **실제 Spotify/Tidal 플레이리스트로 export(풀서클):** 사용자 계정에 진짜 플레이리스트 생성 → 외부 링크 공유. 쓰기 스코프는 이미 보유했으나, **트래픽이 외부 플랫폼으로 빠져 홍보 역효과** → 기각하고 우리 페이지 청취로 전환.
- **공개 리스트만(재생 X):** 인페이지 청취·연결 퍼널 누락 → 기각.
- **로그인 강제:** 비로그인도 리스트는 봐야 유입됨 → 조회 무인증, 재생만 연결.

## 관련 문서

- [상세 설계](../superpowers/specs/2026-06-15-shared-playlist-page-design.md)
- [ADR-009 Eat The Shared](ADR-009-share-url-import.md) (역방향 짝 — import)
- 코드: `src/mrms/db/playlist.py`, `src/mrms/api/playlists.py`, `web/src/components/player/PlayerBar.tsx`, `web/src/lib/player.ts`
