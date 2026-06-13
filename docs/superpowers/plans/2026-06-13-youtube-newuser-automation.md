# YouTube 신규 유저 자동화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** YouTube 미스곡 임베딩 + MRT 재생성을 기존 EMP 파이프라인 스테이지로 통합해, 신규 유저가 추가 수동작업 없이 22%→~99% 취향 커버리지로 자동 수렴하게 한다.

**Architecture:** (1) 3곳 중복된 MRT 생성 로직을 `mrms.recsys.mrt.generate_user_mrt` 단일 함수로 추출(DRY). (2) `run_pipeline`에 `youtube_misses`(script 13 다운로드 + 캐시우회 03 추출)와 `regenerate_mrt`(stale 유저만 in-process 재생성) 스테이지 추가. (3) stale 판정 = `현재 임베딩 보유 UserTrack 수 > UserEmbedding.computedFrom`. 두 스테이지는 `append_stage`로 `/admin/emp`에 자동 노출.

**Tech Stack:** Python, psycopg(raw SQL), pgvector, scikit-learn KMeans, MERT(subprocess), 기존 `mrms.emp.runner`/`mrms.db.emp` 파이프라인 프레임워크.

**근거 문서:** [ADR-001](../../decisions/ADR-001-youtube-newuser-automation.md) · [설계 spec](../specs/2026-06-13-youtube-newuser-automation-design.md)

---

## File Structure

| 파일 | 책임 | 변경 |
|---|---|---|
| `src/mrms/recsys/mrt.py` | MRT 검색 + **공유 생성 함수 + stale 판정 + 상수** | 수정(추가) |
| `src/mrms/onboarding/pipeline.py` | 온보딩 orchestration | 수정(MRT 블록 → 공유 함수 호출) |
| `scripts/09_generate_mrt.py` | MRT CLI | 수정(공유 함수 호출) |
| `src/mrms/emp/runner.py` | 파이프라인 runner | 수정(2 스테이지 + 헬퍼) |
| `tests/recsys/test_user_mrt.py` | 공유 함수·stale 판정 테스트 | 신규 |
| `tests/emp/test_runner.py` | 파이프라인 스테이지 테스트 | 수정(신규 스테이지 assert) |
| `docs/cron-setup.md`, ADR-001 | 문서 | 수정 |

**상수 단일 출처(mrt.py):** `MODEL_VERSION = f"{EMBEDDING_MODEL_VERSION}+persona-K3"`, `CATALOG_MODEL_VERSION = EMBEDDING_MODEL_VERSION`, `DEFAULT_K=3`, `DEFAULT_TOP_N=20`, `DEFAULT_CANDIDATE_POOL=30`. `pipeline.py`·`scripts/09`는 이걸 import.

---

## Task 1: 공유 MRT 생성 함수 `generate_user_mrt` 추출 (DRY 핵심)

**Files:**
- Modify: `src/mrms/recsys/mrt.py`
- Test: `tests/recsys/test_user_mrt.py`

- [ ] **Step 1: 실패 테스트 작성** — `tests/recsys/test_user_mrt.py`

