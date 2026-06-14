# 내 플레이리스트 → Spotify/Tidal export 상세 설계 (Eat The Shared의 짝)

작성일: `2026-06-15`
상태: 설계 승인 — 구현 예정. ADR-[ADR-010](../../decisions/ADR-010-playlist-export.md).

## 목표

내 MRMS 플레이리스트를 사용자의 **Spotify/Tidal 계정에 진짜 플레이리스트로 생성(export)** → 그 **공유 링크**를 아무나 열고, **Eat The Shared로 역수입**(풀서클). "남들 먹을거 만들기" — import(공유 URL→트랙)의 역방향.

핵심: 쓰기 OAuth 스코프가 **이미 보유**(Spotify `playlist-modify-private/public`, Tidal `w_usr w_sub`) → **재인증 불필요.** 신규 = export 모듈(create+add) + 라우트 + 버튼.

## 사용자 경험

1. 내 플레이리스트 화면(PGT 플레이리스트 탭/상세)에 **"Spotify/Tidal로 내보내기" 버튼**(연동된 플랫폼).
2. 누르면 내 계정에 동명 플레이리스트 생성 + 트랙 추가 → **공유 링크 표시(복사 버튼)** + "N곡 내보냄 · M곡 스킵(해당 플랫폼에 없음)".
3. 그 링크는 외부 공유용이고, Eat The Shared(`/import`)로 그대로 역수입 가능.

## 아키텍처 / 데이터 흐름

```
[플레이리스트 화면] "내보내기" 버튼(platform)
   → POST /api/export/playlist { playlist_id, platform }
       → get_playlist + get_playlist_tracks (기존 db/playlist)
       → 대상 플랫폼 platform_track_id 있는 곡만 추림 (없으면 skip 카운트)
       → 유저 토큰(_spotify_tok/_tidal_tok, 쓰기 스코프 보유)
       → create_platform_playlist(name) → add_tracks(uris/ids, 배치)
   ← { url(공유 링크), exported, skipped }
[플레이리스트 화면] 공유 링크 + 카운트 표시
```

## 백엔드 (신규 = export 모듈 + 라우트)

- `src/mrms/export/spotify.py` 신규:
  - `GET /v1/me` → user id → `POST /v1/users/{id}/playlists {name, public}` → playlist id + `external_urls.spotify`(공유 링크).
  - `POST /v1/playlists/{id}/tracks {uris:[spotify:track:ID]}` 100개씩 배치.
- `src/mrms/export/tidal.py` 신규: `w_usr`로 플레이리스트 생성 + 트랙 추가. **정확한 엔드포인트/페이로드는 구현 시 연동 계정으로 확인**(create + items add). 공유 링크 = `https://tidal.com/playlist/{uuid}`.
- `src/mrms/api/export.py` 신규: `POST /api/export/playlist {playlist_id, platform}` → main.py 등록. 권한=`get_current_user_id`(본인 플레이리스트만). 트랙 추림 → create+add → `{url, exported, skipped}` 반환.
- 재사용: `db/playlist`(get_playlist/get_playlist_tracks), `_spotify_tok`/`_tidal_tok`.

## 트랙 처리

- 플레이리스트 트랙 중 **대상 플랫폼 ID(`spotify_track_id`/`tidal_track_id`) 있는 곡만** export. 없는 곡은 **스킵 + 카운트**(사용자에게 "M곡 스킵" 표시).
- 크로스플랫폼 resolve(`playback_resolve` 재사용해 없는 곡도 채우기)는 **후속**(v1 미포함 — 곡당 API 호출이라 느림).

## 프론트

- 내 플레이리스트 화면에 "내보내기" 버튼(연동 플랫폼별). 클릭 → `POST /api/export/playlist` → 결과: 공유 링크(복사) + 카운트. 로딩/에러.
- `web/src/lib/api/export.ts` — `exportPlaylist(playlistId, platform)`.

## 에러 / 엣지

- 대상 플랫폼 미연동(토큰 없음) → 401 "플랫폼을 연결하세요".
- export 가능 곡 0(전부 해당 플랫폼에 없음) → 400/메시지.
- 플랫폼 create/add API 실패 → 502 + 메시지.
- 빈 플레이리스트 → 메시지.

## 제약 / 리스크

- **쓰기 작업**: 사용자 계정에 실제 플레이리스트가 생성됨(되돌리기 = 사용자가 직접 삭제). 중복 export 시 매번 새 플레이리스트(또는 후속으로 upsert).
- **Tidal create 엔드포인트 불확실** → 구현 시 prod 연동 계정으로 검증. v1은 **Spotify 확실 + Tidal은 확인 후 포함**.
- dev/prod 분리로 로컬 라이브 검증은 prod 토큰 필요 → 단위/통합은 플랫폼 API mock.

## 테스트 전략

- 단위: 트랙 추림(대상 플랫폼 ID 있는 것만, skip 카운트) 순수 로직.
- 단위: spotify create+add는 httpx mock(respx)으로 호출 시퀀스/배치 확인.
- 통합: `POST /api/export/playlist` — 인증·본인 플레이리스트·미연동 401·0곡·정상(토큰·플랫폼 API mock → url 반환) 경로.
- ⚠️ DB 격리: dev DB cleanup fixture. 전체 `pytest tests/` 금지.

## 비채택 대안

- **MRMS 내부 공유 링크**(`/shared/{id}`): 가볍지만 범위가 MRMS 생태계 안 → "아무나 + 풀서클" 위해 플랫폼 export 채택.
- **전 곡 크로스플랫폼 resolve**: v1엔 과함(느림) → 스킵+보고, resolve는 후속.

## 후속 작업

1. `export/spotify.py`(create+add) · `export/tidal.py`(확인 후).
2. `api/export.py`(`POST /api/export/playlist`) + main.py 등록.
3. 프론트 플레이리스트 "내보내기" 버튼 + `lib/api/export.ts`.
4. 단위·통합 테스트.
5. (후속) 스킵 곡 크로스플랫폼 resolve, PGT/MRT export.

## 관련 문서

- [ADR-010](../../decisions/ADR-010-playlist-export.md)
- [ADR-009 Eat The Shared(import)](../../decisions/ADR-009-share-url-import.md) (역방향 짝)
- 코드: `src/mrms/api/playlists.py`·`src/mrms/db/playlist.py`(플레이리스트), `src/mrms/api/search.py`(`_spotify_tok`/`_tidal_tok`)
