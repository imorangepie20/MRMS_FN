"""FloEMPImporter — music-flo.com 공개 API."""
from contextlib import contextmanager

import httpx
import respx

from mrms.db.emp_section import (
    list_sections_with_items,
    upsert_section,
    upsert_section_item,
)
from mrms.db.settings import set_setting
from mrms.emp.flo import (
    DEFAULT_SOURCES,
    SOURCES_SETTING_KEY,
    FloEMPImporter,
    _album_cover,
    _classify_item,
    _detail_cover,
    _format_cover,
    _normalize_track,
    _parse_play_time,
    _pick_img_url,
    _section_key,
)

CURATIONS_URL = "https://www.music-flo.com/api/personal/v1/curations/contents"
PANELS_URL = "https://www.music-flo.com/api/personal/v2/recommends/home/panels"


def _playlist_url(num_id: str) -> str:
    return f"https://www.music-flo.com/api/personal/v1/playlist/{num_id}"


def _channel_url(num_id: str) -> str:
    return f"https://www.music-flo.com/api/meta/v1/channel/{num_id}"


@contextmanager
def _preserve_flo_special_sections(conn):
    """import_all가 special:* 섹션을 prune하는 것에서 공용 dev DB를 보호.

    진입 전 special:* 섹션+아이템을 스냅샷하고, 종료 시 지우고 재삽입.
    import_all 테스트가 section-level prune를 트리거하기 때문에 필요 —
    빈 응답이 아닌 이상 다른 real special:* 섹션이 전부 날아간다."""
    snapshot = [
        s for s in list_sections_with_items(conn, platform="flo")
        if s["section_key"].startswith("special:")
    ]
    try:
        yield
    finally:
        conn.rollback()
        with conn.cursor() as cur:
            cur.execute(
                'DELETE FROM "EMPSection" WHERE platform = %s AND "sectionKey" LIKE %s',
                ("flo", "special:%"),
            )
        conn.commit()
        for s in snapshot:
            sid = upsert_section(
                conn, platform="flo", section_key=s["section_key"],
                display_title=s["display_title"], display_order=s["display_order"],
            )
            for it in s["items"]:
                upsert_section_item(
                    conn, section_id=sid, item_type=it["item_type"],
                    item_id=it["item_id"], title=it["title"],
                    cover_url=it["cover_url"], display_order=it["display_order"],
                )
        conn.commit()


def _flo_track(tid, name, artists, album_title, play_time, rep_artist=None):
    """FLO track object 모양."""
    tr = {
        "id": tid,
        "name": name,
        "artistList": [{"name": a} for a in artists],
        "album": {
            "title": album_title,
            "img": {"urlFormat": "https://cdn.music-flo.com/cover/{size}.jpg"},
            "releaseYmd": "20260601",
        },
        "playTime": play_time,
    }
    if rep_artist is not None:
        tr["representationArtist"] = {"name": rep_artist}
    return tr


# ----- 소스 파싱 -----


def test_load_sources_parses(db_conn):
    """special + panels + playlist + channel 파싱, 주석/빈 줄/모르는 kind 무시."""
    set_setting(
        db_conn,
        SOURCES_SETTING_KEY,
        "# comment\n"
        "special\n"
        "panels\n"
        "playlist/12345\n"
        "channel/67890\n"
        "bogus/xyz\n"
        "\n",
    )
    try:
        importer = FloEMPImporter()
        sources = importer._load_sources(db_conn)
        assert sources == [
            ("special", ""),
            ("panels", ""),
            ("playlist", "12345"),
            ("channel", "67890"),
        ]
    finally:
        set_setting(db_conn, SOURCES_SETTING_KEY, None)


def test_load_sources_default(db_conn):
    """비어 있으면 DEFAULT_SOURCES = ['special', 'panels']."""
    set_setting(db_conn, SOURCES_SETTING_KEY, None)
    importer = FloEMPImporter()
    sources = importer._load_sources(db_conn)
    assert DEFAULT_SOURCES == ["special", "panels"]
    assert sources == [("special", ""), ("panels", "")]


