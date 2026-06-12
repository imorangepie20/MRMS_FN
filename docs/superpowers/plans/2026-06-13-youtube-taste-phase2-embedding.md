# YouTube 취향 Phase 2 — 미스곡 임베딩 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** YouTube 라이브러리 미스곡(videoId 보유·임베딩 없음)을 yt-dlp로 받아 카탈로그와 동일한 체인(훅 30초 → MERT → 학습된 projection head → 256d)으로 `TrackEmbedding`에 적재한다.

**Architecture:** 기존 오디오 파이프라인(02 다운로드 → 03 MERT 768d → 10 projection 256d 적재)을 재사용한다. 신규는 **(a) yt-dlp 다운로드 + 훅 클립 모듈**, **(b) 미스곡을 받아 `{AUDIO_DIR}/youtube_{videoId}.m4a`로 저장하는 스크립트**뿐. key를 `youtube_{videoId}`로 맞추면 03이 `youtube_{videoId}.npy`를 만들고, embedding_loader가 `TrackPlatform(platform='youtube', platformTrackId=videoId)`로 trackId를 역매핑한다.

**Tech Stack:** yt-dlp 2026.06.09, ffmpeg, MERT-95M (24kHz), psycopg, 기존 `mrms.emp.embedding_loader`.

**검증된 전제 (2026-06-13):** Spotify preview 폐기 → yt-dlp 직행. yt-dlp+ffmpeg 추출 동작 확인. 카탈로그 임베딩은 `ffmpeg -t 30` 앞 30초(프리뷰=훅). MERT `SAMPLE_RATE=24000`. `derive_track_key` = ISRC 없으면 `{source}_{platform_track_id}`. 768→256은 04 학습 projection head(10이 적용).

**정합성 제1원칙:** 카탈로그는 플랫폼 프리뷰(훅 30초). YouTube 풀트랙 앞 30초는 인트로 → 분포 불일치. **훅 근처(길이의 30% 지점)부터 30초를 추출**해 저장한다. 03은 그 30초 파일을 그대로 `-t 30` 처리.

---

## File Structure

- **Create** `src/mrms/ingest/youtube_audio.py` — `clip_offset_seconds(duration, ratio)`(순수) + `download_and_clip(video_id, dest, *, offset_ratio, clip_seconds)`(yt-dlp+ffmpeg). 한 책임: videoId → 훅 30초 m4a.
- **Create** `scripts/13_embed_youtube_misses.py` — 미스곡 DB 조회 + `download_and_clip`로 `{AUDIO_DIR}/youtube_{videoId}.m4a` 저장 + 스로틀/실패로그. (임베딩 추출은 기존 03·10 재사용 — 이 스크립트는 오디오 확보까지.)
- **Modify** `src/mrms/config.py` — `youtube_clip_offset_ratio: float = 0.30` 추가.
- **Modify** `pyproject.toml` — `yt-dlp>=2026.6` 의존성.
- **Verify/Modify** `src/mrms/emp/embedding_loader.py` — `youtube_{videoId}` key → trackId 역매핑이 동작하는지 (Task 4).
- **Create** `tests/ingest/test_youtube_audio.py`, `tests/scripts/test_embed_youtube_misses.py`.
- **Modify** `docs/deployment.md` — ffmpeg/yt-dlp 설치 + 배치 안내.

---

### Task 1: 의존성 + 설정값

**Files:**
- Modify: `pyproject.toml` (dependencies 블록, 현재 `"ytmusicapi>=1.12",` 다음 줄)
- Modify: `src/mrms/config.py` (`download_preview_seconds` 근처 — 현재 line 101)
- Test: `tests/test_config.py` (없으면 생성)

- [ ] **Step 1: 실패 테스트 작성**

`tests/test_config.py`:
```python
def test_youtube_clip_offset_ratio_default():
    from mrms.config import settings
    assert 0.0 <= settings.youtube_clip_offset_ratio < 1.0
    assert settings.youtube_clip_offset_ratio == 0.30
```

- [ ] **Step 2: 실패 확인**

Run: `.venv/bin/python -m pytest tests/test_config.py::test_youtube_clip_offset_ratio_default -v`
Expected: FAIL — `AttributeError: 'Settings' object has no attribute 'youtube_clip_offset_ratio'`

- [ ] **Step 3: 구현**

`src/mrms/config.py` 의 `download_preview_seconds: int = 30` 바로 아래에 추가:
```python
    # YouTube 풀트랙에서 훅 근처 30초를 뽑기 위한 오프셋 비율 (앞=인트로 회피).
    # 카탈로그 임베딩이 플랫폼 프리뷰(훅)에서 나왔으므로 분포를 맞춘다.
    youtube_clip_offset_ratio: float = 0.30
```
`pyproject.toml` 의 `"ytmusicapi>=1.12",` 다음 줄에 추가:
```toml
    "yt-dlp>=2026.6",
```

