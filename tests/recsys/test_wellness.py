from __future__ import annotations

import math
import uuid

import pytest

from mrms.recsys.wellness import MOOD_PRESETS, CATALOG_MV, mood_fit, recommend_wellness
from mrms.db.ids import stable_id
from mrms.db.user_track import get_or_create_user


def test_presets_have_four_moods():
    assert set(MOOD_PRESETS) == {"calm", "energize", "focus", "sleep"}


def test_mood_fit_peaks_at_center():
    feats = {"valence": 0.40, "energy": 0.25, "tempo": 85.0,
             "acousticness": 0.70, "instrumentalness": 0.0}
    assert abs(mood_fit(feats, MOOD_PRESETS["calm"]) - 1.0) < 1e-9


def test_mood_fit_monotonic_decrease():
    center = {"valence": 0.40, "energy": 0.25, "tempo": 85.0,
              "acousticness": 0.70, "instrumentalness": 0.0}
    near = {**center, "energy": 0.35}
    far = {**center, "energy": 0.65}
    p = MOOD_PRESETS["calm"]
    assert mood_fit(center, p) > mood_fit(near, p) > mood_fit(far, p)
    assert 0.0 < mood_fit(far, p) <= 1.0


def test_mood_fit_ignores_zero_weight_axis():
    p = MOOD_PRESETS["energize"]
    base = {"valence": 0.78, "energy": 0.80, "tempo": 135.0,
            "acousticness": 0.5, "instrumentalness": 0.0}
    other = {**base, "instrumentalness": 1.0}
    assert mood_fit(base, p) == mood_fit(other, p)


CALM_CENTER = {"valence": 0.40, "energy": 0.25, "tempo": 85.0,
               "acousticness": 0.70, "instrumentalness": 0.0}


def _seed_track(conn, cleanup, *, valence, energy, tempo, acousticness=0.5,
                instrumentalness=0.1, title="W Song", artist="W Artist"):
    """Artist+Track+TrackAudioFeatures+TrackEmbedding(zeros) 시드. track_id 반환."""
    isrc = f"WELL{uuid.uuid4().hex[:8].upper()}"
    artist_id = stable_id(f"artist|{artist.lower()}|{isrc}")
    track_id = stable_id(f"track|{isrc}")
    emb = "[" + ",".join(["0.0125"] * 256) + "]"
    # Register in reverse dependency order: cleanup runs reversed, so Artist is last.
    cleanup('DELETE FROM "Artist" WHERE id = %s', (artist_id,))
    cleanup('DELETE FROM "Track" WHERE id = %s', (track_id,))
    cleanup('DELETE FROM "TrackAudioFeatures" WHERE "trackId" = %s', (track_id,))
    cleanup('DELETE FROM "TrackEmbedding" WHERE "trackId" = %s', (track_id,))
    with conn.cursor() as cur:
        cur.execute('INSERT INTO "Artist"(id,name,"nameNormalized") VALUES(%s,%s,%s) ON CONFLICT(id) DO NOTHING',
                    (artist_id, artist, artist.lower()))
        cur.execute('''INSERT INTO "Track"(id,isrc,title,"titleNormalized","durationMs","artistId")
                       VALUES(%s,%s,%s,%s,%s,%s) ON CONFLICT(id) DO NOTHING''',
                    (track_id, isrc, title, title.lower(), 180000, artist_id))
        cur.execute('''INSERT INTO "TrackAudioFeatures"
              (id,"trackId",source,"modelVersion",danceability,energy,valence,acousticness,
               instrumentalness,liveness,speechiness,tempo,loudness,key,mode,"timeSignature",
               "energyCurve",subgenres,confidence)
              VALUES(%s,%s,'our_model',%s,0.5,%s,%s,%s,%s,0.1,0.05,%s,-8.0,5,1,4,
                     ARRAY[]::double precision[],ARRAY[]::text[],0.9)''',
                    (stable_id(f"taf|{track_id}"), track_id, CATALOG_MV, energy, valence,
                     acousticness, instrumentalness, tempo))
        cur.execute('''INSERT INTO "TrackEmbedding"(id,"trackId","modelVersion",embedding,pooling,"audioSource")
                       VALUES(%s,%s,%s,%s::vector,'mean','mp3_30s')''',
                    (stable_id(f"emb|{track_id}"), track_id, CATALOG_MV, emb))
    conn.commit()
    return track_id


def test_recommend_orders_by_mood_fit_no_embedding(db_conn, cleanup):
    user_id = get_or_create_user(db_conn, f"well_{uuid.uuid4().hex[:8]}@t.local")
    cleanup('DELETE FROM "User" WHERE id = %s', (user_id,))
    near = _seed_track(db_conn, cleanup, **CALM_CENTER, title="Near")
    far = _seed_track(db_conn, cleanup, valence=0.9, energy=0.9, tempo=150.0, title="Far")
    recs = recommend_wellness(db_conn, user_id, "calm", n=500000)
    ids = [r["track_id"] for r in recs]
    assert near in ids and far in ids
    assert ids.index(near) < ids.index(far)
    assert all("score" in r and "mood_fit" in r for r in recs)


def test_recommend_excludes_owned_and_disliked(db_conn, cleanup):
    user_id = get_or_create_user(db_conn, f"well_{uuid.uuid4().hex[:8]}@t.local")
    cleanup('DELETE FROM "User" WHERE id = %s', (user_id,))
    owned = _seed_track(db_conn, cleanup, **CALM_CENTER, title="Owned")
    blocked = _seed_track(db_conn, cleanup, **CALM_CENTER, title="Blocked")
    with db_conn.cursor() as cur:
        cur.execute('INSERT INTO "UserTrack"(id,"userId","trackId","isCore",source,platform) VALUES(%s,%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING',
                    (stable_id(f"ut|{user_id}|{owned}"), user_id, owned, False, "liked", "local"))
        cur.execute('''INSERT INTO "UserBlocked"(id,"userId","targetId","targetType",reason)
                       VALUES(%s,%s,%s,'track','disliked') ON CONFLICT DO NOTHING''',
                    (stable_id(f"ub|{user_id}|{blocked}"), user_id, blocked))
    db_conn.commit()
    recs = recommend_wellness(db_conn, user_id, "calm", n=20)
    ids = [r["track_id"] for r in recs]
    assert owned not in ids and blocked not in ids


def test_recommend_bad_mood_raises(db_conn):
    with pytest.raises(ValueError):
        recommend_wellness(db_conn, "dummy-user", "nope", n=5)
