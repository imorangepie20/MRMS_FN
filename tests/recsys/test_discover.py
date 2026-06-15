"""EMP-밖 discovery — blend/seed/read/gemini/resolve/generate."""
from __future__ import annotations

import uuid as _uuid

import psycopg
import pytest

from mrms.db.emp import delete_emp_sources_by_source_id
from mrms.db.user_track import get_or_create_user
from mrms.recsys.discover import (
    DiscoveryLLMError,
    TrackSuggestion,
    TrackSuggestions,
    blend_recsys,
    gemini_related_tracks,
    read_discovery,
    taste_seed,
)


def test_blend_interleaves_taste_and_discovery_5050():
    out = blend_recsys(["t1", "t2", "t3"], ["d1", "d2", "d3"], 6)
    assert out == ["t1", "d1", "t2", "d2", "t3", "d3"]


def test_blend_dedups_by_track_id_keeping_first():
    out = blend_recsys(["t1", "t2"], ["t1", "d1"], 4)
    # t1 from taste first; discovery t1 skipped as dup
    assert out == ["t1", "d1", "t2"]


def test_blend_drains_remaining_when_one_side_short():
    out = blend_recsys(["t1", "t2", "t3"], ["d1"], 10)
    assert out == ["t1", "d1", "t2", "t3"]


def test_blend_empty_discovery_returns_taste_only_capped():
    assert blend_recsys(["t1", "t2", "t3"], [], 2) == ["t1", "t2"]


def test_blend_empty_taste_returns_discovery_only():
    assert blend_recsys([], ["d1", "d2"], 5) == ["d1", "d2"]


def _mk_artist(conn, name, genre=None):
    aid = "ar_" + _uuid.uuid4().hex[:12]
    with conn.cursor() as cur:
        cur.execute(
            'INSERT INTO "Artist" (id, name, "nameNormalized", "mainGenre") VALUES (%s,%s,%s,%s)',
            (aid, name, name.lower(), genre),
        )
    return aid


def _mk_track(conn, artist_id, title):
    # 실제 Track NOT NULL 컬럼 전부 채운다 (test_user_mrt.py 셋업과 동일):
    # isrc(UNIQUE NOT NULL), titleNormalized·durationMs(NOT NULL).
    tid = "tr_" + _uuid.uuid4().hex[:12]
    with conn.cursor() as cur:
        cur.execute(
            'INSERT INTO "Track" (id, isrc, title, "titleNormalized", "durationMs", "artistId") '
            'VALUES (%s,%s,%s,%s,%s,%s)',
            (tid, "TST" + tid[-9:], title, title.lower(), 0, artist_id),
        )
    return tid


def _add_usertrack(conn, user_id, track_id):
    # UserTrack NOT NULL 컬럼: isCore, platform.
    with conn.cursor() as cur:
        cur.execute(
            'INSERT INTO "UserTrack" (id, "userId", "trackId", "isCore", source, platform) '
            'VALUES (%s,%s,%s,FALSE,%s,%s) ON CONFLICT DO NOTHING',
            ("ut_" + _uuid.uuid4().hex[:12], user_id, track_id, "liked", "youtube"),
        )


def test_taste_seed_top_artists_and_genres(db_conn: psycopg.Connection, cleanup):
    user_id = get_or_create_user(db_conn, f"seed-{_uuid.uuid4().hex[:8]}@test.com")
    a1 = _mk_artist(db_conn, "Diana Krall", "jazz")
    a2 = _mk_artist(db_conn, "IU", "kpop")
    # cleanup은 reversed 실행 → 자식(UserTrack→Track→Artist)이 먼저 지워지도록 부모부터 등록.
    # (Track.artistId→Artist는 RESTRICT라 Artist를 먼저 지우면 FK 실패.)
    cleanup('DELETE FROM "Artist" WHERE id = ANY(%s)', ([a1, a2],))
    cleanup('DELETE FROM "Track" WHERE "artistId" = ANY(%s)', ([a1, a2],))
    cleanup('DELETE FROM "UserTrack" WHERE "userId" = %s', (user_id,))
    # Diana Krall 2곡, IU 1곡 → Diana 먼저
    for t in ["The Look of Love", "Peel Me a Grape"]:
        _add_usertrack(db_conn, user_id, _mk_track(db_conn, a1, t))
    _add_usertrack(db_conn, user_id, _mk_track(db_conn, a2, "Through the Night"))
    db_conn.commit()

    seed = taste_seed(db_conn, user_id, n_artists=5, n_genres=5)
    assert seed["artists"][0] == "Diana Krall"
    assert "IU" in seed["artists"]
    assert set(seed["genres"]) == {"jazz", "kpop"}


