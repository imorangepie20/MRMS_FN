# Sub-project A1: Tidal Onboarding (Design)

**날짜**: 2026-06-08
**상태**: 디자인 (사용자 리뷰 대기)
**범위**: 단일 사용자 (개발자 본인) CLI로 Tidal OAuth + 좋아요 + 본인 플레이리스트 import → PGT/PCT 시드 구축

## 1. Goal + 사용자 의도

본인의 주력 스트리밍 플랫폼이 Tidal이므로, **본인 실제 청취 데이터로 user embedding 품질을 검증**하기 위해 Tidal 먼저 선택. Spotify는 동일 추상화로 A1.1 단계에서 추가.

CLI 한 번 실행으로:
1. 본인 Tidal 계정 OAuth 인증
2. 좋아요한 트랙 + 본인 플레이리스트 fetch
3. 우리 카탈로그(166k Track)에 ISRC로 매칭
4. 매칭된 트랙을 `UserTrack` 테이블에 적재 (PCT/PGT 구성)
5. 미매칭 트랙은 카운트만 로깅

## 2. Success Criteria

```bash
$ python3 scripts/08_onboard_tidal.py --email me@example.com

[1/3] Auth: 브라우저 자동 오픈 → Tidal 로그인 → 토큰 발급 ✓
[2/3] 좋아요 트랙 fetch: 247개 (카탈로그 매칭 142, ISRC 없음 3, 미존재 102)
[3/3] 플레이리스트 12개 → 트랙 386개 (매칭 198)
✓ UserTrack 적재: 287 (isCore=true: 142, isCore=false: 145)

# DB 검증
$ docker compose exec pg psql -U mrms -d mrms -c '
  SELECT t.title, a.name, ut."isCore", ut.source
  FROM "UserTrack" ut
  JOIN "Track" t ON t.id = ut."trackId"
  JOIN "Artist" a ON a.id = t."artistId"
  WHERE ut."userId" = (SELECT id FROM "User" WHERE email = $$me@example.com$$)
  LIMIT 10;
'
→ 본인이 실제 Tidal에서 좋아요한 트랙들이 보임
```

**재실행 안전성**: 같은 명령 두 번 돌려도 row 수 변화 없음 (UPSERT).

## 3. Tidal API의 함정 + 대응

Tidal은 Spotify보다 까다로움. 디자인에 명시적 대응:

| 함정 | 대응 |
|---|---|
| **JSON:API 응답 구조** (data + included + relationships) | `_parse_jsonapi` 헬퍼 — `data[i]` + `included` 매칭으로 평탄화 |
| **v1/v2 엔드포인트 혼재** | v2 우선 (`openapi.tidal.com/v2/...`), v1 fallback 안 함 (응답 형식 다름 → 복잡도 ↑) |
| **공식 SDK 없음** | raw httpx, 모든 응답 dict로 처리 |
| **국가 제한** | 본인 country code (Tidal 계정 설정의 국가)로 요청, 카탈로그 외 트랙은 자연스럽게 skip |
| **ISRC 필드 위치** | v2에서 `attributes.isrc` — 다른 곳에 있으면 skip |
| **redirect_uri HTTPS 필수** | Cloudflare Tunnel `mrms.approid.team` (이미 셋업됨) |
| **scope 변동** | `.env`의 TIDAL_SCOPES 사용, 응답 검증 |
| **페이지네이션** | cursor 기반 — `links.next` 따라가기 |

## 4. Architecture

```
scripts/08_onboard_tidal.py             CLI orchestrator (~80줄)
  ↓ uses
src/mrms/auth/tidal.py                  OAuth client (PKCE) + 토큰 관리
src/mrms/auth/callback_server.py        단발 로컬 HTTP 콜백 서버 (재사용 가능)
src/mrms/sync/tidal_importer.py         Tidal API → DB import 로직
src/mrms/sync/jsonapi.py                JSON:API 응답 평탄화 헬퍼
src/mrms/db/user_track.py               UserTrack 테이블 액세스 레이어

scripts/08_onboard_tidal.py 흐름:
  ├── User row 조회/생성 (email)
  ├── TidalOAuthClient.authorize() → UserOAuth UPSERT
  ├── TidalImporter.import_all() → UserTrack UPSERT 배치
  └── 요약 통계 출력
```

