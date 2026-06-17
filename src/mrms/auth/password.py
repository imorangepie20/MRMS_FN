"""비밀번호 해싱 — bcrypt."""
from __future__ import annotations

import bcrypt


def _encode(plain: str) -> bytes:
    """bcrypt 입력 바이트. bcrypt는 72바이트만 사용하며 5.x는 초과 시 ValueError를
    던지므로(멀티바이트 한글 비밀번호도 도달) 인코딩 후 72바이트로 절단한다.
    hash/verify가 동일 절단을 써야 검증이 일치한다."""
    return plain.encode("utf-8")[:72]


def hash_password(plain: str) -> str:
    """평문 비밀번호 → bcrypt 해시 문자열."""
    return bcrypt.hashpw(_encode(plain), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """평문이 해시와 일치하면 True. 해시 형식이 깨졌으면 False(예외 삼킴)."""
    try:
        return bcrypt.checkpw(_encode(plain), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False