- [ ] **Step 4: 통과 확인**

Run: `.venv/bin/python -m pytest tests/test_config.py::test_youtube_clip_offset_ratio_default -v`
Expected: PASS

- [ ] **Step 5: 커밋**
```bash
git add pyproject.toml src/mrms/config.py tests/test_config.py
git commit -m "feat(phase2): yt-dlp 의존성 + youtube_clip_offset_ratio 설정"
```

---

### Task 2: 훅 클립 오프셋 (순수 함수) + 다운로드 모듈

**Files:**
- Create: `src/mrms/ingest/youtube_audio.py`
- Test: `tests/ingest/test_youtube_audio.py`

- [ ] **Step 1: 실패 테스트 작성 (순수 오프셋 로직)**

`tests/ingest/test_youtube_audio.py`:
```python
from mrms.ingest.youtube_audio import clip_offset_seconds


def test_offset_skips_intro_for_long_track():
    # 200초 트랙, ratio 0.30 → 60초 지점부터
    assert clip_offset_seconds(200.0, ratio=0.30, clip_seconds=30.0) == 60.0


def test_offset_zero_for_short_track():
    # 35초 트랙: 오프셋 적용 시 끝을 넘으므로 0부터
    assert clip_offset_seconds(35.0, ratio=0.30, clip_seconds=30.0) == 0.0


def test_offset_zero_when_duration_unknown():
    assert clip_offset_seconds(None, ratio=0.30, clip_seconds=30.0) == 0.0
```

- [ ] **Step 2: 실패 확인**

Run: `.venv/bin/python -m pytest tests/ingest/test_youtube_audio.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'mrms.ingest.youtube_audio'`

- [ ] **Step 3: 구현**

`src/mrms/ingest/youtube_audio.py`:
```python
"""YouTube videoId → 훅 30초 오디오 클립 (yt-dlp + ffmpeg).

카탈로그 임베딩이 플랫폼 프리뷰(훅)에서 나왔으므로, 풀트랙 앞(인트로)이 아니라
길이의 offset_ratio 지점부터 clip_seconds 만큼 추출해 분포를 맞춘다.
"""
from __future__ import annotations

import subprocess
from pathlib import Path


def clip_offset_seconds(
    duration: float | None, *, ratio: float, clip_seconds: float
) -> float:
    """클립 시작 오프셋(초). 오프셋+클립이 트랙 끝을 넘거나 길이 미상이면 0."""
    if not duration or duration <= 0:
        return 0.0
    offset = duration * ratio
    if offset + clip_seconds > duration:
        return 0.0
    return offset


def _stream_url_and_duration(video_id: str) -> tuple[str, float | None]:
    """yt-dlp로 bestaudio 스트림 URL + duration 확보 (다운로드 X)."""
    import yt_dlp

    url = f"https://www.youtube.com/watch?v={video_id}"
    with yt_dlp.YoutubeDL(
        {"quiet": True, "no_warnings": True, "format": "bestaudio", "skip_download": True}
    ) as ydl:
        info = ydl.extract_info(url, download=False)
    audio = [
        f for f in info.get("formats", [])
        if f.get("acodec") not in (None, "none") and f.get("vcodec") == "none"
    ]
    if not audio:
        raise RuntimeError(f"no audio stream for {video_id}")
    return audio[-1]["url"], info.get("duration")


def download_and_clip(
    video_id: str,
    dest: Path,
    *,
    offset_ratio: float,
    clip_seconds: float = 30.0,
) -> None:
    """videoId → 훅 클립을 dest(.m4a)로 저장. 실패 시 예외."""
    stream_url, duration = _stream_url_and_duration(video_id)
    offset = clip_offset_seconds(duration, ratio=offset_ratio, clip_seconds=clip_seconds)
    dest.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "ffmpeg", "-y", "-loglevel", "error",
        "-ss", str(offset), "-i", stream_url,
        "-t", str(clip_seconds), "-vn", "-acodec", "aac", "-b:a", "128k",
        str(dest),
    ]
    subprocess.run(cmd, check=True, capture_output=True, timeout=120)
    if not dest.exists() or dest.stat().st_size < 5_000:
        raise RuntimeError(f"clip too small/missing for {video_id}")
```

- [ ] **Step 4: 통과 확인**