기존 패턴과 일치: `src/mrms/ingest/*.py`는 외부 데이터 클라이언트, `src/mrms/auth/`와 `src/mrms/sync/`는 인증/사용자 동기화 책임.

## 5. Data Model

### 5.1 새 테이블: UserTrack

```sql
CREATE TABLE "UserTrack" (
    id        TEXT PRIMARY KEY,
    "userId"  TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    "trackId" TEXT NOT NULL REFERENCES "Track"(id) ON DELETE CASCADE,
    "isCore"  BOOLEAN NOT NULL,    -- true = PCT 멤버
    source    TEXT NOT NULL,        -- 'liked' | 'playlist:<title>'
    platform  TEXT NOT NULL,        -- 'tidal' (A1.1에서 'spotify' 추가)
    "addedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE ("userId", "trackId")
);
CREATE INDEX idx_usertrack_user_core ON "UserTrack"("userId", "isCore");
CREATE INDEX idx_usertrack_user_platform ON "UserTrack"("userId", platform);
```

### 5.2 Conflict 규칙

같은 트랙이 좋아요 + 플레이리스트 둘 다에 있을 때:

```sql
ON CONFLICT ("userId", "trackId") DO UPDATE SET
  "isCore" = "UserTrack"."isCore" OR EXCLUDED."isCore",
  source = CASE
    WHEN EXCLUDED.source = 'liked' THEN 'liked'
    ELSE "UserTrack".source
  END
```

좋아요 신호가 플레이리스트보다 강함. `isCore`은 한 번 true가 되면 유지.

### 5.3 기존 테이블 활용

- `User` (Prisma 정의됨): id, email, displayName, country, createdAt
- `UserOAuth` (Prisma 정의됨): userId, platform, accessToken, refreshToken, expiresAt, scope

토큰은 평문 저장 (A1 단일 사용자 + 본인 머신 DB). 다중 사용자 단계에서 암호화 도입.

## 6. OAuth Flow (PKCE)

Tidal은 redirect_uri HTTPS 강제. Cloudflare Tunnel 사용 (이미 셋업됨).

### 6.1 사전 조건 확인

- Tidal Developer Dashboard에 redirect URI 등록됨: `https://mrms.approid.team/callback/tidal` ✓
- Cloudflare Tunnel 실행: `mrms.approid.team` → `localhost:8080` ✓
- `.env`의 `TIDAL_CLIENT_ID`, `TIDAL_CLIENT_SECRET`, `TIDAL_REDIRECT_URI`, `TIDAL_SCOPES` 설정됨 ✓

### 6.2 Flow 단계

```
1. CLI가 PKCE pair 생성:
   - code_verifier: 랜덤 64자 [A-Za-z0-9_~.-]
   - code_challenge: sha256(verifier) → base64url, no padding

2. CallbackServer 시작 (127.0.0.1:8080)
   - 단발 GET /callback/tidal 핸들러
   - 응답 수신 후 자체 종료

3. 브라우저 자동 오픈:
   https://login.tidal.com/authorize?
     response_type=code&
     client_id=<TIDAL_CLIENT_ID>&
     redirect_uri=https://mrms.approid.team/callback/tidal&
     scope=<TIDAL_SCOPES>&
     code_challenge=<HASH>&
     code_challenge_method=S256&
     state=<RANDOM_32>

4. 사용자 Tidal 로그인 + 권한 동의

5. Tidal → https://mrms.approid.team/callback/tidal?code=XXX&state=YYY
   → Cloudflare Tunnel → localhost:8080
   콜백 서버가 state 검증 후 code 추출, 응답 페이지 표시, 서버 종료

6. 토큰 교환:
   POST https://auth.tidal.com/v1/oauth2/token
     grant_type=authorization_code,
     code=XXX,
     redirect_uri=https://mrms.approid.team/callback/tidal,
     client_id=<>,
     code_verifier=<>
   → access_token + refresh_token + expires_in (보통 86400 = 24h)

7. UserOAuth UPSERT (userId, platform='tidal', tokens, scopes)
```

