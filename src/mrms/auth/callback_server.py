"""단발 OAuth 콜백 HTTP 서버.

브라우저가 redirect_uri로 GET 요청 보낼 때 code/state 수신해서
호출자에게 반환한 뒤 자체 종료. 다른 path는 404.
"""
from __future__ import annotations

import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse


_SUCCESS_HTML = """<!doctype html>
<html><head><meta charset="utf-8"><title>Auth</title></head>
<body style="font-family:sans-serif;text-align:center;padding:40px">
<h1>인증 완료</h1>
<p>이 창을 닫고 터미널로 돌아가세요.</p>
</body></html>
""".encode("utf-8")


class CallbackServer:
    def __init__(
        self,
        host: str = "127.0.0.1",
        port: int = 8080,
        path: str = "/callback/tidal",
    ):
        self.host = host
        self.port = port
        self.path = path
        self._result: tuple[str, str] | None = None
        self._event = threading.Event()
        self._httpd: HTTPServer | None = None

    def wait_for_callback(self, timeout: float = 300.0) -> tuple[str, str]:
        """서버 시작 + 단발 콜백 수신. (code, state) 반환."""
        parent = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, fmt, *args):
                pass  # silence

            def do_GET(self):
                parsed = urlparse(self.path)
                if parsed.path != parent.path:
                    self.send_response(404)
                    self.end_headers()
                    return
                qs = parse_qs(parsed.query)
                code = qs.get("code", [None])[0]
                state = qs.get("state", [None])[0]
                if code is None:
                    self.send_response(400)
                    self.end_headers()
                    self.wfile.write(b"missing code")
                    return
                parent._result = (code, state or "")
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.end_headers()
                self.wfile.write(_SUCCESS_HTML)
                parent._event.set()

        self._httpd = HTTPServer((self.host, self.port), Handler)

        def serve():
            while not self._event.is_set():
                self._httpd.handle_request()

        t = threading.Thread(target=serve, daemon=True)
        t.start()

        try:
            if not self._event.wait(timeout=timeout):
                raise TimeoutError(f"콜백 {timeout}초 안에 안 옴")
            assert self._result is not None
            return self._result
        finally:
            try:
                self._httpd.server_close()
            except Exception:
                pass
