# Sub-project B: User Embedding + MRT (Design)

**날짜**: 2026-06-08
**상태**: 디자인 (사용자 리뷰 대기)
**범위**: B-full — 멀티 페르소나 user embedding + MRT (3종) DB 적재 + 갱신 CLI + 검증 CLI

## 1. Goal

A1에서 적재된 `UserTrack`(PCT + PGT)을 기반으로:
1. 사용자별 멀티 페르소나 (K=3) 클러스터링
2. 각 페르소나의 centroid를 256d vector로 저장 (`UserPersona`)
3. 페르소나 가중 평균으로 사용자 전체 vector 저장 (`UserEmbedding`)
4. 각 페르소나로 카탈로그(166k)에서 cosine 검색 → top-20 추천 플레이리스트 × 3개
5. 합쳐서 추천 트랙 / 추천 앨범 derive
6. 1주 2회 cron으로 자동 갱신
7. CLI로 검증 가능

## 2. Success Criteria

```bash
$ python3 scripts/09_generate_mrt.py --email me@example.com
[1/5] UserTrack 임베딩 로드: 334 (PCT 5, PGT 329)
[2/5] K-means clustering (K=3): persona sizes [120, 110, 104]
[3/5] UserEmbedding + UserPersona UPSERT
[4/5] 페르소나별 카탈로그 검색 (HNSW) — 페르소나당 top-20
[5/5] PlaylistHistory 3행 + 통계 derive
✓ 완료 — 추천 트랙 47곡 (dedup), 추천 앨범 12개

$ python3 scripts/09_view_mrt.py --email me@example.com

━━━ 페르소나 0 (120 곡 클러스터) ━━━
 1. Bach: Goldberg Variations - Glenn Gould        sim=0.92
 2. Mozart Symphony No. 40 - ...                    sim=0.91
 ...

━━━ 페르소나 1 (110 곡 클러스터) ━━━
 1. Kind of Blue - Miles Davis                      sim=0.90
 ...

━━━ 추천 트랙 (top-10) ━━━
 1. ... (페르소나별 top score)

━━━ 추천 앨범 (top-5) ━━━
 1. ...
```

**재실행 안전성**: 같은 명령 두 번 → `UserEmbedding`/`UserPersona` UPSERT, `PlaylistHistory` 추가 (history 보존).

**검증**: 본인이 페르소나별 곡 목록 보고 "들어볼만함" 비율 ≥30% (주관 평가).

## 3. Architecture

```
scripts/09_generate_mrt.py [--email X | --all]
  ↓
src/mrms/recsys/persona.py        K-means 클러스터링 + UserEmbedding/UserPersona 적재
src/mrms/recsys/mrt.py            페르소나별 추천 SQL + 결과 derive + PlaylistHistory 적재
src/mrms/db/user_embedding.py     UserEmbedding / UserPersona / PlaylistHistory DB ops

scripts/09_view_mrt.py            검증용 출력 (Rich 콘솔)
```

기존 패턴과 일치:
- `src/mrms/recsys/` (신규 디렉토리, 추천 알고리즘)
- `src/mrms/db/` 기존 + `user_embedding.py` 신규
- 스크립트 `09_*.py` — V1의 `05_*.py`/`06_*.py` 처럼 단발 파이프라인 스텝

## 4. Data Model

### 4.1 기존 Prisma 스키마 그대로 사용 (DDL 추가 필요)

prisma/schema.prisma에 이미 정의되어 있으나 SQL DDL 미적용. 다음 파일로 추가:

`prisma/init/04_user_embedding.sql`:

```sql
-- UserEmbedding (사용자별 단일 vector)
CREATE TABLE IF NOT EXISTS "UserEmbedding" (
    "userId"       TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    "modelVersion" TEXT NOT NULL,
    embedding      vector(256) NOT NULL,
    "computedFrom" INTEGER NOT NULL,    -- 몇 개 트랙 신호로
    "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY ("userId", "modelVersion")
);

CREATE INDEX IF NOT EXISTS idx_userembedding_version
  ON "UserEmbedding"("modelVersion");

-- UserPersona (사용자당 K=3 페르소나 vector)
CREATE TABLE IF NOT EXISTS "UserPersona" (
    id             TEXT PRIMARY KEY,
    "userId"       TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    "personaIdx"   INTEGER NOT NULL,
    embedding      vector(256) NOT NULL,
    "inferredTag"  TEXT,
    "topGenres"    TEXT[] NOT NULL DEFAULT '{}',
    "avgBpm"       REAL,
    "contextHours" INTEGER[] NOT NULL DEFAULT '{}',
    "trackCount"   INTEGER NOT NULL,
    UNIQUE ("userId", "personaIdx")
);

CREATE INDEX IF NOT EXISTS idx_userpersona_user
  ON "UserPersona"("userId");

-- PlaylistHistory (페르소나당 1행, 갱신마다 추가)
CREATE TABLE IF NOT EXISTS "PlaylistHistory" (
    id             TEXT PRIMARY KEY,
    "userId"       TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    "trackIds"     TEXT[] NOT NULL,
    "modelVersion" TEXT NOT NULL,
    context        JSONB,
    "generatedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "playedCount"  INTEGER NOT NULL DEFAULT 0,
    "skipCount"    INTEGER NOT NULL DEFAULT 0,
    "savedCount"   INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_playlisthistory_user_gen
  ON "PlaylistHistory"("userId", "generatedAt" DESC);
```

### 4.2 새 테이블 없음

추천 트랙 / 추천 앨범은 **별도 테이블 없이 derive** (PlaylistHistory의 latest 3행에서):

```sql
-- 추천 트랙 (latest)
WITH latest AS (
  SELECT unnest("trackIds") AS track_id,
         (context->>'personaIdx')::int AS persona_idx
  FROM "PlaylistHistory"
  WHERE "userId" = $1
    AND "generatedAt" > NOW() - INTERVAL '7 days'
  ORDER BY "generatedAt" DESC
  LIMIT 3
)
SELECT track_id, COUNT(DISTINCT persona_idx) AS persona_count
FROM latest
GROUP BY track_id
ORDER BY persona_count DESC
LIMIT 30;

-- 추천 앨범 derive 동일 패턴
```

성능 이슈 시 캐시 테이블 추가 (V2.x).

## 5. Algorithm

### 5.1 K-means 클러스터링

```python
from sklearn.cluster import KMeans

X = fetch_user_track_embeddings(conn, user_id)  # (N, 256) numpy

if len(X) < 3:
    # 트랙 너무 적음 — 클러스터링 skip, 단일 vector만
    raise NotEnoughDataError("최소 3개 UserTrack 필요")

km = KMeans(
    n_clusters=3,
    init='k-means++',
    n_init=10,
    max_iter=300,
    random_state=42,
)
labels = km.fit_predict(X)
centroids = km.cluster_centers_  # (3, 256)

# 각 centroid L2 정규화 (cosine 검색 가정)
centroids = centroids / np.linalg.norm(centroids, axis=1, keepdims=True)
```

### 5.2 UserEmbedding 집계

```python
weights = np.bincount(labels)             # 각 클러스터 크기
user_vector = np.average(centroids, axis=0, weights=weights)
user_vector = user_vector / np.linalg.norm(user_vector)
```

### 5.3 페르소나별 추천 SQL (per centroid)

```sql
SELECT t.id, t.title, a.name AS artist, t."albumId",
       1 - (e.embedding <=> %s::vector) AS similarity
FROM "TrackEmbedding" e
JOIN "Track" t ON t.id = e."trackId"
JOIN "Artist" a ON a.id = t."artistId"
WHERE e."modelVersion" = 'our-v1.0'
  AND t.id NOT IN (
    SELECT "trackId" FROM "UserTrack" WHERE "userId" = %s
  )
ORDER BY e.embedding <=> %s::vector
LIMIT 30;
```

→ 페르소나당 top-30 후 top-20 take (다양성 규칙 없음, baseline).

### 5.4 다양성 규칙

**B 단계**: 없음 (raw cosine).

**향후 (B.x or C)**: 결과 보고 결정.
- b 옵션: 아티스트당 최대 2곡
- c 옵션: MMR (Maximum Marginal Relevance)

### 5.5 추천 트랙 / 추천 앨범 derive

```python
# 60개 (3 페르소나 × 20곡) → dedup → score = max(similarity)
all_recs = collect_all_persona_recs(persona_results)  # [(track_id, similarity, persona_idx), ...]

# 추천 트랙: max similarity 기준 top-30
mrt_tracks = top_by_max_similarity(all_recs, limit=30)

# 추천 앨범: track_id → album_id 매핑 후 album별 트랙 수 집계 top-15
mrt_albums = top_albums_by_track_count(all_recs, limit=15)
```

