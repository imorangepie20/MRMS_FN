from __future__ import annotations

from fastapi.testclient import TestClient

from mrms.api.main import app

client = TestClient(app)


def test_wellness_requires_auth():
    client.cookies.clear()
    r = client.get("/api/wellness/recommendations", params={"mood": "calm"})
    assert r.status_code in (401, 403)


def test_wellness_bad_mood_400(login):
    user_id, session_id = login()
    client.cookies.set("mrms_session", session_id)
    r = client.get("/api/wellness/recommendations", params={"mood": "nope"})
    assert r.status_code == 400
    client.cookies.clear()


def test_wellness_returns_list(login):
    user_id, session_id = login()
    client.cookies.set("mrms_session", session_id)
    r = client.get("/api/wellness/recommendations", params={"mood": "energize"})
    assert r.status_code == 200
    data = r.json()
    assert data["mood"] == "energize"
    assert isinstance(data["tracks"], list)
    client.cookies.clear()
