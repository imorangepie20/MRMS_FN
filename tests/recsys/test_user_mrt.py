"""generate_user_mrt + select_stale_mrt_users — 공유 MRT 생성/판정."""
import numpy as np
import pytest
from pgvector.psycopg import register_vector

from mrms.db.ids import stable_id as _id
from mrms.config import EMBEDDING_MODEL_VERSION

CATALOG = EMBEDDING_MODEL_VERSION
MV = f"{EMBEDDING_MODEL_VERSION}+persona-K3"


def _seed_user_with_tracks(conn, n_tracks: int) -> str:
    """User + n개 Track(+Artist) + TrackEmbedding(256d, inEmp) + UserTrack 생성. user_id 반환.

    Track/Artist/User 행은 stable_id + ON CONFLICT라 idempotent 고정 fixture — cleanup 불필요(테스트는 UserTrack/Persona/Embedding/History만 정리).
    """
    register_vector(conn)
    user_id = _id("test|mrtuser")
    artist_id = _id("test|mrtartist")
    with conn.cursor() as cur:
        cur.execute('INSERT INTO "User" (id, email) VALUES (%s,%s) ON CONFLICT (id) DO NOTHING',
                    (user_id, "mrt-test@auto.local"))
        cur.execute('INSERT INTO "Artist" (id, name, "nameNormalized") VALUES (%s,%s,%s) ON CONFLICT (id) DO NOTHING',
                    (artist_id, "MRT Test Artist", "mrt test artist"))
        for i in range(n_tracks):
            tid = _id(f"test|mrttrack|{i}")
            cur.execute('''INSERT INTO "Track" (id, isrc, title, "titleNormalized", "durationMs", "artistId", "inEmp")
                           VALUES (%s,%s,%s,%s,%s,%s,TRUE) ON CONFLICT (id) DO NOTHING''',
                        (tid, f"TESTISRC{i:08d}", f"t{i}", f"t{i}", 0, artist_id))
            vec = np.zeros(256, dtype=np.float32)
            vec[i % 256] = 1.0  # 분산된 단위벡터
            cur.execute('''INSERT INTO "TrackEmbedding" (id, "trackId", "modelVersion", embedding, pooling, "audioSource")
                           VALUES (%s,%s,%s,%s,%s,%s) ON CONFLICT ("trackId","modelVersion") DO NOTHING''',
                        (_id(f"te|{tid}"), tid, CATALOG, vec, "attention", "mp3_30s"))
            cur.execute('''INSERT INTO "UserTrack" (id, "userId", "trackId", "isCore", source, platform)
                           VALUES (%s,%s,%s,FALSE,%s,%s) ON CONFLICT ("userId","trackId") DO NOTHING''',
                        (_id(f"ut|{user_id}|{tid}"), user_id, tid, "playlist:test", "youtube"))
    conn.commit()
    return user_id


def test_generate_user_mrt_creates_personas_and_history(db_conn, cleanup):
    from mrms.recsys.mrt import generate_user_mrt, MODEL_VERSION
    uid = _seed_user_with_tracks(db_conn, n_tracks=6)
    n = generate_user_mrt(db_conn, uid, k=3)
    db_conn.commit()
    assert n == 6
    with db_conn.cursor() as cur:
        cur.execute('SELECT count(*) FROM "UserPersona" WHERE "userId"=%s', (uid,))
        assert cur.fetchone()[0] == 3
        cur.execute('SELECT "computedFrom" FROM "UserEmbedding" WHERE "userId"=%s AND "modelVersion"=%s',
                    (uid, MODEL_VERSION))
        assert cur.fetchone()[0] == 6
        cur.execute('SELECT count(*) FROM "PlaylistHistory" WHERE "userId"=%s', (uid,))
        assert cur.fetchone()[0] == 3
    cleanup('DELETE FROM "PlaylistHistory" WHERE "userId"=%s', (uid,))
    cleanup('DELETE FROM "UserPersona" WHERE "userId"=%s', (uid,))
    cleanup('DELETE FROM "UserEmbedding" WHERE "userId"=%s', (uid,))
    cleanup('DELETE FROM "UserTrack" WHERE "userId"=%s', (uid,))


def test_generate_user_mrt_skips_when_below_k(db_conn, cleanup):
    from mrms.recsys.mrt import generate_user_mrt
    uid = _seed_user_with_tracks(db_conn, n_tracks=2)
    assert generate_user_mrt(db_conn, uid, k=3) is None
    cleanup('DELETE FROM "UserTrack" WHERE "userId"=%s', (uid,))


def test_select_stale_mrt_users(db_conn, cleanup):
    from mrms.recsys.mrt import generate_user_mrt, select_stale_mrt_users
    uid = _seed_user_with_tracks(db_conn, n_tracks=6)
    # MRT 아직 없음 → stale (computedFrom 없음, baseline 0)
    assert uid in select_stale_mrt_users(db_conn, k=3)
    # MRT 생성 후 → 더 이상 stale 아님 (computedFrom=6 == 현재 6)
    generate_user_mrt(db_conn, uid, k=3); db_conn.commit()
    assert uid not in select_stale_mrt_users(db_conn, k=3)
    cleanup('DELETE FROM "PlaylistHistory" WHERE "userId"=%s', (uid,))
    cleanup('DELETE FROM "UserPersona" WHERE "userId"=%s', (uid,))
    cleanup('DELETE FROM "UserEmbedding" WHERE "userId"=%s', (uid,))
    cleanup('DELETE FROM "UserTrack" WHERE "userId"=%s', (uid,))
