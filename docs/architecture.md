# MRMS 시스템 설계

## 핵심 아키텍처

```
┌──────────────────────────────────────────────────────────────┐
│ DATA INGESTION                                                │
├──────────────────────────────────────────────────────────────┤
│   [CSV 197k 트랙] → Deezer enrichment → ISRC + preview URL    │
│                                              ↓                 │
│   [iTunes/Deezer] ← multi-source download → m4a 166k 트랙    │
│                                              ↓                 │
│                                  ffmpeg 사전 디코딩            │
│                                              ↓                 │
│                              npy float16 audio cache           │
└──────────────────────────────────────────────────────────────┘
                                              ↓
┌──────────────────────────────────────────────────────────────┐
│ MODEL LAYER                                                   │
├──────────────────────────────────────────────────────────────┤
│   [MERT-95M Encoder] (frozen)                                 │
│         ↓ (30s audio @ 24kHz)                                 │
│   (1, T, 768) hidden states → mean pool → (768,)              │
│         ↓                                                      │
│   [Multi-Task Heads] (학습됨)                                 │
│   ┌────────────────────────────────────────────────────┐     │
│   │ • bounded_7 (dance/energy/valence/...) sigmoid    │     │
│   │ • tempo (BPM, log-MSE)                            │     │
│   │ • loudness (dB, MSE)                              │     │
│   │ • key (12-class CE)                               │     │
│   │ • mode (binary CE)                                │     │
│   │ • time_signature (5-class CE)                     │     │
│   │ • embedding_256 (L2-normalized, 추천용)           │     │
│   └────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────┘
                                              ↓
┌──────────────────────────────────────────────────────────────┐
│ STORAGE                                                       │
├──────────────────────────────────────────────────────────────┤
│   PostgreSQL 16 + pgvector                                    │
│   ├─ Artist / Album / Track (메타)                            │
│   ├─ TrackPlatform (Tidal/Spotify/FLO/Melon 매핑)             │
│   ├─ TrackAudioFeatures (Spotify-12 + 우리 확장)              │
│   └─ TrackEmbedding (vector(256) + HNSW index)                │
└──────────────────────────────────────────────────────────────┘
                                              ↓
┌──────────────────────────────────────────────────────────────┐
│ SERVING (현재 V1)                                             │
├──────────────────────────────────────────────────────────────┤
│   SQL `embedding <=> query_embedding` 한 줄                   │
│   → 코사인 유사도 기반 k-NN 추천                              │
│   → P95 latency <10ms (HNSW)                                  │
└──────────────────────────────────────────────────────────────┘
```

## 데이터 흐름 (Spotify-12 호환 features 생성)

```
Raw audio (30s, m4a)
     ↓ ffmpeg
PCM float16 @ 24kHz mono
     ↓ MERT-95M (frozen)
hidden states (1, ~2250, 768)
     ↓ mean pool
embedding (768,)
     ↓ multi-task heads
{danceability, energy, valence, acousticness, instrumentalness,
 liveness, speechiness, tempo, loudness, key, mode, time_signature,
 projection_256}
```

이 12개 차원은 **Spotify Web API의 `/audio-features` 응답과 호환**되어, 기존 Spotify 데이터 위에 구축된 코드가 그대로 동작.

## 모델 학습 데이터

```
전체 카탈로그:           197,789 트랙
  ├─ 임베딩 있음:        166,579 (84.2%)
  ├─ Spotify-12 라벨:     92,459 (Spotify-source가 대부분)
  └─ 학습 가능 (둘 다):   72,812 트랙

분할 (artist-stratified 80/10/10):
  ├─ Train: 57,997
  ├─ Val:    7,521
  └─ Test:   7,294
```

**Artist-stratified** 분할은 음악 ML의 흔한 데이터 누수 함정 방지 — 같은 아티스트의 곡이 train/val/test 모두에 들어가면 R²가 비현실적으로 높게 측정됨.

## DB 스키마 (V1)

```
Artist ──┬─◇─── Album
         │
         └─◇─── Track ─┬─── TrackPlatform (1:N, 플랫폼별 ID)
                       ├─── TrackAudioFeatures (Spotify-12 + 확장)
                       └─── TrackEmbedding (vector(256), HNSW)
```

