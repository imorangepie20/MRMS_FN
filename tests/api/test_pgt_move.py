"""MRT→PGT 이동 테스트: UserTrack에 담은 트랙은 MRT 추천에서 제외."""
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


def _seed_catalog_track(conn) -> tuple[str, str, str]:
    """Artist + Album + Track + TrackPlatform(tidal) 생성.

    tidal primary fallback을 통해 _fetch_track_metadata INNER JOIN을 통과하도록
    TrackPlatform(platform='tidal')을 반드시 삽입한다.

    Returns: (artist_id, album_id, track_id)
    """
    tag = uuid.uuid4().hex[:8]
    artist_id = _id(f"test|pgtmove|artist|{tag}")
    album_id = _id(f"test|pgtmove|album|{tag}")
    track_id = _id(f"test|pgtmove|track|{tag}")
    tidal_platform_track_id = f"tidal-{tag}"

    with conn.cursor() as cur:
        cur.execute(
            '''INSERT INTO "Artist" (id, name, "nameNormalized")
               VALUES (%s, %s, %s) ON CONFLICT (id) DO NOTHING''',
            (artist_id, f"MoveArtist-{tag}", f"moveartist-{tag}"),
        )
        cur.execute(
            '''INSERT INTO "Album" (id, title, "albumType", "artistId")
               VALUES (%s, %s, %s, %s) ON CONFLICT (id) DO NOTHING''',
            (album_id, f"MoveAlbum-{tag}", "album", artist_id),
        )
        cur.execute(
            '''INSERT INTO "Track"
                 (id, isrc, title, "titleNormalized", "durationMs", "artistId", "albumId")
               VALUES (%s, %s, %s, %s, %s, %s, %s) ON CONFLICT (id) DO NOTHING''',
            (track_id, f"PGTMOVE{tag.upper()}", f"MoveTrack-{tag}",
             f"movetrack-{tag}", 210000, artist_id, album_id),
        )
        tp_id = _id(f"test|pgtmove|tp|{tag}")
        cur.execute(
            '''INSERT INTO "TrackPlatform" (id, "trackId", platform, "platformTrackId")
               VALUES (%s, %s, %s, %s)
               ON CONFLICT ("trackId", platform) DO NOTHING''',
            (tp_id, track_id, "tidal", tidal_platform_track_id),
        )
    conn.commit()
    return artist_id, album_id, track_id


def _seed_album(conn, n: int = 3) -> tuple[str, list[str]]:
    """Artist + Album + n Tracks 생성. (album_id, [track_id, ...]) 반환."""
    tag = uuid.uuid4().hex[:8]
    artist_id = _id(f"test|pgtcollect|artist|{tag}")
    album_id = _id(f"test|pgtcollect|album|{tag}")
    track_ids = [_id(f"test|pgtcollect|track|{tag}|{i}") for i in range(n)]

    with conn.cursor() as cur:
        cur.execute(
            '''INSERT INTO "Artist" (id, name, "nameNormalized")
               VALUES (%s, %s, %s) ON CONFLICT (id) DO NOTHING''',
            (artist_id, f"CollectArtist-{tag}", f"collectartist-{tag}"),
        )
        cur.execute(
            '''INSERT INTO "Album" (id, title, "albumType", "artistId")
               VALUES (%s, %s, %s, %s) ON CONFLICT (id) DO NOTHING''',
            (album_id, f"CollectAlbum-{tag}", "album", artist_id),
        )
        for i, tid in enumerate(track_ids):
            cur.execute(
                '''INSERT INTO "Track"
                     (id, isrc, title, "titleNormalized", "durationMs", "artistId", "albumId")
                   VALUES (%s, %s, %s, %s, %s, %s, %s) ON CONFLICT (id) DO NOTHING''',
                (
                    tid,
                    f"PGTCOL{tag.upper()}{i:02d}",
                    f"CollectTrack-{tag}-{i}",
                    f"collecttrack-{tag}-{i}",
                    210000,
                    artist_id,
                    album_id,
                ),
            )
    conn.commit()
    return album_id, track_ids, artist_id


