# MRT 4종 반응 (좋아요 / 취향저격 / 싫어요 / 관심없어요) — 설계

> **목표:** MRT 추천 아이템(트랙·앨범)에 4종 반응 + 풍선 툴팁을 달고, 반응하면 MRT에서 즉시 사라지게 한다. 긍정(좋아요·취향저격)은 PGT로 이동, 부정은 **싫어요=영구 차단** / **관심없어요=일시 숨김(다음 재생성 때 재추천 가능)**.

작성 2026-06-14. **결정 기록:** [ADR-003](../../decisions/ADR-003-mrt-reactions.md). 인덱스: [docs/README.md](../../README.md). 선행: [ADR-002](../../decisions/ADR-002-pgt-library-mrt-curation.md)(MRT→PGT 이동=display 필터, 이 설계가 확장).

---

## 1. 모델 (확정)

MRT 아이템에 4 반응. **모두 누르면 MRT에서 즉시 제거**(이동 inbox 일관 — 페르소나 플레이리스트 포함). 긍정→PGT, 부정→차단/숨김:

| 반응 | 아이콘 | 효과 | 저장 |
|---|---|---|---|
| **좋아요** | Heart | 라이브러리(PGT/Liked) | `UserTrack source='liked'` (기존) |
| **취향저격** | Sparkles | 핵심 취향(PGT/PCT) | `UserTrack isCore=true` (기존 `/pct`) |
| **싫어요** | ThumbsDown | **영구 제외** (다신 추천 X) | `UserBlocked reason='disliked'` |
| **관심없어요** | EyeOff | **일시 숨김** (다음 재생성 때 재추천 가능) | `UserBlocked reason='dismissed'` |

- **트랙 + 앨범 둘 다** 반응 가능. 앨범 반응 = 그 앨범 차단/숨김(트랙 전체).

## 2. 현재 상태 (재사용/확장 대상)

