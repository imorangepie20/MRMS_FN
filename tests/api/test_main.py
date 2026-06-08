"""FastAPI endpoint 테스트 (TestClient)."""
from fastapi.testclient import TestClient

from mrms.api.main import app


client = TestClient(app)


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}