V2에서 추가될 부분 (이미 prisma/schema.prisma에 정의됨, 적재만 필요):
```
User ──┬─── UserOAuth (Tidal/Spotify tokens)
       ├─── UserEmbedding (per-user 256d)
       ├─── UserPersona (multi-persona, K-means)
       ├─── UserProfile (집계 통계)
       ├─── UserBlocked
       ├─── UserSession
       ├─── TrackInteraction (재생/스킵/저장 이력)
       └─── PlaylistHistory
```

## 핵심 설계 결정

### 1. Frozen MERT + 작은 학습 가능한 heads

```
MERT-95M (95M 파라미터) ─── frozen
        ↓
Multi-task heads (1.7M 파라미터) ─── 학습
```

이유:
- 92k 라벨로 95M 전체 finetune은 overfit 위험
- Frozen 인코더는 한 번 추출하면 768d 캐시 재사용
- 학습 단계는 4분 안에 끝남 → 빠른 실험 사이클
- M1 같은 약한 GPU에서도 head 학습 가능

### 2. 256d projection (768 → 256)

이유:
- pgvector에서 768d는 메모리 큼 (검색 P99 ↑)
- 256d로 압축해도 음악적 유사도 잘 보존
- HNSW 인덱스 크기 1/3
- DB 적재 시간 단축

### 3. ISRC를 키로

이유:
- 글로벌 표준 식별자 (Spotify/Tidal/Apple 동일)
- 플랫폼 간 매칭 쉬움
- 단, 같은 곡이 다른 ISRC로 등록되는 경우 있음 (앨범 버전 차이 등)

### 4. Deezer로 enrichment + iTunes로 fallback

이유:
- Deezer Search API: ISRC + 30s preview URL을 한 번에 (무료, 무한 quota)
- Spotify Web API: 신규 dev 앱은 daily quota 매우 낮음 (실패함)
- iTunes Search: text fallback에 강함 (90s preview)
- 최종 audio 커버리지: ~84% (162k / 197k)

### 5. PostgreSQL + pgvector를 메인 store로

이유:
- Single source of truth (메타 + 임베딩 함께)
- HNSW 인덱스로 k-NN P95 <10ms
- SQL JOIN으로 추천 + 메타 한 쿼리
- FAISS는 보조 (백업 + 빠른 batch 검색)
- 운영 친화적 (백업/복제/모니터링 표준)

## 모델 성능 (Test set, 7,294 트랙)

| Metric | 값 | 평가 |
|---|---|---|
| loss_bounded (MSE) | 0.0235 | 🟢 RMSE 0.15 on [0,1] |
| loss_tempo (log-MSE) | 0.058 | 🟢 강함 |
| loss_loudness (MSE, dB) | 8.94 | 🟡 dB scale |
| loss_mode (CE) | 0.596 | 🟡 baseline 0.693 대비 약간 ↑ |
| loss_time_sig (CE) | 0.294 | 🟢 |
| loss_key (CE) | 0.0 | ⚠ test 셋에 라벨 부족 (마스크) |

**약점**: danceability head가 모든 트랙에서 0.03~0.10 사이로 underestimate. V2에서 head 가중치 조정 + 데이터 분포 분석 필요.

## V2 — User Embedding 단계

```
사용자 청취 이력 (TrackInteraction)
        ↓
가중치 적용 (save=+5, full_listen=+2, skip_30s=-0.5, skip_5s=-2)
        ↓
시간 감쇠 (half-life 30일)
        ↓
사용자 좋아한 트랙들의 256d 임베딩 평균/aggregation
        ↓
UserEmbedding(256d)
        ↓
pgvector cosine similarity → 추천
```

multi-persona는 K-means로 사용자 청취 패턴 클러스터링 → 컨텍스트(시간대/디바이스)별 다른 임베딩 선택.

## V2 — Two-Tower

```
User Tower:  history → aggregator → user_emb_256
Track Tower: audio → MERT → heads → track_emb_256
                                ↓
                  shared embedding space (256d)
                                ↓
                  cosine_sim(user, track) → score
```

학습:
- Positive pairs: (user, 좋아한 곡)
- Negative pairs: random or hard negatives
- InfoNCE / contrastive loss
- 두 타워의 임베딩 공간 정렬

이때 비로소 **"이 사용자가 좋아할 확률"이 높은 곡**을 찾을 수 있음 (V1의 단순 트랙 유사도와 다름).
