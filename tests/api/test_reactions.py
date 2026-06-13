"""Reaction endpoints: dislike/dismiss 트랙·앨범."""
from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient

from mrms.api.main import app
from mrms.db.ids import stable_id as _id

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