### 6.3 Scope 매핑 (A1에 필요한 것)

`.env`의 TIDAL_SCOPES 중 A1 필수:
- `user.read` — 계정 정보 (국가, 이메일)
- `collection.read` — My Collection (좋아요 트랙)
- `playlists.read` — 본인 플레이리스트

`collection.write`, `playlists.write`, `playback`, `search.*` 등은 A1엔 불필요. **A1 CLI는 위 3개만 요청** (사용자 동의 화면에서 권한 줄임).

## 7. Import Pipeline

### 7.1 사용자 정보 fetch (국가 코드 + 이메일)

```
GET https://openapi.tidal.com/v2/users/me
Authorization: Bearer <access_token>

→ JSON:API 응답:
{
  "data": {
    "id": "...",
    "type": "users",
    "attributes": {
      "country": "KR",
      "email": "...",
      "displayName": "..."
    }
  }
}

User 행에 country/displayName 업데이트.
```

### 7.2 좋아요 트랙 (My Collection)

```
GET https://openapi.tidal.com/v2/userCollections/{userId}/relationships/tracks
  ?countryCode=KR&locale=en-US&include=tracks&page[cursor]=...

→ JSON:API 응답:
{
  "data": [{ "id": "<trackId>", "type": "tracks" }, ...],
  "included": [
    {
      "id": "<trackId>",
      "type": "tracks",
      "attributes": {
        "isrc": "USXXX...",
        "title": "...",
        "duration": 245,
        ...
      },
      "relationships": { ... }
    },
    ...
  ],
  "links": { "next": "..." }
}

cursor 따라가며 모든 페이지.
각 트랙 attributes.isrc 추출 → Track 테이블 ISRC 매칭.

매칭: UserTrack UPSERT (isCore=true, source='liked', platform='tidal')
ISRC 없음 / 카탈로그 미존재: 카운트
```

### 7.3 본인 플레이리스트

```
GET https://openapi.tidal.com/v2/playlists?filter[r.owners.id]=<userId>
  &countryCode=KR&include=owners&page[cursor]=...

→ 본인 소유 플레이리스트 목록 (id, title, owner)

각 플레이리스트별:
  GET https://openapi.tidal.com/v2/playlists/{id}/relationships/items
    ?countryCode=KR&include=items&page[cursor]=...
  → 트랙 페이지네이션 (좋아요와 동일 패턴)

각 트랙 매칭 + UserTrack UPSERT (isCore=false, source=f'playlist:{title}', platform='tidal')
```

### 7.4 JSON:API 평탄화 헬퍼

```python
# src/mrms/sync/jsonapi.py
def flatten_jsonapi(response: dict, focus_type: str | None = None) -> list[dict]:
    """JSON:API 응답을 [{ id, type, ...attributes }] 리스트로 변환.

    data + included 통합 + ID 기준 dedup (included가 더 풍부한 attributes 보유).
    focus_type 지정 시 해당 type만 반환 (예: 'tracks' / 'playlists').
    relationships는 무시 (필요시 별도 추출).

    Tidal 패턴 — collection/playlist 트랙 fetch:
      - data: relationship 레코드 (attributes 비어있을 수 있음)
      - included (include=items): 실제 track resource (attributes.isrc 등)
    """
    items: dict[str, dict] = {}
    for entry in (response.get("data") or []) + (response.get("included") or []):
        if focus_type and entry.get("type") != focus_type:
            continue
        eid = entry["id"]
        merged = items.get(eid, {})
        attrs = entry.get("attributes") or {}
        items[eid] = {
            "id": eid,
            "type": entry["type"],
            **merged,
            **attrs,  # included의 attrs가 우선 (더 풍부함)
        }
    return list(items.values())


def get_next_cursor(response: dict) -> str | None:
    next_link = (response.get("links") or {}).get("next")
    if not next_link:
        return None
    from urllib.parse import urlparse, parse_qs
    qs = parse_qs(urlparse(next_link).query)
    # Tidal next URL은 보통 page[cursor]=... 형식
    return qs.get("page[cursor]", [None])[0]
```

