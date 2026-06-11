"""AppleEMPImporter — RSS 차트(songs) + music.apple.com 페이지 스크래핑(albums/playlists)."""
import json

import httpx
import respx

from mrms.db.settings import set_setting
from mrms.emp.apple import (
    DEFAULT_SOURCES,
    PAGE_BASE,
    RSS_BASE,
    SOURCES_SETTING_KEY,
    AppleEMPImporter,
    _iso8601_to_ms,
    _resolve_artwork_template,
    _upsize_artwork,
    parse_container_feed,
    parse_container_page,
    parse_feed,
)


def _feed(title: str, songs: list[dict]) -> dict:
    return {"feed": {"title": title, "results": songs}}


def _song(sid, name, artist, album=None, art="https://x/100x100bb.jpg"):
    return {
        "id": sid, "name": name, "artistName": artist,
        "collectionName": album, "artworkUrl100": art,
    }


def _container(cid, name, artist=None, art="https://x/100x100bb.jpg", url=None):
    return {
        "id": cid, "name": name, "artistName": artist,
        "artworkUrl100": art, "url": url,
    }


# ----- HTML fixtures (작은, 실측 구조 반영) -----


def _serialized_html(tracks: list[dict], extra_sections: list[dict] | None = None) -> str:
    """serialized-server-data script가 담긴 컨테이너 페이지 HTML.

    각 track dict는 {id, title, artistName, duration(ms), art(템플릿|None)}."""
    items = []
    for t in tracks:
        artwork = None
        if t.get("art"):
            artwork = {"dictionary": {"url": t["art"]}}
        items.append({
            "title": t["title"],
            "artistName": t.get("artistName"),
            "duration": t.get("duration"),
            "artwork": artwork,
            "contentDescriptor": {"identifiers": {"storeAdamID": t["id"]}},
        })
    sections = [{"itemKind": "trackLockup", "items": items}]
    if extra_sections:
        sections.extend(extra_sections)
    payload = {"data": [{"data": {"sections": sections}}], "userTokenHash": "x"}
    # 실측 HTML: type="application/json" id="serialized-server-data" (따옴표 있음).
    return (
        "<html><head>"
        '<script type="application/json" id="serialized-server-data">'
        + json.dumps(payload, ensure_ascii=False)
        + "</script></head><body></body></html>"
    )


def _ldjson_html(at_type: str, key: str, tracks: list[dict]) -> str:
    """ld+json script만 담긴 HTML (serialized 없음 → fallback 경로 테스트).

    각 track dict는 {id, name, duration(ISO8601), thumb}."""
    track_objs = []
    for t in tracks:
        obj = {
            "@type": "MusicRecording",
            "name": t["name"],
            "duration": t.get("duration"),
            "url": f"https://music.apple.com/us/song/x/{t['id']}",
        }
        if t.get("thumb"):
            obj["audio"] = {"thumbnailUrl": t["thumb"]}
        track_objs.append(obj)
    ld = {"@context": "http://schema.org", "@type": at_type, key: track_objs}
    return (
        "<html><head>"
        '<script id=schema:music-album type="application/ld+json">'
        + json.dumps(ld, ensure_ascii=False)
        + "</script></head><body></body></html>"
    )


# ----- 순수 함수: artwork / duration -----


def test_upsize_artwork():
    assert _upsize_artwork("https://x/100x100bb.jpg") == "https://x/600x600bb.jpg"
    assert _upsize_artwork(None) is None


def test_resolve_artwork_template():
    assert (
        _resolve_artwork_template("https://x/{w}x{h}bb.{f}")
        == "https://x/600x600bb.jpg"
    )
    assert _resolve_artwork_template("https://x/{w}x{h}cc.{f}", size=300) == (
        "https://x/300x300cc.jpg"
    )
    assert _resolve_artwork_template(None) is None
    # 비템플릿은 그대로
    assert _resolve_artwork_template("https://x/static.jpg") == "https://x/static.jpg"


def test_iso8601_to_ms():
    assert _iso8601_to_ms("PT5M7S") == 307000
    assert _iso8601_to_ms("PT3M") == 180000
    assert _iso8601_to_ms("PT45S") == 45000
    assert _iso8601_to_ms("PT1H2M3S") == 3723000
    assert _iso8601_to_ms("garbage") is None
    assert _iso8601_to_ms(None) is None
    assert _iso8601_to_ms("PT") is None


# ----- 순수 함수: songs 피드 -----


