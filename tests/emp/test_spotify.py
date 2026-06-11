"""SpotifyEMPImporter — open.spotify.com/embed 위젯 스크래핑 (토큰 0)."""
import json

import httpx
import respx

from mrms.db.settings import set_setting
from mrms.emp.spotify import (
    DEFAULT_SOURCES,
    EMBED_BASE,
    SOURCES_SETTING_KEY,
    SpotifyEMPImporter,
    normalize_artist,
    parse_next_data,
)


def _embed_html(name: str, tracks: list[dict]) -> str:
    """embed 위젯 HTML — __NEXT_DATA__ 안에 entity {name, trackList} 를 담는다."""
    next_data = {
        "props": {
            "pageProps": {
                "state": {
                    "data": {
                        "entity": {
                            "name": name,
                            "trackList": tracks,
                        }
                    }
                }
            }
        }
    }
    payload = json.dumps(next_data)
    return (
        "<!DOCTYPE html><html><head></head><body>"
        f'<script id="__NEXT_DATA__" type="application/json">{payload}</script>'
        "</body></html>"
    )


def _embed_track(tid, title, subtitle, duration=180000):
    """embed trackList[] 항목 모양."""
    return {
        "uri": f"spotify:track:{tid}",
        "title": title,
        "subtitle": subtitle,
        "duration": duration,
    }


# ----- 소스 파싱 -----


def test_load_sources_parses(db_conn):
    """playlist/album/artist 파싱, 주석/빈 줄/모르는 kind·인라인 주석 처리."""
    set_setting(
        db_conn,
        SOURCES_SETTING_KEY,
        "# comment\n"
        "playlist/37i9dQZEVXbMDoHDwVN2tF   # Top 50 Global\n"
        "album/al123\n"
        "artist/ar456\n"
        "bogus/xyz\n"
        "noslash\n"
        "\n",
    )
    try:
        importer = SpotifyEMPImporter()
        sources = importer._load_sources(db_conn)
        assert sources == [
            ("playlist", "37i9dQZEVXbMDoHDwVN2tF"),
            ("album", "al123"),
            ("artist", "ar456"),
        ]
    finally:
        set_setting(db_conn, SOURCES_SETTING_KEY, None)


def test_load_sources_default(db_conn):
    """Setting 비었으면 DEFAULT_SOURCES — 검증된 차트 playlist ID."""
    set_setting(db_conn, SOURCES_SETTING_KEY, None)
    importer = SpotifyEMPImporter()
    sources = importer._load_sources(db_conn)
    assert len(sources) == len(DEFAULT_SOURCES)
    assert all(kind == "playlist" for kind, _ in sources)
    # 인라인 주석이 ID에 새지 않는지
    assert ("playlist", "37i9dQZEVXbMDoHDwVN2tF") in sources
    assert all("#" not in ident and " " not in ident for _, ident in sources)


# ----- __NEXT_DATA__ 파싱 -----


def test_parse_next_data_extracts_entity():
    html = _embed_html("Top 50 Global", [_embed_track("t1", "Song 1", "Artist 1")])
    entity = parse_next_data(html)
    assert entity is not None
    assert entity["name"] == "Top 50 Global"
    assert entity["trackList"][0]["uri"] == "spotify:track:t1"


def test_parse_next_data_no_script_returns_none():
    assert parse_next_data("<html><body>no next data</body></html>") is None


def test_parse_next_data_bad_json_returns_none():
    html = '<script id="__NEXT_DATA__" type="application/json">{not json</script>'
    assert parse_next_data(html) is None


# ----- subtitle 다중 아티스트 정규화 -----


def test_normalize_artist():
    assert normalize_artist("Artist A, Artist B") == "Artist A"
    assert normalize_artist("Solo Artist") == "Solo Artist"
    assert normalize_artist("  Lead , Feat  ") == "Lead"
    assert normalize_artist("") == "Unknown"
    assert normalize_artist(None) == "Unknown"


# ----- fetch + 파싱 통합 -----


@respx.mock
async def test_fetch_embed_parses_entity():
    """embed HTTP 200 → entity dict."""
    html = _embed_html("Today's Top Hits", [_embed_track("x1", "Hit", "Big Star")])
    respx.get(f"{EMBED_BASE}/playlist/pl1").mock(
        return_value=httpx.Response(200, text=html)
    )
    importer = SpotifyEMPImporter()
    async with httpx.AsyncClient() as http:
        entity = await importer._fetch_embed(http, "playlist", "pl1")
    assert entity["name"] == "Today's Top Hits"