### 7.5 통계 누적

```python
@dataclass
class ImportStats:
    liked_fetched: int = 0
    liked_matched: int = 0
    liked_no_isrc: int = 0
    liked_not_in_catalog: int = 0
    playlists_fetched: int = 0
    playlist_tracks_fetched: int = 0
    playlist_tracks_matched: int = 0
    playlist_tracks_no_isrc: int = 0
    playlist_tracks_not_in_catalog: int = 0
    user_tracks_upserted: int = 0
    user_tracks_is_core: int = 0
```

## 8. Error Handling + Idempotency

### 8.1 토큰 관리

- 호출 직전 `expires_at - 60s` 체크 → 만료 임박이면 refresh
- POST `https://auth.tidal.com/v1/oauth2/token` with `grant_type='refresh_token'`
- 새 토큰 받으면 UserOAuth UPDATE
- API 호출 중 401 → 한 번 더 refresh + retry

### 8.2 Rate Limit / 네트워크

- HTTP 429 → `Retry-After` 헤더 읽고 그만큼 sleep, max 60초 (초과시 abort)
- HTTP 5xx → tenacity 지수 백오프 (3회)
- `httpx.TimeoutException` / `ConnectError` → 동일 재시도
- HTTP 4xx (401/403 외) → 개별 트랙/페이지 skip, 전체는 진행

### 8.3 Tidal-특이 응답 처리

- 응답이 빈 `data: []` → 정상 종료 (이 사용자에게 데이터 없음)
- 응답에 `errors` 키 있음 → 메시지 로깅 + abort 또는 retry (코드별)
- `included` 누락 (relationships만 있음) → 별도 GET 호출로 보완 안 함 (skip)
- `attributes.isrc` 누락 → no_isrc 카운트, skip

### 8.4 멱등성

- 모든 DB 작업 UPSERT (`ON CONFLICT DO UPDATE`)
- 재실행 시: 토큰 valid면 refresh 안 함, 좋아요 다시 fetch (새로 좋아요한 트랙 추가됨)
- 같은 트랙 재import: 위 conflict 규칙대로 isCore/source 머지
- 더 이상 좋아요 안 한 곡은 UserTrack에서 자동 삭제 안 함 (V2 sync 로직)

## 9. Testing

### 9.1 단위 (mock Tidal API)

- JSON:API 평탄화: data + included 다양한 케이스
- ISRC 매칭: 정상 / null / 미존재 각각
- Conflict 머지: liked + playlist → isCore=true, source='liked'
- 토큰 refresh 트리거: expires_at 임박 시
- Pagination: 3페이지 cursor 따라가며 모든 트랙 수집
- 빈 응답 처리: `data: []`로 정상 종료
- `errors` 키 응답: 적절한 에러 발생

### 9.2 통합 (실제 본인 Tidal 계정)

- 1차 실행 → DB row 수 N 기록
- 2차 실행 (즉시) → row 수 N 동일
- SELECT 결과 → 본인이 직접 알고 있는 좋아요 트랙 일부 확인

### 9.3 사전 조건 검증

- `tidalapi` 같은 외부 라이브러리 없음 — 우리 코드만으로
- 토큰 유효 → API 호출 200
- 토큰 만료 시뮬레이션 → 자동 refresh 동작

## 10. Out of Scope

