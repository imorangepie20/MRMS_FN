"""미스곡 조회 쿼리 — 합성 ID 제외 + UserTrack 보유 + 임베딩 없음만 반환."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))


def test_fetch_youtube_misses_excludes_synthetic_and_embedded(db_conn, cleanup):
    """실 videoId + UserTrack 보유 + 임베딩 없음만 반환. 합성(yt_)·임베딩 보유는 제외."""
    import importlib

    mod = importlib.import_module("13_embed_youtube_misses")

    # 준비: artist/track/usertrack/trackplatform 시드 — cleanup 등록 (자식 먼저 삭제).
    # 실 스키마 NOT NULL: Artist(name, nameNormalized), Track(isrc, titleNormalized,
    # durationMs), UserTrack(isCore, source, platform) 모두 채운다.
    with db_conn.cursor() as cur:
        cur.execute(
            'INSERT INTO "Artist" (id, name, "nameNormalized") VALUES (%s,%s,%s)',
            ("p2-ar", "P2 Artist", "p2 artist"),
        )
        cur.execute('INSERT INTO "User" (id, email) VALUES (%s,%s)', ("p2-u", "p2@test.local"))
        for tid, vid, isrc in [
            ("p2-t-real", "REALVID12345", "P2REAL000001"),
            ("p2-t-syn", "yt_deadbeef", "yt_deadbeef"),
        ]:
            cur.execute(
                'INSERT INTO "Track" '
                '(id, isrc, title, "titleNormalized", "durationMs", "artistId") '
                "VALUES (%s,%s,%s,%s,%s,%s)",
                (tid, isrc, f"T {tid}", f"t {tid}", 0, "p2-ar"),
            )
            cur.execute(
                'INSERT INTO "TrackPlatform" (id,"trackId",platform,"platformTrackId") '
                "VALUES (%s,%s,%s,%s)",
                (f"tp-{tid}", tid, "youtube", vid),
            )
            cur.execute(
                'INSERT INTO "UserTrack" (id,"userId","trackId",platform,source,"isCore") '
                "VALUES (%s,%s,%s,%s,%s,%s)",
                (f"ut-{tid}", "p2-u", tid, "youtube", "playlist:x", False),
            )
    db_conn.commit()
    # cleanup은 등록 역순으로 실행되므로 부모(Artist/User)를 먼저 등록해
    # 자식(UserTrack/TrackPlatform/Track)이 먼저 삭제되게 한다 (FK 위반 방지).
    cleanup('DELETE FROM "Artist" WHERE id=%s', ("p2-ar",))
    cleanup('DELETE FROM "User" WHERE id=%s', ("p2-u",))
    cleanup('DELETE FROM "Track" WHERE id IN (%s,%s)', ("p2-t-real", "p2-t-syn"))
    cleanup('DELETE FROM "TrackPlatform" WHERE "trackId" IN (%s,%s)', ("p2-t-real", "p2-t-syn"))
    cleanup('DELETE FROM "UserTrack" WHERE "userId"=%s', ("p2-u",))

    # limit을 크게 — DB에 다른 미스곡이 있어도 시드한 행이 결과에서 잘리지 않게 (격리 robust)
    rows = mod.fetch_youtube_misses(db_conn, limit=1_000_000)
    vids = {r["video_id"] for r in rows}
    assert "REALVID12345" in vids       # 실 videoId + UserTrack + 임베딩 없음 → 포함
    assert "yt_deadbeef" not in vids    # 합성 ID → 제외
