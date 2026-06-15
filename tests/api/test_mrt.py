"""mrt_latest endpoint 테스트."""
from __future__ import annotations

from fastapi.testclient import TestClient

from mrms.api.main import app
from mrms.emp.base import upsert_track_and_emp_source

client = TestClient(app)


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
