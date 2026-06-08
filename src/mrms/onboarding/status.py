"""Onboarding 진행 상태 — in-memory store."""
from __future__ import annotations

from threading import Lock
from typing import Literal


Step = Literal[
    "idle",
    "fetching_favorites",
    "matching_tracks",
    "computing_embedding",
    "clustering",
    "generating_mrt",
    "done",
    "error",
]


class OnboardingStatus:
    def __init__(self) -> None:
        self.step: Step = "idle"
        self.progress: int = 0
        self.message: str | None = None
        self.error: str | None = None

    def set(self, step: Step, progress: int, message: str | None = None) -> None:
        self.step = step
        self.progress = progress
        self.message = message

    def fail(self, error: str) -> None:
        self.step = "error"
        self.error = error

    def to_dict(self) -> dict:
        return {
            "step": self.step,
            "progress": self.progress,
            "message": self.message,
            "error": self.error,
        }


_store: dict[str, OnboardingStatus] = {}
_lock = Lock()


def get_or_create_status(user_id: str) -> OnboardingStatus:
    with _lock:
        if user_id not in _store:
            _store[user_id] = OnboardingStatus()
        return _store[user_id]


def reset_status(user_id: str) -> OnboardingStatus:
    with _lock:
        _store[user_id] = OnboardingStatus()
        return _store[user_id]
