"""단발 HTTP 콜백 서버 테스트."""
import threading
import time
from urllib.request import urlopen

import pytest

from mrms.auth.callback_server import CallbackServer


def test_receive_callback_with_code_and_state():
    """서버 시작 → GET 요청 → code/state 수신 → 자체 종료."""
    server = CallbackServer(host="127.0.0.1", port=18801, path="/callback/tidal")
    result = {}

    def worker():
        code, state = server.wait_for_callback(timeout=5)
        result["code"] = code
        result["state"] = state

    t = threading.Thread(target=worker, daemon=True)
    t.start()
    time.sleep(0.2)

    # 요청 보내기 (실제 OAuth provider 흉내)
    with urlopen("http://127.0.0.1:18801/callback/tidal?code=XYZ&state=ABC") as resp:
        body = resp.read().decode()
    assert "인증 완료" in body or "성공" in body or "complete" in body.lower()

    t.join(timeout=2)
    assert result["code"] == "XYZ"
    assert result["state"] == "ABC"


def test_timeout_raises():
    """timeout 안에 콜백 안 오면 TimeoutError."""
    server = CallbackServer(host="127.0.0.1", port=18802, path="/callback/tidal")
    with pytest.raises(TimeoutError):
        server.wait_for_callback(timeout=0.5)


def test_ignores_other_paths():
    """등록 안 한 path 요청은 무시 (404), wait는 계속 대기."""
    server = CallbackServer(host="127.0.0.1", port=18803, path="/callback/tidal")
    result = {}

    def worker():
        try:
            code, state = server.wait_for_callback(timeout=2)
            result["code"] = code
        except TimeoutError:
            result["code"] = None

    t = threading.Thread(target=worker, daemon=True)
    t.start()
    time.sleep(0.2)

    # 잘못된 path
    try:
        urlopen("http://127.0.0.1:18803/something_else")
    except Exception:
        pass

    # 그 다음 올바른 path
    urlopen("http://127.0.0.1:18803/callback/tidal?code=OK&state=S")

    t.join(timeout=3)
    assert result["code"] == "OK"
