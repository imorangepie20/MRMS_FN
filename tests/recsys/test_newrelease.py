"""취향 맞춤 신보(신곡) — 2단계 Gemini(grounded→structured) + 적재/제외."""
from __future__ import annotations

import uuid as _uuid
from unittest.mock import patch

import pytest

import mrms.recsys.discover as _disc_mod
import mrms.recsys.newrelease as _nr_mod
from mrms.db.user_track import get_or_create_user
from mrms.emp.base import upsert_track_and_emp_source
from mrms.recsys.discover import TrackSuggestion, TrackSuggestions
from mrms.recsys.newrelease import gemini_new_releases, read_newrelease


# ── 2-call fake Gemini (Call1=grounded text, Call2=structured parsed) ──
class _FakeModels2:
    def __init__(self, results):
        self._results = list(results)
        self.calls = []

    def generate_content(self, **kwargs):
        self.calls.append(kwargs)
        r = self._results[len(self.calls) - 1]
        if isinstance(r, Exception):
            raise r
        return r


class _FakeTextResp:
    def __init__(self, text):
        self.text = text


class _FakeParsedResp:
    def __init__(self, parsed):
        self.parsed = parsed


class _FakeClient2:
    def __init__(self, results):
        self.models = _FakeModels2(results)


class _StubYT:
    def __init__(self, by_query):
        self._by_query = by_query

    def search(self, q):
        return self._by_query.get(q, [])


def _song_item(vid, title, artist):
    return {
        "resultType": "song", "videoId": vid, "title": title,
        "artists": [{"name": artist}], "album": {"name": "A"},
        "duration_seconds": 180, "thumbnails": [{"url": "c", "width": 300}],
    }


def _grounded(text):
    return _FakeTextResp(text)


def _structured(items):
    return _FakeParsedResp(TrackSuggestions(items=items))


def test_gemini_new_releases_two_step_order():
    """Call1=grounded(tools=google_search), Call2=structured(response_schema)."""
    client = _FakeClient2([
        _grounded("NewArtist - Fresh Song (2026 발매)"),
        _structured([TrackSuggestion(artist="NewArtist", title="Fresh Song")]),
    ])
    out = gemini_new_releases({"artists": ["X"], "genres": ["pop"]}, 5, client=client)
    assert [s.title for s in out] == ["Fresh Song"]
    assert len(client.models.calls) == 2
    # Call1 grounded(tools 있음, schema 없음), Call2 structured(schema 있음, tools 없음)
    c0, c1 = client.models.calls[0]["config"], client.models.calls[1]["config"]
    assert c0.tools is not None and c0.response_schema is None
    assert c1.tools is None and c1.response_schema is not None


def test_gemini_new_releases_empty_grounded_raises():
    from mrms.recsys.discover import DiscoveryLLMError
    client = _FakeClient2([_grounded(""), _structured([])])
    with pytest.raises(DiscoveryLLMError):
        gemini_new_releases({"artists": ["X"], "genres": []}, 5, client=client)


def test_gemini_new_releases_none_parsed_raises():
    from mrms.recsys.discover import DiscoveryLLMError
    client = _FakeClient2([_grounded("some text"), _FakeParsedResp(None)])
    with pytest.raises(DiscoveryLLMError):
        gemini_new_releases({"artists": ["X"], "genres": []}, 5, client=client)


def test_gemini_new_releases_wraps_exception():
    from mrms.recsys.discover import DiscoveryLLMError
    client = _FakeClient2([RuntimeError("boom")])
    with pytest.raises(DiscoveryLLMError):
        gemini_new_releases({"artists": ["X"], "genres": []}, 5, client=client)


# ── DB 시드 헬퍼 (test_discover.py 복제) ──
def _mk_artist(conn, name, genre=None):
    aid = "ar_" + _uuid.uuid4().hex[:12]
    with conn.cursor() as cur:
        cur.execute(
            'INSERT INTO "Artist" (id, name, "nameNormalized", "mainGenre") VALUES (%s,%s,%s,%s)',
            (aid, name, name.lower(), genre),
        )
    return aid


def _mk_track(conn, artist_id, title):
    tid = "tr_" + _uuid.uuid4().hex[:12]
    with conn.cursor() as cur:
        cur.execute(
            'INSERT INTO "Track" (id, isrc, title, "titleNormalized", "durationMs", "artistId") '
            'VALUES (%s,%s,%s,%s,%s,%s)',
            (tid, "TST" + tid[-9:], title, title.lower(), 0, artist_id),
        )
    return tid


