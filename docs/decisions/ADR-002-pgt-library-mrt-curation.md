# ADR-002 PGT 라이브러리 + MRT 큐레이션 흐름

작성일: `2026-06-13`

## 상태

제안 — 설계 승인됨, 구현 대기. (구현 완료 시 `승인`으로 갱신)

## 결정

PGT 5섹션(Liked·Playlists·Albums·Artists·PCT)을 **UserTrack 파생 그룹핑**으로 구성하고(새 user-owned 테이블 없음), MRT→PGT "이동"을 **UserTrack 생성 + MRT display 필터**로 구현한다(PlaylistHistory 불변).

- **PGT 섹션:** Liked(source='liked'), Albums(Track.albumId 그룹), Artists(Track.artistId 그룹), PCT(isCore=true)는 **UserTrack 파생**. **Playlists**는 기존 **1급 Playlist 테이블**(사용자 생성, `playlists.py` 재사용) + 임포트(UserTrack `source='playlist:%'` 그룹, best-effort). UserAlbum/UserArtist 테이블 신설 안 함.
- **(A 범위)** 임포트 플리 1급 모델링(Playlist kind/platform + import→Playlist 행)은 **B = 별도 후속**으로 보류 — A의 source 그룹핑은 다대다 불가(lossy) 한계 인지.
- **MRT→PGT 이동 = 복사 아님:** like/pct(기존 `user_tracks` 토글) 또는 앨범 collect로 UserTrack 생성 → `mrt_latest`가 UserTrack 보유 trackId를 추천에서 제외 → MRT에서 사라짐. 이력(PlaylistHistory)은 보존.
- **MRT 누적 관리:** 화면은 최신 generation만(`fetch_latest_playlists`) + 이동분 제외; DB는 `prune_playlist_history(keep_generations=N)`로 오래된 generation 삭제.

대안(비채택): (a) 1급 엔티티 테이블 — 트랙 없는 팔로우/플레이리스트 CRUD가 필요할 때나 정당, 현재 YAGNI. (b) 이동 시 PlaylistHistory 배열 mutate / 'moved' 플래그 — 이력 훼손·상태 추가.

## 배경

`contents_constructure.md`의 3영역(EMP→MRT→PGT) 중 PGT/MRT 상호작용이 미구현. MRT 추천은 2x/week(+파이프라인) 생성되어 PlaylistHistory가 무한 누적되고, 사용자가 추천을 라이브러리로 가져갈 경로가 없다. 한편 like/pct 토글(UserTrack 생성)은 이미 있어 PGT 편입 메커니즘으로 재사용 가능하다.

## 근거

- 파생 그룹핑은 기존 데이터(UserTrack.source, Track.albumId/artistId)로 즉시 가능 — 스키마·import 변경 0.
- "이동 = display 필터"는 `search_for_persona`가 이미 UserTrack 보유분을 다음 추천에서 제외하는 로직과 일관 → 한 개의 진실(UserTrack 존재)로 MRT/PGT가 동기화.
- like/pct 재사용으로 PGT 편입 경로가 하나(토글)로 단순.

## 결과

좋은 점:
- 새 테이블·import 변경 없이 PGT 5섹션 + 이동 실현.
- MRT가 "처리하는 inbox"로 자연 감소(이동) + prune으로 DB 영속.
- 이력 보존(PlaylistHistory mutate 안 함).

트레이드오프:
- 파생 그룹핑이라 "트랙 없는 아티스트 팔로우"·"사용자 플레이리스트 CRUD"는 불가(나중에 1급 엔티티로 확장).
- 한 트랙이 여러 섹션에 중복 노출(liked+album+artist) — 의도된 동작(섹션이 파생이라 자연 구분).
- 앨범 담기 source = `'liked'` 확정(2026-06-13).

## 후속 작업

1. `src/mrms/api/pgt.py` — 5섹션 파생 조회 엔드포인트
2. `web/.../library` 화면 + `PgtLibrary.tsx`(5섹션)
3. `mrt_latest`에 UserTrack 제외 필터 + 앨범 `collect` 액션
4. `prune_playlist_history` + `regenerate_mrt` 연동
5. prune keep_generations 기본값(2) 확정 (앨범 담기 source = `'liked'` 확정됨)

## 관련 문서

- [상세 설계](../superpowers/specs/2026-06-13-pgt-library-mrt-curation-design.md)
- [contents_constructure.md](../contents_constructure.md) — EMP/MRT/PGT/PCT 원전
- [ADR-001](ADR-001-youtube-newuser-automation.md) — MRT 생성·regenerate(prune 연동 지점)
- 코드: `src/mrms/api/user_tracks.py`(like/pct), `src/mrms/api/main.py`(mrt_latest)