def test_album_collect(db_conn, set_session_cookie, cleanup):
    """앨범 collect: 앨범의 모든 트랙을 PGT(source='liked')로 담기."""
    user_id = set_session_cookie(f"album-collect-{uuid.uuid4().hex[:6]}@test.com")
    album_id, track_ids, artist_id = _seed_album(db_conn, n=3)

    # cleanup 등록순서: Artist → Album → Track(s) → UserTrack
    # 실행순서(역순):   UserTrack → Track(s) → Album → Artist
    cleanup('DELETE FROM "Artist" WHERE id=%s', (artist_id,))
    cleanup('DELETE FROM "Album" WHERE id=%s', (album_id,))
    for tid in track_ids:
        cleanup('DELETE FROM "Track" WHERE id=%s', (tid,))
    cleanup('DELETE FROM "UserTrack" WHERE "userId"=%s', (user_id,))

    r = client.post(f"/api/user/tracks/album/{album_id}/collect")
    assert r.status_code == 200 and r.json()["collected"] == 3

    with db_conn.cursor() as cur:
        cur.execute(
            '''SELECT count(*) FROM "UserTrack"
               WHERE "userId"=%s AND "trackId"=ANY(%s) AND source='liked' ''',
            (user_id, track_ids),
        )
        assert cur.fetchone()[0] == 3

    client.cookies.clear()


def test_moved_track_excluded_from_mrt(db_conn, set_session_cookie, cleanup):
    """MRT→PGT 이동: like하면 mrt/latest recommended_tracks에서 제외된다."""
    user_id = set_session_cookie(f"pgt-move-{uuid.uuid4().hex[:6]}@test.com")

    # 1) 카탈로그 트랙 seed (tidal TrackPlatform 포함 → meta resolve 통과)
    artist_id, album_id, track_id = _seed_catalog_track(db_conn)

    # cleanup 등록 — 역순으로 실행됨
    # 등록 순서: Artist → Album → Track → TrackPlatform → UserTrack
    # 실행 순서(역순): UserTrack → TrackPlatform → Track → Album → Artist
    cleanup('DELETE FROM "Artist" WHERE id = %s', (artist_id,))
    cleanup('DELETE FROM "Album" WHERE id = %s', (album_id,))
    cleanup('DELETE FROM "Track" WHERE id = %s', (track_id,))
    cleanup('DELETE FROM "TrackPlatform" WHERE "trackId" = %s', (track_id,))
    cleanup('DELETE FROM "UserTrack" WHERE "trackId" = %s', (track_id,))

    # 2) PlaylistHistory seed — persona 0, 우리 트랙 score 0.9
    insert_playlist_history(
        db_conn, user_id, [track_id], "our-v1.0+persona-K3",
        context={"personaIdx": 0, "kind": "persona", "scores": [0.9]},
    )
    db_conn.commit()

    # 3) MRT 최초 조회 → recommended_tracks에 track_id 포함되어야 함
    r1 = client.get("/api/mrt/latest")
    assert r1.status_code == 200, r1.text
    body1 = r1.json()

    rec_ids_before = [t["track_id"] for t in body1["recommended_tracks"]]
    assert track_id in rec_ids_before, (
        f"seed 트랙이 MRT recommended_tracks에 없음. "
        f"recommended_tracks={rec_ids_before}, "
        f"personas={body1['personas']}"
    )

    # 4) Like → UserTrack 생성 (PGT로 이동)
    r_like = client.post(f"/api/user/tracks/{track_id}/like")
    assert r_like.status_code == 200, r_like.text
    assert r_like.json()["liked"] is True

    # 5) MRT 재조회 → recommended_tracks에서 track_id가 사라져야 함
    r2 = client.get("/api/mrt/latest")
    assert r2.status_code == 200, r2.text
    body2 = r2.json()

    rec_ids_after = [t["track_id"] for t in body2["recommended_tracks"]]
    assert track_id not in rec_ids_after, (
        f"like 후에도 track_id={track_id}가 MRT에 남아있음 (MRT→PGT 이동 미구현)"
    )

    # 6) persona playlist에서도 제외됐는지 확인
    all_playlist_ids = [
        t["track_id"]
        for p in body2["personas"]
        for t in p["playlist"]
    ]
    assert track_id not in all_playlist_ids, (
        f"like 후에도 track_id={track_id}가 persona playlist에 남아있음"
    )

    # 7) recommended_albums에서도 제외 (앨범에 이 트랙 하나뿐 → 앨범 통째로 사라짐).
    #    track_to_album에서 owned 제외가 실제로 먹히는지 검증 (가장 미묘한 경로).
    rec_album_ids = [a["album_id"] for a in body2["recommended_albums"]]
    assert album_id not in rec_album_ids, (
        f"like 후에도 album_id={album_id}가 recommended_albums에 남아있음"
    )

    client.cookies.clear()
