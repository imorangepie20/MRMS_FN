"""EMP 합성-ISRC enrichment."""
import uuid
from unittest.mock import AsyncMock, patch

import pytest

from mrms.emp.isrc_enrich import (
    SyntheticTrack,
    classify_one,
    fetch_synthetic_emp_tracks,
    find_canonical,
    is_confident_match,
    merge_track,
    rekey_track,
    resolve_real_isrc,
)


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


def test_is_confident_match_artist_gate_and_title_variants():
    # artist 일치 + title 정확/버전 변형 → True
    assert is_confident_match("Watermelon Sugar", "Harry Styles",
                              "Watermelon Sugar", "Harry Styles") is True
    assert is_confident_match('The Power (7" Version)', "Snap!",
                              "The Power", "SNAP!") is True
    # 괄호 피처/한글 아티스트 정규화
    assert is_confident_match(
        "친구로 지내다 보면 (Feat. 김민석 of 멜로망스)", "BIG Naughty (서동현)",
        "친구로 지내다 보면", "BIG Naughty",
    ) is True
    # artist 불일치 → False (오매칭 차단)
    assert is_confident_match("Watermelon Sugar", "Harry Styles",
                              "Watermelon Sugar", "Andrew Foy") is False
    # 빈 값 → False
    assert is_confident_match("", "X", "", "X") is False


@pytest.mark.asyncio
async def test_resolve_real_isrc_confident_returns_isrc():
    dz = {"isrc": "GBUM71903920", "title": "Watermelon Sugar", "artist": "Harry Styles",
          "preview_url": "http://x"}
    with patch("mrms.emp.isrc_enrich.deezer.search_by_text",
               new=AsyncMock(return_value=dz)):
        got = await resolve_real_isrc(None, "Watermelon Sugar", "Harry Styles")
    assert got == "GBUM71903920"


@pytest.mark.asyncio
async def test_resolve_real_isrc_rejects_low_confidence_and_empty():
    # artist 불일치 → None
    dz_bad = {"isrc": "X", "title": "Watermelon Sugar", "artist": "Andrew Foy"}
    with patch("mrms.emp.isrc_enrich.deezer.search_by_text",
               new=AsyncMock(return_value=dz_bad)):
        assert await resolve_real_isrc(None, "Watermelon Sugar", "Harry Styles") is None
    # Deezer 미스 → None
    with patch("mrms.emp.isrc_enrich.deezer.search_by_text",
               new=AsyncMock(return_value=None)):
        assert await resolve_real_isrc(None, "X", "Y") is None
    # isrc 없는 결과 → None
    with patch("mrms.emp.isrc_enrich.deezer.search_by_text",
               new=AsyncMock(return_value={"title": "X", "artist": "Y"})):
        assert await resolve_real_isrc(None, "X", "Y") is None


def test_merge_track_repoints_fks_and_deletes_synth(db_conn, cleanup):
    """합성 트랙의 TrackPlatform/EMPSource를 canonical로 옮기고 합성 Track 삭제."""
    sfx = uuid.uuid4().hex[:8]
    synth = _make_track(db_conn, cleanup, f"emp_apple_{sfx}", in_emp=True)
    canon = _make_track(db_conn, cleanup, f"USRC2{sfx}", in_emp=True)

    # 합성에 TrackPlatform(apple) + EMPSource 부착
    with db_conn.cursor() as cur:
        cur.execute(
            '''INSERT INTO "TrackPlatform" (id,"trackId",platform,"platformTrackId")
               VALUES (%s,%s,'apple',%s)''',
            (f"tp_{sfx}", synth, f"applepid_{sfx}"),
        )
        cur.execute(
            '''INSERT INTO "EMPSource" (id,"trackId",platform,source_type,source_id)
               VALUES (%s,%s,'apple','editorial_playlist',%s)''',
            (f"es_{sfx}", synth, f"src_{sfx}"),
        )
    db_conn.commit()
    # canonical 쪽으로 옮겨질 행들 cleanup 등록
    cleanup('DELETE FROM "TrackPlatform" WHERE "platformTrackId" = %s', (f"applepid_{sfx}",))
    cleanup('DELETE FROM "EMPSource" WHERE source_id = %s', (f"src_{sfx}",))

    assert find_canonical(db_conn, f"USRC2{sfx}", synth) == canon

    merge_track(db_conn, synth, canon)

    with db_conn.cursor() as cur:
        cur.execute('SELECT 1 FROM "Track" WHERE id = %s', (synth,))
        assert cur.fetchone() is None
        cur.execute('SELECT "trackId" FROM "TrackPlatform" WHERE "platformTrackId" = %s',
                    (f"applepid_{sfx}",))
        assert cur.fetchone()[0] == canon
        cur.execute('SELECT "trackId" FROM "EMPSource" WHERE source_id = %s', (f"src_{sfx}",))
        assert cur.fetchone()[0] == canon