```python
"""generate_user_mrt + select_stale_mrt_users — 공유 MRT 생성/판정."""
import numpy as np
import pytest
from pgvector.psycopg import register_vector

from mrms.db.ids import stable_id as _id
from mrms.config import EMBEDDING_MODEL_VERSION

CATALOG = EMBEDDING_MODEL_VERSION
MV = f"{EMBEDDING_MODEL_VERSION}+persona-K3"


def _seed_user_with_tracks(conn, n_tracks: int) -> str:
    """User + n개 Track(+Artist) + TrackEmbedding(256d, inEmp) + UserTrack 생성. user_id 반환."""
    register_vector(conn)
    user_id = _id("test|mrtuser")
    artist_id = _id("test|mrtartist")
    with conn.cursor() as cur:
        cur.execute('INSERT INTO "User" (id, email) VALUES (%s,%s) ON CONFLICT (id) DO NOTHING',
                    (user_id, "mrt-test@auto.local"))
        cur.execute('INSERT INTO "Artist" (id, name, "nameNormalized") VALUES (%s,%s,%s) ON CONFLICT (id) DO NOTHING',
                    (artist_id, "MRT Test Artist", "mrt test artist"))
        for i in range(n_tracks):
            tid = _id(f"test|mrttrack|{i}")
            cur.execute('''INSERT INTO "Track" (id, isrc, title, "titleNormalized", "durationMs", "artistId", "inEmp")
                           VALUES (%s,%s,%s,%s,%s,%s,TRUE) ON CONFLICT (id) DO NOTHING''',
                        (tid, f"TESTISRC{i:08d}", f"t{i}", f"t{i}", 0, artist_id))
            vec = np.zeros(256, dtype=np.float32); vec[i % 256] = 1.0  # 분산된 단위벡터
            cur.execute('''INSERT INTO "TrackEmbedding" (id, "trackId", "modelVersion", embedding, pooling, "audioSource")
                           VALUES (%s,%s,%s,%s,%s,%s) ON CONFLICT ("trackId","modelVersion") DO NOTHING''',
                        (_id(f"te|{tid}"), tid, CATALOG, vec, "attention", "mp3_30s"))
            cur.execute('''INSERT INTO "UserTrack" (id, "userId", "trackId", "isCore", source, platform)
                           VALUES (%s,%s,%s,FALSE,%s,%s) ON CONFLICT ("userId","trackId") DO NOTHING''',
                        (_id(f"ut|{user_id}|{tid}"), user_id, tid, "playlist:test", "youtube"))
    conn.commit()
    return user_id


def test_generate_user_mrt_creates_personas_and_history(db_conn, cleanup):
    from mrms.recsys.mrt import generate_user_mrt, MODEL_VERSION
    uid = _seed_user_with_tracks(db_conn, n_tracks=6)
    n = generate_user_mrt(db_conn, uid, k=3)
    db_conn.commit()
    assert n == 6
    with db_conn.cursor() as cur:
        cur.execute('SELECT count(*) FROM "UserPersona" WHERE "userId"=%s', (uid,))
        assert cur.fetchone()[0] == 3
        cur.execute('SELECT "computedFrom" FROM "UserEmbedding" WHERE "userId"=%s AND "modelVersion"=%s',
                    (uid, MODEL_VERSION))
        assert cur.fetchone()[0] == 6
        cur.execute('SELECT count(*) FROM "PlaylistHistory" WHERE "userId"=%s', (uid,))
        assert cur.fetchone()[0] == 3
    cleanup('DELETE FROM "PlaylistHistory" WHERE "userId"=%s', (uid,))
    cleanup('DELETE FROM "UserPersona" WHERE "userId"=%s', (uid,))
    cleanup('DELETE FROM "UserEmbedding" WHERE "userId"=%s', (uid,))
    cleanup('DELETE FROM "UserTrack" WHERE "userId"=%s', (uid,))


def test_generate_user_mrt_skips_when_below_k(db_conn, cleanup):
    from mrms.recsys.mrt import generate_user_mrt
    uid = _seed_user_with_tracks(db_conn, n_tracks=2)
    assert generate_user_mrt(db_conn, uid, k=3) is None
    cleanup('DELETE FROM "UserTrack" WHERE "userId"=%s', (uid,))
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pytest tests/recsys/test_user_mrt.py -v`
Expected: FAIL — `ImportError: cannot import name 'generate_user_mrt'`

- [ ] **Step 3: `mrt.py`에 상수 + `fetch_user_track_matrix` + `generate_user_mrt` 추가**

`src/mrms/recsys/mrt.py` 상단 import 아래(`from mrms.config import EMBEDDING_MODEL_VERSION` 다음)에 추가:

```python
MODEL_VERSION = f"{EMBEDDING_MODEL_VERSION}+persona-K3"
CATALOG_MODEL_VERSION = EMBEDDING_MODEL_VERSION
DEFAULT_K = 3
DEFAULT_TOP_N = 20
DEFAULT_CANDIDATE_POOL = 30
```

`search_for_persona` 함수 아래에 추가:

