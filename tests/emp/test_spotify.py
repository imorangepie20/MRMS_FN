"""SpotifyEMPImporter — Search API 기반 섹션 구성 (큐레이션 endpoint 차단 대응)."""
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import httpx
import respx

from mrms.db.settings import set_setting
from mrms.emp.spotify import (
    DEFAULT_GENRES,
    SEARCH_MAX_TRACKS,
    SEARCH_PAGE_LIMIT,
    SOURCES_SETTING_KEY,
    SpotifyEMPImporter,
    _group_albums,
    default_sources,
    display_title_for_query,
    section_key_for_query,
)

SEARCH_URL = "https://api.spotify.com/v1/search"
TOKEN_URL = "https://accounts.spotify.com/api/token"


def _track(tid, name, isrc, album_id, album_name, artist="Artist"):
    """Spotify /search 응답의 track object 모양."""
    return {
        "id": tid,
        "name": name,
        "duration_ms": 180000,
        "external_ids": {"isrc": isrc} if isrc else {},
        "artists": [{"name": artist}],
        "album": {
            "id": album_id,
            "name": album_name,
            "images": [
                {"url": f"https://i.scdn.co/{album_id}/640", "height": 640, "width": 640},
                {"url": f"https://i.scdn.co/{album_id}/300", "height": 300, "width": 300},
                {"url": f"https://i.scdn.co/{album_id}/64", "height": 64, "width": 64},
            ],
        },
    }


def _mock_client_token():
    respx.post(TOKEN_URL).mock(
        return_value=httpx.Response(200, json={"access_token": "cc_tok", "expires_in": 3600})
    )


# ----- 소스 파싱 -----


def test_load_sources_parses(db_conn):
    """search-tracks + playlist 파싱, 주석/빈 줄/모르는 kind 무시."""
    set_setting(
        db_conn,
        SOURCES_SETTING_KEY,
        "# comment\n"
        "search-tracks/year:2026 genre:k-pop\n"
        "playlist/37i9abc\n"
        "bogus/xyz\n"
        "\n",
    )
    try:
        importer = SpotifyEMPImporter(client_id="x", client_secret="y")
        sources = importer._load_sources(db_conn)
        assert sources == [
            ("search-tracks", "year:2026 genre:k-pop"),
            ("playlist", "37i9abc"),
        ]
    finally:
        set_setting(db_conn, SOURCES_SETTING_KEY, None)


def test_load_sources_default(db_conn):
    """Setting 비었으면 default_sources — 올해 year 필터 + 장르 다양성."""
    set_setting(db_conn, SOURCES_SETTING_KEY, None)
    importer = SpotifyEMPImporter(client_id="x", client_secret="y")
    sources = importer._load_sources(db_conn)
    assert len(sources) == 1 + len(DEFAULT_GENRES)
    assert all(kind == "search-tracks" for kind, _ in sources)
    year = datetime.now(timezone.utc).year
    assert sources[0] == ("search-tracks", f"year:{year}")
    assert ("search-tracks", f"year:{year} genre:jazz") in sources
    # k-pop/hip-hop은 이 앱 티어 genre: 필터에서 항상 0건이라 기본값에서 제외
    assert ("search-tracks", f"year:{year} genre:k-pop") not in sources
    assert default_sources(2026)[0] == "search-tracks/year:2026"


# ----- 제목/키 유도 -----


def test_display_title_for_query():
    assert display_title_for_query("year:2026") == "2026 · Hot New"
    assert display_title_for_query("year:2026 genre:k-pop") == "2026 · K-Pop"
    assert display_title_for_query("year:2026 genre:r&b") == "2026 · R&B"
    assert display_title_for_query("year:2026 genre:hip-hop") == "2026 · Hip-Hop"
    assert display_title_for_query("lofi beats") == "Lofi Beats"


def test_section_key_for_query():
    assert section_key_for_query("year:2026 genre:k-pop") == "search-year-2026-genre-k-pop"
    assert section_key_for_query("year:2026 genre:r&b") == "search-year-2026-genre-r-b"
    # 안정성 — 같은 쿼리는 항상 같은 키
    assert section_key_for_query("year:2026") == section_key_for_query("year:2026")


# ----- search fetch/파싱 -----