Run: `.venv/bin/python -m pytest tests/ingest/test_youtube_audio.py -v`
Expected: PASS (3 passed) — 순수 오프셋 로직만 검증. `download_and_clip`은 네트워크 의존이라 Task 5 수동 e2e에서 검증.

- [ ] **Step 5: 커밋**
```bash
git add src/mrms/ingest/youtube_audio.py tests/ingest/test_youtube_audio.py
git commit -m "feat(phase2): youtube_audio 훅 클립 + yt-dlp 다운로드 모듈"
```

---

### Task 3: 미스곡 조회 + 다운로드 스크립트

**Files:**
- Create: `scripts/13_embed_youtube_misses.py`
- Test: `tests/scripts/test_embed_youtube_misses.py`

- [ ] **Step 1: 실패 테스트 작성 (조회 쿼리 — 합성 ID 제외 + UserTrack 보유 + 임베딩 없음)**

`tests/scripts/test_embed_youtube_misses.py` (기존 db_conn/cleanup fixture 패턴 사용 — `tests/conftest.py` 확인):
```python
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))


def test_fetch_youtube_misses_excludes_synthetic_and_embedded(db_conn, cleanup):
    """실 videoId + UserTrack 보유 + 임베딩 없음만 반환. 합성(yt_)·임베딩 보유는 제외."""
    import importlib
    mod = importlib.import_module("13_embed_youtube_misses")

    # 준비: artist/track/usertrack/trackplatform 시드 — cleanup 등록 (자식 먼저 삭제)
    with db_conn.cursor() as cur:
        cur.execute('INSERT INTO "Artist" (id, name) VALUES (%s,%s)', ("p2-ar", "P2 Artist"))
        cur.execute('INSERT INTO "User" (id, email) VALUES (%s,%s)', ("p2-u", "p2@test.local"))
        for tid, vid in [("p2-t-real", "REALVID12345"), ("p2-t-syn", "yt_deadbeef")]:
            cur.execute('INSERT INTO "Track" (id, title, "artistId") VALUES (%s,%s,%s)',
                        (tid, f"T {tid}", "p2-ar"))
            cur.execute('INSERT INTO "TrackPlatform" (id,"trackId",platform,"platformTrackId") VALUES (%s,%s,%s,%s)',
                        (f"tp-{tid}", tid, "youtube", vid))
            cur.execute('INSERT INTO "UserTrack" (id,"userId","trackId",platform,source,"isCore") VALUES (%s,%s,%s,%s,%s,%s)',
                        (f"ut-{tid}", "p2-u", tid, "youtube", "playlist:x", False))
    db_conn.commit()
    cleanup('DELETE FROM "UserTrack" WHERE "userId"=%s', ("p2-u",))
    cleanup('DELETE FROM "TrackPlatform" WHERE "trackId" IN (%s,%s)', ("p2-t-real","p2-t-syn"))
    cleanup('DELETE FROM "Track" WHERE id IN (%s,%s)', ("p2-t-real","p2-t-syn"))
    cleanup('DELETE FROM "Artist" WHERE id=%s', ("p2-ar",))
    cleanup('DELETE FROM "User" WHERE id=%s', ("p2-u",))

    rows = mod.fetch_youtube_misses(db_conn, limit=100)
    vids = {r["video_id"] for r in rows}
    assert "REALVID12345" in vids       # 실 videoId + UserTrack + 임베딩 없음 → 포함
    assert "yt_deadbeef" not in vids    # 합성 ID → 제외
```

- [ ] **Step 2: 실패 확인**

Run: `.venv/bin/python -m pytest tests/scripts/test_embed_youtube_misses.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named '13_embed_youtube_misses'`

- [ ] **Step 3: 구현**