### 5.6 modelVersion

이번 sub-project가 출력하는 모든 데이터:
- `UserEmbedding.modelVersion` = `"our-v1.0+persona-K3"`
- `PlaylistHistory.modelVersion` = `"our-v1.0+persona-K3"`
- `UserPersona`엔 modelVersion 컬럼 없음 (스키마 그대로)

이후 K 변경 / 알고리즘 변경 시 새 modelVersion 부여 → A/B 비교 가능.

## 6. CLI Commands

### 6.1 `scripts/09_generate_mrt.py`

```bash
# 단일 사용자
python3 scripts/09_generate_mrt.py --email me@example.com

# 모든 사용자 (cron용)
python3 scripts/09_generate_mrt.py --all
```

옵션:
- `--email` — 특정 사용자
- `--all` — DB의 모든 User 순회
- `--k 3` — 클러스터 개수 (기본 3)
- `--persona-top-n 20` — 페르소나당 추천 곡 수 (기본 20)
- `--candidate-pool 30` — 검색 풀 크기 (기본 30)

흐름 (per user):
```
1. UserTrack 임베딩 로드 (n×256)
2. K-means → 3 centroids + labels
3. UserEmbedding UPSERT (집계 vector)
4. UserPersona UPSERT × 3 (centroid, trackCount, ...)
5. 페르소나별 cosine 검색 + 본인 UserTrack 제외
6. PlaylistHistory INSERT × 3 (context={personaIdx, kind:'persona'})
7. conn.commit()
```

`--all` 모드에서 사용자 1명 실패해도 다른 사용자 계속 진행.

### 6.2 `scripts/09_view_mrt.py`

```bash
python3 scripts/09_view_mrt.py --email me@example.com
```

옵션:
- `--email` — 필수
- `--top-n 10` — 페르소나당 표시할 곡 수 (기본 10)

출력:
- 페르소나 0/1/2 헤더 + 곡 목록 (제목, 아티스트, similarity)
- 추천 트랙 top-10 (페르소나 점수 max)
- 추천 앨범 top-5 (트랙 수 기준)

## 7. Scheduling (1주 2회)

OS-level cron 사용. 우리 코드는 단발 실행만 보장.

`docs/cron-setup.md` (가이드 추가):

```bash
crontab -e

# 추가:
# 매주 월/목 오전 3시 MRT 갱신
0 3 * * 1,4 cd "/Volumes/MacExtend 1/MRMS_FN" && .venv/bin/python3 scripts/09_generate_mrt.py --all >> logs/mrt_cron.log 2>&1
```

macOS launchd 사용 시 동일 명령을 plist로 변환 (가이드 문서에 예시).

## 8. Error Handling + Idempotency

### 8.1 트랙 부족

`UserTrack` < 3개 → `NotEnoughDataError` 발생, 해당 사용자 skip (--all 모드 시).

### 8.2 K-means 수렴 실패

n_init=10이라 보통 수렴. 극단적 경우 KMeans 자체 경고 → 로그 남기고 정상 결과 사용.

### 8.3 DB 트랜잭션

- UserEmbedding/UserPersona는 UPSERT — 재실행 안전
- PlaylistHistory는 INSERT only — 매번 새 행 (history)
- 각 사용자 단위 commit (--all 모드에서 한 사용자 실패가 다른 사용자에 영향 X)

### 8.4 멱등성

- 같은 분에 두 번 실행 → UserEmbedding 같음, PlaylistHistory 2 generation 행 추가
- 다음 view 명령 결과 동일 (latest 3행 = 두 번째 실행 결과)

## 9. Testing

### 9.1 단위 (mock DB)

- K-means with synthetic embeddings (e.g., 3 well-separated Gaussian clusters)
  - 예상 centroids 검증
  - labels 분포 검증
- UserEmbedding 집계: weighted average 수식 검증 (numerical)
- 추천 트랙 derive: dedup + max similarity 정렬 검증
- 추천 앨범 derive: track→album 집계 검증

### 9.2 통합 (실제 DB)