@respx.mock
async def test_search_tracks_paginates_to_max():
    """가득 찬 페이지 → 다음 offset 요청, SEARCH_MAX_TRACKS에서 중단."""
    _mock_client_token()

    def responder(request):
        start = int(request.url.params["offset"])
        items = [
            _track(f"t{i}", f"N{i}", None, f"al{i}", f"A{i}")
            for i in range(start, start + SEARCH_PAGE_LIMIT)
        ]
        return httpx.Response(200, json={"tracks": {"items": items}})

    route = respx.get(SEARCH_URL).mock(side_effect=responder)
    importer = SpotifyEMPImporter(client_id="x", client_secret="y")
    async with httpx.AsyncClient() as http:
        tracks = await importer._search_tracks(http, "year:2026")
    assert len(tracks) == SEARCH_MAX_TRACKS
    assert route.call_count == SEARCH_MAX_TRACKS // SEARCH_PAGE_LIMIT
    assert route.calls[1].request.url.params["offset"] == str(SEARCH_PAGE_LIMIT)
    assert route.calls[0].request.url.params["limit"] == str(SEARCH_PAGE_LIMIT)
    assert route.calls[0].request.url.params["market"] == "US"


@respx.mock
async def test_search_tracks_extracts_and_filters():
    """isrc/album/cover 추출 + album_id 없는 트랙·중복 id 제외."""
    _mock_client_token()
    items = [
        _track("st1", "Song A", "USRC10000001", "alA", "Album A"),
        _track("st1", "Song A dup", None, "alA", "Album A"),  # 중복 id
        {"id": "st2", "name": "No Album", "artists": [{"name": "X"}], "album": {}},
    ]
    respx.get(SEARCH_URL).mock(
        return_value=httpx.Response(200, json={"tracks": {"items": items}})
    )
    importer = SpotifyEMPImporter(client_id="x", client_secret="y")
    async with httpx.AsyncClient() as http:
        tracks = await importer._search_tracks(http, "q")
    assert len(tracks) == 1
    t = tracks[0]
    assert t["platform_track_id"] == "st1"
    assert t["isrc"] == "USRC10000001"
    assert t["album_id"] == "alA"
    assert t["album_cover"] == "https://i.scdn.co/alA/300"  # 중간 크기 우선


def test_group_albums_dedup_first_seen_order():
    tracks = [
        {"album_id": "a1", "album_title": "A1", "album_cover": "c1"},
        {"album_id": "a2", "album_title": "A2", "album_cover": "c2"},
        {"album_id": "a1", "album_title": "A1", "album_cover": "c1"},
        {"album_id": None, "album_title": "X", "album_cover": None},
    ]
    assert _group_albums(tracks) == [("a1", "A1", "c1"), ("a2", "A2", "c2")]


# ----- import_all 통합 (search → 섹션 + 트랙 upsert) -----


@respx.mock
async def test_import_all_search_saves_section_and_tracks(db_conn, cleanup):
    """search 소스 1개 → EMPSection 1개 + 앨범 아이템 dedup + 트랙 EMPSource(album:id)."""
    section_key = "search-year-2026-genre-test-emp"
    set_setting(db_conn, SOURCES_SETTING_KEY, "search-tracks/year:2026 genre:test-emp")
    # cleanup은 역순 실행 — 부모(Artist/Album/Track)를 먼저 등록
    cleanup('DELETE FROM "Artist" WHERE name IN (%s, %s)', ("SP Test A1", "SP Test A2"))
    cleanup(
        'DELETE FROM "Album" WHERE title IN (%s, %s)',
        ("SP Test Album 1", "SP Test Album 2"),
    )
    cleanup(
        'DELETE FROM "Track" WHERE isrc IN (%s, %s, %s)',
        ("TESTSP0000001", "TESTSP0000002", "TESTSP0000003"),
    )
    cleanup(
        'DELETE FROM "TrackPlatform" WHERE "platformTrackId" IN (%s, %s, %s)',
        ("sp_t1", "sp_t2", "sp_t3"),
    )
    cleanup(
        'DELETE FROM "EMPSource" WHERE source_id IN (%s, %s)',
        ("album:al_sp1", "album:al_sp2"),
    )
    cleanup(
        'DELETE FROM "EMPSection" WHERE platform = %s AND "sectionKey" = %s',
        ("spotify", section_key),
    )  # EMPSectionItem은 ON DELETE CASCADE
    cleanup('DELETE FROM "Setting" WHERE key = %s', (SOURCES_SETTING_KEY,))

    _mock_client_token()
    items = [
        _track("sp_t1", "Song 1", "TESTSP0000001", "al_sp1", "SP Test Album 1", "SP Test A1"),
        _track("sp_t2", "Song 2", "TESTSP0000002", "al_sp1", "SP Test Album 1", "SP Test A1"),
        _track("sp_t3", "Song 3", "TESTSP0000003", "al_sp2", "SP Test Album 2", "SP Test A2"),
    ]
    respx.get(SEARCH_URL).mock(
        return_value=httpx.Response(200, json={"tracks": {"items": items}})
    )

    importer = SpotifyEMPImporter(client_id="x", client_secret="y")
    summary = await importer.import_all(db_conn)

    assert summary["errors"] == []
    assert summary["playlists_processed"] == 1
    assert summary["tracks_new"] + summary["tracks_existing"] == 3

    with db_conn.cursor() as cur:
        cur.execute(
            'SELECT id, "displayTitle" FROM "EMPSection" '
            'WHERE platform = %s AND "sectionKey" = %s',
            ("spotify", section_key),
        )
        sec = cur.fetchone()
        assert sec is not None
        assert sec[1] == "2026 · Test-Emp"
        cur.execute(
            'SELECT "itemType", "itemId", title, "coverUrl" FROM "EMPSectionItem" '
            'WHERE "sectionId" = %s ORDER BY "displayOrder"',
            (sec[0],),
        )
        sec_items = cur.fetchall()
        # 앨범 dedup + 첫 등장 순
        assert [(r[0], r[1]) for r in sec_items] == [("album", "al_sp1"), ("album", "al_sp2")]
        assert sec_items[0][2] == "SP Test Album 1"
        assert sec_items[0][3] == "https://i.scdn.co/al_sp1/300"
        # 트랙 EMPSource — source_id가 album:{id} (emp_browse 모달 정합)
        cur.execute(
            'SELECT COUNT(*) FROM "EMPSource" '
            "WHERE platform = %s AND source_type = %s AND source_id = %s",
            ("spotify", "editorial_search", "album:al_sp1"),
        )
        assert cur.fetchone()[0] == 2