```python
def fetch_user_track_matrix(
    conn: psycopg.Connection,
    user_id: str,
    catalog_model_version: str = CATALOG_MODEL_VERSION,
) -> tuple[list[str], np.ndarray]:
    """UserTrack의 256d 임베딩 행렬 (track_ids, X(N,256))."""
    _ensure_vector_registered(conn)
    with conn.cursor() as cur:
        cur.execute(
            '''SELECT ut."trackId", e.embedding
               FROM "UserTrack" ut
               JOIN "TrackEmbedding" e ON e."trackId" = ut."trackId"
               WHERE ut."userId" = %s AND e."modelVersion" = %s''',
            (user_id, catalog_model_version),
        )
        rows = cur.fetchall()
    if not rows:
        return [], np.zeros((0, 256), dtype=np.float32)
    track_ids = [r[0] for r in rows]
    embs: list[np.ndarray] = []
    for r in rows:
        v = r[1]
        if isinstance(v, str):
            v = np.fromstring(v.strip("[]"), sep=",", dtype=np.float32)
        embs.append(np.asarray(v, dtype=np.float32))
    return track_ids, np.vstack(embs)


def generate_user_mrt(
    conn: psycopg.Connection,
    user_id: str,
    *,
    k: int = DEFAULT_K,
    top_n: int = DEFAULT_TOP_N,
    candidate_pool: int = DEFAULT_CANDIDATE_POOL,
) -> int | None:
    """UserTrack 임베딩 → cluster → UserEmbedding/UserPersona → search → PlaylistHistory.

    반환: 사용한 트랙 수(성공) / None(트랙<k → skip). **커밋은 호출자 책임.**
    run_onboarding·scripts/09·regenerate_mrt 스테이지가 공유한다 (단일 출처).
    """
    from mrms.db.user_embedding import (
        insert_playlist_history,
        upsert_user_embedding,
        upsert_user_persona,
    )
    from mrms.recsys.persona import aggregate_user_vector, cluster_user_tracks

    track_ids, X = fetch_user_track_matrix(conn, user_id)
    if len(track_ids) < k:
        return None

    result = cluster_user_tracks(X, k=k)
    user_vec = aggregate_user_vector(result.centroids, result.weights)
    upsert_user_embedding(conn, user_id, MODEL_VERSION, user_vec, computed_from=len(track_ids))
    for idx in range(k):
        upsert_user_persona(
            conn, user_id, persona_idx=idx,
            embedding=result.centroids[idx], track_count=int(result.weights[idx]),
        )
    for idx in range(k):
        recs = search_for_persona(
            conn, user_id, result.centroids[idx],
            catalog_model_version=CATALOG_MODEL_VERSION,
            candidate_pool=candidate_pool, top_n=top_n,
        )
        insert_playlist_history(
            conn, user_id, [r["track_id"] for r in recs], MODEL_VERSION,
            context={"personaIdx": idx, "kind": "persona",
                     "scores": [r["similarity"] for r in recs]},
        )
    return len(track_ids)
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pytest tests/recsys/test_user_mrt.py -v`
Expected: PASS (2 passed)

- [ ] **Step 5: 커밋**

```bash
git add src/mrms/recsys/mrt.py tests/recsys/test_user_mrt.py
git commit -m "feat(recsys): generate_user_mrt 공유 함수 추출 (DRY)"
```

---

## Task 2: stale MRT 유저 판정 `select_stale_mrt_users`

**Files:**
- Modify: `src/mrms/recsys/mrt.py`
- Test: `tests/recsys/test_user_mrt.py`

- [ ] **Step 1: 실패 테스트 추가** — `tests/recsys/test_user_mrt.py` 끝에 추가