# ----- cover urlFormat 치환 -----


def test_format_cover_replaces_size():
    """urlFormat '{size}' → 500 치환."""
    assert (
        _format_cover({"urlFormat": "https://cdn.flo.com/x/{size}.jpg"})
        == "https://cdn.flo.com/x/500.jpg"
    )
    assert _format_cover(None) is None
    assert _format_cover({}) is None


# ----- 아이템 분류 (PLAYLIST/CHNL) -----


def test_classify_item_playlist():
    """PLAYLIST → ('playlist', id, name, cover). gridImg 우선."""
    r = _classify_item({
        "type": "PLAYLIST",
        "id": 111,
        "name": "여름 드라이브",
        "gridImg": {"urlFormat": "https://cdn.flo.com/grid/{size}.jpg"},
        "img": {"urlFormat": "https://cdn.flo.com/img/{size}.jpg"},
    })
    assert r == (
        "playlist",
        "111",
        "여름 드라이브",
        "https://cdn.flo.com/grid/500.jpg",
    )


def test_classify_item_channel():
    """CHNL → ('channel', id, name, cover). gridImg 없으면 img fallback."""
    r = _classify_item({
        "type": "CHNL",
        "id": 222,
        "name": "K-힙합",
        "img": {"urlFormat": "https://cdn.flo.com/img/{size}.jpg"},
    })
    assert r == (
        "channel",
        "222",
        "K-힙합",
        "https://cdn.flo.com/img/500.jpg",
    )


def test_classify_item_unknown_type_returns_none():
    assert _classify_item({"type": "TRACK", "id": 1, "name": "x"}) is None
    assert _classify_item({"type": "PLAYLIST", "name": "no id"}) is None


# ----- playTime → ms -----


def test_parse_play_time():
    assert _parse_play_time("3:45") == (3 * 60 + 45) * 1000  # 225000
    assert _parse_play_time("0:30") == 30000
    assert _parse_play_time("10:00") == 600000
    assert _parse_play_time("1:02:03") == (62 * 60 + 3) * 1000  # h:m:s
    assert _parse_play_time(None) is None
    assert _parse_play_time("bad") is None


# ----- 트랙 정규화 -----


def test_normalize_track_artist_list_join():
    """artistList[].name ', ' join + playTime ms + album.title."""
    t = _normalize_track(
        _flo_track("t1", "노래", ["데이브레이크", "원슈타인"], "앨범A", "4:05")
    )
    assert t["platform_track_id"] == "t1"
    assert t["title"] == "노래"
    assert t["isrc"] is None
    assert t["artist"] == "데이브레이크, 원슈타인"
    assert t["album_title"] == "앨범A"
    assert t["duration_ms"] == (4 * 60 + 5) * 1000
    # album.img.urlFormat → '{size}'→500 치환된 트랙 커버
    assert t["cover_url"] == "https://cdn.music-flo.com/cover/500.jpg"


def test_normalize_track_falls_back_to_representation_artist():
    """artistList 비었으면 representationArtist.name."""
    tr = {
        "id": "t2",
        "name": "솔로곡",
        "artistList": [],
        "representationArtist": {"name": "won.e"},
        "album": {"title": "B"},
        "playTime": "2:10",
    }
    t = _normalize_track(tr)
    assert t["artist"] == "won.e"
    assert t["duration_ms"] == 130000


def test_normalize_track_missing_id_or_name():
    assert _normalize_track({"name": "x"}) is None
    assert _normalize_track({"id": "1"}) is None
    assert _normalize_track("not a dict") is None


# ----- import_all 통합 (curations → 섹션 + 아이템 + 트랙) -----


