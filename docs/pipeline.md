# Pipeline Runbook

전체 데이터 처리 + 모델 학습 + DB 적재 파이프라인. 7개 메인 스크립트 + 1개 보조.

## 의존성 그래프

```
01_enrich_via_deezer  →  data/csv/ems_enriched.parquet
                              │
02_download_audio  →  data/audio/*.m4a (166k)
02b_retry_failed  ─→  실패한 트랙 재시도 (15k 추가 회복)
                              │
03a_predecode  →  data/audio_decoded/*.npy (float16, 24kHz mono)
                              │
03_extract_embeddings  →  data/embeddings/mert_v1_95m/*.npy (768d)
                              │
04_train_heads  →  checkpoints/heads_v1.0/best.ckpt
                              │
05_inference  →  data/features/our_model_v1.0.parquet
              →  data/projection/v1.0.parquet (256d)
                              │
06_build_faiss  →  data/faiss/v1.0.bin
                              │
07_load_to_db  →  PostgreSQL (Artist/Album/Track/Features/Embedding)
```

각 단계 출력은 다음 단계 입력 — 도중에 멈춰도 caching으로 재시작 가능.

---

## Stage 0 — 진단

### `scripts/00_test_spotify.py`

Spotify API 자격증명 + endpoint 권한 진단 (사용 안 한 V1에선 비활성).

```bash
python3 scripts/00_test_spotify.py
```

**입력**: `.env`의 `SPOTIFY_CLIENT_ID/SECRET`
**출력**: 토큰 발급/`/tracks`/`/search` 응답 + HTTP 코드

---

## Stage 1 — Catalog Enrichment

### `scripts/01_enrich_via_deezer.py`

Deezer Search/Lookup으로 ISRC + preview URL 채우기. Spotify API는 dev 앱 quota 너무 낮아 우회.

```bash
# Smoke test
python3 scripts/01_enrich_via_deezer.py --limit 1000

# 본 실행 (~60분)
python3 scripts/01_enrich_via_deezer.py --concurrency 40
```

**입력**: `data/csv/ems_collected_track.csv`
**출력**: `data/csv/ems_enriched.parquet`
**시간**: ~60분 (197k tracks, concurrency 40)
**성공률**: ~89.5% (Deezer 카탈로그가 글로벌하지만 인디 트랙 일부 미포함)

**옵션**:
- `--catalog PATH` — 입력 CSV 경로
- `--out PATH` — 출력 parquet
- `--concurrency N` — Deezer 동시 호출 (기본 20)
- `--limit N` — N개만 테스트

---

## Stage 2 — Audio Download

### `scripts/02_download_audio.py`

다중 소스 preview 다운로더. 5단계 fallback 체인:
1. CSV의 `preview_url` (이미 있으면)
2. Deezer ISRC lookup
3. Deezer 텍스트 검색
4. iTunes ISRC search
5. iTunes 텍스트 search

```bash
# Smoke test
python3 scripts/02_download_audio.py --limit 1000

# 본 실행 (~2시간)
python3 scripts/02_download_audio.py --concurrency 30
```

**입력**: `data/csv/ems_enriched.parquet`
**출력**: `data/audio/{key}.m4a` (~75GB)
**시간**: ~2~3시간
**성공률**: ~83% (151k 다운로드)

**중요 동작**:
- **재개 가능** — 이미 다운로드된 파일은 skip
- **4xx fail-fast** — 죽은 URL 재시도 안 함 (속도 ↑)
- **dedupe by key** — ISRC 또는 `{source}_{platform_id}` 기준

**로그**:
- `logs/download_success.csv` — 성공 + 소스
- `logs/download_failed.csv` — 실패 + 에러 메시지

### `scripts/02b_retry_failed.py`

02 실패 트랙에 대해 더 공격적인 검색 전략:
- 제목 정리 ("(Official Video)" 등 노이즈 제거)
- iTunes 다국가 검색 (US/KR/JP/GB)
- 다양한 query variation

