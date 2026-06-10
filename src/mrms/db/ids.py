"""sha1 기반 결정론적 ID 생성 — 공용 헬퍼.

cuid 호환 포맷('c' + sha1 hex 24자). 같은 입력이면 같은 ID (재실행 멱등성).
usedforsecurity=False: 보안 용도가 아니므로 FIPS 환경에서도 동작.
"""
from __future__ import annotations

import hashlib


def stable_id(value: str) -> str:
    return f"c{hashlib.sha1(value.encode(), usedforsecurity=False).hexdigest()[:24]}"