def test_merge_track_drops_conflicting_rows(db_conn, cleanup):
    """canonical이 이미 같은 unique 키(platform)를 가지면 synth 행은 drop(이동 X)."""
    sfx = uuid.uuid4().hex[:8]
    synth = _make_track(db_conn, cleanup, f"emp_apple_{sfx}", in_emp=True)
    canon = _make_track(db_conn, cleanup, f"USRC4{sfx}", in_emp=True)
    # synth와 canon 둘 다 apple TrackPlatform 보유(platformTrackId 다름) → platform 충돌
    with db_conn.cursor() as cur:
        cur.execute('''INSERT INTO "TrackPlatform" (id,"trackId",platform,"platformTrackId")
                       VALUES (%s,%s,'apple',%s)''', (f"tps_{sfx}", synth, f"spid_{sfx}"))
        cur.execute('''INSERT INTO "TrackPlatform" (id,"trackId",platform,"platformTrackId")
                       VALUES (%s,%s,'apple',%s)''', (f"tpc_{sfx}", canon, f"cpid_{sfx}"))
    db_conn.commit()
    cleanup('DELETE FROM "TrackPlatform" WHERE "platformTrackId" = %s', (f"spid_{sfx}",))
    cleanup('DELETE FROM "TrackPlatform" WHERE "platformTrackId" = %s', (f"cpid_{sfx}",))

    merge_track(db_conn, synth, canon)

    with db_conn.cursor() as cur:
        # synth Track 삭제됨
        cur.execute('SELECT 1 FROM "Track" WHERE id = %s', (synth,))
        assert cur.fetchone() is None
        # canonical은 apple TrackPlatform 정확히 1개 = 자기 것(cpid). synth(spid)는 drop.
        cur.execute('SELECT "platformTrackId" FROM "TrackPlatform" '
                    'WHERE "trackId" = %s AND platform = %s', (canon, "apple"))
        assert [r[0] for r in cur.fetchall()] == [f"cpid_{sfx}"]
        # synth를 참조하는 TrackPlatform 없음
        cur.execute('SELECT count(*) FROM "TrackPlatform" WHERE "trackId" = %s', (synth,))
        assert cur.fetchone()[0] == 0


def test_rekey_track_updates_isrc(db_conn, cleanup):
    """카탈로그에 없는 real ISRC → 합성 트랙 isrc를 real로 갱신."""
    sfx = uuid.uuid4().hex[:8]
    synth = _make_track(db_conn, cleanup, f"emp_vibe_{sfx}", in_emp=True)
    real = f"KRB3{sfx}"
    cleanup('DELETE FROM "Track" WHERE isrc = %s', (real,))  # 갱신 후 키로도 정리

    rekey_track(db_conn, synth, real)

    with db_conn.cursor() as cur:
        cur.execute('SELECT isrc FROM "Track" WHERE id = %s', (synth,))
        assert cur.fetchone()[0] == real


@pytest.mark.asyncio
async def test_classify_one_branches(db_conn, cleanup):
    """resolve 결과 × 카탈로그 존재 여부로 merge/rekey/skip 분기."""
    sfx = uuid.uuid4().hex[:8]
    canon = _make_track(db_conn, cleanup, f"USRC3{sfx}", in_emp=True)
    synth = SyntheticTrack(track_id=f"x_{sfx}", isrc=f"emp_apple_{sfx}",
                           title="Test Title", artist="Test Artist")

    # real ISRC가 카탈로그에 있음 → merge
    with patch("mrms.emp.isrc_enrich.resolve_real_isrc",
               new=AsyncMock(return_value=f"USRC3{sfx}")):
        assert await classify_one(db_conn, None, synth) == ("merge", f"USRC3{sfx}", canon)
    # real ISRC가 신규 → rekey
    with patch("mrms.emp.isrc_enrich.resolve_real_isrc",
               new=AsyncMock(return_value=f"NEW9{sfx}")):
        assert await classify_one(db_conn, None, synth) == ("rekey", f"NEW9{sfx}", None)
    # 해결 실패 → skip
    with patch("mrms.emp.isrc_enrich.resolve_real_isrc", new=AsyncMock(return_value=None)):
        assert await classify_one(db_conn, None, synth) == ("skip", None, None)