@respx.mock
async def test_import_all_special_saves_section_items_and_tracks(db_conn, cleanup):
    """special 소스 → 큐레이션 섹션 1개 + playlist/channel 아이템 + 양쪽 트랙 적재."""
    # sectionKey는 이제 title 기반(title 정규화) — _section_key와 동일 계산.
    section_key = _section_key("예감 좋은 행운을 드려요", 9001)
    set_setting(db_conn, SOURCES_SETTING_KEY, "special")

    # cleanup 역순 실행 — 자식(Track)→부모(Album)→조부모(Artist) 순으로 지우려면
    # 등록은 Artist → Album → Track 순 (FK: Track→Album→Artist)
    cleanup(
        'DELETE FROM "Artist" WHERE name IN (%s, %s)',
        ("FLO Test A1", "FLO Test A2"),
    )
    cleanup(
        'DELETE FROM "Album" WHERE title IN (%s, %s)',
        ("PL Album", "CH Album"),
    )
    cleanup(
        'DELETE FROM "Track" WHERE isrc IN (%s, %s)',
        ("emp_flo_flo_pl_t1", "emp_flo_flo_ch_t1"),
    )
    cleanup(
        'DELETE FROM "TrackPlatform" WHERE "platformTrackId" IN (%s, %s)',
        ("flo_pl_t1", "flo_ch_t1"),
    )
    cleanup(
        'DELETE FROM "EMPSource" WHERE source_id IN (%s, %s)',
        ("playlist:111", "channel:222"),
    )
    cleanup(
        'DELETE FROM "EMPSection" WHERE platform = %s AND "sectionKey" = %s',
        ("flo", section_key),
    )  # EMPSectionItem은 ON DELETE CASCADE
    cleanup('DELETE FROM "Setting" WHERE key = %s', (SOURCES_SETTING_KEY,))

    curations = {
        "code": "2000000",
        "data": {
            "list": [
                {
                    "type": "CURATION2",
                    "content": {
                        "id": 9001,
                        "title": "예감 좋은 행운을 드려요",
                        "list": [
                            {
                                "type": "PLAYLIST",
                                "id": 111,
                                "name": "행운 플레이리스트",
                                "gridImg": {
                                    "urlFormat": "https://cdn.flo.com/pl/{size}.jpg"
                                },
                            },
                            {
                                "type": "CHNL",
                                "id": 222,
                                "name": "K-힙합 채널",
                                "img": {
                                    "urlFormat": "https://cdn.flo.com/ch/{size}.jpg"
                                },
                            },
                        ],
                    },
                }
            ]
        },
    }
    respx.get(CURATIONS_URL).mock(
        return_value=httpx.Response(200, json=curations)
    )
    respx.get(_playlist_url("111")).mock(
        return_value=httpx.Response(
            200,
            json={
                "code": "2000000",
                "data": {
                    "track": {
                        "list": [
                            _flo_track(
                                "flo_pl_t1", "PL Song", ["FLO Test A1"], "PL Album", "3:00"
                            )
                        ]
                    }
                },
            },
        )
    )
    respx.get(_channel_url("222")).mock(
        return_value=httpx.Response(
            200,
            json={
                "code": "2000000",
                "data": {
                    "trackList": [
                        _flo_track(
                            "flo_ch_t1", "CH Song", ["FLO Test A2"], "CH Album", "4:30"
                        )
                    ]
                },
            },
        )
    )

    with _preserve_flo_special_sections(db_conn):
        importer = FloEMPImporter()
        summary = await importer.import_all(db_conn)

        assert summary["errors"] == []
        assert summary["playlists_processed"] == 2  # playlist + channel
        assert summary["tracks_new"] + summary["tracks_existing"] == 2

        with db_conn.cursor() as cur:
            cur.execute(
                'SELECT id, "displayTitle" FROM "EMPSection" '
                'WHERE platform = %s AND "sectionKey" = %s',
                ("flo", section_key),
            )
            sec = cur.fetchone()
            assert sec is not None
            assert sec[1] == "예감 좋은 행운을 드려요"

            cur.execute(
                'SELECT "itemType", "itemId", title, "coverUrl" FROM "EMPSectionItem" '
                'WHERE "sectionId" = %s ORDER BY "displayOrder"',
                (sec[0],),
            )
            sec_items = cur.fetchall()
            assert [(r[0], r[1]) for r in sec_items] == [
                ("playlist", "111"),
                ("channel", "222"),
            ]
            assert sec_items[0][3] == "https://cdn.flo.com/pl/500.jpg"
            assert sec_items[1][3] == "https://cdn.flo.com/ch/500.jpg"

            # 트랙 EMPSource — source_type/source_id 검증
            cur.execute(
                'SELECT COUNT(*) FROM "EMPSource" '
                "WHERE platform = %s AND source_type = %s AND source_id = %s",
                ("flo", "flo_curation", "playlist:111"),
            )
            assert cur.fetchone()[0] == 1
            cur.execute(
                'SELECT COUNT(*) FROM "EMPSource" '
                "WHERE platform = %s AND source_type = %s AND source_id = %s",
                ("flo", "flo_curation", "channel:222"),
            )
            assert cur.fetchone()[0] == 1


