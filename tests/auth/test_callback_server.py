"""단발 HTTP 콜백 서버 테스트."""
import socket
import threading
import time
from urllib.error import URLError
from urllib.request import urlopen

import pytest

from mrms.auth.callback_server import CallbackServer


def _free_port() -> int:
    """OS가 할당한 ephemeral 포트 반환 (테스트 간 충돌 방지)."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _wait_ready(port: int, timeout: float = 2.0) -> None:
    """서버가 listen 시작할 때까지 짧게 poll."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=0.1):
                return
        except OSError:
            time.sleep(0.02)
    raise TimeoutError(f"서버 {port}가 {timeout}초 안에 listen 안 함")


def test_receive_callback_with_code_and_state():
    """서버 시작 → GET 요청 → code/state 수신 → 자체 종료."""
    port = _free_port()
    server = CallbackServer(host="127.0.0.1", port=port, path="/callback/tidal")
    result = {}

    def worker():
        code, state = server.wait_for_callback(timeout=5)
        result["code"] = code
        result["state"] = state

    t = threading.Thread(target=worker, daemon=True)
    t.start()
    _wait_ready(port)

    with urlopen(f"http://127.0.0.1:{port}/callback/tidal?code=XYZ&state=ABC") as resp:
        body = resp.read().decode()
    assert "인증 완료" in body or "성공" in body or "complete" in body.lower()

    t.join(timeout=2)
    assert result["code"] == "XYZ"
    assert result["state"] == "ABC"


def test_timeout_raises():
    """timeout 안에 콜백 안 오면 TimeoutError."""
    port = _free_port()
    server = CallbackServer(host="127.0.0.1", port=port, path="/callback/tidal")
    with pytest.raises(TimeoutError):
        server.wait_for_callback(timeout=0.5)


def test_ignores_other_paths():
    """등록 안 한 path 요청은 무시 (404), wait는 계속 대기."""
    port = _free_port()
    server = CallbackServer(host="127.0.0.1", port=port, path="/callback/tidal")
    result = {}

    def worker():
        try:
            code, state = server.wait_for_callback(timeout=3)
            result["code"] = code
        except TimeoutError:
            result["code"] = None

    t = threading.Thread(target=worker, daemon=True)
    t.start()
    _wait_ready(port)

    # 잘못된 path
    try:
        urlopen(f"http://127.0.0.1:{port}/something_else")
    except URLError:
        pass
    except Exception:
        pass

    # 그 다음 올바른 path
    urlopen(f"http://127.0.0.1:{port}/callback/tidal?code=OK&state=S")

    t.join(timeout=3)
    assert result["code"] == "OK"
