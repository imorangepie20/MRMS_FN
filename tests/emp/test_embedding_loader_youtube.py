"""'youtube_{videoId}' key → trackId 역매핑 검증.

embedding_loader는 reverse-mapping 함수를 따로 두지 않고, 다음 forward 경로로
trackId↔key를 잇는다:
  fetch_pending(conn)  → PendingTrack(track_id, ..., youtube_id) 조회
  candidate_keys(track) → 'youtube_{youtube_id}' 키 후보 생성
  resolve_npy(dir, track) → '{key}.npy' 존재 파일 매칭
03이 만든 youtube_{videoId}.npy 가 올바른 trackId에 붙으려면 이 경로에
youtube 분기가 있어야 한다 (기존 tidal/spotify 분기와 동일 패턴).
"""
from __future__ import annotations

import numpy as np

from mrms.emp.embedding_loader import (
    PendingTrack,
    candidate_keys,
    fetch_pending,
    resolve_npy,
)


# ─── 순수 key 매핑: youtube 분기 ──────────────────────────────────
def test_candidate_keys_includes_youtube():
    t = PendingTrack(
        track_id="t1", isrc=None, tidal_id=None, spotify_id=None, youtube_id="VIDXYZ789"
    )
    assert "youtube_VIDXYZ789" in candidate_keys(t)


def test_resolve_npy_matches_youtube_key(tmp_path):
    t = PendingTrack(
        track_id="t1", isrc=None, tidal_id=None, spotify_id=None, youtube_id="VIDXYZ789"
    )
    np.save(tmp_path / "youtube_VIDXYZ789.npy", np.zeros(768, dtype=np.float32))
    assert resolve_npy(tmp_path, t) == tmp_path / "youtube_VIDXYZ789.npy"


# ─── DB reverse 경로: 'youtube_{videoId}' → trackId ──────────────
def test_youtube_key_maps_to_track_id(db_conn, cleanup):
    """실 미스곡 형태(inEmp=FALSE + UserTrack)가 fetch_pending에 surface 되어야 한다.

    upsert_youtube_track로 들어온 유저 라이브러리 미스곡은 EMPSource가 없어
    inEmp=FALSE 다 (기본값). inEmp 게이트만 걸면 이 트랙이 영영 임베딩 대상에서
    빠지므로, 실제 production 형태 그대로 시드해 fetch_pending이 노출하는지 검증한다.
    fetch_pending이 videoId를 노출 → candidate_keys로 'youtube_{videoId}' 생성 →
    그 key가 해당 trackId로 역매핑된다 (03이 만든 npy가 올바른 트랙에 붙는다)."""
    with db_conn.cursor() as cur:
        cur.execute(
            'INSERT INTO "Artist" (id,name,"nameNormalized") VALUES (%s,%s,%s)',
            ("p2l-ar", "L", "l"),
        )
        cur.execute('INSERT INTO "User" (id,email) VALUES (%s,%s)', ("p2l-u", "p2l@test.local"))
        # 실 미스곡: inEmp 미지정 → 컬럼 기본값 FALSE (EMPSource 없음).
        cur.execute(
            'INSERT INTO "Track" (id,isrc,title,"titleNormalized","durationMs","artistId") '
            "VALUES (%s,%s,%s,%s,%s,%s)",
            ("p2l-t", "yt_VIDXYZ789", "L", "l", 0, "p2l-ar"),
        )
        cur.execute(
            'INSERT INTO "TrackPlatform" (id,"trackId",platform,"platformTrackId") '
            "VALUES (%s,%s,%s,%s)",
            ("p2l-tp", "p2l-t", "youtube", "VIDXYZ789"),
        )
        cur.execute(
            'INSERT INTO "UserTrack" (id,"userId","trackId",platform,source,"isCore") '
            "VALUES (%s,%s,%s,%s,%s,%s)",
            ("p2l-ut", "p2l-u", "p2l-t", "youtube", "playlist:x", False),
        )
    db_conn.commit()
    # cleanup은 등록 역순 실행 → 부모(Artist/User) 먼저 등록해 자식이 먼저 삭제.
    cleanup('DELETE FROM "Artist" WHERE id=%s', ("p2l-ar",))
    cleanup('DELETE FROM "User" WHERE id=%s', ("p2l-u",))
    cleanup('DELETE FROM "Track" WHERE id=%s', ("p2l-t",))
    cleanup('DELETE FROM "TrackPlatform" WHERE id=%s', ("p2l-tp",))
    cleanup('DELETE FROM "UserTrack" WHERE id=%s', ("p2l-ut",))

    # inEmp=FALSE 확인 — 게이트가 이 트랙을 떨어뜨리지 않는지가 핵심.
    with db_conn.cursor() as cur:
        cur.execute('SELECT "inEmp" FROM "Track" WHERE id=%s', ("p2l-t",))
        assert cur.fetchone()[0] is False

    pending = {p.track_id: p for p in fetch_pending(db_conn, limit=0)}
    assert "p2l-t" in pending  # inEmp=FALSE 미스곡도 surface 되어야 한다.
    track = pending["p2l-t"]
    assert track.youtube_id == "VIDXYZ789"
    # 'youtube_{videoId}' key가 이 trackId(p2l-t)의 후보에 포함 → 역매핑 성립.
    assert "youtube_VIDXYZ789" in candidate_keys(track)