@respx.mock
async def test_fetch_embed_non_200_returns_none():
    respx.get(f"{EMBED_BASE}/playlist/pl404").mock(return_value=httpx.Response(404))
    importer = SpotifyEMPImporter()
    async with httpx.AsyncClient() as http:
        assert await importer._fetch_embed(http, "playlist", "pl404") is None


# ----- import_all 통합 (embed → 섹션 + 아이템 + 트랙 upsert) -----


@respx.mock
async def test_import_all_saves_section_item_and_tracks(db_conn, cleanup):
    """playlist 소스 1개 → EMPSection 1개 + 컨테이너 아이템 1개 + trackList 트랙 upsert."""
    kind, pid = "playlist", "pl_emp_test"
    section_key = f"{kind}:{pid}"
    set_setting(db_conn, SOURCES_SETTING_KEY, f"{kind}/{pid}")

    # cleanup 역순 실행 — 부모(Artist/Track)를 먼저 등록.
    cleanup(
        'DELETE FROM "Artist" WHERE name IN (%s, %s)',
        ("SP Embed A1", "SP Embed A2"),
    )
    cleanup(
        'DELETE FROM "Track" WHERE isrc IN (%s, %s)',
        ("emp_spotify_sp_e1", "emp_spotify_sp_e2"),
    )
    cleanup(
        'DELETE FROM "TrackPlatform" WHERE "platformTrackId" IN (%s, %s)',
        ("sp_e1", "sp_e2"),
    )
    cleanup('DELETE FROM "EMPSource" WHERE source_id = %s', (section_key,))
    cleanup(
        'DELETE FROM "EMPSection" WHERE platform = %s AND "sectionKey" = %s',
        ("spotify", section_key),
    )  # EMPSectionItem은 ON DELETE CASCADE
    cleanup('DELETE FROM "Setting" WHERE key = %s', (SOURCES_SETTING_KEY,))

    html = _embed_html(
        "EMP Test Chart",
        [
            _embed_track("sp_e1", "Embed Song 1", "SP Embed A1, Feature X", 200000),
            _embed_track("sp_e2", "Embed Song 2", "SP Embed A2"),
        ],
    )
    respx.get(f"{EMBED_BASE}/{kind}/{pid}").mock(
        return_value=httpx.Response(200, text=html)
    )

    importer = SpotifyEMPImporter()
    summary = await importer.import_all(db_conn)

    assert summary["errors"] == []
    assert summary["playlists_processed"] == 1
    assert summary["tracks_new"] + summary["tracks_existing"] == 2

    with db_conn.cursor() as cur:
        cur.execute(
            'SELECT id, "displayTitle" FROM "EMPSection" '
            'WHERE platform = %s AND "sectionKey" = %s',
            ("spotify", section_key),
        )
        sec = cur.fetchone()
        assert sec is not None
        assert sec[1] == "EMP Test Chart"
        # 컨테이너 자체가 하나의 아이템 (item_type=playlist, item_id=pid)
        cur.execute(
            'SELECT "itemType", "itemId", title FROM "EMPSectionItem" '
            'WHERE "sectionId" = %s',
            (sec[0],),
        )
        items = cur.fetchall()
        assert items == [("playlist", pid, "EMP Test Chart")]
        # 트랙 EMPSource — source_id가 '{kind}:{id}', source_type editorial_embed
        cur.execute(
            'SELECT COUNT(*) FROM "EMPSource" '
            "WHERE platform = %s AND source_type = %s AND source_id = %s",
            ("spotify", "editorial_embed", section_key),
        )
        assert cur.fetchone()[0] == 2
        # 다중 아티스트 subtitle은 첫 아티스트로 정규화
        cur.execute(
            'SELECT a.name FROM "Track" t JOIN "Artist" a ON a.id = t."artistId" '
            'WHERE t.isrc = %s',
            ("emp_spotify_sp_e1",),
        )
        assert cur.fetchone()[0] == "SP Embed A1"


@respx.mock
async def test_import_all_fetch_failure_recorded(db_conn):
    """embed fetch 실패(404) → 해당 소스만 에러, 전체 중단 없음."""
    set_setting(db_conn, SOURCES_SETTING_KEY, "playlist/pl_missing")
    respx.get(f"{EMBED_BASE}/playlist/pl_missing").mock(
        return_value=httpx.Response(404)
    )
    try:
        importer = SpotifyEMPImporter()
        summary = await importer.import_all(db_conn)
    finally:
        set_setting(db_conn, SOURCES_SETTING_KEY, None)
    assert summary["tracks_new"] == 0
    assert summary["playlists_processed"] == 0
    assert any("pl_missing" in e for e in summary["errors"])