`scripts/13_embed_youtube_misses.py`:
```python
"""YouTube 미스곡(videoId 보유·임베딩 없음) → 훅 30초 오디오를 {AUDIO_DIR}/youtube_{videoId}.m4a 로 저장.

이후 기존 파이프라인으로 임베딩:
    python scripts/03_extract_embeddings.py
    python scripts/10_load_emp_embeddings.py

스로틀: 다운로드 간 sleep(기본 3초) + 동시성 1. YouTube IP 차단 방지.
실패(차단/삭제/지역제한)는 logs/youtube_download_failed.csv 기록 후 스킵.
"""
from __future__ import annotations

import argparse
import csv
import os
import random
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

import psycopg
from rich.console import Console

from mrms.config import settings
from mrms.ingest.youtube_audio import download_and_clip

console = Console()

MISS_SQL = """
    SELECT DISTINCT t.id, tp."platformTrackId" AS video_id, t.title, ar.name AS artist
    FROM "Track" t
    JOIN "TrackPlatform" tp ON tp."trackId" = t.id AND tp.platform = 'youtube'
    JOIN "Artist" ar ON ar.id = t."artistId"
    WHERE tp."platformTrackId" NOT LIKE 'yt\\_%%'
      AND EXISTS (SELECT 1 FROM "UserTrack" ut WHERE ut."trackId" = t.id)
      AND NOT EXISTS (SELECT 1 FROM "TrackEmbedding" e WHERE e."trackId" = t.id)
    LIMIT %s
"""


def fetch_youtube_misses(conn: psycopg.Connection, limit: int) -> list[dict]:
    with conn.cursor() as cur:
        cur.execute(MISS_SQL, (limit,))
        return [
            {"track_id": r[0], "video_id": r[1], "title": r[2], "artist": r[3]}
            for r in cur.fetchall()
        ]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=200)
    ap.add_argument("--sleep", type=float, default=3.0, help="다운로드 간 평균 대기(초)")
    ap.add_argument("--audio-dir", type=Path, default=settings.audio_dir)
    args = ap.parse_args()

    conn = psycopg.connect(os.environ["DATABASE_URL"])
    try:
        misses = fetch_youtube_misses(conn, args.limit)
    finally:
        conn.close()
    console.print(f"미스곡: [bold]{len(misses)}[/bold] (limit={args.limit})")

    log_dir = settings.log_dir
    log_dir.mkdir(parents=True, exist_ok=True)
    failed: list[dict] = []
    ok = 0
    for i, m in enumerate(misses, 1):
        dest = args.audio_dir / f"youtube_{m['video_id']}.m4a"
        if dest.exists() and dest.stat().st_size > 5_000:
            ok += 1
            continue
        try:
            download_and_clip(
                m["video_id"], dest,
                offset_ratio=settings.youtube_clip_offset_ratio,
            )
            ok += 1
        except Exception as e:  # 차단/삭제/지역제한 — 스킵
            failed.append({**m, "error": str(e)[:200]})
        console.print(f"  [{i}/{len(misses)}] {m['artist']} — {m['title']}: "
                      f"{'ok' if dest.exists() else 'fail'}")
        time.sleep(args.sleep + random.uniform(0, args.sleep))

    if failed:
        with open(log_dir / "youtube_download_failed.csv", "w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=["track_id", "video_id", "title", "artist", "error"])
            w.writeheader(); w.writerows(failed)
    console.print(f"[green]✓ 오디오 확보:[/green] {ok}  [red]✗ 실패:[/red] {len(failed)}")
    console.print("다음: python scripts/03_extract_embeddings.py && python scripts/10_load_emp_embeddings.py")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: 통과 확인**

Run: `.venv/bin/python -m pytest tests/scripts/test_embed_youtube_misses.py -v`
Expected: PASS — 쿼리가 합성 ID 제외 + 실 videoId 포함.

- [ ] **Step 5: 커밋**
```bash
git add scripts/13_embed_youtube_misses.py tests/scripts/test_embed_youtube_misses.py
git commit -m "feat(phase2): 미스곡 조회 + yt-dlp 다운로드 스크립트 (13)"
```

---

### Task 4: embedding_loader의 youtube key→trackId 역매핑 검증/보강

**Files:**
- Read/Modify: `src/mrms/emp/embedding_loader.py`
- Test: `tests/emp/test_embedding_loader_youtube.py`

03이 만든 `youtube_{videoId}.npy`를 10(embedding_loader)이 trackId로 역매핑해야 TrackEmbedding이 올바른 트랙에 붙는다. 매핑이 ISRC/tidal/spotify만 처리하면 youtube가 누락된다.

- [ ] **Step 1: 먼저 읽기**

Run: `grep -nE "def |key|trackId|TrackPlatform|derive|stem|youtube|tidal|spotify|isrc|platform" src/mrms/emp/embedding_loader.py`
목적: `.npy` 파일 stem(key) → trackId 매핑 로직 위치 + youtube 처리 여부 확인.

- [ ] **Step 2: 실패 테스트 작성 (youtube key → trackId 매핑)**

`tests/emp/test_embedding_loader_youtube.py` (매핑 함수명은 Step 1에서 확인한 실제 이름으로 — 아래는 `resolve_track_id_for_key`로 가정; 다르면 교체):
```python
def test_youtube_key_maps_to_track_id(db_conn, cleanup):
    """'youtube_{videoId}' key → TrackPlatform(platform='youtube') 통해 trackId."""
    from mrms.emp.embedding_loader import resolve_track_id_for_key  # 실제 이름으로 교체

    with db_conn.cursor() as cur:
        cur.execute('INSERT INTO "Artist" (id,name) VALUES (%s,%s)', ("p2l-ar", "L"))
        cur.execute('INSERT INTO "Track" (id,title,"artistId") VALUES (%s,%s,%s)', ("p2l-t", "L", "p2l-ar"))
        cur.execute('INSERT INTO "TrackPlatform" (id,"trackId",platform,"platformTrackId") VALUES (%s,%s,%s,%s)',
                    ("p2l-tp", "p2l-t", "youtube", "VIDXYZ789"))
    db_conn.commit()
    cleanup('DELETE FROM "TrackPlatform" WHERE id=%s', ("p2l-tp",))
    cleanup('DELETE FROM "Track" WHERE id=%s', ("p2l-t",))
    cleanup('DELETE FROM "Artist" WHERE id=%s', ("p2l-ar",))

    assert resolve_track_id_for_key(db_conn, "youtube_VIDXYZ789") == "p2l-t"