@respx.mock
async def test_import_all_special_bad_code_records_error(db_conn):
    """curations code != 2000000 → 에러 기록 + skip (예외 없음)."""
    set_setting(db_conn, SOURCES_SETTING_KEY, "special")
    respx.get(CURATIONS_URL).mock(
        return_value=httpx.Response(200, json={"code": "4000000", "data": {}})
    )
    try:
        importer = FloEMPImporter()
        summary = await importer.import_all(db_conn)
    finally:
        set_setting(db_conn, SOURCES_SETTING_KEY, None)
    assert summary["tracks_new"] == 0
    assert summary["playlists_processed"] == 0
    assert any("4000000" in e for e in summary["errors"])


# ----- sectionKey 정규화 (title 기반 dedup) -----


def test_section_key_uses_normalized_title():
    """title 있으면 'special:{title}' — 공백 축약 정규화."""
    assert _section_key("음악과 즐기는 2026 북중미 월드컵", 11811) == (
        "special:음악과 즐기는 2026 북중미 월드컵"
    )
    # 다른 sec_id라도 같은 title이면 같은 key → upsert UNIQUE로 dedup
    assert _section_key("음악과 즐기는 2026 북중미 월드컵", 11820) == (
        "special:음악과 즐기는 2026 북중미 월드컵"
    )


def test_section_key_collapses_whitespace():
    """title 내부 연속 공백/앞뒤 공백 축약 — FLO가 약간 다르게 줘도 합친다."""
    assert _section_key("  띄어쓰기   많은  제목 ", 1) == "special:띄어쓰기 많은 제목"


def test_section_key_falls_back_to_id_when_no_title():
    """title이 None/빈 문자열이면 sec_id fallback — 다른 섹션과 충돌 방지."""
    assert _section_key(None, 9001) == "special:id-9001"
    assert _section_key("", 9001) == "special:id-9001"
    assert _section_key("   ", 9001) == "special:id-9001"


# ----- import_all 통합: title 중복 dedup -----


