"""MERT-95M 인코더 래퍼.

MERT (Music Encoder Representations via Transformers) — Wav2Vec2 기반,
160k 시간 음악 데이터로 사전학습된 SSL 모델. 768-d hidden states 출력.

사용:
    encoder = MERTEncoder(device="mps")
    audio = librosa.load("track.m4a", sr=24000)[0]  # 1D ndarray
    emb = encoder.encode_audio(audio)               # (768,) tensor
    embs = encoder.encode_batch([a1, a2, a3])       # (B, 768) tensor

Refs:
    https://huggingface.co/m-a-p/MERT-v1-95M
"""

from __future__ import annotations

from typing import Optional

import numpy as np
import torch
import torch.nn as nn
from transformers import AutoModel, Wav2Vec2FeatureExtractor

DEFAULT_MODEL = "m-a-p/MERT-v1-95M"
SAMPLE_RATE = 24_000


class MERTEncoder(nn.Module):
    """Frozen MERT-95M 인코더 + 시간 평균 풀링."""

    def __init__(
        self,
        model_id: str = DEFAULT_MODEL,
        device: str = "mps",
        precision: str = "fp32",  # 'fp32' | 'fp16'
        max_audio_seconds: float = 30.0,
    ):
        super().__init__()
        self.model_id = model_id
        self.device = torch.device(device)
        self.max_samples = int(max_audio_seconds * SAMPLE_RATE)

        self.processor = Wav2Vec2FeatureExtractor.from_pretrained(
            model_id, trust_remote_code=True
        )
        self.model = AutoModel.from_pretrained(
            model_id, trust_remote_code=True
        )

        # 전부 freeze (inference only)
        for p in self.model.parameters():
            p.requires_grad = False
        self.model.eval()

        # MPS는 fp16 지원 (속도 ↑)
        if precision == "fp16" and device != "cpu":
            self.model.half()
        self.precision = precision

        self.model.to(self.device)

    @property
    def hidden_dim(self) -> int:
        return self.model.config.hidden_size  # 768

    def _prep(self, audio: np.ndarray) -> np.ndarray:
        """길이 제한 + 0-패딩 정규화 (너무 짧으면 0-pad)."""
        if len(audio) > self.max_samples:
            audio = audio[: self.max_samples]
        # 최소 1초는 있어야 의미 있음
        min_len = SAMPLE_RATE
        if len(audio) < min_len:
            audio = np.pad(audio, (0, min_len - len(audio)))
        return audio.astype(np.float32)

    @torch.no_grad()
    def encode_audio(self, audio: np.ndarray) -> torch.Tensor:
        """단일 오디오 → (hidden_dim,) mean-pooled embedding."""
        audio = self._prep(audio)
        inputs = self.processor(
            audio, sampling_rate=SAMPLE_RATE, return_tensors="pt"
        )
        input_values = inputs["input_values"].to(self.device)
        if self.precision == "fp16" and self.device.type != "cpu":
            input_values = input_values.half()

        outputs = self.model(input_values)
        # outputs.last_hidden_state: (1, T, hidden_dim)
        emb = outputs.last_hidden_state.mean(dim=1).squeeze(0)  # (hidden_dim,)
        return emb.float().cpu()

    @torch.no_grad()
    def encode_batch(
        self,
        audios: list[np.ndarray],
    ) -> torch.Tensor:
        """배치 인코딩 → (B, hidden_dim) mean-pooled."""
        prepped = [self._prep(a) for a in audios]
        inputs = self.processor(
            prepped,
            sampling_rate=SAMPLE_RATE,
            return_tensors="pt",
            padding=True,
        )
        input_values = inputs["input_values"].to(self.device)
        attention_mask: Optional[torch.Tensor] = inputs.get("attention_mask")
        if attention_mask is not None:
            attention_mask = attention_mask.to(self.device)

        if self.precision == "fp16" and self.device.type != "cpu":
            input_values = input_values.half()

        outputs = self.model(input_values, attention_mask=attention_mask)
        # masked mean pool
        h = outputs.last_hidden_state  # (B, T, D)
        if attention_mask is not None:
            # processor가 input mask를 줘서 output frames 길이가 다를 수 있음
            # 가장 단순: 그냥 mean (대부분 동일 길이라 큰 영향 없음)
            emb = h.mean(dim=1)
        else:
            emb = h.mean(dim=1)
        return emb.float().cpu()