```python
def test_select_stale_mrt_users(db_conn, cleanup):
    from mrms.recsys.mrt import generate_user_mrt, select_stale_mrt_users
    uid = _seed_user_with_tracks(db_conn, n_tracks=6)
    # MRT 아직 없음 → stale (computedFrom 없음, baseline 0)
    assert uid in select_stale_mrt_users(db_conn, k=3)
    # MRT 생성 후 → 더 이상 stale 아님 (computedFrom=6 == 현재 6)
    generate_user_mrt(db_conn, uid, k=3); db_conn.commit()
    assert uid not in select_stale_mrt_users(db_conn, k=3)
    cleanup('DELETE FROM "PlaylistHistory" WHERE "userId"=%s', (uid,))
    cleanup('DELETE FROM "UserPersona" WHERE "userId"=%s', (uid,))
    cleanup('DELETE FROM "UserEmbedding" WHERE "userId"=%s', (uid,))
    cleanup('DELETE FROM "UserTrack" WHERE "userId"=%s', (uid,))
```

- [ ] **Step 2: 실패 확인**

Run: `pytest tests/recsys/test_user_mrt.py::test_select_stale_mrt_users -v`
Expected: FAIL — `ImportError: cannot import name 'select_stale_mrt_users'`

- [ ] **Step 3: `select_stale_mrt_users` 구현** — `mrt.py`의 `generate_user_mrt` 아래 추가

```python
def select_stale_mrt_users(conn: psycopg.Connection, *, k: int = DEFAULT_K) -> list[str]:
    """MRT 재생성 대상 유저: 현재 임베딩 보유 UserTrack 수가 k 이상이고,
    그 수가 마지막 MRT 계산 시점(UserEmbedding.computedFrom, 없으면 0)보다 큰 유저.

    신규 유저(UserEmbedding 없음=baseline 0) + 미스곡 임베딩으로 카운트 오른
    기존 유저 둘 다 포착. computedFrom == 현재 수면 MRT가 최신 → 제외.
    """
    with conn.cursor() as cur:
        cur.execute(
            '''SELECT u.id
               FROM "User" u
               JOIN LATERAL (
                 SELECT count(*) AS cnt
                 FROM "UserTrack" ut
                 JOIN "TrackEmbedding" e ON e."trackId" = ut."trackId"
                 WHERE ut."userId" = u.id AND e."modelVersion" = %s
               ) c ON TRUE
               LEFT JOIN "UserEmbedding" ue
                 ON ue."userId" = u.id AND ue."modelVersion" = %s
               WHERE c.cnt >= %s
                 AND c.cnt > COALESCE(ue."computedFrom", 0)''',
            (CATALOG_MODEL_VERSION, MODEL_VERSION, k),
        )
        return [r[0] for r in cur.fetchall()]
```

- [ ] **Step 4: 통과 확인**

Run: `pytest tests/recsys/test_user_mrt.py -v`
Expected: PASS (3 passed)

- [ ] **Step 5: 커밋**

```bash
git add src/mrms/recsys/mrt.py tests/recsys/test_user_mrt.py
git commit -m "feat(recsys): select_stale_mrt_users — computedFrom 기반 stale 판정"
```

---

## Task 3: `run_onboarding`을 공유 함수로 교체

**Files:**
- Modify: `src/mrms/onboarding/pipeline.py:142-181`

- [ ] **Step 1: 기존 테스트 baseline 확인**

Run: `pytest tests/onboarding/ -v`
Expected: PASS (기존 온보딩 테스트 — 변경 전 통과 확인)

- [ ] **Step 2: MRT 블록 교체** — `pipeline.py`에서 `# 2. UserTrack 임베딩 + cluster + MRT` 주석(143행)부터 `conn.commit()`(179행)까지를 아래로 교체

```python
        # 2. UserTrack 임베딩 + cluster + MRT (platform 무관) — 공유 함수로 위임
        status.set("computing_embedding", 50, "음악 취향 분석 중...")
        from mrms.recsys.mrt import generate_user_mrt

        status.set("clustering", 75, f"페르소나 {k}개 추출 중...")
        n_tracks = generate_user_mrt(
            conn, user_id, k=k, top_n=persona_top_n, candidate_pool=candidate_pool,
        )
        if n_tracks is None:
            status.fail(f"트랙 임베딩이 부족합니다 (< K={k})")
            return
        status.set("generating_mrt", 90, "추천 생성 중...")
        conn.commit()
```