@respx.mock
async def test_import_all_dedupes_same_title_different_sec_ids(db_conn, cleanup):
    """FLO가 같은 title + 같은 items를 다른 content.id로 2개 주면
    sectionKey가 title 기반이라 1개 섹션으로 dedup된다 (과거 월드컵 3중복 재현)."""
    title = "FLO DEDUP TEST UNIQUE 9q8w7e6r"
    section_key = _section_key(title, 99001)  # == f"special:{title}"
    set_setting(db_conn, SOURCES_SETTING_KEY, "special")

    cleanup(
        'DELETE FROM "EMPSection" WHERE platform = %s AND "displayTitle" = %s',
        ("flo", title),
    )
    cleanup(
        'DELETE FROM "EMPSource" WHERE platform = %s AND source_id = %s',
        ("flo", "playlist:888"),
    )
    cleanup('DELETE FROM "Setting" WHERE key = %s', (SOURCES_SETTING_KEY,))

    # 2개 섹션 — id만 다르고 title + items 동일 (실제 월드컵 중복 패턴)
    curations = {
        "code": "2000000",
        "data": {"list": [
            {
                "type": "CURATION2",
                "content": {
                    "id": 99001,
                    "title": title,
                    "list": [{
                        "type": "PLAYLIST", "id": 888, "name": "DUP PL",
                        "img": {"urlFormat": "https://cdn.flo.com/dup/{size}.jpg"},
                    }],
                },
            },
            {
                "type": "CURATION2",
                "content": {
                    "id": 99002,  # 다른 id, 같은 title + 같은 item
                    "title": title,
                    "list": [{
                        "type": "PLAYLIST", "id": 888, "name": "DUP PL",
                        "img": {"urlFormat": "https://cdn.flo.com/dup/{size}.jpg"},
                    }],
                },
            },
        ]},
    }
    respx.get(CURATIONS_URL).mock(return_value=httpx.Response(200, json=curations))
    respx.get(_playlist_url("888")).mock(
        return_value=httpx.Response(200, json={"code": "2000000", "data": {"track": {"list": []}}})
    )

    with _preserve_flo_special_sections(db_conn):
        importer = FloEMPImporter()
        await importer.import_all(db_conn)

        with db_conn.cursor() as cur:
            # 같은 title은 1개만 존재 (dedup)
            cur.execute(
                'SELECT COUNT(*) FROM "EMPSection" WHERE platform = %s AND "displayTitle" = %s',
                ("flo", title),
            )
            assert cur.fetchone()[0] == 1

            # sectionKey는 title 기반 (sec_id 아님)
            cur.execute(
                'SELECT "sectionKey" FROM "EMPSection" WHERE platform = %s AND "displayTitle" = %s',
                ("flo", title),
            )
            assert cur.fetchone()[0] == section_key

            # item도 중복 없이 1개
            cur.execute(
                '''SELECT COUNT(*) FROM "EMPSectionItem" si
                   JOIN "EMPSection" s ON s.id = si."sectionId"
                   WHERE s.platform = %s AND s."displayTitle" = %s''',
                ("flo", title),
            )
            assert cur.fetchone()[0] == 1


# ----- _detail_cover: playlist 상세의 gridImg → cover URL -----


def test_detail_cover_picks_closest_to_500():
    """availableSizeList와 길이가 맞으면 500에 가장 가까운 size index 선택."""
    grid = {
        "availableSizeList": [75, 140, 200, 350, 500, 1000],
        "urlFormatList": [f"https://cdn.flo.com/s{i}.jpg" for i in [75, 140, 200, 350, 500, 1000]],
    }
    assert _detail_cover(grid) == "https://cdn.flo.com/s500.jpg"


def test_detail_cover_size_mismatch_takes_last():
    """availableSizeList와 길이 안 맞거나 없으면 마지막(가장 큰) URL."""
    assert _detail_cover({"urlFormatList": ["a", "b", "c"]}) == "c"
    assert _detail_cover({"urlFormatList": []}) is None
    assert _detail_cover(None) is None
    assert _detail_cover({}) is None


# ----- import_all: playlist 상세에서 커버 역채우기(backfill) -----


