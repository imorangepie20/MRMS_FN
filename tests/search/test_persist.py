from __future__ import annotations

from mrms.search.persist import persist_search_tracks


def test_persist_assigns_track_id_and_inEmp(db_conn, cleanup):
    flat = [{
        "track_id": None, "title": "Persist Song", "artist": "PT Artist",
        "album_title": "PT Album", "album_cover": None, "duration_ms": 123000,
        "isrc": "PTSEARCH0001",
        "tidal_track_id": "td_p1", "spotify_track_id": "sp_p1",
    }]
    cleanup('DELETE FROM "Track" WHERE isrc = %s', ("PTSEARCH0001",))
    persist_search_tracks(db_conn, flat, q="persist song")
    assert flat[0]["track_id"] is not None
    with db_conn.cursor() as cur:
        cur.execute('SELECT "inEmp" FROM "Track" WHERE id = %s', (flat[0]["track_id"],))
        assert cur.fetchone()[0] is True
        cur.execute(
            'SELECT COUNT(*) FROM "TrackPlatform" WHERE "trackId" = %s', (flat[0]["track_id"],))
        assert cur.fetchone()[0] == 2  # tidal + spotify
        cur.execute(
            '''SELECT COUNT(*) FROM "EMPSource"
               WHERE "trackId" = %s AND source_type = 'search' ''', (flat[0]["track_id"],))
        assert cur.fetchone()[0] >= 1
    cleanup('DELETE FROM "EMPSource" WHERE "trackId" = %s', (flat[0]["track_id"],))
    cleanup('DELETE FROM "TrackPlatform" WHERE "trackId" = %s', (flat[0]["track_id"],))
    cleanup('DELETE FROM "Track" WHERE id = %s', (flat[0]["track_id"],))
