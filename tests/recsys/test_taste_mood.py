from __future__ import annotations

import uuid

from mrms.db.ids import stable_id
from mrms.db.user_track import get_or_create_user
from mrms.recsys.taste_mood import recommend_by_taste_mood

EMB = "[" + ",".join(["0.0625"] * 256) + "]"  # 단일 방향 단위벡터 — 시드들이 서로 cosine 1


def _seed_track(conn, cleanup, *, valence, energy, tempo, emb=EMB, title="TM Song",
                artist="TM Artist"):
    """Artist+Track+TAF+TrackEmbedding 시드. track_id 반환."""
    isrc = f"TM{uuid.uuid4().hex[:8].upper()}"
    artist_id = stable_id(f"artist|{artist.lower()}|{isrc}")
    track_id = stable_id(f"track|{isrc}")
    # 등록 역순으로 cleanup (cleanup이 역순 실행 → Artist 마지막)
    cleanup('DELETE FROM "Artist" WHERE id = %s', (artist_id,))
    cleanup('DELETE FROM "Track" WHERE id = %s', (track_id,))
    cleanup('DELETE FROM "TrackAudioFeatures" WHERE "trackId" = %s', (track_id,))
    cleanup('DELETE FROM "TrackEmbedding" WHERE "trackId" = %s', (track_id,))
    with conn.cursor() as cur:
        cur.execute('INSERT INTO "Artist"(id,name,"nameNormalized") VALUES(%s,%s,%s) '
                    'ON CONFLICT(id) DO NOTHING', (artist_id, artist, artist.lower()))
        cur.execute('''INSERT INTO "Track"(id,isrc,title,"titleNormalized","durationMs","artistId")
                       VALUES(%s,%s,%s,%s,%s,%s) ON CONFLICT(id) DO NOTHING''',
                    (track_id, isrc, title, title.lower(), 180000, artist_id))
        cur.execute('''INSERT INTO "TrackAudioFeatures"
              (id,"trackId",source,"modelVersion",danceability,energy,valence,acousticness,
               instrumentalness,liveness,speechiness,tempo,loudness,key,mode,"timeSignature",
               "energyCurve",subgenres,confidence)
              VALUES(%s,%s,'our_model','our-v1.0',0.5,%s,%s,0.3,0.1,0.05,0.05,%s,-8.0,5,1,4,
                     ARRAY[]::double precision[],ARRAY[]::text[],0.9)''',
                    (stable_id(f"taf|{track_id}"), track_id, energy, valence, tempo))
        cur.execute('''INSERT INTO "TrackEmbedding"(id,"trackId","modelVersion",embedding,pooling,"audioSource")
                       VALUES(%s,%s,'our-v1.0',%s::vector,'mean','mp3_30s')''',
                    (stable_id(f"emb|{track_id}"), track_id, emb))
    conn.commit()
    return track_id


def _own(conn, cleanup, user_id, track_id):
    ut = stable_id(f"ut|{user_id}|{track_id}")
    cleanup('DELETE FROM "UserTrack" WHERE id = %s', (ut,))
    with conn.cursor() as cur:
        cur.execute('INSERT INTO "UserTrack"(id,"userId","trackId","isCore",source,platform) '
                    'VALUES(%s,%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING',
                    (ut, user_id, track_id, False, "liked", "local"))
    conn.commit()


def test_empty_when_no_taste(db_conn, cleanup):
    uid = get_or_create_user(db_conn, f"tm_{uuid.uuid4().hex[:8]}@t.local")
    cleanup('DELETE FROM "User" WHERE id = %s', (uid,))
    # UserTrack도 UserEmbedding도 없음 → 취향 신호 없음 → 빈 리스트
    assert recommend_by_taste_mood(db_conn, uid, 0.5, 0.5, 100.0) == []


def test_orders_by_mood_within_taste_and_excludes_owned(db_conn, cleanup):
    uid = get_or_create_user(db_conn, f"tm_{uuid.uuid4().hex[:8]}@t.local")
    cleanup('DELETE FROM "User" WHERE id = %s', (uid,))
    # 취향 앵커(보유) — taste_vector = 이 임베딩. near/far는 같은 임베딩(취향 풀 최상위).
    taste = _seed_track(db_conn, cleanup, valence=0.5, energy=0.5, tempo=100.0, title="Taste")
    _own(db_conn, cleanup, uid, taste)
    near = _seed_track(db_conn, cleanup, valence=0.40, energy=0.25, tempo=85.0, title="MoodNear")
    far = _seed_track(db_conn, cleanup, valence=0.95, energy=0.95, tempo=160.0, title="MoodFar")
    recs = recommend_by_taste_mood(db_conn, uid, 0.40, 0.25, 85.0, n=500, pool_size=500)
    ids = [r["track_id"] for r in recs]
    assert near in ids and far in ids
    assert ids.index(near) < ids.index(far)  # 무드 중심에 가까운 곡이 먼저
    assert taste not in ids                  # 보유(UserTrack) 제외
    assert all("score" in r and "taste_sim" in r for r in recs)