@respx.mock
async def test_import_all_search_zero_results_skips_section(db_conn):
    """검색 0건 → 빈 섹션 안 만들고 에러 기록만 (genre 필터 quirk 가시화)."""
    set_setting(db_conn, SOURCES_SETTING_KEY, "search-tracks/year:2026 genre:test-empty")
    _mock_client_token()
    respx.get(SEARCH_URL).mock(
        return_value=httpx.Response(200, json={"tracks": {"items": []}})
    )
    try:
        importer = SpotifyEMPImporter(client_id="x", client_secret="y")
        summary = await importer.import_all(db_conn)
    finally:
        set_setting(db_conn, SOURCES_SETTING_KEY, None)
    assert summary["playlists_processed"] == 0
    assert any("0 tracks" in e for e in summary["errors"])
    with db_conn.cursor() as cur:
        cur.execute(
            'SELECT COUNT(*) FROM "EMPSection" WHERE platform = %s AND "sectionKey" = %s',
            ("spotify", "search-year-2026-genre-test-empty"),
        )
        assert cur.fetchone()[0] == 0


# ----- playlist 소스 graceful skip -----


async def test_playlist_source_skips_without_admin_token(db_conn, monkeypatch):
    """ADMIN_EMAIL 없으면 playlist 소스만 에러 기록 후 skip — 예외 없음."""
    monkeypatch.delenv("ADMIN_EMAIL", raising=False)
    set_setting(db_conn, SOURCES_SETTING_KEY, "playlist/pl_test_123")
    try:
        importer = SpotifyEMPImporter(client_id="x", client_secret="y")
        summary = await importer.import_all(db_conn)
    finally:
        set_setting(db_conn, SOURCES_SETTING_KEY, None)
    assert summary["tracks_new"] == 0
    assert summary["playlists_processed"] == 0
    assert any("playlist/pl_test_123" in e for e in summary["errors"])


@respx.mock
async def test_playlist_source_403_recorded_and_continues(db_conn):
    """playlist fetch 403 → 해당 소스만 에러, 전체 중단 없음."""
    set_setting(db_conn, SOURCES_SETTING_KEY, "playlist/pl403")
    respx.get("https://api.spotify.com/v1/playlists/pl403/tracks").mock(
        return_value=httpx.Response(403)
    )
    try:
        importer = SpotifyEMPImporter(client_id="x", client_secret="y")
        with patch.object(
            SpotifyEMPImporter, "_get_admin_user_token", AsyncMock(return_value="user_tok")
        ):
            summary = await importer.import_all(db_conn)
    finally:
        set_setting(db_conn, SOURCES_SETTING_KEY, None)
    assert summary["tracks_new"] == 0
    assert summary["playlists_processed"] == 0
    assert any("pl403" in e and "403" in e for e in summary["errors"])
