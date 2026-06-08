# 환경 셋업 가이드

## 사전 요구사항

- **macOS (M1+)** 또는 Linux (Ubuntu 22.04+)
- **Python 3.10 또는 3.11** (3.14는 일부 패키지 호환성 문제)
- **Docker Desktop** + Docker Compose
- **외장 SSD 또는 디스크 500GB+ 여유** (audio + decoded + embeddings 합산 ~300GB)
- (선택) Lambda Labs 계정 — 클라우드 GPU 사용 시
- (선택) Cloudflare 계정 + 본인 도메인 — OAuth용 HTTPS 터널

## 1. 저장소 클론 + Python 환경

```bash
cd "/Volumes/<외장 SSD>"
# 프로젝트 위치 — 외장 SSD 권장 (큰 데이터)
git clone <REPO_URL> MRMS_FN
cd MRMS_FN

# Python 가상환경 (3.10 또는 3.11)
python3.11 -m venv .venv   # 또는 python3.10
source .venv/bin/activate

# 의존성
pip install --upgrade pip
pip install -e ".[dev]"

# 동작 확인
python3 -c "import torch; print('Torch:', torch.__version__, 'MPS:', torch.backends.mps.is_available())"
```

**M1 Mac**: torch가 MPS 자동 감지. `MPS: True` 나와야 정상.
**Linux + GPU**: `pip install torch --index-url https://download.pytorch.org/whl/cu121` 같이 CUDA 버전 지정 필요할 수 있음.

### Python 버전 함정

- **3.10/3.11**: 안전, 모든 의존성 호환
- **3.12**: 대부분 OK
- **3.13**: pyarrow 등 일부 미지원
- **3.14**: 많은 패키지 미지원 — 피하세요

Lambda Labs는 기본 3.10 — 우리 코드 호환됨.

## 2. ffmpeg 설치

오디오 디코딩 필수.

```bash
# macOS
brew install ffmpeg

# Linux
sudo apt-get install -y ffmpeg

# 확인
ffmpeg -version
which ffmpeg
```

## 3. 환경변수 (.env)

`.env.example`을 복사 + 실제 값 입력:

```bash
cp .env.example .env
# .env 편집
```

### 필수 항목

```bash
# DB (port 5433 — REMS 등 다른 PG와 충돌 피함)
DATABASE_URL=postgresql://mrms:mrms@localhost:5433/mrms

# 외장 SSD 경로 (본인 환경에 맞게)
PROJECT_ROOT=/Volumes/MacExtend 1/MRMS_FN
DATA_ROOT=${PROJECT_ROOT}/data
AUDIO_DIR=${DATA_ROOT}/audio
# ... 등 자동 파생
```

### 선택 — 사용자 OAuth (V2)

V1 (자체 모델 학습 + 추천)은 OAuth 없이도 동작.
V2에서 사용자 청취 이력 sync 필요.

```bash
# Spotify
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
SPOTIFY_REDIRECT_URI=https://mrms.<your-domain>/callback/spotify

# Tidal
TIDAL_CLIENT_ID=
TIDAL_CLIENT_SECRET=
TIDAL_REDIRECT_URI=https://mrms.<your-domain>/callback/tidal
```

**중요**: `.env`는 `.gitignore`되어 있음. `.env.example`에 실제 키 절대 넣지 마세요 (git 커밋되면 노출).

### 보안 프로그램 — Mac 함정

Korean 보안 프로그램 (안랩 등)이 Lambda Labs/Spotify dev portal 카드 등록 막을 수 있음.
모바일로 가입 + Apple Pay 사용이 가장 부드러움.

## 4. PostgreSQL + pgvector

```bash
# 시작
docker compose up -d

# 로그 확인 (ready 메시지)
docker compose logs pg | grep "ready to accept"

# 접속 테스트
docker compose exec pg psql -U mrms -d mrms -c "SELECT version();"
```

### pgvector extension

`prisma/init/01_extensions.sql`이 자동 실행되어 vector + pg_trgm + unaccent extension 활성화.

```bash
# 확인
docker compose exec pg psql -U mrms -d mrms -c "\dx"
# → vector, pg_trgm, unaccent 표시
```

### 포트 5433 — 왜?

기본 5432는 다른 프로젝트 (예: REMS) PG와 충돌. MRMS는 **5433**으로 설정.

### 테이블 생성 (Prisma 우회)

Prisma 7이 `url` 필드 deprecated해서 V6 핀이 필요한데 너무 복잡. 그냥 SQL DDL 직접 적용:

```bash
docker compose exec -T pg psql -U mrms -d mrms < prisma/init/02_schema.sql

# 테이블 확인
docker compose exec pg psql -U mrms -d mrms -c "\dt"
# → Artist, Album, Track, TrackPlatform, TrackAudioFeatures, TrackEmbedding 6개
```

**Prisma schema (`prisma/schema.prisma`)는 canonical 정의**로 남겨두고, V2에서 User 관련 테이블 추가할 때 같이 업데이트.

## 5. 데이터 디렉토리

외장 SSD에 ~300GB 여유 확보:

```bash
mkdir -p data/{csv,audio,audio_decoded,embeddings,features,projection,faiss} \
         checkpoints logs

df -h data
# → 충분한 free space (500GB+ 권장) 확인
```

### 데이터 크기

| 디렉토리 | 크기 | 비고 |
|---|---:|---|
| `data/csv/` | ~200MB | 카탈로그 (~200k 행) |
| `data/audio/` | ~75GB | 166k m4a |
| `data/audio_decoded/` | ~240GB | 사전 디코딩 npy float16 |
| `data/embeddings/` | ~600MB | MERT 768d |
| `data/features/` | ~10MB | Spotify-12 예측 |
| `data/projection/` | ~170MB | 256d projection |
| `data/faiss/` | ~216MB | HNSW 인덱스 |
| **합계** | **~316GB** | |

PostgreSQL DB는 docker volume에 별도 (~10GB).

## 6. 카탈로그 데이터 준비

기존 카탈로그 CSV가 있다면:

```bash
cp /path/to/your/ems_collected_track.csv data/csv/
```

스키마: 36 컬럼, 헤더 없음. 자세한 컬럼 매핑은 `src/mrms/data/catalog.py`의 `CATALOG_COLUMNS` 참고.

## 7. (선택) Cloudflare Tunnel

OAuth 콜백용 HTTPS 도메인. V1에선 불필요, V2에서 사용.

자세한 가이드: [cloudflare-tunnel-setup.md](cloudflare-tunnel-setup.md)

## 8. (선택) Lambda Labs

M1에서 MERT 임베딩 추출이 36시간 걸려서 클라우드 GPU 권장.

자세한 가이드: [lambda-labs-setup.md](lambda-labs-setup.md)

비용: $5~10 (1회 실행)

## 9. 동작 확인

```bash
# Python imports
python3 -c "
import sys; sys.path.insert(0, 'src')
from mrms.config import settings
from mrms.data.catalog import load_catalog
from mrms.models.encoder import MERTEncoder
print('✓ all imports OK')
print('  DB URL:', settings.database_url)
print('  Audio dir:', settings.audio_dir)
"

# DB 연결
python3 -c "
import psycopg
import os
from dotenv import load_dotenv
load_dotenv()
with psycopg.connect(os.environ['DATABASE_URL']) as conn:
    print('✓ DB connection OK')
"

# Torch device
python3 -c "
import torch
if torch.backends.mps.is_available():
    print('✓ MPS available (M1)')
elif torch.cuda.is_available():
    print('✓ CUDA available:', torch.cuda.get_device_name(0))
else:
    print('⚠ CPU only — 매우 느림')
"
```

## 자주 마주치는 셋업 함정

### `ModuleNotFoundError: No module named 'mrms'`

```bash
# pyproject.toml editable 설치 확인
pip install -e .

# 또는 PYTHONPATH 임시 설정
export PYTHONPATH=$(pwd)/src
```

### `pyarrow` import 실패

```bash
pip install pyarrow
# Python 3.13/3.14는 미지원 — 3.10/3.11로 venv 재생성
```

### `docker compose` vs `docker-compose`

- **Docker Desktop 최신**: `docker compose` (스페이스)
- **Legacy**: `docker-compose` (하이픈)

문서는 `docker compose` 사용. 막히면 `docker-compose`로 시도.

### `port 5432 already in use`

```bash
# 어떤 process가 5432 점유 중인지
lsof -i :5432
# REMS 등 다른 docker compose 멈추거나, MRMS를 다른 port (5433)로 (이미 그렇게 설정됨)
```

### `pip install -e .` 권한 에러

```bash
# venv 활성화 안 됨 — 시스템 Python에 설치하려고 시도
which python3
# → .venv/bin/python3 여야 정상
```

### SSH key passphrase 반복

```bash
# ssh-agent에 등록 (1회만)
eval "$(ssh-agent)"
ssh-add ~/.ssh/lambda_mrms
```

### `BrokenPipeError` from `pip list | head`

→ 무해. head가 일찍 닫혀서 pip가 stdout 끊김 감지한 것. 패키지 설치는 정상.
