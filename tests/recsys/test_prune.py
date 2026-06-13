"""prune_playlist_history — 최신 N generation만 유지."""
from mrms.db.ids import stable_id as _id


def test_prune_keeps_latest_generations(db_conn, cleanup):
    from mrms.db.user_embedding import prune_playlist_history, insert_playlist_history
    uid = _id("test|pruneuser")
    with db_conn.cursor() as cur:
        cur.execute('INSERT INTO "User"(id,email) VALUES(%s,%s) ON CONFLICT(id) DO NOTHING', (uid, "prune@auto.local"))
    db_conn.commit()
    # 3 generation × 3 페르소나 = 9행. 같은 generation의 3행은 거의 동시,
    # generation 간엔 시차가 있어야 하므로 generation마다 약간 sleep.
    import time
    for _gen in range(3):
        for idx in range(3):
            insert_playlist_history(db_conn, uid, [], "mv", {"personaIdx": idx})
        db_conn.commit()
        time.sleep(1.1)  # generation 경계가 date_trunc('second')로 구분되도록
    deleted = prune_playlist_history(db_conn, uid, keep_generations=2)
    with db_conn.cursor() as cur:
        cur.execute('SELECT count(*) FROM "PlaylistHistory" WHERE "userId"=%s', (uid,))
        assert cur.fetchone()[0] == 6   # 2 generation × 3
    assert deleted == 3
    cleanup('DELETE FROM "PlaylistHistory" WHERE "userId"=%s', (uid,))
