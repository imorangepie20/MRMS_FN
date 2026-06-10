"""증분 EMP 임베딩 로더.

EMP 풀에 새로 들어온 트랙의 768d MERT npy (03_extract_embeddings.py 출력)를
기존 카탈로그와 동일한 trained projection head (04_train_heads.py 체크포인트)로
256d 변환해 TrackEmbedding(modelVersion=EMBEDDING_MODEL_VERSION)에 적재.

07_load_to_db.py(일회성 카탈로그 적재, parquet 입력 필요)의 증분 대체 —
EMP 파이프라인 (run_emp_pipeline.py)의 마지막 stage가 이 스크립트를 호출.

Usage:
    python scripts/10_load_emp_embeddings.py
    python scripts/10_load_emp_embeddings.py --dry-run --limit 5
    python scripts/10_load_emp_embeddings.py --device mps --batch-size 256
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from mrms.emp.embedding_loader import main

if __name__ == "__main__":
    sys.exit(main())