def test_parse_feed_extracts_tracks():
    title, tracks = parse_feed(_feed("인기곡", [
        _song("1", "REDRED", "코르티스", "GREENGREEN"),
        _song("2", "Solo", "Artist"),
    ]))
    assert title == "인기곡"
    assert len(tracks) == 2
    assert tracks[0]["track_id"] == "1"
    assert tracks[0]["title"] == "REDRED"
    assert tracks[0]["artist"] == "코르티스"
    assert tracks[0]["album"] == "GREENGREEN"
    assert tracks[0]["cover_url"] == "https://x/600x600bb.jpg"
    assert tracks[1]["album"] is None


def test_parse_feed_skips_incomplete():
    _, tracks = parse_feed(_feed("x", [
        {"id": "1", "name": "ok", "artistName": "a"},
        {"id": "2", "name": "no artist"},        # skip
        {"name": "no id", "artistName": "a"},    # skip
    ]))
    assert len(tracks) == 1


def test_parse_feed_empty():
    _, tracks = parse_feed({"feed": {"results": []}})
    assert tracks == []
    _, tracks2 = parse_feed({})
    assert tracks2 == []


# ----- 순수 함수: 컨테이너 피드 (albums/playlists RSS) -----


def test_parse_container_feed():
    title, containers = parse_container_feed(_feed("Top Albums", [
        _container("6769568449", "ICEMAN", "Drake",
                   url="https://music.apple.com/us/album/iceman/6769568449"),
        _container("pl.abc", "Today's Country"),
    ]))
    assert title == "Top Albums"
    assert len(containers) == 2
    assert containers[0]["container_id"] == "6769568449"
    assert containers[0]["name"] == "ICEMAN"
    assert containers[0]["artist"] == "Drake"
    assert containers[0]["cover_url"] == "https://x/600x600bb.jpg"
    assert containers[0]["url"].endswith("/6769568449")
    assert containers[1]["url"] is None


def test_parse_container_feed_skips_incomplete():
    _, containers = parse_container_feed(_feed("x", [
        {"id": "1", "name": "ok"},
        {"id": "2"},            # no name → skip
        {"name": "no id"},      # no id → skip
    ]))
    assert len(containers) == 1


# ----- 순수 함수: 컨테이너 페이지 (serialized 우선) -----


def test_parse_container_page_serialized():
    """serialized-server-data: artistName + ms duration + 템플릿 커버."""
    html = _serialized_html([
        {"id": "t1", "title": "Make Them Cry", "artistName": "Drake",
         "duration": 307682, "art": None},  # album 트랙 — 커버 없음
        {"id": "t2", "title": "I Knew It", "artistName": "Taylor Swift",
         "duration": 178186, "art": "https://x/{w}x{h}bb.{f}"},
    ])
    tracks = parse_container_page(html)
    assert len(tracks) == 2
    assert tracks[0]["track_id"] == "t1"
    assert tracks[0]["title"] == "Make Them Cry"
    assert tracks[0]["artist"] == "Drake"
    assert tracks[0]["duration_ms"] == 307682
    assert tracks[0]["cover_url"] is None
    assert tracks[1]["artist"] == "Taylor Swift"
    assert tracks[1]["cover_url"] == "https://x/600x600bb.jpg"


def test_parse_container_page_serialized_skips_no_id():
    html = _serialized_html([
        {"id": "t1", "title": "ok", "artistName": "a", "duration": 1000},
    ])
    # title 없는 항목을 직접 끼워넣어 skip 검증 (헬퍼는 id/title 항상 채움)
    payload = json.loads(html.split('serialized-server-data">', 1)[1].split("</script>")[0])
    payload["data"][0]["data"]["sections"][0]["items"].append(
        {"title": "no id", "artistName": "b", "contentDescriptor": {}}
    )
    payload["data"][0]["data"]["sections"][0]["items"].append(
        {"artistName": "c", "contentDescriptor": {"identifiers": {"storeAdamID": "t9"}}}
    )
    html2 = (
        '<script type="application/json" id="serialized-server-data">'
        + json.dumps(payload) + "</script>"
    )
    tracks = parse_container_page(html2)
    assert [t["track_id"] for t in tracks] == ["t1"]