```

- [ ] **Step 3: 실패 확인 → 보강**

Run: `.venv/bin/python -m pytest tests/emp/test_embedding_loader_youtube.py -v`
- PASS면: embedding_loader가 이미 `{platform}_{platformTrackId}` 일반 매핑을 함 → Task 완료(테스트만 추가 가치).
- FAIL면: Step 1에서 찾은 매핑 함수에 youtube 분기 추가 — `key.startswith("youtube_")` → `platformTrackId = key[len("youtube_"):]` → `SELECT "trackId" FROM "TrackPlatform" WHERE platform='youtube' AND "platformTrackId"=%s`. (기존 tidal/spotify 분기와 동일 패턴으로.)

- [ ] **Step 4: 통과 확인**

Run: `.venv/bin/python -m pytest tests/emp/test_embedding_loader_youtube.py -v`
Expected: PASS

- [ ] **Step 5: 커밋**
```bash
git add src/mrms/emp/embedding_loader.py tests/emp/test_embedding_loader_youtube.py
git commit -m "feat(phase2): embedding_loader youtube key→trackId 역매핑"
```

---

### Task 5: e2e 수동 검증 + 배포 문서

**Files:**
- Modify: `docs/deployment.md`

- [ ] **Step 1: dev e2e (실제 미스곡 소수)**

OAuth 연결된 dev 사용자로 import(미스곡 생성) 후:
```bash
.venv/bin/python scripts/13_embed_youtube_misses.py --limit 5 --sleep 3
.venv/bin/python scripts/03_extract_embeddings.py --limit 5
.venv/bin/python scripts/10_load_emp_embeddings.py --limit 5
```
검증 SQL:
```sql
SELECT count(*) FROM "TrackEmbedding" e
JOIN "TrackPlatform" tp ON tp."trackId"=e."trackId" AND tp.platform='youtube'
WHERE e."modelVersion"='our-v1.0';
```
Expected: > 0 (방금 임베딩된 미스곡). 차원 확인: `SELECT vector_dims(embedding) FROM "TrackEmbedding" ... LIMIT 1` = 256.

- [ ] **Step 2: 재-onboard로 취향 반영 확인**

같은 사용자 onboarding 재실행 → `_fetch_user_track_matrix` 곡 수가 Phase 1(178)보다 증가, PlaylistHistory 재생성. (수동.)

- [ ] **Step 3: 배포 문서 갱신**

`docs/deployment.md` 의 운영 섹션에 추가:
```markdown
### YouTube 미스곡 임베딩 (Phase 2)
사전: `yt-dlp`(pip), `ffmpeg`(시스템) 설치.
    .venv/bin/python scripts/13_embed_youtube_misses.py --limit 200 --sleep 3
    .venv/bin/python scripts/03_extract_embeddings.py
    .venv/bin/python scripts/10_load_emp_embeddings.py
저빈도·소량 배치로 실행 (YouTube IP 차단 방지). 가정용 회선 권장.
```

- [ ] **Step 4: 커밋**
```bash
git add docs/deployment.md
git commit -m "docs(phase2): YouTube 미스곡 임베딩 운영 절차"
```

---

## 스코프 밖 (YAGNI)
- 동기/실시간 임베딩, 풀트랙 멀티청크(카탈로그 30초와 불일치), Tidal 프리뷰 fallback, 사용자별 우선순위 큐, 임베딩 후 오디오 자동 삭제(스토리지 이슈 생기면 추가).

## 리스크
- YouTube ToS/IP 차단(개인·저빈도라 방어적, 가정용 회선 유리) · 훅 오프셋 휴리스틱 한계(A/B 튜닝은 `youtube_clip_offset_ratio`로) · MERT GPU 시간(prod CUDA는 배치 빠름).