이제 `pipeline.py` 상단 import에서 더 이상 직접 쓰지 않는 것 제거: `from mrms.recsys.mrt import search_for_persona`, `from mrms.recsys.persona import (NotEnoughTracksError, aggregate_user_vector, cluster_user_tracks)`, `from mrms.db.user_embedding import (insert_playlist_history, upsert_user_embedding, upsert_user_persona)`. **단, `_fetch_user_track_matrix`/`count_embedding_user_tracks`는 다른 곳(precheck, else 분기)에서 쓰므로 유지** — 그 함수들이 쓰는 import만 남긴다(현재 `MODEL_VERSION`/`CATALOG_MODEL_VERSION`/`DEFAULT_K` 상수는 pipeline 내 다른 참조 확인 후, precheck가 쓰는 `DEFAULT_K`는 `from mrms.recsys.mrt import DEFAULT_K`로 교체).

> 주의: `MODEL_VERSION` 상수가 pipeline.py 내 다른 곳에서 안 쓰이면 제거. `count_embedding_user_tracks`/`_fetch_user_track_matrix`는 `CATALOG_MODEL_VERSION`만 참조하므로 `from mrms.recsys.mrt import CATALOG_MODEL_VERSION`로 일원화.

- [ ] **Step 3: 온보딩 테스트 통과 확인**

Run: `pytest tests/onboarding/ -v`
Expected: PASS (동작 동일 — MRT 생성 결과 불변)

- [ ] **Step 4: 커밋**

```bash
git add src/mrms/onboarding/pipeline.py
git commit -m "refactor(onboarding): MRT 생성을 generate_user_mrt 공유 함수로 위임"
```

---

## Task 4: `scripts/09_generate_mrt.py`를 공유 함수로 교체

**Files:**
- Modify: `scripts/09_generate_mrt.py:78-124`

- [ ] **Step 1: `generate_for_user` 본문 교체** — 78~124행을 아래로

```python
def generate_for_user(conn: psycopg.Connection, email: str, k: int, top_n: int, candidate_pool: int) -> bool:
    """단일 사용자 MRT 생성. True=성공, False=skip."""
    from mrms.recsys.mrt import generate_user_mrt

    console.print(f"\n[bold]== {email} ==[/bold]")
    user_id = get_or_create_user(conn, email)
    conn.commit()

    n = generate_user_mrt(conn, user_id, k=k, top_n=top_n, candidate_pool=candidate_pool)
    if n is None:
        console.print(f"  [yellow]skip — 트랙 임베딩 < K({k})[/yellow]")
        return False
    conn.commit()
    console.print(f"  [green]✓ MRT 적재 완료 ({n}곡)[/green]")
    return True
```

상단에서 이제 안 쓰는 import 제거: `fetch_user_track_matrix`(이 파일 로컬 정의도 삭제), `search_for_persona`, `cluster_user_tracks`/`aggregate_user_vector`/`NotEnoughTracksError`, `upsert_user_embedding`/`upsert_user_persona`/`insert_playlist_history`, `MODEL_VERSION`/`CATALOG_MODEL_VERSION` 로컬 상수. `list_all_user_emails`·`get_or_create_user`·`register_vector`·`load_dotenv`는 유지.

- [ ] **Step 2: 동작 확인 (로컬 dev DB)**

Run: `DATABASE_URL=$DEV_DB .venv/bin/python scripts/09_generate_mrt.py --email mrt-test@auto.local`
Expected: `✓ MRT 적재 완료` 또는 `skip` (에러 없이 종료)

- [ ] **Step 3: 커밋**

```bash
git add scripts/09_generate_mrt.py
git commit -m "refactor(scripts): 09_generate_mrt를 generate_user_mrt 공유 함수로 교체"
```

---

## Task 5: 파이프라인에 `youtube_misses` + `regenerate_mrt` 스테이지 추가

**Files:**
- Modify: `src/mrms/emp/runner.py`
- Test: `tests/emp/test_runner.py`

