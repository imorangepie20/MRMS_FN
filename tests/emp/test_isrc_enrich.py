"""EMP 합성-ISRC enrichment."""
import uuid

import pytest

from mrms.emp.isrc_enrich import SyntheticTrack, fetch_synthetic_emp_tracks


def _artist_id(conn) -> str:
    with conn.cursor() as cur:
        cur.execute('SELECT id FROM "Artist" LIMIT 1')
        row = cur.fetchone()
    if not row:
        pytest.skip("Artist 데이터 부족")
    return row[0]


def _make_track(conn, cleanup, isrc: str, *, in_emp: bool) -> str:
    """테스트용 Track 직접 삽입. id 반환. cleanup 등록."""
    tid = f"t_isrctest_{uuid.uuid4().hex[:10]}"
    aid = _artist_id(conn)
    with conn.cursor() as cur:
        cur.execute(
            '''INSERT INTO "Track"
                 (id, isrc, title, "titleNormalized", "durationMs", "artistId", "inEmp")
               VALUES (%s, %s, %s, %s, %s, %s, %s)''',
            (tid, isrc, "Test Title", "test title", 0, aid, in_emp),
        )
    conn.commit()
    cleanup('DELETE FROM "Track" WHERE id = %s', (tid,))
    return tid


def test_fetch_synthetic_picks_only_synthetic_unembedded_inemp(db_conn, cleanup):
    """합성 ISRC(언더스코어 포함) + inEmp + 미임베딩만 골라낸다."""
    sfx = uuid.uuid4().hex[:8]
    synth = _make_track(db_conn, cleanup, f"emp_apple_{sfx}", in_emp=True)
    real = _make_track(db_conn, cleanup, f"USRC1{sfx}", in_emp=True)   # real ISRC → 제외
    not_emp = _make_track(db_conn, cleanup, f"emp_vibe_{sfx}", in_emp=False)  # inEmp=False → 제외

    ids = {t.track_id for t in fetch_synthetic_emp_tracks(db_conn)}
    assert synth in ids
    assert real not in ids
    assert not_emp not in ids
    # 반환 타입 확인
    one = next(t for t in fetch_synthetic_emp_tracks(db_conn) if t.track_id == synth)
    assert isinstance(one, SyntheticTrack)
    assert one.isrc == f"emp_apple_{sfx}"
    assert one.title == "Test Title"
