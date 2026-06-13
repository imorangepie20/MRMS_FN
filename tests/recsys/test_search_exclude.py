import numpy as np
from pgvector.psycopg import register_vector
from mrms.db.ids import stable_id as _id
from mrms.config import EMBEDDING_MODEL_VERSION

CATALOG = EMBEDDING_MODEL_VERSION


def _seed_emb_track(conn, i):
    """inEmp + TrackEmbedding 보유 카탈로그 트랙. (track_id, vec) 반환."""
    register_vector(conn)
    aid = _id("test|se|artist")
    with conn.cursor() as cur:
        cur.execute('INSERT INTO "Artist"(id,name,"nameNormalized") VALUES(%s,%s,%s) ON CONFLICT(id) DO NOTHING', (aid, "SE", "se"))
        tid = _id(f"test|se|track|{i}")
        cur.execute('''INSERT INTO "Track"(id,isrc,title,"titleNormalized","durationMs","artistId","inEmp")
                       VALUES(%s,%s,%s,%s,%s,%s,TRUE) ON CONFLICT(id) DO NOTHING''',
                    (tid, f"SEISRC{i:08d}", f"se{i}", f"se{i}", 1000, aid))
        vec = np.zeros(256, dtype=np.float32); vec[i % 256] = 1.0
        cur.execute('''INSERT INTO "TrackEmbedding"(id,"trackId","modelVersion",embedding,pooling,"audioSource")
                       VALUES(%s,%s,%s,%s,%s,%s) ON CONFLICT("trackId","modelVersion") DO NOTHING''',
                    (_id(f"se|te|{tid}"), tid, CATALOG, vec, "attention", "mp3_30s"))
    conn.commit()
    return tid, vec


def test_search_excludes_disliked(db_conn, cleanup):
    from mrms.recsys.mrt import search_for_persona
    from mrms.db.user_blocked import block_target
    uid = _id("test|seuser")
    with db_conn.cursor() as cur:
        cur.execute('INSERT INTO "User"(id,email) VALUES(%s,%s) ON CONFLICT(id) DO NOTHING', (uid, "se@auto.local"))
    db_conn.commit()
    t0, v0 = _seed_emb_track(db_conn, 0)
    t1, _ = _seed_emb_track(db_conn, 1)
    cleanup('DELETE FROM "UserBlocked" WHERE "userId"=%s', (uid,))

    block_target(db_conn, uid, t0, "track", "disliked")
    ids = [r["track_id"] for r in search_for_persona(db_conn, uid, v0, catalog_model_version=CATALOG, candidate_pool=50, top_n=50)]
    assert t0 not in ids        # disliked → 영구 제외

    block_target(db_conn, uid, t1, "track", "dismissed")
    ids2 = [r["track_id"] for r in search_for_persona(db_conn, uid, v0, catalog_model_version=CATALOG, candidate_pool=50, top_n=50)]
    assert t1 in ids2           # dismissed는 search 통과 (재추천 가능)
    cleanup('DELETE FROM "UserBlocked" WHERE "userId"=%s', (uid,))
