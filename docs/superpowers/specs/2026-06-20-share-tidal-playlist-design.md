# 공유페이지 "Tidal에서 재생" — 설계 스펙

> 작성 2026-06-20. MRMS_FN. 공유 플레이리스트를 듣는 사람이 **Tidal에서 바로 재생/가져가기**.

## 문제 & 결정

- MRMS 유저 플레이리스트는 Tidal에 동일 플레이리스트가 없음(트랙별 `tidal_track_id`만). "Tidal에서 재생"하려면 **Tidal 플레이리스트를 먼저 만들어야** 함.
- per-listener 생성(리스너가 버튼 클릭 시 본인 Tidal에 생성)은 리스너마다 로그인+Tidal 연결 필요 → 무거움.
- **채택(사용자 제안)**: **공유 켤 때(소유자) 소유자 Tidal에 1회 생성**하고 uuid 저장 → 공유페이지는 그 Tidal 플레이리스트 **공개 링크**만 노출. 듣는 사람은 **무인증**으로 열어서 재생/즐겨찾기(가져가기) 가능.
- API: 레거시 v1(`api.tidal.com/v1`) — 토큰 스코프가 `w_usr`(레거시)뿐, v2 `playlists.write` 없음.

## 아키텍처

**Tidal 쓰기 헬퍼** `src/mrms/tidal_playlist.py`:
- `create_tidal_playlist(access_token, title, description, track_ids)` → uuid.
  1. `GET /v1/sessions` → userId·countryCode
  2. `POST /v1/users/{userId}/playlists` (form title·description) → uuid
  3. 트랙 추가(50개 배치, 배치마다 `GET /v1/playlists/{uuid}`로 ETag 재취득 → `POST .../items` `If-None-Match`+`trackIds`+`onArtifactNotFound=SKIP`)
  - (오픈소스 tidalapi의 create/add 흐름과 동일.)

**저장**: `Playlist."tidalPlaylistId" TEXT`(마이그레이션 `20260620100000_playlist_tidal_id`). `get_playlist_by_share_id`가 `tidal_playlist_id` 반환. `get_playlist_tidal_id`/`set_playlist_tidal_id` 헬퍼.

**공유 토글** `POST /api/user/playlists/{id}/share`(async): enable + 아직 미생성 + 소유자 Tidal 연결 시 → 공유 트랙의 `tidal_track_id`로 `create_tidal_playlist` → uuid 저장. **best-effort**(실패해도 공유는 정상, `tidal_created` 반환).

**공유페이지**: `playlist.tidal_playlist_id` 있으면 **"Tidal에서 재생 ↗"** 링크 버튼(`https://tidal.com/playlist/{id}`, 새 탭, 무인증).

## 한계 / 후속

- 소유자가 공유 후 플레이리스트를 수정하면 Tidal 쪽은 **stale**(생성 시점 스냅샷). 재동기화는 후속(현재는 재공유 토글 off→on 시에도 기존 uuid 유지). 필요하면 "Tidal 동기화" 별도 액션.
- 이미 공유 중이던(기존) 플레이리스트는 `tidalPlaylistId`가 없어 토글 off→on 한 번 필요.
- 쓰기 API는 사전 실측 불가(회원 토큰 필요) → 배포 후 실제 연결 계정으로 1차 검증.

## 검증

- 단위(respx): `create_tidal_playlist` 흐름(폼·etag·trackIds)·50배치·생성오류 전파. tsc/eslint clean.
