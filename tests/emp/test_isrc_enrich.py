"""EMP 합성-ISRC enrichment."""
import uuid
from unittest.mock import AsyncMock, patch

import pytest

from mrms.emp.isrc_enrich import (
    SyntheticTrack,
    fetch_synthetic_emp_tracks,
    is_confident_match,
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