```bash
python3 scripts/02b_retry_failed.py --concurrency 30
```

**입력**: `logs/download_failed.csv` + `data/csv/ems_enriched.parquet`
**출력**: `data/audio/{key}.m4a` (추가) + `logs/retry_success.csv`, `logs/retry_still_failed.csv`
**시간**: ~30~60분
**회복률**: ~51% (15k 추가 트랙)

---

## Stage 3 — Audio Embedding

### `scripts/03a_predecode.py`

m4a → float16 npy 사전 디코딩 (1회만). 이후 03이 빠르게 동작.

```bash
python3 scripts/03a_predecode.py --workers 8
```

**입력**: `data/audio/*.m4a`
**출력**: `data/audio_decoded/{key}.npy` (~240GB, float16 mono 24kHz)
**시간**: M1 ~2시간 / Lambda Cloud ~20분 (CPU 8코어 병렬)

**왜 필요**:
- 03 매 실행마다 ffmpeg 호출은 오버헤드 큼 (50ms × 166k = 2.3h 낭비)
- npy로 캐시 → numpy.load 5ms로 즉시 사용

### `scripts/03_extract_embeddings.py`

MERT-95M으로 모든 트랙의 768d mean-pooled 임베딩 추출. **이 단계가 전체 파이프라인의 가장 큰 GPU 부하**.

```bash
# M1 MPS (~36시간 — 권장 안 함)
python3 scripts/03_extract_embeddings.py --device mps --batch-size 8

# Lambda Labs H100 (~15~20분, ~$5)
python3 scripts/03_extract_embeddings.py --device cuda --precision fp16 --batch-size 64

# CPU only (~수일)
python3 scripts/03_extract_embeddings.py --device cpu
```

**입력**: `data/audio_decoded/*.npy` (캐시 자동 감지) 또는 `data/audio/*.m4a` (느림)
**출력**: `data/embeddings/mert_v1_95m/{key}.npy` (~500MB, 768d float32)
**시간**: device에 따라 천차만별

**Lambda Labs 가이드**: [lambda-labs-setup.md](lambda-labs-setup.md)

---

## Stage 4 — Heads Training

### `scripts/04_train_heads.py`

Frozen MERT 임베딩 위에 multi-task heads 학습. PyTorch Lightning + AdamW + cosine LR.

```bash
python3 scripts/04_train_heads.py --epochs 30 --batch-size 256
```

**입력**:
- `data/embeddings/mert_v1_95m/*.npy` (768d MERT)
- `data/csv/ems_enriched.parquet` (Spotify-12 라벨)

**출력**:
- `checkpoints/heads_v1.0/best.ckpt` (val/loss 기준)
- `checkpoints/heads_v1.0/last.ckpt`
- `checkpoints/heads_v1.0/tb_logs/` (TensorBoard)

**시간**: M1 MPS ~4분 (15 epoch, early stopping)
**모델 크기**: 1.7M params (heads만)

**옵션**:
- `--epochs N` — 최대 epoch (기본 30, early stop이 보통 10-20에서)
- `--batch-size N` — M1 32GB은 256 OK
- `--lr 1e-3` — 학습률
- `--num-workers N` — DataLoader worker
- `--accelerator mps|cuda|cpu` — Lightning accelerator

**모니터링**:
```bash
tensorboard --logdir checkpoints/heads_v1.0/tb_logs --port 6006
```

---

## Stage 5 — Full Inference

### `scripts/05_inference.py`

학습된 heads로 모든 임베딩 트랙 (166k)에 features + 256d projection 산출.

```bash
python3 scripts/05_inference.py
```

**입력**:
- `data/embeddings/mert_v1_95m/*.npy`
- `checkpoints/heads_v1.0/best.ckpt`

**출력**:
- `data/features/our_model_v1.0.parquet` — Spotify-12 + spotify_key/mode/time_sig
- `data/projection/v1.0.parquet` — key + 256d embedding (L2 normalized)

**시간**: ~5분 (M1 MPS, batch 512)

