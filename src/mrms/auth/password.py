"""비밀번호 해싱 — bcrypt."""
from __future__ import annotations

import bcrypt


def hash_password(plain: str) -> str:
    """평문 비밀번호 → bcrypt 해시 문자열."""
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """평문이 해시와 일치하면 True. 해시 형식이 깨졌으면 False(예외 삼킴)."""
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False