- [ ] **Step 1: 실패 테스트 추가** — `tests/emp/test_runner.py`에 신규 테스트 함수 추가. 기존 `test_run_pipeline_records_run`의 patch 블록에 두 신규 헬퍼 patch + assert를 더한 형태:

```python
async def test_run_pipeline_includes_youtube_and_mrt_stages(db_conn, cleanup):
    """run_pipeline → youtube_misses + regenerate_mrt 스테이지 기록."""
    from mrms.emp.runner import run_pipeline

    async def _imp(conn):
        return {"tracks_new": 1, "tracks_existing": 0, "playlists_processed": 1, "errors": []}

    ok = {"status": "success", "duration_ms": 10, "stdout": "", "stderr": "", "error": None}
    mrt_ok = {"status": "success", "duration_ms": 10, "stdout": "stale=0 regenerated=0 failed=0",
              "stderr": "", "error": None}

    with patch("mrms.emp.runner._run_importer_tidal", new=_imp), \
         patch("mrms.emp.runner._run_importer_spotify", new=_imp), \
         patch("mrms.emp.runner._run_importer_flo", new=_imp), \
         patch("mrms.emp.runner._run_importer_melon", new=_imp), \
         patch("mrms.emp.runner._run_importer_vibe", new=_imp), \
         patch("mrms.emp.runner._run_importer_apple", new=_imp), \
         patch("mrms.emp.runner._run_importer_youtube", new=_imp), \
         patch("mrms.emp.runner._run_audio_download", return_value=ok), \
         patch("mrms.emp.runner._run_extract_embeddings", return_value=ok), \
         patch("mrms.emp.runner._run_youtube_misses", return_value=ok), \
         patch("mrms.emp.runner._run_load_to_db", return_value=ok), \
         patch("mrms.emp.runner._run_regenerate_mrt", return_value=mrt_ok):
        run_id = await run_pipeline(db_conn, platform="all", triggered_by="manual")

    cleanup('DELETE FROM "IngestionRun" WHERE id = %s', (run_id,))
    with db_conn.cursor() as cur:
        cur.execute('SELECT status, stages FROM "IngestionRun" WHERE id = %s', (run_id,))
        status, stages = cur.fetchone()
    names = [s["stage"] for s in stages]
    assert status == "success"
    assert "youtube_misses" in names
    assert "regenerate_mrt" in names
    # 순서: extract 다음 youtube_misses, load 다음 regenerate_mrt
    assert names.index("youtube_misses") > names.index("extract_embeddings")
    assert names.index("youtube_misses") < names.index("load_to_db")
    assert names.index("regenerate_mrt") > names.index("load_to_db")
```

또한 기존 `test_run_pipeline_records_run`·`test_run_pipeline_partial_on_failure`의 `with patch(...)` 블록에 `_run_youtube_misses`/`_run_regenerate_mrt` patch를 추가(없으면 실제 subprocess/DB 호출됨). 두 테스트에 아래 두 줄을 patch 목록에 추가:

```python
         patch("mrms.emp.runner._run_youtube_misses", return_value=ok_stage), \
         patch("mrms.emp.runner._run_regenerate_mrt", return_value=ok_stage), \
```

- [ ] **Step 2: 실패 확인**

Run: `pytest tests/emp/test_runner.py -v`
Expected: FAIL — `AttributeError: ... does not have the attribute '_run_youtube_misses'`

- [ ] **Step 3: 헬퍼 + 스테이지 구현** — `src/mrms/emp/runner.py`

상단 import에 `import os` 추가(`import subprocess` 옆). `_REPO_ROOT` 아래에 dir 상수 추가:

```python
from mrms.config import settings

# 유저 라이브러리 youtube 미스곡 전용 오디오 디렉토리 — EMP 카탈로그 audio_dir과 분리해
# 메인 03(decode 캐시 사용)이 미스곡 m4a를 건너뛰는 문제를 회피한다.
_YT_MISSES_DIR = settings.audio_dir.parent / "audio_yt_misses"
# 존재하지 않는 경로 → 03의 use_cache=False → audio-dir 직접 디코딩(캐시 우회).
_NO_DECODE_CACHE = settings.data_root / "_no_decode_cache"
```