---

## Stage 6 — FAISS Index

### `scripts/06_build_faiss.py`

256d projection으로 HNSW 인덱스 빌드. pgvector에 더해 빠른 batch 검색용.

```bash
python3 scripts/06_build_faiss.py
```

**입력**: `data/projection/v1.0.parquet`
**출력**:
- `data/faiss/v1.0.bin` (~216MB)
- `data/faiss/v1.0_keys.parquet` (row idx → key 매핑)

**시간**: ~13초 (HNSW insert)

**옵션**:
- `--hnsw-m 32` — graph degree
- `--ef-construction 200` — 빌드 품질
- `--query-key ISRC --k 10` — 즉시 검색 테스트

---

## Stage 7 — PostgreSQL Load

### `scripts/07_load_to_db.py`

DB 적재 (Artist/Album/Track/TrackPlatform/Features/Embedding).

**사전 조건**:
```bash
# PostgreSQL 시작
docker compose up -d
docker compose logs pg | grep "ready to accept"

# 스키마 생성 (Prisma 우회 — 우리는 직접 SQL)
docker compose exec -T pg psql -U mrms -d mrms < prisma/init/02_schema.sql

# Python 패키지
pip install pgvector psycopg
```

**실행**:
```bash
# Smoke test
python3 scripts/07_load_to_db.py --limit 1000

# 본 적재 (5~15분)
python3 scripts/07_load_to_db.py --reset
```

**입력**:
- `data/csv/ems_enriched.parquet`
- `data/features/our_model_v1.0.parquet`
- `data/projection/v1.0.parquet`

**출력**: PostgreSQL 6개 테이블 (각 ~166k 행)

**옵션**:
- `--reset` — 기존 데이터 삭제 후 적재
- `--limit N` — N개만 테스트
- `--batch-size N` — INSERT 배치 (기본 2000)

---

## 비용 + 시간 요약

| Stage | M1 (32GB) | Lambda H100 | 비고 |
|---|---|---|---|
| 01 Deezer | 60분 | - | 네트워크 |
| 02 Download | 2~3h | - | 네트워크 |
| 02b Retry | 30~60분 | - | 네트워크 |
| 03a Predecode | 2h | 20분 | CPU |
| **03 MERT 임베딩** | **36h** | **15분 (~$3)** | **GPU 메이저** |
| 04 Heads 학습 | 4분 | - | 가벼움 |
| 05 Inference | 5분 | - | 가벼움 |
| 06 FAISS | 13초 | - | 가벼움 |
| 07 DB Load | 5~15분 | - | I/O |
| **합계** | ~3일 wait | ~6h wait + ~$5 | |

---

## 자주 마주치는 함정

### Audio download가 너무 빠르게 실패함

→ `tenacity`가 4xx에 재시도 안 하도록 설정됨 (의도된 동작). 죽은 URL은 즉시 fail-fast.

### MERT 임베딩 추출 OOM (M1)

→ ProcessPoolExecutor 제거 + sequential 로딩으로 메모리 한계 24MB (BATCH×3MB) 유지.

### CUDA + `torch.mps.empty_cache()` 에러

→ device 분기 추가 (`is_mps` / `is_cuda` 별도 체크).

### Lambda Labs에서 `.env` 경로 오류

→ Mac 경로(`/Volumes/MacExtend 1/...`)가 박혀 있어서. sed로 일괄 변환:
```bash
sed -i 's|/Volumes/MacExtend 1/MRMS_FN|/home/ubuntu/mrms|g' ~/mrms/.env
```

### Prisma 7 `url` 필드 deprecated

→ V6로 다운그레이드 또는 SQL DDL 직접 적용 (우리는 후자 선택).

### Port 5432 already in use

→ REMS 같은 다른 PG 인스턴스 충돌. docker-compose.yml에서 5433으로 변경.

### Python 3.14에서 pyarrow 안 깔림

→ Python 3.11/3.10 권장. `pip install pyarrow` 별도 필요할 수도.