def test_read_discovery_returns_metadata_for_source_id(db_conn: psycopg.Connection, cleanup):
    from mrms.emp.base import upsert_track_and_emp_source

    user_id = get_or_create_user(db_conn, f"read-{_uuid.uuid4().hex[:8]}@test.com")
    src = f"discovery:{user_id}"
    cleanup('DELETE FROM "EMPSource" WHERE source_id = %s', (src,))
    r = upsert_track_and_emp_source(
        db_conn, isrc=None, title="Discovery Song", artist="New Artist",
        album_title="Disc Album", duration_ms=200000, platform="youtube",
        platform_track_id="YTREAD1", source_type="discovery", source_id=src,
        source_name="Discovery", cover_url="http://c",
    )
    tid = r["track_id"]
    cleanup('DELETE FROM "TrackPlatform" WHERE "trackId" = %s', (tid,))
    cleanup('DELETE FROM "Track" WHERE id = %s', (tid,))

    rows = read_discovery(db_conn, user_id, limit=10)
    assert len(rows) == 1
    row = rows[0]
    assert row["track_id"] == tid
    assert row["title"] == "Discovery Song"
    assert row["youtube_track_id"] == "YTREAD1"
    assert row["album_cover"] == "http://c"


def test_delete_emp_sources_by_source_id(db_conn: psycopg.Connection, cleanup):
    from mrms.emp.base import upsert_track_and_emp_source

    user_id = get_or_create_user(db_conn, f"del-{_uuid.uuid4().hex[:8]}@test.com")
    src = f"discovery:{user_id}"
    cleanup('DELETE FROM "EMPSource" WHERE source_id = %s', (src,))
    r = upsert_track_and_emp_source(
        db_conn, isrc=None, title="ToDelete", artist="X", album_title=None,
        duration_ms=None, platform="youtube", platform_track_id="YTDEL1",
        source_type="discovery", source_id=src, source_name="Discovery",
    )
    cleanup('DELETE FROM "TrackPlatform" WHERE "trackId" = %s', (r["track_id"],))
    cleanup('DELETE FROM "Track" WHERE id = %s', (r["track_id"],))

    deleted = delete_emp_sources_by_source_id(db_conn, src)
    assert deleted >= 1
    assert read_discovery(db_conn, user_id, limit=10) == []


# ---------------------------------------------------------------------------
# Gemini layer — fake client (no DB / network needed)
# ---------------------------------------------------------------------------

class _FakeModels:
    def __init__(self, result):
        self._result = result

    def generate_content(self, **kwargs):
        if isinstance(self._result, Exception):
            raise self._result
        return self._result


class _FakeResp:
    def __init__(self, parsed):
        self.parsed = parsed


class _FakeClient:
    def __init__(self, result):
        self.models = _FakeModels(result)


def test_gemini_related_tracks_returns_items():
    parsed = TrackSuggestions(items=[
        TrackSuggestion(artist="Stacey Kent", title="The Boy Next Door"),
        TrackSuggestion(artist="Melody Gardot", title="Baby I'm a Fool"),
    ])
    client = _FakeClient(_FakeResp(parsed))
    out = gemini_related_tracks({"artists": ["Diana Krall"], "genres": ["jazz"]}, 2, client=client)
    assert [s.artist for s in out] == ["Stacey Kent", "Melody Gardot"]


def test_gemini_related_tracks_raises_on_none_parsed():
    client = _FakeClient(_FakeResp(None))
    with pytest.raises(DiscoveryLLMError):
        gemini_related_tracks({"artists": ["X"], "genres": []}, 5, client=client)


def test_gemini_related_tracks_wraps_exception():
    client = _FakeClient(RuntimeError("boom"))
    with pytest.raises(DiscoveryLLMError):
        gemini_related_tracks({"artists": ["X"], "genres": []}, 5, client=client)