def test_parse_container_page_ldjson_fallback():
    """serialized 없으면 ld+json fallback — artist None, ISO duration → ms."""
    html = _ldjson_html("MusicAlbum", "tracks", [
        {"id": "9001", "name": "Make Them Cry", "duration": "PT5M7S",
         "thumb": "https://x/thumb.jpg"},
        {"id": "9002", "name": "Dust", "duration": "PT3M9S"},
    ])
    tracks = parse_container_page(html)
    assert len(tracks) == 2
    assert tracks[0]["track_id"] == "9001"
    assert tracks[0]["title"] == "Make Them Cry"
    assert tracks[0]["artist"] is None
    assert tracks[0]["duration_ms"] == 307000
    assert tracks[0]["cover_url"] == "https://x/thumb.jpg"


def test_parse_container_page_ldjson_playlist_track_key():
    """MusicPlaylist는 'track' 키 사용 — 둘 다 지원."""
    html = _ldjson_html("MusicPlaylist", "track", [
        {"id": "5", "name": "Song", "duration": "PT2M"},
    ])
    tracks = parse_container_page(html)
    assert len(tracks) == 1
    assert tracks[0]["track_id"] == "5"


def test_parse_container_page_serialized_wins_over_ldjson():
    """serialized + ld+json 둘 다 있으면 serialized (artistName) 선택."""
    ser = _serialized_html([
        {"id": "s1", "title": "From Serialized", "artistName": "Drake",
         "duration": 100000},
    ])
    ld = _ldjson_html("MusicAlbum", "tracks", [
        {"id": "9999", "name": "From LDJSON", "duration": "PT1M"},
    ])
    combined = ser + ld
    tracks = parse_container_page(combined)
    assert len(tracks) == 1
    assert tracks[0]["track_id"] == "s1"
    assert tracks[0]["artist"] == "Drake"


def test_parse_container_page_empty():
    assert parse_container_page("<html></html>") == []
    # 깨진 JSON도 빈 리스트
    bad = '<script type="application/json" id="serialized-server-data">{bad</script>'
    assert parse_container_page(bad) == []


# ----- 소스 파싱 -----


def test_load_sources_parses(db_conn):
    set_setting(
        db_conn, SOURCES_SETTING_KEY,
        "# comment\nsongs/kr   # Korea\nsongs/jp\nalbums/us\nplaylists/us\n"
        "album/123\nplaylist/pl.abc\nbogus\n",
    )
    try:
        importer = AppleEMPImporter()
        sources = importer._load_sources(db_conn)
        assert sources == [
            ("songs", "kr"),
            ("songs", "jp"),
            ("albums", "us"),
            ("playlists", "us"),
            ("album", "123"),
            ("playlist", "pl.abc"),
        ]
    finally:
        set_setting(db_conn, SOURCES_SETTING_KEY, None)


def test_load_sources_default(db_conn):
    set_setting(db_conn, SOURCES_SETTING_KEY, None)
    importer = AppleEMPImporter()
    sources = importer._load_sources(db_conn)
    assert len(sources) == len(DEFAULT_SOURCES)
    assert all(kind == "songs" for kind, _ in sources)


# ----- import_all 통합: songs -----


@respx.mock
async def test_import_all_saves_section_and_tracks(db_conn, cleanup):
    """songs/kr 소스 1개 → 섹션 1 + chart 아이템 1 + 트랙 upsert."""
    set_setting(db_conn, SOURCES_SETTING_KEY, "songs/kr")
    section_key = "songs:kr"
    source_id = "chart:kr-songs"

    cleanup('DELETE FROM "Artist" WHERE name IN (%s, %s)', ("AP A1", "AP A2"))
    cleanup('DELETE FROM "Album" WHERE title = %s', ("AP Album",))
    cleanup('DELETE FROM "Track" WHERE isrc IN (%s, %s)',
            ("emp_apple_ap1", "emp_apple_ap2"))
    cleanup('DELETE FROM "TrackPlatform" WHERE "platformTrackId" IN (%s, %s)',
            ("ap1", "ap2"))
    cleanup('DELETE FROM "EMPSource" WHERE source_id = %s', (source_id,))
    cleanup('DELETE FROM "EMPSection" WHERE platform = %s AND "sectionKey" = %s',
            ("apple", section_key))
    cleanup('DELETE FROM "Setting" WHERE key = %s', (SOURCES_SETTING_KEY,))

    feed = _feed("인기곡", [
        _song("ap1", "AP Song 1", "AP A1", "AP Album"),
        _song("ap2", "AP Song 2", "AP A2"),
    ])
    respx.get(f"{RSS_BASE}/kr/music/most-played/50/songs.json").mock(
        return_value=httpx.Response(200, json=feed)
    )

    importer = AppleEMPImporter()
    summary = await importer.import_all(db_conn)

    assert summary["errors"] == []
    assert summary["playlists_processed"] == 1
    assert summary["tracks_new"] + summary["tracks_existing"] == 2

    with db_conn.cursor() as cur:
        cur.execute(
            'SELECT id, "displayTitle" FROM "EMPSection" '
            'WHERE platform = %s AND "sectionKey" = %s',
            ("apple", section_key),
        )
        sec = cur.fetchone()
        assert sec is not None
        assert sec[1] == "인기곡"
        cur.execute(
            'SELECT "itemType", "itemId" FROM "EMPSectionItem" WHERE "sectionId" = %s',
            (sec[0],),
        )
        assert cur.fetchall() == [("chart", "kr-songs")]
        cur.execute(
            'SELECT COUNT(*) FROM "EMPSource" WHERE platform = %s AND source_id = %s',
            ("apple", source_id),
        )
        assert cur.fetchone()[0] == 2

        cur.execute(
            'SELECT cover_url FROM "EMPSource" '
            "WHERE platform = %s AND source_id = %s",
            ("apple", source_id),
        )
        covers = [r[0] for r in cur.fetchall()]
        assert all(c == "https://x/600x600bb.jpg" for c in covers)


