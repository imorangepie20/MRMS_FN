# ADR-010 내 플레이리스트 → Spotify/Tidal export (Eat The Shared의 짝)

작성일: `2026-06-15`

## 상태

승인 — 구현 예정. 상세 설계 [2026-06-15-playlist-export-design.md](../superpowers/specs/2026-06-15-playlist-export-design.md). 액션(플레이리스트 버튼), 엔드포인트 `POST /api/export/playlist`.

## 결정

내 MRMS 플레이리스트를 **사용자 Spotify/Tidal 계정에 진짜 플레이리스트로 생성(export)** → 공유 링크 반환. import([ADR-009](ADR-009-share-url-import.md))의 역방향 짝(풀서클).

- **쓰기 스코프 이미 보유**(Spotify `playlist-modify-*`, Tidal `w_usr`) → 재인증 불필요.
- **대상 플랫폼 ID 있는 곡만** export, 없는 곡은 스킵+카운트 보고(크로스플랫폼 resolve는 후속).
- **v1 = Spotify 확실 + Tidal 확인 후**(create 엔드포인트 구현 시 검증).
- 위치 = 내 플레이리스트의 "내보내기" 버튼(별도 페이지 아님).

## 배경

방금 만든 Eat The Shared(공유 URL→트랙 import)의 짝으로 "남들 먹을거"가 필요. MRMS엔 유저 플레이리스트 인프라(`playlists.py`)가 있고 쓰기 스코프도 이미 있어, export 모듈만 더하면 됨.

## 근거

- 쓰기 스코프 보유 → 재인증 없이 즉시 가능.
- 플랫폼 진짜 플레이리스트 = 아무나 열고 Eat The Shared로 역수입(풀서클).
- 곡 추림은 EMP의 platform_track_id 재사용.

## 결과

좋은 점: 외부 공유/풀서클, 재인증 없음, 신규 표면 최소(버튼+라우트).

트레이드오프:
- **쓰기 작업** — 사용자 계정에 실제 플레이리스트 생성(되돌리기=직접 삭제). 중복 export=새 플레이리스트(후속 upsert 여지).
- Tidal create 엔드포인트 불확실 → 구현 시 검증.
- 대상 플랫폼에 없는 곡은 스킵(resolve 후속).

## 후속 작업

1. `export/spotify.py`(create+add) · `export/tidal.py`(확인 후).
2. `api/export.py` + main.py 등록.
3. 프론트 "내보내기" 버튼 + `lib/api/export.ts`.
4. 단위·통합 테스트.
5. (후속) 스킵 곡 resolve, PGT/MRT export, 중복 upsert.

## 관련 문서

- [상세 설계](../superpowers/specs/2026-06-15-playlist-export-design.md)
- [ADR-009 Eat The Shared](ADR-009-share-url-import.md) (역방향 짝)
- 코드: `src/mrms/api/playlists.py`, `src/mrms/db/playlist.py`, `src/mrms/api/search.py`
