"""Reaction endpoints: dislike/dismiss 트랙·앨범."""
from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient

from mrms.api.main import app
from mrms.db.ids import stable_id as _id
from mrms.db.user_embedding import insert_playlist_history

client = TestClient(app)


@pytest.fixture
def set_session_cookie(login):
    """공용 login + cookie set factory. user_id 반환."""
    def _make(email: str) -> str:
        user_id, session_id = login(email)
        client.cookies.set("mrms_session", session_id)
        return user_id

    return _make


def _seed_track(conn):
    """Artist + Album + Track 생성. (album_id, track_id) 반환."""
    tag = uuid.uuid4().hex[:8]
    aid = _id(f"rx|a|{tag}")
    alid = _id(f"rx|al|{tag}")
    tid = _id(f"rx|t|{tag}")
    with conn.cursor() as cur:
        cur.execute(
            'INSERT INTO "Artist"(id,name,"nameNormalized") VALUES(%s,%s,%s) ON CONFLICT(id) DO NOTHING',
            (aid, f"RX{tag}", f"rx{tag}"),
        )
        cur.execute(
            'INSERT INTO "Album"(id,title,"albumType","artistId") VALUES(%s,%s,%s,%s) ON CONFLICT(id) DO NOTHING',
            (alid, f"RXAL{tag}", "album", aid),
        )
        cur.execute(
            '''INSERT INTO "Track"(id,isrc,title,"titleNormalized","durationMs","artistId","albumId")
               VALUES(%s,%s,%s,%s,%s,%s,%s) ON CONFLICT(id) DO NOTHING''',
            (tid, f"RXISRC{tag.upper()}", "rxt", "rxt", 1000, aid, alid),
        )
    conn.commit()
    return alid, tid


def _seed_catalog_track_with_tp(conn):
    """tidal TrackPlatform 포함 — _fetch_track_metadata 통과용. (album_id, track_id)."""
    tag = uuid.uuid4().hex[:8]
    aid = _id(f"rxm|a|{tag}"); alid = _id(f"rxm|al|{tag}"); tid = _id(f"rxm|t|{tag}")
    with conn.cursor() as cur:
        cur.execute('INSERT INTO "Artist"(id,name,"nameNormalized") VALUES(%s,%s,%s) ON CONFLICT(id) DO NOTHING', (aid, f"RXM{tag}", f"rxm{tag}"))
        cur.execute('INSERT INTO "Album"(id,title,"albumType","artistId") VALUES(%s,%s,%s,%s) ON CONFLICT(id) DO NOTHING', (alid, f"RXMAL{tag}", "album", aid))
        cur.execute(
            '''INSERT INTO "Track"(id,isrc,title,"titleNormalized","durationMs","artistId","albumId")
               VALUES(%s,%s,%s,%s,%s,%s,%s) ON CONFLICT(id) DO NOTHING''',
            (tid, f"RXMISRC{tag.upper()}", "rxmt", "rxmt", 210000, aid, alid),
        )
        cur.execute(
            '''INSERT INTO "TrackPlatform"(id,"trackId",platform,"platformTrackId")
               VALUES(%s,%s,'tidal',%s) ON CONFLICT("trackId",platform) DO NOTHING''',
            (_id(f"rxm|tp|{tag}"), tid, f"tidal-{tag}"),
        )
    conn.commit()
    return alid, tid


def test_disliked_track_excluded_from_mrt(db_conn, set_session_cookie, cleanup):
    user_id = set_session_cookie(f"rxm-{uuid.uuid4().hex[:6]}@test.com")
    album_id, track_id = _seed_catalog_track_with_tp(db_conn)
    cleanup('DELETE FROM "UserBlocked" WHERE "userId"=%s', (user_id,))
    cleanup('DELETE FROM "PlaylistHistory" WHERE "userId"=%s', (user_id,))
    insert_playlist_history(db_conn, user_id, [track_id], "our-v1.0+persona-K3",
                            context={"personaIdx": 0, "kind": "persona", "scores": [0.9]})
    db_conn.commit()
    assert track_id in [t["track_id"] for t in client.get("/api/mrt/latest").json()["recommended_tracks"]]
    client.post(f"/api/user/tracks/{track_id}/dislike")
    body = client.get("/api/mrt/latest").json()
    assert track_id not in [t["track_id"] for t in body["recommended_tracks"]]
    assert album_id not in [a["album_id"] for a in body["recommended_albums"]]
    client.cookies.clear()


def test_track_dislike_dismiss(db_conn, set_session_cookie, cleanup):
    user_id = set_session_cookie(f"rx-{uuid.uuid4().hex[:6]}@test.com")
    album_id, track_id = _seed_track(db_conn)
    cleanup('DELETE FROM "UserBlocked" WHERE "userId"=%s', (user_id,))

    assert client.post(f"/api/user/tracks/{track_id}/dislike").json() == {"disliked": True}
    assert client.post(f"/api/user/tracks/{track_id}/dismiss").json() == {"dismissed": True}
    assert client.post(f"/api/user/tracks/album/{album_id}/dislike").json() == {"disliked": True}
    assert client.post(f"/api/user/tracks/album/{album_id}/dismiss").json() == {"dismissed": True}

    with db_conn.cursor() as cur:
        cur.execute(
            'SELECT "targetType", reason FROM "UserBlocked" WHERE "userId"=%s ORDER BY "targetType"',
            (user_id,),
        )
        rows = cur.fetchall()

    assert ("album", "dismissed") in rows and ("track", "dismissed") in rows

    client.cookies.clear()