- 본인 데이터로 generate → DB 행 수 확인 (UserEmbedding 1, UserPersona 3, PlaylistHistory 3)
- 재실행 → 같은 UserEmbedding/UserPersona, PlaylistHistory +3 (총 6)
- view 명령 → top-10 트랙 출력, 본인이 검증

### 9.3 사전 조건 검증

- TrackEmbedding 166k+ 적재됨
- UserTrack 적재됨 (A1 완료 상태)
- pgvector extension active
- HNSW 인덱스 존재 (`idx_embedding_hnsw`)

## 10. Out of Scope

- ❌ `UserPersona.inferredTag` 자동 생성 ("운동용" / "잠들기") — context 모델 필요
- ❌ `UserPersona.avgBpm` / `topGenres` / `contextHours` 채우기 — features 기반 enrichment
- ❌ 다양성 규칙 b/c (artist max 2 / MMR)
- ❌ MrtTrack / MrtAlbum 캐시 테이블
- ❌ UI / 웹 화면 (E 단계)
- ❌ 사용자 피드백 루프 (재생/스킵 → 모델 재학습) — TrackInteraction 채울 후
- ❌ Re-clustering 자동 트리거 (UserTrack 변경량 기준)
- ❌ A/B 테스트 (multi-model)
- ❌ explicit content 필터링 (User.explicit 활용)
- ❌ 국가별 가용성 필터링 (TrackPlatform.regions)
- ❌ 비밀번호/로그인 (다중 사용자 인증) — A1과 동일하게 본인 환경 가정

## 11. 파일 변경 목록

### 신규
- `prisma/init/04_user_embedding.sql` (UserEmbedding + UserPersona + PlaylistHistory DDL)
- `src/mrms/recsys/__init__.py`
- `src/mrms/recsys/persona.py` (~150줄: K-means + UserEmbedding/UserPersona 적재)
- `src/mrms/recsys/mrt.py` (~200줄: 페르소나별 검색 + derive + PlaylistHistory 적재)
- `src/mrms/db/user_embedding.py` (~120줄: DB ops)
- `scripts/09_generate_mrt.py` (~100줄: CLI)
- `scripts/09_view_mrt.py` (~80줄: 검증 CLI)
- `docs/cron-setup.md` (cron/launchd 가이드)
- `tests/recsys/__init__.py`
- `tests/recsys/test_persona.py`
- `tests/recsys/test_mrt.py`
- `tests/db/test_user_embedding.py`

### 수정
- `pyproject.toml`: `scikit-learn>=1.4` 추가 (K-means)

## 12. 가정 + 명시적 결정

- 사용자(본인) 머신에서 실행. cron은 본인 시스템에 등록
- UserTrack 적어도 3개 이상 (A1에서 본인 데이터 334개 OK)
- TrackEmbedding modelVersion='our-v1.0' 유지 (V1과 호환)
- PCT는 K-means에서 PGT와 동일 처리 (코어 표시는 UI/badge 영역의 일)
- modelVersion 변경 시 데이터 분리 (A/B 가능)
- PlaylistHistory는 history — 자동 삭제 없음 (성장 시 V2.x에서 retention 정책)

## 13. 구현 시 검증 필요 사항

1. **pgvector cosine 연산자 (`<=>`)와 L2 정규화 임베딩 적합성**
   - 우리 TrackEmbedding은 L2 정규화됨 (V1 학습 시)
   - centroid도 L2 정규화 후 검색 → 코사인 유사도 = `1 - distance`
   - 첫 실행 시 SELECT로 sample similarity 값 확인

2. **HNSW 검색 성능**
   - 페르소나당 1쿼리 × 3 → P95 < 30ms 예상
   - 측정 후 인덱스 efSearch 조정 가능 (현재 64)

3. **K-means 안정성**
   - n_init=10 + random_state=42 → 재현 가능
   - 사용자별 트랙 수 < 30 시 클러스터 품질 저하 가능 — 일단 동작 보고 가이드 결정

## 14. 후속 작업 (B 이후)

- **B.1**: 다양성 규칙 (artist max 2 또는 MMR) — 결과 보고
- **B.2**: `inferredTag` + avgBpm/topGenres 자동 enrichment (features 활용)
- **C**: Two-Tower 학습 (UserEmbedding을 더 정확하게)
- **D**: EMP 확장 (Tier 2 플랫폼 크롤러)
- **E**: 플레이어 UI + 비주얼 EQ