@respx.mock
async def test_import_all_backfills_playlist_cover_from_detail(db_conn, cleanup):
    """큐레이션 목록엔 없고 playlist 상세 API에만 있는 커버를 Phase 2에서 채운다.

    재현: FLO 큐레이션 PLAYLIST 아이템은 gridImg/img 없이 옴 → Phase 1 cover=None.
    Phase 2에서 /playlist/{id} 호출 시 data.gridImg.urlFormatList → cover 추출해
    EMPSectionItem.coverUrl 업데이트."""
    title = "FLO BACKFILL COVER TEST unique777"
    set_setting(db_conn, SOURCES_SETTING_KEY, "special")

    cleanup(
        'DELETE FROM "EMPSection" WHERE platform = %s AND "displayTitle" = %s',
        ("flo", title),
    )
    cleanup('DELETE FROM "Setting" WHERE key = %s', (SOURCES_SETTING_KEY,))

    detail_cover = "https://cdn.music-flo.com/image/v2/album/backfill_500.jpg"
    curations = {
        "code": "2000000",
        "data": {"list": [{
            "type": "CURATION2",
            "content": {
                "id": 77001,
                "title": title,
                "list": [{
                    # 큐레이션 목록의 PLAYLIST 아이템 — gridImg/img 없음
                    "type": "PLAYLIST", "id": 77888, "name": "Backfill PL",
                }],
            },
        }]},
    }
    respx.get(CURATIONS_URL).mock(return_value=httpx.Response(200, json=curations))
    respx.get(_playlist_url("77888")).mock(
        return_value=httpx.Response(200, json={
            "code": "2000000",
            "data": {
                "track": {"list": []},
                "gridImg": {
                    "availableSizeList": [140, 350, 500],
                    "urlFormatList": [
                        "https://cdn.music-flo.com/image/v2/album/backfill_140.jpg",
                        "https://cdn.music-flo.com/image/v2/album/backfill_350.jpg",
                        detail_cover,
                    ],
                },
            },
        })
    )

    with _preserve_flo_special_sections(db_conn):
        importer = FloEMPImporter()
        await importer.import_all(db_conn)

        with db_conn.cursor() as cur:
            cur.execute(
                '''SELECT si."coverUrl" FROM "EMPSectionItem" si
                   JOIN "EMPSection" s ON s.id = si."sectionId"
                   WHERE s.platform = %s AND si."itemType" = %s AND si."itemId" = %s''',
                ("flo", "playlist", "77888"),
            )
            row = cur.fetchone()
            assert row is not None
            # Phase 1은 None, Phase 2가 detail 커버로 backfill → 500에 가장 가까운 것
            assert row[0] == detail_cover


# ----- _album_cover / _pick_img_url: v1 + v2 앨범 커버 대응 -----


def test_album_cover_v1_img_urlFormat():
    """v1: album.img = {urlFormat: '.../{size}.jpg'} → {size} 치환."""
    album = {"img": {"urlFormat": "https://cdn.flo.com/x/{size}.jpg"}}
    assert _album_cover(album) == "https://cdn.flo.com/x/500.jpg"


def test_album_cover_v2_imgUrlFormat():
    """v2: album.imgUrlFormat = '.../{size}/quality/90' (inline at album level)."""
    album = {"imgUrlFormat": "https://cdn.flo.com/image/album/123/{size}/quality/90"}
    assert _album_cover(album) == "https://cdn.flo.com/image/album/123/500/quality/90"


def test_album_cover_v2_imgList():
    """v2: album.imgList = [{size, url}, ...] → COVER_SIZE(500)에 가장 가까운 것."""
    album = {"imgList": [
        {"size": 75, "url": "https://cdn.flo.com/s75.jpg"},
        {"size": 500, "url": "https://cdn.flo.com/s500.jpg"},
        {"size": 1000, "url": "https://cdn.flo.com/s1000.jpg"},
    ]}
    assert _album_cover(album) == "https://cdn.flo.com/s500.jpg"


def test_album_cover_none():
    assert _album_cover(None) is None
    assert _album_cover({}) is None


def test_pick_img_url_closest():
    """target 500에서 size 200(diff 300)이 1000(diff 500)보다 가깝다."""
    assert _pick_img_url([{"size": 200, "url": "a"}, {"size": 1000, "url": "b"}], 500) == "a"
    assert _pick_img_url([{"size": 350, "url": "c"}, {"size": 1000, "url": "d"}], 500) == "c"
    assert _pick_img_url(None, 500) is None
    assert _pick_img_url([], 500) is None


# ----- _fetch_home_panels: v2 POPULAR_CHANNEL 필터 -----


