from __future__ import annotations

import mrms.api.situation as situation_api
from fastapi.testclient import TestClient

from mrms.api.main import app
from mrms.llm.situation import SituationInterpretation, SituationLLMError

client = TestClient(app)


def _fake_interp():
    return SituationInterpretation(
        interpretation="차분한 비 오는 아침", mood_label="rainy calm",
        valence=0.4, energy=0.3, tempo_bpm=90.0, acousticness=0.5, instrumentalness=0.15,
        valence_weight=1.0, energy_weight=1.0, tempo_weight=0.6,
        acousticness_weight=0.4, instrumentalness_weight=1.0,
    )


def test_situation_requires_auth():
    client.cookies.clear()
    r = client.post("/api/situation/recommendations", json={"text": "비 오는 아침"})
    assert r.status_code in (401, 403)


def test_situation_empty_text_400(login):
    _, session_id = login()
    client.cookies.set("mrms_session", session_id)
    r = client.post("/api/situation/recommendations", json={"text": "   "})
    assert r.status_code == 400
    client.cookies.clear()


def test_situation_llm_failure_502(login, monkeypatch):
    _, session_id = login()
    client.cookies.set("mrms_session", session_id)

    def boom(_text):
        raise SituationLLMError("down")

    monkeypatch.setattr(situation_api, "interpret_situation", boom)
    r = client.post("/api/situation/recommendations", json={"text": "비 오는 아침"})
    assert r.status_code == 502
    client.cookies.clear()


def test_situation_happy_path(login, monkeypatch):
    _, session_id = login()
    client.cookies.set("mrms_session", session_id)
    monkeypatch.setattr(situation_api, "interpret_situation", lambda _t: _fake_interp())
    r = client.post("/api/situation/recommendations", json={"text": "비 오는 아침 독서"})
    assert r.status_code == 200
    data = r.json()
    assert data["interpretation"] == "차분한 비 오는 아침"
    assert data["mood_label"] == "rainy calm"
    assert data["features"]["tempo_bpm"] == 90.0
    assert isinstance(data["tracks"], list)
    client.cookies.clear()
