"""mrt_latest endpoint 테스트."""
from __future__ import annotations

import uuid as _uuid

from fastapi.testclient import TestClient

from mrms.api.main import app
from mrms.emp.base import upsert_track_and_emp_source

client = TestClient(app)


def _mk_artist(conn, name):
    aid = "ar_" + _uuid.uuid4().hex[:12]
    with conn.cursor() as cur:
        cur.execute(
            'INSERT INTO "Artist" (id, name, "nameNormalized", "mainGenre") VALUES (%s,%s,%s,%s)',
            (aid, name, name.lower(), None),
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


def test_mrt_latest_blends_discovery_tracks(db_conn, login, cleanup):
    user_id, session_id = login()
    # persona 1개 직접 적재 (early-return 회피). 트랙은 EMP에 있는 임의 Track 사용.
    with db_conn.cursor() as cur:
        cur.execute('SELECT id FROM "Track" LIMIT 2')
        base = [r[0] for r in cur.fetchall()]
    if len(base) < 1:
        import pytest
        pytest.skip("Track 데이터 부족")
    from mrms.db.user_embedding import insert_playlist_history
    insert_playlist_history(
        db_conn, user_id, base, "+persona-K3",
        context={"personaIdx": 0, "kind": "persona", "scores": [1.0] * len(base)},
    )
    db_conn.commit()
    cleanup('DELETE FROM "PlaylistHistory" WHERE "userId" = %s', (user_id,))

    src = f"discovery:{user_id}"
    r = upsert_track_and_emp_source(
        db_conn, isrc=None, title="Disc Track", artist="Disc Artist",
        album_title=None, duration_ms=190000, platform="youtube",
        platform_track_id="YTBLEND1", source_type="discovery", source_id=src,
        source_name="Discovery",
    )
    dtid = r["track_id"]
    cleanup('DELETE FROM "EMPSource" WHERE source_id = %s', (src,))
    cleanup('DELETE FROM "TrackPlatform" WHERE "trackId" = %s', (dtid,))
    cleanup('DELETE FROM "Track" WHERE id = %s', (dtid,))

    client.cookies.set("mrms_session", session_id)
    resp = client.get("/api/mrt/latest")
    client.cookies.clear()
    assert resp.status_code == 200, resp.text
    rows = resp.json()["recommended_tracks"]
    disc = [t for t in rows if t["track_id"] == dtid]
    assert len(disc) == 1
    assert disc[0]["youtube_track_id"] == "YTBLEND1"
    assert disc[0]["title"] == "Disc Track"


def test_mrt_latest_includes_new_releases(db_conn, login, cleanup):
    user_id, session_id = login()
    # persona 1개 적재(early-return 회피)
    with db_conn.cursor() as cur:
        cur.execute('SELECT id FROM "Track" LIMIT 2')
        base = [r[0] for r in cur.fetchall()]
    if len(base) < 1:
        import pytest
        pytest.skip("Track 데이터 부족")
    from mrms.db.user_embedding import insert_playlist_history
    insert_playlist_history(
        db_conn, user_id, base, "+persona-K3",
        context={"personaIdx": 0, "kind": "persona", "scores": [1.0] * len(base)},
    )
    db_conn.commit()
    cleanup('DELETE FROM "PlaylistHistory" WHERE "userId" = %s', (user_id,))

    src = f"new_release:{user_id}"
    r = upsert_track_and_emp_source(
        db_conn, isrc=None, title="NR Track", artist="NR Artist",
        album_title=None, duration_ms=200000, platform="youtube",
        platform_track_id="YTNRSERVE", source_type="new_release", source_id=src,
        source_name="New Releases",
    )
    ntid = r["track_id"]
    cleanup('DELETE FROM "EMPSource" WHERE source_id = %s', (src,))
    cleanup('DELETE FROM "TrackPlatform" WHERE "trackId" = %s', (ntid,))
    cleanup('DELETE FROM "Track" WHERE id = %s', (ntid,))

    client.cookies.set("mrms_session", session_id)
    resp = client.get("/api/mrt/latest")
    client.cookies.clear()
    assert resp.status_code == 200, resp.text
    nr = [t for t in resp.json()["recommended_new_releases"] if t["track_id"] == ntid]
    assert len(nr) == 1
    assert nr[0]["youtube_track_id"] == "YTNRSERVE"
    assert nr[0]["title"] == "NR Track"


def test_mrt_latest_shows_persona_recs_without_tidal(db_conn, login, cleanup):
    """persona 추천이 tidal 없는 youtube-only 트랙이어도 표시돼야 한다.

    회귀: 예전 _fetch_track_metadata가 primary_platform(미연결→tidal) INNER로 필터해
    tidal 없는 카탈로그 추천을 전부 떨궈 '추천 0'이 되던 버그.
    """
    user_id, session_id = login()  # 미연결 유저 → 예전엔 tidal 게이트
    # youtube videoId만 있는 카탈로그 트랙(tidal/spotify 없음). discovery/new_release 아님.
    r = upsert_track_and_emp_source(
        db_conn, isrc=None, title="YT Only Rec", artist="YT Only Artist",
        album_title=None, duration_ms=200000, platform="youtube",
        platform_track_id="YTPERSONA1", source_type="station",
        source_id="station:test", source_name="Station",
    )
    ptid = r["track_id"]
    cleanup('DELETE FROM "EMPSource" WHERE source_id = %s', ("station:test",))
    cleanup('DELETE FROM "TrackPlatform" WHERE "trackId" = %s', (ptid,))
    cleanup('DELETE FROM "Track" WHERE id = %s', (ptid,))

    from mrms.db.user_embedding import insert_playlist_history
    insert_playlist_history(
        db_conn, user_id, [ptid], "+persona-K3",
        context={"personaIdx": 0, "kind": "persona", "scores": [1.0]},
    )
    db_conn.commit()
    cleanup('DELETE FROM "PlaylistHistory" WHERE "userId" = %s', (user_id,))

    client.cookies.set("mrms_session", session_id)
    resp = client.get("/api/mrt/latest")
    client.cookies.clear()
    assert resp.status_code == 200, resp.text
    recs = [t for t in resp.json()["recommended_tracks"] if t["track_id"] == ptid]
    assert len(recs) == 1, "tidal 없는 persona 추천이 필터링돼 사라짐(게이트 미제거)"
    assert recs[0]["youtube_track_id"] == "YTPERSONA1"
    assert recs[0]["tidal_track_id"] is None


def test_mrt_latest_dedups_same_song_diff_track_id(db_conn, login, cleanup):
    """같은 곡(artist+title 동일, track_id 다름)이 추천에 중복 노출되지 않는다(_song_key)."""
    user_id, session_id = login()
    a = _mk_artist(db_conn, "Dup Artist")
    t1 = _mk_track(db_conn, a, "Dup Song")
    t2 = _mk_track(db_conn, a, "Dup Song")  # 같은 곡, 다른 track_id
    cleanup('DELETE FROM "Artist" WHERE id = %s', (a,))
    cleanup('DELETE FROM "Track" WHERE "artistId" = %s', (a,))

    from mrms.db.user_embedding import insert_playlist_history
    insert_playlist_history(
        db_conn, user_id, [t1, t2], "+persona-K3",
        context={"personaIdx": 0, "kind": "persona", "scores": [1.0, 0.9]},
    )
    db_conn.commit()
    cleanup('DELETE FROM "PlaylistHistory" WHERE "userId" = %s', (user_id,))

    client.cookies.set("mrms_session", session_id)
    resp = client.get("/api/mrt/latest")
    client.cookies.clear()
    assert resp.status_code == 200, resp.text
    recs = [t for t in resp.json()["recommended_tracks"] if t["track_id"] in (t1, t2)]
    assert len(recs) == 1, f"같은 곡이 {len(recs)}번 노출 — 중복 제거 실패"


def test_mrt_latest_excludes_owned_song_diff_track_id(db_conn, login, cleanup):
    """내가 가진 곡은 다른 track_id 버전이어도 추천에서 제외된다(_owned_song_keys)."""
    user_id, session_id = login()
    a = _mk_artist(db_conn, "Owned Artist")
    owned = _mk_track(db_conn, a, "Owned Song")
    other = _mk_track(db_conn, a, "Owned Song")  # 같은 곡, 다른 track_id
    _add_usertrack(db_conn, user_id, owned)  # 보유
    cleanup('DELETE FROM "Artist" WHERE id = %s', (a,))
    cleanup('DELETE FROM "Track" WHERE "artistId" = %s', (a,))
    cleanup('DELETE FROM "UserTrack" WHERE "userId" = %s', (user_id,))

    from mrms.db.user_embedding import insert_playlist_history
    insert_playlist_history(
        db_conn, user_id, [other], "+persona-K3",
        context={"personaIdx": 0, "kind": "persona", "scores": [1.0]},
    )
    db_conn.commit()
    cleanup('DELETE FROM "PlaylistHistory" WHERE "userId" = %s', (user_id,))

    client.cookies.set("mrms_session", session_id)
    resp = client.get("/api/mrt/latest")
    client.cookies.clear()
    assert resp.status_code == 200, resp.text
    recs = [t for t in resp.json()["recommended_tracks"] if t["track_id"] in (owned, other)]
    assert recs == [], "보유곡(다른 track_id)이 추천에 노출됨"


def test_mrt_latest_includes_album_cover(db_conn, login, cleanup):
    """추천 트랙에 EMPSource.cover_url이 album_cover로 실린다(서빙 누락 회귀)."""
    user_id, session_id = login()
    r = upsert_track_and_emp_source(
        db_conn, isrc=None, title="Cover Track", artist="Cover Artist",
        album_title="Cover Album", duration_ms=200000, platform="youtube",
        platform_track_id="YTCOVER1", source_type="station",
        source_id="station:cover", source_name="Station",
        cover_url="https://example.com/cover600.jpg",
    )
    ctid = r["track_id"]
    cleanup('DELETE FROM "EMPSource" WHERE source_id = %s', ("station:cover",))
    cleanup('DELETE FROM "TrackPlatform" WHERE "trackId" = %s', (ctid,))
    cleanup('DELETE FROM "Track" WHERE id = %s', (ctid,))

    from mrms.db.user_embedding import insert_playlist_history
    insert_playlist_history(
        db_conn, user_id, [ctid], "+persona-K3",
        context={"personaIdx": 0, "kind": "persona", "scores": [1.0]},
    )
    db_conn.commit()
    cleanup('DELETE FROM "PlaylistHistory" WHERE "userId" = %s', (user_id,))

    client.cookies.set("mrms_session", session_id)
    resp = client.get("/api/mrt/latest")
    client.cookies.clear()
    assert resp.status_code == 200, resp.text
    recs = [t for t in resp.json()["recommended_tracks"] if t["track_id"] == ctid]
    assert len(recs) == 1
    assert recs[0]["album_cover"] == "https://example.com/cover600.jpg"