`_run_load_to_db` 아래에 두 헬퍼 추가:

```python
def _run_youtube_misses(limit: int = 500) -> dict:
    """유저 라이브러리 youtube 미스곡: 13(다운로드, 전용 dir) + 03(추출, 캐시 우회).

    npy는 03 기본 out-dir(embed_dir/mert_v1_95m)에 생성 → 이후 load_to_db(10)이
    fetch_pending으로 미스곡을 잡아 적재한다. 메인 audio_dir과 분리해 decode 캐시
    충돌을 피한다. GPU 디바이스는 MRMS_EMBED_DEVICE(기본 cuda)로 지정."""
    t0 = time.monotonic()
    dl = _run_script([
        sys.executable, _script_path("13_embed_youtube_misses.py"),
        "--limit", str(limit), "--sleep", "2",
        "--audio-dir", str(_YT_MISSES_DIR),
    ])
    if dl["status"] != "success":
        dl["duration_ms"] = _ms_since(t0)
        return dl
    ex = _run_script([
        sys.executable, _script_path("03_extract_embeddings.py"),
        "--audio-dir", str(_YT_MISSES_DIR),
        "--cache-dir", str(_NO_DECODE_CACHE),
        "--device", os.environ.get("MRMS_EMBED_DEVICE", "cuda"),
    ])
    ex["duration_ms"] = _ms_since(t0)
    return ex


def _run_regenerate_mrt(conn: psycopg.Connection) -> dict:
    """stale MRT 유저 재생성 (in-process). 유저별 try/except + commit로 격리."""
    from mrms.recsys.mrt import generate_user_mrt, select_stale_mrt_users

    t0 = time.monotonic()
    try:
        users = select_stale_mrt_users(conn)
    except Exception as e:
        safe_rollback(conn)
        return {"status": "failed", "duration_ms": _ms_since(t0),
                "stdout": "", "stderr": "", "error": fmt_exc(e, 300)}
    regenerated = 0
    failed = 0
    for uid in users:
        try:
            if generate_user_mrt(conn, uid) is not None:
                conn.commit()
                regenerated += 1
        except Exception:
            safe_rollback(conn)
            failed += 1
    return {
        "status": "success" if failed == 0 else "partial",
        "duration_ms": _ms_since(t0),
        "stdout": f"stale={len(users)} regenerated={regenerated} failed={failed}",
        "stderr": "",
        "error": None if failed == 0 else f"{failed} user(s) failed",
    }
```

`run_pipeline`의 `# extract embeddings` 블록과 `# load to DB` 블록 **사이**에 youtube_misses 삽입, `# load to DB` 블록 **다음**에 regenerate_mrt 삽입:

```python
        # extract embeddings (기존)
        s = _run_extract_embeddings()
        append_stage(conn, run_id, {"stage": "extract_embeddings", **s})
        if s["status"] != "success":
            overall_ok = False

        # youtube 미스곡 다운로드 + 전용 추출 (신규)
        s = _run_youtube_misses()
        append_stage(conn, run_id, {"stage": "youtube_misses", **s})
        if s["status"] != "success":
            overall_ok = False

        # load to DB (기존) — youtube 미스곡 npy 포함 적재
        s = _run_load_to_db()
        append_stage(conn, run_id, {"stage": "load_to_db", **s})
        if s["status"] != "success":
            overall_ok = False

        # stale MRT 재생성 (신규)
        s = _run_regenerate_mrt(conn)
        append_stage(conn, run_id, {"stage": "regenerate_mrt", **s})
        if s["status"] != "success":
            overall_ok = False
```

- [ ] **Step 4: 통과 확인**

Run: `pytest tests/emp/test_runner.py -v`
Expected: PASS (기존 2 + 신규 1)

- [ ] **Step 5: 커밋**

```bash
git add src/mrms/emp/runner.py tests/emp/test_runner.py
git commit -m "feat(emp): run_pipeline에 youtube_misses + regenerate_mrt 스테이지 추가"
```

---

