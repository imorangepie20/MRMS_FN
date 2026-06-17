"""bcrypt 해시/검증 단위."""
from mrms.auth.password import hash_password, verify_password


def test_hash_then_verify_roundtrip():
    h = hash_password("s3cret-pw")
    assert h != "s3cret-pw"          # 평문이 아님
    assert verify_password("s3cret-pw", h) is True


def test_verify_wrong_password():
    h = hash_password("s3cret-pw")
    assert verify_password("wrong", h) is False


def test_verify_malformed_hash_returns_false():
    assert verify_password("anything", "not-a-bcrypt-hash") is False


def test_long_multibyte_password_roundtrip():
    """한글 등 멀티바이트 비밀번호(>72바이트)도 hash/verify 라운드트립(bcrypt 5.x ValueError 방지)."""
    pw = "비밀" * 15  # 30자, UTF-8 90바이트 > 72
    h = hash_password(pw)
    assert verify_password(pw, h) is True