@respx.mock
async def test_fetch_home_panels_filters_popular_channel():
    """POPULAR_CHANNEL(CHNL)만 반환, PLAY_NOW 등 다른 타입은 skip."""
    panels_resp = {
        "code": "2000000",
        "data": {"list": [
            {
                "type": "POPULAR_CHANNEL", "title": "채널 A",
                "content": {"id": "111", "type": "CHNL", "trackList": []},
            },
            {
                "type": "PLAY_NOW", "title": "자동선곡",
                "content": {"id": "null", "type": "RC_PLNW_TR"},
            },
            {
                "type": "POPULAR_CHANNEL", "title": "채널 B",
                "content": {"id": "222", "type": "CHNL", "trackList": []},
            },
        ]},
    }
    respx.get(PANELS_URL).mock(return_value=httpx.Response(200, json=panels_resp))
    import httpx as _httpx
    async with _httpx.AsyncClient() as http:
        panels, err = await FloEMPImporter()._fetch_home_panels(http)
    assert err is None
    assert len(panels) == 2  # PLAY_NOW 1개 제외
    assert panels[0]["title"] == "채널 A"
    assert panels[1]["title"] == "채널 B"


# ----- import_all panels: 인라인 트랙 + 첫 트랙 커버 -----


@respx.mock
async def test_import_all_panels_saves_section_item_inline_tracks(db_conn, cleanup):
    """panels 소스 → 섹션 1개 + item 1개(channel) + 인라인 트랙 직접 upsert.
    커버는 첫 트랙 앨범 커버. Phase 2 fetch skip."""
    title = "FLO PANEL TEST unique55"
    set_setting(db_conn, SOURCES_SETTING_KEY, "panels")

    cleanup('DELETE FROM "EMPSection" WHERE platform = %s AND "displayTitle" = %s', ("flo", title))
    cleanup(
        'DELETE FROM "EMPSource" WHERE platform = %s AND source_id = %s',
        ("flo", "channel:51909"),
    )
    cleanup('DELETE FROM "Setting" WHERE key = %s', (SOURCES_SETTING_KEY,))

    cover500 = "https://cdn.music-flo.com/image/v2/album/830/350/08/s500.jpg"
    panels_resp = {
        "code": "2000000",
        "data": {"list": [{
            "type": "POPULAR_CHANNEL",
            "title": title,
            "imgList": [{"size": 500, "url": "https://generic-not-used.jpg"}],
            "content": {
                "id": "51909", "type": "CHNL", "trackCount": 1,
                "trackList": [{
                    "id": 454522696, "name": "팡파레", "playTime": "03:29",
                    "artistList": [{"id": 80041466, "name": "다비치"}],
                    "representationArtist": {"id": 80041466, "name": "다비치"},
                    "album": {
                        "id": 408350830, "title": "Season Note",
                        "imgUrlFormat": "https://cdn.music-flo.com/image/v2/album/830/350/08/{size}.jpg",
                        "imgList": [
                            {"size": 75, "url": "https://cdn.music-flo.com/image/v2/album/830/350/08/s75.jpg"},
                            {"size": 500, "url": cover500},
                        ],
                    },
                }],
            },
        }]},
    }
    respx.get(PANELS_URL).mock(return_value=httpx.Response(200, json=panels_resp))

    with _preserve_flo_special_sections(db_conn):
        importer = FloEMPImporter()
        summary = await importer.import_all(db_conn)

        assert summary["errors"] == []
        assert summary["tracks_new"] + summary["tracks_existing"] == 1

        with db_conn.cursor() as cur:
            # 섹션 1개 (panel: prefix)
            cur.execute(
                'SELECT "sectionKey" FROM "EMPSection" WHERE platform = %s AND "displayTitle" = %s',
                ("flo", title),
            )
            sec_row = cur.fetchone()
            assert sec_row is not None
            assert sec_row[0] == f"panel:{title}"

            # item cover = 첫 트랙 앨범 커버 (imgUrlFormat → 500)
            cur.execute(
                '''SELECT si."coverUrl" FROM "EMPSectionItem" si
                   JOIN "EMPSection" s ON s.id = si."sectionId"
                   WHERE s.platform = %s AND s."displayTitle" = %s''',
                ("flo", title),
            )
            item_row = cur.fetchone()
            assert item_row is not None
            assert item_row[0] == "https://cdn.music-flo.com/image/v2/album/830/350/08/500.jpg"
