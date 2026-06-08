# MRMS — Music Recommendation Management System

자체 학습 오디오 분석 기반 음악 추천 시스템. **Spotify Web API의 audio-features 의존 없이** MERT-95M으로 직접 오디오를 분석해 Spotify-12 호환 features + 256d 임베딩을 생성하고 pgvector로 검색.

## 현재 상태 — MVP 완성

```
✅ 166,579 트랙 audio 보유 (Tidal/Spotify/FLO/Melon 통합)
✅ 자체 모델 (MERT-95M + multi-task heads) 학습 완료
✅ 166,579 트랙에 Spotify-12 features + 256d projection 예측 완료
✅ PostgreSQL + pgvector HNSW 인덱스 적재 완료
✅ SQL 한 줄로 cosine similarity 추천 동작
```

DB 적재 결과:

| 테이블 | 행 수 |
|---|---:|
| Artist | 55,827 |
| Album | 119,197 |
| Track | 166,579 |
| TrackPlatform | 166,579 |
| TrackAudioFeatures | 166,579 |
| TrackEmbedding (256d) | 166,579 |

## 한 줄 추천 쿼리

```sql
WITH q AS (SELECT embedding FROM "TrackEmbedding" WHERE "trackId" = '<TRACK_ID>')
SELECT t.title, a.name, 1 - (e.embedding <=> q.embedding) AS similarity
FROM "TrackEmbedding" e
JOIN "Track" t ON t.id = e."trackId"
JOIN "Artist" a ON a.id = t."artistId"
CROSS JOIN q
ORDER BY e.embedding <=> q.embedding
LIMIT 10;
```

## 핵심 문서

- [docs/architecture.md](docs/architecture.md) — 시스템 설계, 데이터 흐름, 모델 구조
- [docs/pipeline.md](docs/pipeline.md) — 7단계 스크립트 런북 (입력/출력/실행 시간)
- [docs/setup.md](docs/setup.md) — 환경 셋업 + 함정 가이드
- [docs/lambda-labs-setup.md](docs/lambda-labs-setup.md) — 클라우드 GPU 임베딩 추출
- [docs/cloudflare-tunnel-setup.md](docs/cloudflare-tunnel-setup.md) — OAuth용 HTTPS 도메인

## 빠른 시작

처음 환경 셋업이면 [docs/setup.md](docs/setup.md) 먼저.

이미 셋업됐다면 전체 파이프라인:

```bash
# 1) 카탈로그 enrichment (Deezer로 ISRC + preview URL 채움)
python3 scripts/01_enrich_via_deezer.py

# 2) 오디오 다운로드
python3 scripts/02_download_audio.py
python3 scripts/02b_retry_failed.py  # 실패한 것 재시도

# 3) 오디오 사전 디코딩
python3 scripts/03a_predecode.py --workers 8

# 4) MERT 임베딩 추출 (M1: ~36h, Lambda H100: ~15분)
python3 scripts/03_extract_embeddings.py --device cuda --batch-size 64

# 5) Multi-task heads 학습 (~4분)
python3 scripts/04_train_heads.py --epochs 30 --batch-size 256

# 6) 전체 트랙에 inference
python3 scripts/05_inference.py

# 7) FAISS 인덱스 빌드
python3 scripts/06_build_faiss.py

# 8) PostgreSQL 적재
docker compose up -d
docker compose exec -T pg psql -U mrms -d mrms < prisma/init/02_schema.sql
python3 scripts/07_load_to_db.py
```

각 단계 상세는 [docs/pipeline.md](docs/pipeline.md) 참고.

## 디렉토리 구조

```
MRMS_FN/
├── pyproject.toml              # Python 의존성
├── docker-compose.yml          # PostgreSQL + pgvector (port 5433)
├── .env / .env.example         # 환경변수
├── prisma/
│   ├── schema.prisma           # DB 스키마 정의 (canonical)
│   └── init/
│       ├── 01_extensions.sql   # pgvector + pg_trgm 활성화
│       └── 02_schema.sql       # 테이블 DDL (수동 적용)
├── src/mrms/                   # 라이브러리 코드
│   ├── config.py               # pydantic-settings 통합 설정
│   ├── data/
│   │   ├── catalog.py          # CSV 36-col 스키마 + loader
│   │   └── dataset.py          # PyTorch Dataset + artist-stratified split
│   ├── ingest/
│   │   ├── deezer.py           # Deezer Search/Lookup (ISRC + preview)
│   │   ├── itunes.py           # iTunes Search (fallback)
│   │   └── spotify_meta.py     # Spotify client_credentials (~사용 안 함)
│   ├── models/
│   │   ├── encoder.py          # MERT-95M frozen wrapper
│   │   └── heads.py            # Multi-task heads (Spotify-12 + 256d)
│   └── training/
│       ├── losses.py           # MultiTaskLoss + R²/accuracy metrics
│       └── trainer.py          # PyTorch Lightning 모듈
├── scripts/                    # 파이프라인 실행 스크립트 (00~07)
├── data/                       # gitignored — 외장 SSD
│   ├── csv/                    # 카탈로그 (~200MB)
│   ├── audio/                  # m4a (~75GB)
│   ├── audio_decoded/          # npy float16 (~240GB)
│   ├── embeddings/             # MERT 768d (~600MB)
│   ├── features/               # 우리 모델 출력 (~10MB)
│   ├── projection/             # 256d 추천 임베딩 (~170MB)
│   └── faiss/                  # HNSW 인덱스 (~216MB)
├── checkpoints/                # 학습된 heads
├── logs/                       # 실행 로그
└── docs/                       # 문서
```

## 기술 스택

- **Python 3.10+**, PyTorch 2.x, PyTorch Lightning
- **MERT-95M** (m-a-p/MERT-v1-95M) — frozen audio encoder
- **Custom multi-task heads** — Spotify-12 features 회귀 + 256d projection
- **PostgreSQL 16 + pgvector** — 벡터 검색 (HNSW)
- **FAISS** — 메모리 내 추가 인덱스 (선택)
- **Lambda Labs H100** — 1회 임베딩 추출 (~$5)

## V2 로드맵

- User OAuth (Tidal/Spotify) + 청취 이력 sync
- User Embedding (multi-persona)
- Two-Tower 모델 (User × Track scoring)
- Ranking model (LightGBM 또는 DCN)
- 플레이리스트 생성 알고리즘 (에너지 곡선, MMR 다양성)
- 사용자 행동 신호 → 실시간 user_emb 업데이트
- 모델 retrain pipeline + A/B 테스트
- REST API (Next.js or FastAPI 프론트)
- danceability 차원 모델 개선 (현재 baseline 약점)
