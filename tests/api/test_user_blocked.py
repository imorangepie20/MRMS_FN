"""UserBlocked DB ops — 부정 반응(disliked/dismissed) 저장/조회/클리어."""
from mrms.db.ids import stable_id as _id


def _seed_album_track(conn):
    """Artist + Album + 1 Track. (album_id, track_id) 반환."""
    aid = _id("test|ub|artist"); alid = _id("test|ub|album"); tid = _id("test|ub|track")
    with conn.cursor() as cur:
        cur.execute('INSERT INTO "Artist"(id,name,"nameNormalized") VALUES(%s,%s,%s) ON CONFLICT(id) DO NOTHING', (aid, "UB Artist", "ub artist"))
        cur.execute('INSERT INTO "Album"(id,title,"albumType","artistId") VALUES(%s,%s,%s,%s) ON CONFLICT(id) DO NOTHING', (alid, "UB Album", "album", aid))
        cur.execute('''INSERT INTO "Track"(id,isrc,title,"titleNormalized","durationMs","artistId","albumId")
                       VALUES(%s,%s,%s,%s,%s,%s,%s) ON CONFLICT(id) DO NOTHING''',
                    (tid, "UBISRC00000001", "ubtrk", "ubtrk", 1000, aid, alid))
    conn.commit()
    return alid, tid


def test_block_and_query(db_conn, cleanup):
    from mrms.db.user_blocked import block_target, blocked_track_ids, clear_dismissed
    uid = _id("test|ubuser")
    with db_conn.cursor() as cur:
        cur.execute('INSERT INTO "User"(id,email) VALUES(%s,%s) ON CONFLICT(id) DO NOTHING', (uid, "ub@auto.local"))
    db_conn.commit()
    album_id, track_id = _seed_album_track(db_conn)
    cleanup('DELETE FROM "UserBlocked" WHERE "userId"=%s', (uid,))

    block_target(db_conn, uid, track_id, "track", "disliked")
    assert track_id in blocked_track_ids(db_conn, uid, ["disliked"])
    assert track_id in blocked_track_ids(db_conn, uid, ["disliked", "dismissed"])

    block_target(db_conn, uid, album_id, "album", "dismissed")
    assert track_id in blocked_track_ids(db_conn, uid, ["dismissed"])  # album→track 확장

    n = clear_dismissed(db_conn, uid)
    assert n == 1
    assert track_id in blocked_track_ids(db_conn, uid, ["disliked"])
    assert blocked_track_ids(db_conn, uid, ["dismissed"]) == set()


def test_block_target_upsert(db_conn, cleanup):
    from mrms.db.user_blocked import block_target
    uid = _id("test|ubuser2")
    with db_conn.cursor() as cur:
        cur.execute('INSERT INTO "User"(id,email) VALUES(%s,%s) ON CONFLICT(id) DO NOTHING', (uid, "ub2@auto.local"))
    db_conn.commit()
    _, track_id = _seed_album_track(db_conn)
    cleanup('DELETE FROM "UserBlocked" WHERE "userId"=%s', (uid,))
    block_target(db_conn, uid, track_id, "track", "dismissed")
    block_target(db_conn, uid, track_id, "track", "disliked")
    with db_conn.cursor() as cur:
        cur.execute('SELECT count(*), max(reason) FROM "UserBlocked" WHERE "userId"=%s AND "targetId"=%s', (uid, track_id))
        cnt, reason = cur.fetchone()
    assert cnt == 1 and reason == "disliked"