@respx.mock
async def test_import_all_fetch_failure_recorded(db_conn):
    set_setting(db_conn, SOURCES_SETTING_KEY, "songs/zz")
    respx.get(f"{RSS_BASE}/zz/music/most-played/50/songs.json").mock(
        return_value=httpx.Response(404)
    )
    try:
        importer = AppleEMPImporter()
        summary = await importer.import_all(db_conn)
        assert summary["tracks_new"] == 0
        assert any("zz" in e for e in summary["errors"])
    finally:
        set_setting(db_conn, SOURCES_SETTING_KEY, None)


# ----- import_all 통합: albums (RSS 목록 + 페이지 스크래핑) -----


@respx.mock
async def test_import_all_albums_scrapes_pages(db_conn, cleanup):
    """albums/us → 섹션 1 + album 아이템 1개 + 페이지 스크래핑 트랙 upsert.

    album 트랙은 자체 커버 없음 → 컨테이너 커버로 fallback."""
    set_setting(db_conn, SOURCES_SETTING_KEY, "albums/us")
    section_key = "albums:us"
    album_id = "6769568449"
    source_id = f"album:{album_id}"
    container_cover = "https://x/600x600bb.jpg"

    cleanup('DELETE FROM "Artist" WHERE name = %s', ("Drake AP",))
    cleanup('DELETE FROM "Track" WHERE isrc IN (%s, %s)',
            ("emp_apple_alb1", "emp_apple_alb2"))
    cleanup('DELETE FROM "TrackPlatform" WHERE "platformTrackId" IN (%s, %s)',
            ("alb1", "alb2"))
    cleanup('DELETE FROM "EMPSource" WHERE source_id = %s', (source_id,))
    cleanup('DELETE FROM "EMPSection" WHERE platform = %s AND "sectionKey" = %s',
            ("apple", section_key))
    cleanup('DELETE FROM "Setting" WHERE key = %s', (SOURCES_SETTING_KEY,))

    album_url = f"{PAGE_BASE}/us/album/iceman/{album_id}"
    feed = _feed("Top Albums", [
        _container(album_id, "ICEMAN", "Drake AP", url=album_url),
    ])
    respx.get(f"{RSS_BASE}/us/music/most-played/50/albums.json").mock(
        return_value=httpx.Response(200, json=feed)
    )

    page_html = _serialized_html([
        {"id": "alb1", "title": "Make Them Cry", "artistName": "Drake AP",
         "duration": 307682, "art": None},
        {"id": "alb2", "title": "Dust", "artistName": "Drake AP",
         "duration": 189000, "art": None},
    ])
    respx.get(album_url).mock(return_value=httpx.Response(200, text=page_html))

    importer = AppleEMPImporter()
    summary = await importer.import_all(db_conn)

    assert summary["errors"] == []
    assert summary["playlists_processed"] == 1
    assert summary["tracks_new"] + summary["tracks_existing"] == 2

    with db_conn.cursor() as cur:
        cur.execute(
            'SELECT id FROM "EMPSection" WHERE platform = %s AND "sectionKey" = %s',
            ("apple", section_key),
        )
        sec = cur.fetchone()
        assert sec is not None
        cur.execute(
            'SELECT "itemType", "itemId" FROM "EMPSectionItem" WHERE "sectionId" = %s',
            (sec[0],),
        )
        assert cur.fetchall() == [("album", album_id)]
        cur.execute(
            'SELECT cover_url FROM "EMPSource" WHERE platform = %s AND source_id = %s',
            ("apple", source_id),
        )
        covers = [r[0] for r in cur.fetchall()]
        # 트랙 커버 없음 → 컨테이너 커버로 채워짐
        assert covers == [container_cover, container_cover]
        # 트랙 duration이 적재됨 (페이지 스크래핑 → ms)
        cur.execute(
            'SELECT t."durationMs" FROM "Track" t '
            'JOIN "TrackPlatform" tp ON tp."trackId" = t.id '
            'WHERE tp."platformTrackId" = %s', ("alb1",),
        )
        assert cur.fetchone()[0] == 307682


