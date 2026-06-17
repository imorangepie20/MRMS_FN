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