def _add_usertrack(conn, user_id, track_id):
    with conn.cursor() as cur:
        cur.execute(
            'INSERT INTO "UserTrack" (id, "userId", "trackId", "isCore", source, platform) '
            'VALUES (%s,%s,%s,FALSE,%s,%s) ON CONFLICT DO NOTHING',
            ("ut_" + _uuid.uuid4().hex[:12], user_id, track_id, "liked", "youtube"),
        )


def test_generate_user_newrelease_persists_and_excludes(db_conn, cleanup):
    """신곡 적재 + 보유곡 + discovery 곡 둘 다 제외."""
    user_id = get_or_create_user(db_conn, f"nr-{_uuid.uuid4().hex[:8]}@test.com")
    # 라이브러리(시드 + 보유곡 제외): Diana Krall 1곡
    a = _mk_artist(db_conn, "Diana Krall", "jazz")
    owned_tid = _mk_track(db_conn, a, "The Look of Love")
    _add_usertrack(db_conn, user_id, owned_tid)
    # 이미 discovery로 노출 중인 곡 1개 (제외돼야)
    disc = upsert_track_and_emp_source(
        db_conn, isrc=None, title="Disc Song", artist="Disc Artist",
        album_title=None, duration_ms=180000, platform="youtube",
        platform_track_id="YTDISC", source_type="discovery",
        source_id=f"discovery:{user_id}", source_name="Discovery",
    )
    db_conn.commit()
    cleanup('DELETE FROM "EMPSource" WHERE source_id = %s', (f"discovery:{user_id}",))
    cleanup('DELETE FROM "EMPSource" WHERE source_id = %s', (f"new_release:{user_id}",))

    # Gemini fake(2-call): [신곡, 보유곡, discovery곡] 제안 → 신곡만 남아야
    client = _FakeClient2([
        _grounded("text"),
        _structured([
            TrackSuggestion(artist="Stacey Kent", title="New Hit"),
            TrackSuggestion(artist="Diana Krall", title="The Look of Love"),
            TrackSuggestion(artist="Disc Artist", title="Disc Song"),
        ]),
    ])
    stub = _StubYT({
        "Stacey Kent New Hit": [_song_item("YTNR1", "New Hit", "Stacey Kent")],
        "Diana Krall The Look of Love": [_song_item("YTOWN", "The Look of Love", "Diana Krall")],
        "Disc Artist Disc Song": [_song_item("YTDISC2", "Disc Song", "Disc Artist")],
    })
    with patch.object(_disc_mod, "_ytmusic", return_value=stub):
        count = _nr_mod.generate_user_newrelease(db_conn, user_id, client=client, n=5)

    assert count == 1  # 보유곡·discovery곡 제외 → 신곡 1개만
    rows = read_newrelease(db_conn, user_id, limit=10)
    assert [r["youtube_track_id"] for r in rows] == ["YTNR1"]

    # cleanup 등록 역순(=실행 순): Artist → owned Track → 적재 Track들 → discovery Track → UserTrack
    cleanup('DELETE FROM "Artist" WHERE id = %s', (a,))
    cleanup('DELETE FROM "Track" WHERE "artistId" = %s', (a,))
    for r in rows:
        cleanup('DELETE FROM "Track" WHERE id = %s', (r["track_id"],))
    cleanup('DELETE FROM "Track" WHERE id = %s', (disc["track_id"],))
    cleanup('DELETE FROM "UserTrack" WHERE "userId" = %s', (user_id,))


def test_generate_user_newrelease_no_seed_returns_zero(db_conn):
    """UserTrack 없음 → seed 빈약 → Gemini 호출 전에 0."""
    user_id = get_or_create_user(db_conn, f"nrns-{_uuid.uuid4().hex[:8]}@test.com")
    client = _FakeClient2([_grounded("t"), _structured([])])
    count = _nr_mod.generate_user_newrelease(db_conn, user_id, client=client, n=5)
    assert count == 0
    assert client.models.calls == []  # seed 비면 Gemini 미호출


def test_generate_user_newrelease_no_key_skips(db_conn, monkeypatch):
    """client=None + 키 없음 → 조용히 skip(0)."""
    user_id = get_or_create_user(db_conn, f"nrnk-{_uuid.uuid4().hex[:8]}@test.com")
    monkeypatch.setattr(_nr_mod.settings, "gemini_api_key", "")
    count = _nr_mod.generate_user_newrelease(db_conn, user_id, client=None, n=5)
    assert count == 0
