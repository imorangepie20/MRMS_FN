"""MelonEMPImporter — melon.com Hot 100 HTML 스크래핑."""
from unittest.mock import AsyncMock, patch

from mrms.emp.melon import (
    SECTION_KEY,
    SECTION_TITLE,
    SOURCE_ID,
    MelonEMPImporter,
    parse_chart,
)


def _row(rank, song_no, title, artist, album=None, cover=None, cls="lst50"):
    """Melon 차트 한 행의 HTML (실측 구조 축약)."""
    album_html = (
        f'<div class="ellipsis rank03"><a href="#album">{album}</a></div>'
        if album is not None
        else '<div class="ellipsis rank03"></div>'
    )
    cover_html = (
        f'<a href="#" class="image_typeAll"><img src="{cover}" /></a>'
        if cover is not None
        else ""
    )
    return f"""
      <tr class="{cls}" data-song-no="{song_no}">
        <td><span class="rank">{rank}</span></td>
        <td>{cover_html}</td>
        <td>
          <div class="ellipsis rank01"><a href="#play">{title}</a></div>
          <div class="ellipsis rank02"><a href="#artist">{artist}</a></div>
          {album_html}
        </td>
      </tr>
    """


def _chart_html(rows_html: str) -> str:
    return f"""<!doctype html><html><body>
      <table><tbody>{rows_html}</tbody></table>
    </body></html>"""


# 픽스처 데이터는 실제 차트 곡과 충돌하지 않도록 합성 제목/아티스트 사용
# (DB seed/타 테스트 잔여물과 Artist/Album dedup 충돌 → cleanup FK 위반 방지).
SAMPLE_HTML = _chart_html(
    _row(1, "38400000", "MELON TEST 갑자기", "MELON Test A1", "MELON Test Album 1",
         "https://cdn.melon/1.jpg")
    + _row(4, "38400003", "MELON TEST LEMONADE", "MELON Test A2", "MELON Test Album 2",
           "https://cdn.melon/4.jpg", cls="lst100")
)


# ----- parse_chart (순수 함수) -----


def test_parse_chart_extracts_rows():
    tracks = parse_chart(SAMPLE_HTML)
    assert len(tracks) == 2

    first = tracks[0]
    assert first["rank"] == 1
    assert first["song_id"] == "38400000"
    assert first["title"] == "MELON TEST 갑자기"
    assert first["artist"] == "MELON Test A1"
    assert first["album"] == "MELON Test Album 1"
    assert first["cover_url"] == "https://cdn.melon/1.jpg"

    # lst100 행도 같은 셀렉터로 잡힘
    second = tracks[1]
    assert second["rank"] == 4
    assert second["song_id"] == "38400003"
    assert second["title"] == "MELON TEST LEMONADE"
    assert second["artist"] == "MELON Test A2"


def test_parse_chart_rank_digits_only():
    """span.rank에 텍스트 노이즈가 섞여도 숫자만 추출."""
    html = _chart_html(_row("순위 7", "111", "곡", "가수"))
    tracks = parse_chart(html)
    assert tracks[0]["rank"] == 7


def test_parse_chart_album_optional():
    """rank03(앨범)이 비면 album=None."""
    html = _chart_html(_row(1, "222", "곡", "가수", album=None))
    tracks = parse_chart(html)
    assert len(tracks) == 1
    assert tracks[0]["album"] is None


def test_parse_chart_fallback_cover_from_td_img():
    """image_typeAll이 없으면 td a img[src] fallback."""
    html = _chart_html("""
      <tr class="lst50" data-song-no="333">
        <td><span class="rank">1</span></td>
        <td><a href="#"><img src="https://cdn.melon/fb.jpg" /></a></td>
        <td>
          <div class="ellipsis rank01"><a>곡</a></div>
          <div class="ellipsis rank02"><a>가수</a></div>
        </td>
      </tr>
    """)
    tracks = parse_chart(html)
    assert tracks[0]["cover_url"] == "https://cdn.melon/fb.jpg"


def test_parse_chart_skips_row_without_song_no():
    """data-song-no 없는 행은 skip."""
    html = _chart_html("""
      <tr class="lst50">
        <td><span class="rank">1</span></td>
        <td>
          <div class="ellipsis rank01"><a>곡</a></div>
          <div class="ellipsis rank02"><a>가수</a></div>
        </td>
      </tr>
    """)
    assert parse_chart(html) == []