- **`UserBlocked` 모델** (prisma, **코드 미사용**): `id, userId, targetId, targetType('track'|'artist'), createdAt`. → 부정 반응 저장에 재사용 + 확장.
- **`TrackInteraction` 모델** (미사용): play/skip/like/**block** 행동 로그 + weight/context. → 부정 신호의 ML 활용은 **후속**(이 설계 밖).
- **`src/mrms/api/user_tracks.py`**: `/{track_id}/like`, `/{track_id}/pct`, `/album/{album_id}/collect`. → 반응 엔드포인트가 여기 합류.
- **`src/mrms/api/main.py` `mrt_latest`**: 이미 `owned`(UserTrack) 집합으로 personas/recommended_tracks/recommended_albums 제외([ADR-002]). → UserBlocked 제외 추가.
- **`src/mrms/recsys/mrt.py` `search_for_persona`**: 현재 `t.id NOT IN (SELECT "trackId" FROM "UserTrack" WHERE "userId"=%s)`만 제외. → UserBlocked `disliked` 제외 추가.
- **`src/mrms/emp/runner.py` `_run_regenerate_mrt`**: 재생성 + prune. → dismissed 클리어 추가.
- **프론트 `MrtDashboard.tsx`**: 트랙 행에 Heart(좋아요)/Sparkles(pct) + 앨범 행에 담기 버튼.

## 3. 설계

### 3.1 데이터 — `UserBlocked` 확장 (마이그레이션)

`UserBlocked`에 **`reason` 컬럼 + 중복 방지 unique** 추가 (모델 미사용=빈 테이블이라 안전):
```sql
ALTER TABLE "UserBlocked" ADD COLUMN reason TEXT NOT NULL DEFAULT 'disliked';
CREATE UNIQUE INDEX IF NOT EXISTS uniq_userblocked_target
  ON "UserBlocked"("userId", "targetId", "targetType");
```
- `reason`: `'disliked'`(영구) | `'dismissed'`(일시).
- `targetType`: 기존 `'track'|'artist'` + **`'album'`** 값 사용(스키마 변경 없음 — String).
- 한 반응 = `UserBlocked` 1행: `(userId, targetId=trackId|albumId, targetType, reason)`. `block_target`은 unique로 `ON CONFLICT (userId,targetId,targetType) DO UPDATE SET reason=...`(반응 바꾸면 reason 갱신).

`db/user_blocked.py`(신규): `block_target(conn, user_id, target_id, target_type, reason)`, `clear_dismissed(conn, user_id)`, `blocked_track_ids(conn, user_id, reasons)` (track + album→track 확장 포함).

### 3.2 제외 로직 (3 지점)

차단/숨김 대상 = **트랙 직접 차단 ∪ 차단 앨범의 트랙**. 헬퍼 `blocked_track_ids(conn, user_id, reasons)`가 둘 다 풀어 trackId 집합 반환:
```sql
SELECT "targetId" FROM "UserBlocked" WHERE "userId"=%s AND targetType='track' AND reason = ANY(%s)
UNION
SELECT t.id FROM "Track" t JOIN "UserBlocked" ub
  ON ub."targetId"=t."albumId" AND ub.targetType='album'
  WHERE ub."userId"=%s AND ub.reason = ANY(%s)
```

1. **`mrt_latest` 표시 필터** — 기존 `owned`(UserTrack)에 더해 **`blocked = blocked_track_ids(reasons=['disliked','dismissed'])`** 도 personas/recommended_tracks/recommended_albums에서 제외. (반응한 트랙/앨범이 화면에서 사라짐.)
2. **`search_for_persona`** — `NOT IN (UserTrack)` 절에 **`disliked`만** 추가 제외:
   `AND t.id NOT IN (SELECT "trackId" FROM "UserTrack" WHERE "userId"=%s) AND t.id NOT IN (<blocked disliked trackIds>)`. dismissed는 제외 안 함 → 다음 generation 재추천 가능.
3. **`_run_regenerate_mrt`** — 유저 재생성(commit) 후 **`clear_dismissed(conn, user_id)`** 호출 → dismissed 행 삭제. (새 추천이 옛 dismissed에 막히지 않음.)

### 3.3 API (반응 엔드포인트)

`user_tracks.py`(또는 신규 `reactions.py`)에 추가 — like/pct 패턴 일관:
- `POST /api/user/tracks/{track_id}/dislike` → `block_target(track, 'disliked')` → `{"disliked": true}`
- `POST /api/user/tracks/{track_id}/dismiss` → `block_target(track, 'dismissed')` → `{"dismissed": true}`
- `POST /api/user/tracks/album/{album_id}/dislike` → `block_target(album, 'disliked')` → `{"disliked": true}`
- `POST /api/user/tracks/album/{album_id}/dismiss` → `block_target(album, 'dismissed')` → `{"dismissed": true}`

### 3.4 프론트 (MrtDashboard)

- 트랙 행: 기존 Heart/Sparkles + **ThumbsDown(싫어요)/EyeOff(관심없어요)** 2 아이콘. 클릭 → 해당 엔드포인트 → `getMrtLatest` 재fetch(아이템 사라짐).
- 앨범 행: 기존 담기 버튼 + 싫어요/관심없어요(앨범 단위).
- **풍선 툴팁**(`title` 속성 또는 기존 툴팁 패턴): 좋아요="좋아요 · 라이브러리에 담기", 취향저격="취향저격 · 핵심 취향(PCT)에 추가", 싫어요="싫어요 · 추천에서 영구 제외", 관심없어요="관심없어요 · 이번 추천에서 숨기기". (기존 Heart/Sparkles에도 툴팁 추가.)
- 아이콘은 기존 lucide-react + MrtDashboard 버튼 스타일 재사용(템플릿 보존).

## 4. 범위 밖 (후속)

- **부정 신호의 추천모델 반영**(싫어요→유사곡 덜 추천): `TrackInteraction` 로깅 + SASRec/taste 모델 영역. 이 설계는 **순수 제외**만.
- **클러스터링 영향 없음**: 차단곡은 UserTrack(PGT)이 아니라 페르소나 클러스터에 영향 없음(자연).
- **차단곡 관리/되돌리기 UI**: MRT에서 반응하면 아이템이 떠나므로 그 자리 토글 불필요. 차단 목록/해제 페이지는 후속.
- **아티스트 차단**: `targetType='artist'`로 확장 가능하나 이번 범위는 트랙+앨범.

## 5. 데이터 흐름

1. MRT에서 트랙/앨범에 반응 → 긍정=UserTrack, 부정=UserBlocked(reason) 1행.
2. `mrt_latest`가 owned(UserTrack) + blocked(disliked·dismissed) 제외 → 반응 아이템 즉시 사라짐.
3. 다음 재생성: `search_for_persona`가 disliked 영구 제외(dismissed 제외 안 함) → 새 generation. `_run_regenerate_mrt`가 dismissed 클리어.
4. → 싫어요는 영영 안 나옴, 관심없어요는 다음 사이클에 다시 나올 수 있음.

## 6. 테스트 전략

- **단위(`db/user_blocked.py`):** block_target/clear_dismissed/blocked_track_ids — 트랙·앨범 시드로 trackId 확장(앨범→트랙) 검증.
- **이동/제외:** `mrt_latest`가 disliked·dismissed 트랙/앨범을 제외하는지(seed MRT → dislike → 다음 latest에서 사라짐). search_for_persona가 disliked 제외 / dismissed 미제외.
- **일시 숨김 사이클:** dismiss → mrt_latest 숨김 → `_run_regenerate_mrt` 후 dismissed 클리어 확인.
- **API:** dislike/dismiss(트랙·앨범) 엔드포인트 응답 + UserBlocked 행 생성.

## 7. 구현 순서 (한 plan)

1. **`UserBlocked` 마이그레이션**(reason 컬럼 + unique) + `db/user_blocked.py`.
2. **반응 엔드포인트**(dislike/dismiss × 트랙/앨범).
3. **제외 3지점**(mrt_latest blocked 필터 + search_for_persona disliked + regenerate clear_dismissed).
4. **프론트** 4 아이콘 + 툴팁(트랙·앨범).

## 관련 문서

- [ADR-003](../../decisions/ADR-003-mrt-reactions.md) — 결정 기록
- [ADR-002](../../decisions/ADR-002-pgt-library-mrt-curation.md) — MRT→PGT 이동(display 필터, 이 설계가 부정 반응으로 확장)
- [contents_constructure.md](../../contents_constructure.md) — '내 취향이예요'(PGT+PCT) 원전
- 코드: `src/mrms/api/user_tracks.py`, `src/mrms/api/main.py`(mrt_latest), `src/mrms/recsys/mrt.py`(search_for_persona), `src/mrms/emp/runner.py`(_run_regenerate_mrt)
