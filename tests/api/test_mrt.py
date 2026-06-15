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