## Task 6: 문서 갱신

**Files:**
- Modify: `docs/cron-setup.md`, `docs/decisions/ADR-001-youtube-newuser-automation.md`

- [ ] **Step 1: `cron-setup.md` 상단에 역할 변경 노트 추가** — 첫 문단 아래에

```markdown
> **2026-06-13 변경:** 미스곡 임베딩 + stale 유저 MRT 재생성이 EMP 파이프라인
> 스테이지(`regenerate_mrt`)로 통합됨([ADR-001](decisions/ADR-001-youtube-newuser-automation.md)).
> 이 `09 --all` cron은 **전체 백필 백스톱**으로만 유지(주기 축소 권장). 일상적 신규 유저
> MRT 갱신은 파이프라인 스테이지가 담당한다.
```

- [ ] **Step 2: ADR-001 상태 갱신** — `## 상태` 섹션을

```markdown
## 상태

승인 — 구현 완료 (2026-06-13). 파이프라인 스테이지 `youtube_misses`/`regenerate_mrt` + `generate_user_mrt` 공유 함수.
```

- [ ] **Step 3: 커밋**

```bash
git add docs/cron-setup.md docs/decisions/ADR-001-youtube-newuser-automation.md
git commit -m "docs: ADR-001 승인 + cron-setup 역할 변경 반영"
```

---

## Task 7: 전체 회귀 + prod 검증 노트

- [ ] **Step 1: 전체 테스트**

Run: `pytest tests/recsys/test_user_mrt.py tests/emp/test_runner.py tests/onboarding/ -v`
Expected: 전부 PASS

- [ ] **Step 2: prod 배치 전 확인 노트 (실행 아님 — 운영자 체크리스트)**

다음 배포 후 prod에서 1회 검증:
- `MRMS_EMBED_DEVICE=cuda`가 systemd 서비스 env에 설정됐는지 (없으면 기본 cuda).
- `data/audio_yt_misses/`가 mrms 유저 쓰기 가능 위치인지.
- 수동 trigger 1회(`/admin/emp` 또는 `scripts/run_emp_pipeline.py`) → run/stage에 `youtube_misses`·`regenerate_mrt`가 success로 찍히는지, 미스곡 임베딩 수·`stale=N regenerated=N`이 합리적인지.

- [ ] **Step 3: 최종 커밋(있으면)**

```bash
git add -A && git commit -m "test: 신규 유저 자동화 전체 회귀 통과" || echo "변경 없음"
```

---

## Self-Review

**1. Spec coverage** ([spec](../specs/2026-06-13-youtube-newuser-automation-design.md)):
- §4.1 youtube_misses + regenerate_mrt 스테이지 → Task 5 ✓ (캐시 우회 = 전용 dir + `_NO_DECODE_CACHE` ✓)
- §4.2 DRY generate_user_mrt → Task 1, 3, 4 ✓
- §4.3 stale 판정(computedFrom) → Task 2 ✓
- §4.4 대시보드 자동 노출 → append_stage로 충족(UI 변경 없음) ✓ / 09 cron 역할 변경 → Task 6 ✓
- §9 테스트(공유함수 단위 + 스테이지 patch + 통합) → Task 1·2·5·7 ✓

**2. Placeholder scan:** 모든 코드 step에 완전 코드 포함, 명령에 expected 명시. 빈 placeholder 없음 ✓

**3. Type consistency:** `generate_user_mrt`(return `int|None`)·`select_stale_mrt_users`(return `list[str]`)·`fetch_user_track_matrix`(return `tuple[list,np.ndarray]`)·`MODEL_VERSION`/`CATALOG_MODEL_VERSION`/`DEFAULT_K` 상수명이 Task 1~5 전반에서 일관 ✓. 스테이지 dict 키(status/duration_ms/stdout/stderr/error)가 기존 `_run_script`·`append_stage` 계약과 일치 ✓

**미결(spec §7, 플랜 범위 밖):** 파이프라인 cadence·`youtube_misses --limit` 튜닝, prod cache-dir 최종 확인은 Task 7 운영 체크리스트로 위임.