@respx.mock
async def test_import_all_single_album_direct(db_conn, cleanup):
    """album/{id} 직접 → 단일 컨테이너 섹션 + 트랙."""
    album_id = "111222"
    set_setting(db_conn, SOURCES_SETTING_KEY, f"album/{album_id}")
    section_key = f"album:{album_id}"
    source_id = section_key

    cleanup('DELETE FROM "Artist" WHERE name = %s', ("Solo AP",))
    cleanup('DELETE FROM "Track" WHERE isrc = %s', ("emp_apple_dir1",))
    cleanup('DELETE FROM "TrackPlatform" WHERE "platformTrackId" = %s', ("dir1",))
    cleanup('DELETE FROM "EMPSource" WHERE source_id = %s', (source_id,))
    cleanup('DELETE FROM "EMPSection" WHERE platform = %s AND "sectionKey" = %s',
            ("apple", section_key))
    cleanup('DELETE FROM "Setting" WHERE key = %s', (SOURCES_SETTING_KEY,))

    page_html = _serialized_html([
        {"id": "dir1", "title": "Direct Song", "artistName": "Solo AP",
         "duration": 200000, "art": "https://x/{w}x{h}bb.{f}"},
    ])
    # album/{id}는 region 기본 us, /album/x/{id} 경로로 fetch
    respx.get(f"{PAGE_BASE}/us/album/x/{album_id}").mock(
        return_value=httpx.Response(200, text=page_html)
    )

    importer = AppleEMPImporter()
    summary = await importer.import_all(db_conn)

    assert summary["errors"] == []
    assert summary["playlists_processed"] == 1
    assert summary["tracks_new"] + summary["tracks_existing"] == 1

    with db_conn.cursor() as cur:
        cur.execute(
            'SELECT cover_url FROM "EMPSource" WHERE platform = %s AND source_id = %s',
            ("apple", source_id),
        )
        assert cur.fetchone()[0] == "https://x/600x600bb.jpg"


@respx.mock
async def test_import_all_album_page_failure_graceful(db_conn, cleanup):
    """페이지 스크래핑 실패해도 섹션은 저장되고 에러만 기록 (graceful)."""
    set_setting(db_conn, SOURCES_SETTING_KEY, "albums/us")
    section_key = "albums:us"
    album_id = "deadbeef"
    cleanup('DELETE FROM "EMPSection" WHERE platform = %s AND "sectionKey" = %s',
            ("apple", section_key))
    cleanup('DELETE FROM "Setting" WHERE key = %s', (SOURCES_SETTING_KEY,))

    album_url = f"{PAGE_BASE}/us/album/x/{album_id}"
    feed = _feed("Top Albums", [_container(album_id, "Broken", "X", url=album_url)])
    respx.get(f"{RSS_BASE}/us/music/most-played/50/albums.json").mock(
        return_value=httpx.Response(200, json=feed)
    )
    respx.get(album_url).mock(return_value=httpx.Response(503))

    importer = AppleEMPImporter()
    summary = await importer.import_all(db_conn)

    # 섹션은 처리됨, 페이지 실패는 errors에
    assert summary["playlists_processed"] == 1
    assert summary["tracks_new"] == 0
    assert any(album_id in e for e in summary["errors"])

    with db_conn.cursor() as cur:
        cur.execute(
            'SELECT COUNT(*) FROM "EMPSectionItem" si '
            'JOIN "EMPSection" s ON s.id = si."sectionId" '
            'WHERE s.platform = %s AND s."sectionKey" = %s',
            ("apple", section_key),
        )
        assert cur.fetchone()[0] == 1
