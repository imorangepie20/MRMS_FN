# Lambda Labs A100 임베딩 추출 가이드

166k 트랙의 MERT-95M 임베딩을 1x A100에서 ~1시간에 추출.

**예상 비용**: $3~5 (instance 2~3시간 사용)

## 1. Lambda Labs 가입 + 인스턴스 선택

1. https://lambda.ai/cloud 가입 + 신용카드 등록
2. SSH 키 생성 (로컬 터미널):
   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/lambda_mrms -C "mrms-extract"
   ```
3. Lambda 콘솔 → SSH Keys → 위 `~/.ssh/lambda_mrms.pub` 내용 등록

4. 인스턴스 launch:
   - **Instance type**: `gpu_1x_a100` (PCIe 40GB) — $1.10/hour
   - **Region**: 가까운 곳 (us-west-1 또는 asia-east-1 있으면)
   - **Filesystem**: 새로 만들거나 attach 없이 진행 (instance ephemeral storage 충분)
   - **SSH key**: 위에서 등록한 키 선택
   - **Launch**

5. 시작되면 표시되는 IP 메모. 예: `123.45.67.89`

## 2. SSH 접속 확인

```bash
ssh -i ~/.ssh/lambda_mrms ubuntu@123.45.67.89
# 처음 접속시 'yes' 입력
# 접속되면 디스크 확인:
df -h /
# → /dev/nvme... 1.4T or more 있어야 함
exit
```

## 3. 코드 + 데이터 업로드

### Step A — 코드만 먼저 (작음, ~1MB)

```bash
# 로컬에서
cd "/Volumes/MacExtend 1/MRMS_FN"

# 코드 + 스크립트만 rsync
rsync -avz \
  --exclude='.venv' \
  --exclude='data' \
  --exclude='checkpoints' \
  --exclude='logs' \
  --exclude='.git' \
  --exclude='__pycache__' \
  --exclude='*.pyc' \
  -e "ssh -i ~/.ssh/lambda_mrms" \
  . ubuntu@123.45.67.89:~/mrms/
```

### Step B — m4a 오디오 (75GB)

```bash
# 백그라운드 + 진행률 표시
rsync -avhP \
  -e "ssh -i ~/.ssh/lambda_mrms" \
  data/audio/ ubuntu@123.45.67.89:~/mrms/data/audio/
```

홈 인터넷 업로드 속도에 따라 30분~2시간. 중간에 끊겨도 `rsync` 재실행으로 재개.

## 4. 원격에서 환경 셋업

```bash
ssh -i ~/.ssh/lambda_mrms ubuntu@123.45.67.89

# Lambda Labs는 ubuntu + python3 + cuda 기본 제공
cd ~/mrms

# Python 가상환경
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip

# 의존성 (CUDA torch 자동 감지)
pip install -e .

# ffmpeg 설치 (디코딩용)
sudo apt-get update && sudo apt-get install -y ffmpeg

# 동작 확인
python3 -c "import torch; print('CUDA:', torch.cuda.is_available(), torch.cuda.get_device_name(0))"
# → CUDA: True NVIDIA A100-PCIE-40GB
```

## 5. 디코딩 + 임베딩 추출

```bash
# 활성 venv 상태에서
cd ~/mrms

# Step 1: m4a → npy 디코딩 (병렬 16 worker, ~20분)
python3 scripts/03a_predecode.py --workers 16

# Step 2: MERT 임베딩 추출 (A100, ~30~60분)
python3 scripts/03_extract_embeddings.py \
  --device cuda \
  --precision fp16 \
  --batch-size 32
```

A100에선:
- batch 32 가능 (vs M1 batch 8)
- 추정 throughput: ~60~100 tracks/sec
- 166k / 80 = 2080초 = **약 35분**

## 6. 결과 다운로드

```bash
# 로컬에서 (분리된 터미널)
cd "/Volumes/MacExtend 1/MRMS_FN"

rsync -avhP \
  -e "ssh -i ~/.ssh/lambda_mrms" \
  ubuntu@123.45.67.89:~/mrms/data/embeddings/ \
  data/embeddings/
```

- 166k × 3KB = ~600MB
- 다운로드 1~2분

## 7. 인스턴스 종료 (중요!)

```bash
# Lambda 콘솔에서 instance Terminate 클릭
# 또는 SSH에서:
sudo poweroff  # 안전한 종료. Lambda는 자동으로 instance 회수
```

**종료 안 하면 시간당 $1.10 계속 청구됩니다.**

## 8. 총 비용 추정

```
Upload 1h    ┐
Setup 10min   │  instance 시간당 $1.10
Decode 20min  │  ≈ 2.5h × $1.10 = $2.75
Embed 35min   │
Download 5min ┘

총: $3 ~ 5
```

## 트러블슈팅

**rsync 끊김** → 재실행만 하면 됨 (이미 전송된 파일 skip)

**CUDA OOM at batch 32** → `--batch-size 16` 으로 줄임 (시간 약간 ↑)

**디스크 부족** → 75GB m4a + 240GB npy + 600MB embeddings = ~316GB. Lambda 1.4TB 디스크에 여유 충분

**모델 다운로드 실패** → Lambda 인터넷은 빠르니까 retry 한 번이면 됨

## 작업 완료 후

로컬에 다운로드한 `data/embeddings/mert_v1_95m/` 활용해서:

```bash
# M1에서 heads 학습 (1~2시간)
python3 scripts/04_train_heads.py --epochs 30 --batch-size 256
```
