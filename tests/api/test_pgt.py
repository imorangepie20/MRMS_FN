"""PGT 파생 섹션 쿼리."""
from mrms.db.ids import stable_id as _id


def _seed(conn):
    """User + Artist + Album + 3 Track + UserTrack(liked/pct/playlist) 시드."""
    uid = _id("test|pgtuser")
    aid = _id("test|pgtartist"); alid = _id("test|pgtalbum")
    with conn.cursor() as cur:
        cur.execute('INSERT INTO "User"(id,email) VALUES(%s,%s) ON CONFLICT(id) DO NOTHING', (uid, "pgt@auto.local"))
        cur.execute('INSERT INTO "Artist"(id,name,"nameNormalized") VALUES(%s,%s,%s) ON CONFLICT(id) DO NOTHING', (aid, "PGT Artist", "pgt artist"))
        cur.execute('INSERT INTO "Album"(id,title,"albumType","artistId") VALUES(%s,%s,%s,%s) ON CONFLICT(id) DO NOTHING', (alid, "PGT Album", "album", aid))
        for i, (src, core) in enumerate([("liked", False), ("liked", True), ("playlist:My Mix", False)]):
            tid = _id(f"test|pgttrack|{i}")
            cur.execute('''INSERT INTO "Track"(id,isrc,title,"titleNormalized","durationMs","artistId","albumId")
                           VALUES(%s,%s,%s,%s,%s,%s,%s) ON CONFLICT(id) DO NOTHING''',
                        (tid, f"PGTISRC{i:08d}", f"trk{i}", f"trk{i}", 1000, aid, alid))
            cur.execute('''INSERT INTO "UserTrack"(id,"userId","trackId","isCore",source,platform)
                           VALUES(%s,%s,%s,%s,%s,'mrms') ON CONFLICT("userId","trackId") DO NOTHING''',
                        (_id(f"ut|{uid}|{tid}"), uid, tid, core, src))
    conn.commit()
    return uid


def test_pgt_sections(db_conn, cleanup):
    from mrms.db.pgt import (section_liked, section_pct, section_albums,
                             section_artists)
    uid = _seed(db_conn)
    assert len(section_liked(db_conn, uid)) == 2            # 2 liked
    assert len(section_pct(db_conn, uid)) == 1              # 1 isCore
    albums = section_albums(db_conn, uid)
    assert len(albums) == 1 and albums[0]["track_count"] == 3
    artists = section_artists(db_conn, uid)
    assert len(artists) == 1 and artists[0]["track_count"] == 3
    # 서브함수 + 트랙 dict shape(get_playlist_tracks와 동일: album_cover 포함)
    from mrms.db.pgt import album_tracks
    at = album_tracks(db_conn, uid, albums[0]["album_id"])
    assert len(at) == 3 and "album_cover" in at[0]
    cleanup('DELETE FROM "UserTrack" WHERE "userId"=%s', (uid,))