- ❌ Spotify (A1.1 — 동일 추상화로 추가)
- ❌ 다중 사용자 회원가입 / 로그인 / 세션
- ❌ 저장 앨범, 팔로우 아티스트, 최근 청취 이력
- ❌ 카탈로그 미존재 트랙 자동 fetch + audio + embedding 추가
- ❌ 토큰 암호화 / KMS / Vault 연동
- ❌ Background sync (cron / 주기적 갱신)
- ❌ "내 취향이에요" 버튼 UX (UI 단계)
- ❌ Web UI / Frontend
- ❌ 좋아요 취소 동기화 (sync 단계에서 결정)

## 11. 파일 변경 목록

### 신규
- `src/mrms/auth/__init__.py`
- `src/mrms/auth/tidal.py` (~180줄: PKCE + 토큰 + refresh)
- `src/mrms/auth/callback_server.py` (~80줄: 단발 HTTP listener)
- `src/mrms/sync/__init__.py`
- `src/mrms/sync/jsonapi.py` (~40줄: JSON:API 평탄화)
- `src/mrms/sync/tidal_importer.py` (~250줄: fetch + match + UPSERT)
- `src/mrms/db/user_track.py` (~60줄: UserTrack DB ops)
- `prisma/init/03_user_track.sql` (UserTrack DDL)
- `scripts/08_onboard_tidal.py` (~80줄 CLI orchestrator)
- `tests/auth/test_tidal_oauth.py`
- `tests/sync/test_jsonapi.py`
- `tests/sync/test_tidal_importer.py`

### 수정
- `pyproject.toml`: 추가 의존성 없음 (httpx + tenacity 이미 있음)

### 검증용
- `scripts/08_verify_onboarding.py` (~30줄, 선택): UserTrack 분포 + 매칭률 출력

## 12. 가정 + 명시적 결정

- 사용자(본인) 머신에서만 실행. DB는 localhost 5433 docker
- Tidal dev app 상태 그대로 (production 신청 불필요)
- 토큰 평문 DB 저장 — A1 한정 의도된 결정
- "본인 플레이리스트"는 본인 소유만 (협업 멤버는 V2)
- 카탈로그 미매칭 트랙은 **버림** (로그만 — V2에서 fetch+embed 처리 결정)
- 좋아요 취소된 트랙은 **DB에서 자동 삭제 안 함** (V2 sync 단계)
- 국가 코드는 GET /v2/users/me 응답의 attributes.country 동적 사용 (KR 등)

## 14. 구현 시 검증 필요 사항

다음은 spec 작성 시점 기준 추정이며, 구현 시 첫 작업으로 실제 동작 확인 필요:

1. **Tidal API 정확한 엔드포인트 경로**
   - 좋아요/My Collection 트랙: 위 spec에서 `userCollections/{userId}/relationships/tracks` 가정 — 실제 path 다를 수 있음
   - 본인 플레이리스트 필터: `filter[r.owners.id]=<userId>` 가정 — Tidal v2 OpenAPI 문서로 검증
   - **첫 작업**: 본인 토큰으로 curl 호출 → 실제 응답 구조 확인 후 spec 업데이트 또는 코드 조정

2. **ISRC 필드 정확한 위치**
   - 가정: `attributes.isrc`
   - 실제 응답에서 다른 위치면 (예: `attributes.extras.isrc`) helper 조정

3. **scope 응답 형식**
   - 토큰 응답의 `scope` 필드 형식 (공백 구분 vs 콤마)
   - UserOAuth.scope에 String[]으로 저장 시 split 필요

## 13. 후속 작업

- **A1.1**: 동일 디자인 + `src/mrms/auth/spotify.py` + `src/mrms/sync/spotify_importer.py` 추가. CLI: `scripts/09_onboard_spotify.py` — Tidal보다 간단 (loopback redirect, JSON 단순)
- **A2 후보 (B/C/D 중)**:
  - B: PGT/PCT 관리 UI
  - C: User Embedding 생성 → V1 추천 모델과 통합
  - D: EMP 확장 (크롤러)