def test_parse_chart_empty_on_layout_change():
    """셀렉터가 안 맞는 HTML이면 빈 리스트 (0행 → import_all이 에러 기록)."""
    assert parse_chart("<html><body><div>no chart</div></body></html>") == []


# ----- import_all DB 통합 -----


async def test_import_all_saves_section_and_tracks(db_conn, cleanup):
    """parse mock(HTML fetch) → EMPSection 1개 + chart 아이템 + 트랙 EMPSource(chart:hot100)."""
    # cleanup은 역순 실행 — 부모(Artist/Album/Track) 먼저 등록.
    cleanup('DELETE FROM "Artist" WHERE name IN (%s, %s)', ("MELON Test A1", "MELON Test A2"))
    cleanup(
        'DELETE FROM "Album" WHERE title IN (%s, %s)',
        ("MELON Test Album 1", "MELON Test Album 2"),
    )
    cleanup(
        'DELETE FROM "Track" WHERE isrc IN (%s, %s)',
        ("emp_melon_38400000", "emp_melon_38400003"),
    )
    cleanup(
        'DELETE FROM "TrackPlatform" WHERE "platformTrackId" IN (%s, %s)',
        ("38400000", "38400003"),
    )
    cleanup('DELETE FROM "EMPSource" WHERE source_id = %s', (SOURCE_ID,))
    cleanup(
        'DELETE FROM "EMPSection" WHERE platform = %s AND "sectionKey" = %s',
        ("melon", SECTION_KEY),
    )  # EMPSectionItem은 ON DELETE CASCADE

    importer = MelonEMPImporter()
    with patch.object(
        MelonEMPImporter, "_fetch_chart_html", AsyncMock(return_value=SAMPLE_HTML)
    ):
        summary = await importer.import_all(db_conn)

    assert summary["errors"] == []
    assert summary["playlists_processed"] == 1
    assert summary["tracks_new"] + summary["tracks_existing"] == 2

    with db_conn.cursor() as cur:
        cur.execute(
            'SELECT id, "displayTitle" FROM "EMPSection" '
            'WHERE platform = %s AND "sectionKey" = %s',
            ("melon", SECTION_KEY),
        )
        sec = cur.fetchone()
        assert sec is not None
        assert sec[1] == SECTION_TITLE

        # 차트 단일 컨테이너 아이템 1개, 대표 커버 = 1위 곡 커버
        cur.execute(
            'SELECT "itemType", "itemId", title, "coverUrl" FROM "EMPSectionItem" '
            'WHERE "sectionId" = %s',
            (sec[0],),
        )
        items = cur.fetchall()
        assert len(items) == 1
        assert items[0][0] == "chart"
        assert items[0][1] == SECTION_KEY
        assert items[0][3] == "https://cdn.melon/1.jpg"

        # 트랙 EMPSource — source_id chart:hot100, 2곡
        cur.execute(
            'SELECT COUNT(*) FROM "EMPSource" '
            "WHERE platform = %s AND source_type = %s AND source_id = %s",
            ("melon", "chart", SOURCE_ID),
        )
        assert cur.fetchone()[0] == 2

        # platform_track_id = Melon songId 매핑 확인
        cur.execute(
            'SELECT COUNT(*) FROM "TrackPlatform" '
            'WHERE platform = %s AND "platformTrackId" IN (%s, %s)',
            ("melon", "38400000", "38400003"),
        )
        assert cur.fetchone()[0] == 2


async def test_import_all_zero_rows_records_error(db_conn):
    """0행이면 섹션 안 만들고 에러만 기록 (레이아웃 변경 가시화)."""
    importer = MelonEMPImporter()
    with patch.object(
        MelonEMPImporter,
        "_fetch_chart_html",
        AsyncMock(return_value="<html><body>no chart</body></html>"),
    ):
        summary = await importer.import_all(db_conn)

    assert summary["tracks_new"] == 0
    assert summary["playlists_processed"] == 0
    assert any("0 rows" in e for e in summary["errors"])
    with db_conn.cursor() as cur:
        cur.execute(
            'SELECT COUNT(*) FROM "EMPSection" WHERE platform = %s AND "sectionKey" = %s',
            ("melon", SECTION_KEY),
        )
        assert cur.fetchone()[0] == 0
