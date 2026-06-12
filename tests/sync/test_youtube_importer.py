"""YouTube Importer 테스트 — Data API mock 기반."""
from unittest.mock import AsyncMock

import pytest

from mrms.sync.youtube_importer import (
    ImportStats,
    YouTubeImporter,
    _normalize,
    import_all,
    match_in_catalog,
    parse_track_metadata,
)


# ─── 텍스트 매칭 정규화/매칭 (DB 불필요) ──────────────────────────────


def test_normalize_lowercases_and_strips_parens():
    """lowercase + 괄호/대괄호 내용 제거 + 비영숫자 → 공백 정리."""
    assert _normalize("Daft Punk (feat. X) [Remastered]") == "daft punk"
    assert _normalize("  Hello,   World!  ") == "hello world"


def test_normalize_keeps_hangul():
    """한글 보존, 구분자(' - ' 등)는 공백."""
    assert _normalize("아이유 - 좋은 날") == "아이유 좋은 날"


def test_normalize_none_and_empty():
    assert _normalize(None) == ""
    assert _normalize("") == ""
    assert _normalize("()") == ""  # 괄호만 → 빈 문자열


def test_match_requires_both_artist_and_title():
    """title·artist 둘 다 정규화 일치만 매칭 — 한쪽만 일치는 거부(거짓매칭 방지)."""
    catalog = {"daft punk|get lucky": "TRK_REAL"}
    # 둘 다 일치(정규화 후) → trackId
    assert match_in_catalog(catalog, "Daft Punk", "Get Lucky (feat. Pharrell)") == "TRK_REAL"
    # title만 일치, artist 다름 → None
    assert match_in_catalog(catalog, "Wrong Artist", "Get Lucky") is None
    # artist만 일치, title 다름 → None
    assert match_in_catalog(catalog, "Daft Punk", "Around the World") is None
    # 둘 다 미스 → None
    assert match_in_catalog(catalog, "Nobody", "Nothing") is None


def test_match_rejects_empty_normalized_side():
    """정규화 결과가 한쪽이라도 비면 매칭 거부."""
    catalog = {"a|b": "T1"}
    assert match_in_catalog(catalog, "", "b") is None
    assert match_in_catalog(catalog, "a", "()") is None  # 괄호만 → 빈 title


def _resp(body: dict, status: int = 200):
    """httpx.Response 흉내 (mock helper)."""
    class _R:
        status_code = status

        def json(self):
            return body

        def raise_for_status(self):
            if not (200 <= status < 300):
                raise Exception(f"HTTP {status}")
    return _R()


def _make_importer(http_mock):
    return YouTubeImporter(http=http_mock, access_token="ACCESS_TEST")


def test_parse_artist_title_split_on_dash():
    """'Artist - Title' 형식 → 분리."""
    artist, title, thumb, vid = parse_track_metadata({
        "title": "Daft Punk - Get Lucky",
        "videoOwnerChannelTitle": "DaftPunkVEVO",
        "thumbnails": {"high": {"url": "https://i.ytimg.com/hi.jpg"}},
        "resourceId": {"videoId": "VID_1"},
    })
    assert artist == "Daft Punk"
    assert title == "Get Lucky"
    assert thumb == "https://i.ytimg.com/hi.jpg"
    assert vid == "VID_1"


def test_parse_uses_owner_channel_minus_topic_when_no_dash():
    """' - ' 없으면 artist = videoOwnerChannelTitle - ' - Topic'."""
    artist, title, _, _ = parse_track_metadata({
        "title": "Some Song",
        "videoOwnerChannelTitle": "Adele - Topic",
        "thumbnails": {},
    })
    assert artist == "Adele"
    assert title == "Some Song"


@pytest.mark.asyncio
async def test_fetch_my_playlists_paginates():
    http = AsyncMock()
    page1 = {
        "items": [
            {
                "id": "PL1",
                "snippet": {"title": "Mine 1", "thumbnails": {"high": {"url": "c1"}}},
                "contentDetails": {"itemCount": 3},
            }
        ],
        "nextPageToken": "TOK2",
    }
    page2 = {
        "items": [
            {
                "id": "PL2",
                "snippet": {"title": "Mine 2", "thumbnails": {}},
                "contentDetails": {"itemCount": 1},
            }
        ],
    }
    http.get = AsyncMock(side_effect=[_resp(page1), _resp(page2)])
    importer = _make_importer(http)
    pls = await importer.fetch_my_playlists()
    assert [p["id"] for p in pls] == ["PL1", "PL2"]
    assert pls[0]["name"] == "Mine 1"
    assert pls[0]["cover_url"] == "c1"


@pytest.mark.asyncio
async def test_fetch_playlist_tracks_filters_deleted_videos():
    http = AsyncMock()
    body = {
        "items": [
            {
                "snippet": {
                    "title": "Artist A - Song A",
                    "videoOwnerChannelTitle": "Artist A",
                    "resourceId": {"videoId": "V_A"},
                    "thumbnails": {"high": {"url": "ta"}},
                },
                "contentDetails": {},
            },
            {
                # 삭제된 영상 — resourceId.videoId 없음 → 필터
                "snippet": {"title": "Deleted video", "resourceId": {}},
                "contentDetails": {},
            },
        ],
    }
    http.get = AsyncMock(return_value=_resp(body))
    importer = _make_importer(http)
    tracks = await importer.fetch_playlist_tracks("PL1")
    assert len(tracks) == 1
    assert tracks[0]["video_id"] == "V_A"
    assert tracks[0]["artist"] == "Artist A"
    assert tracks[0]["title"] == "Song A"


@pytest.mark.asyncio
async def test_fetch_liked_uses_video_id_field():
    http = AsyncMock()
    body = {
        "items": [
            {
                "id": "LIKED_VID",
                "snippet": {
                    "title": "Liked Artist - Liked Song",
                    "channelTitle": "Liked Artist",
                    "thumbnails": {"high": {"url": "tl"}},
                },
                "contentDetails": {},
            }
        ],
    }
    http.get = AsyncMock(return_value=_resp(body))
    importer = _make_importer(http)
    tracks = await importer.fetch_liked()
    assert len(tracks) == 1
    assert tracks[0]["video_id"] == "LIKED_VID"
    assert tracks[0]["artist"] == "Liked Artist"
    assert tracks[0]["title"] == "Liked Song"


def test_import_stats_default_zero():
    s = ImportStats()
    assert s.tracks_imported == 0
    assert s.tracks_created == 0
    assert s.playlists_fetched == 0


@pytest.mark.asyncio
async def test_import_all_creates_tracks_and_is_idempotent(db_conn):
    """videoId로 Track/TrackPlatform 생성 → UserTrack 적재.
    재실행 시 중복 생성 안 됨(같은 videoId 재사용). 파싱/Topic 제거 검증.
    """
    from mrms.db.user_track import get_or_create_user

    user_id = get_or_create_user(db_conn, email="yt_import@example.com")

    vid_liked = "yt_test_vid_LIKED"
    vid_pl = "yt_test_vid_PL"

    def _build_http():
        http = AsyncMock()
        # 호출 순서: fetch_liked → fetch_my_playlists → fetch_playlist_tracks
        http.get = AsyncMock(side_effect=[
            # liked: 'Topic' 제거 케이스 (' - ' 없음)
            _resp({
                "items": [
                    {
                        "id": vid_liked,
                        "snippet": {
                            "title": "My Liked Song",
                            "channelTitle": "Some Artist - Topic",
                            "thumbnails": {"high": {"url": "liked_cover"}},
                        },
                        "contentDetails": {},
                    }
                ],
            }),
            # my playlists
            _resp({
                "items": [
                    {
                        "id": "PL_X",
                        "snippet": {"title": "My Playlist", "thumbnails": {}},
                        "contentDetails": {"itemCount": 1},
                    }
                ],
            }),
            # playlist items: 'Artist - Title' split 케이스
            _resp({
                "items": [
                    {
                        "snippet": {
                            "title": "Cool Artist - Cool Title",
                            "videoOwnerChannelTitle": "Cool Artist",
                            "resourceId": {"videoId": vid_pl},
                            "thumbnails": {"high": {"url": "pl_cover"}},
                        },
                        "contentDetails": {},
                    }
                ],
            }),
        ])
        return http

    try:
        # 1차 import
        stats = await import_all(db_conn, _build_http(), user_id, "ACCESS_TEST")
        assert stats.tracks_fetched == 2
        assert stats.tracks_imported == 2
        assert stats.tracks_created == 2
        assert stats.tracks_existing == 0
        assert stats.playlists_fetched == 1

        # TrackPlatform이 실제 videoId로 적재됐는지 (합성 ID 아님)
        with db_conn.cursor() as cur:
            cur.execute(
                '''SELECT "platformTrackId" FROM "TrackPlatform"
                   WHERE platform = 'youtube' AND "platformTrackId" = ANY(%s)''',
                ([vid_liked, vid_pl],),
            )
            found = {r[0] for r in cur.fetchall()}
        assert found == {vid_liked, vid_pl}

        # liked 트랙: ' - Topic' 제거되어 artist='Some Artist'
        with db_conn.cursor() as cur:
            cur.execute(
                '''SELECT t.title, a.name FROM "Track" t
                   JOIN "Artist" a ON a.id = t."artistId"
                   JOIN "TrackPlatform" tp ON tp."trackId" = t.id
                   WHERE tp.platform = 'youtube' AND tp."platformTrackId" = %s''',
                (vid_liked,),
            )
            row = cur.fetchone()
        assert row == ("My Liked Song", "Some Artist")

        # playlist 트랙: 'Cool Artist - Cool Title' 분리
        with db_conn.cursor() as cur:
            cur.execute(
                '''SELECT t.title, a.name FROM "Track" t
                   JOIN "Artist" a ON a.id = t."artistId"
                   JOIN "TrackPlatform" tp ON tp."trackId" = t.id
                   WHERE tp.platform = 'youtube' AND tp."platformTrackId" = %s''',
                (vid_pl,),
            )
            row = cur.fetchone()
        assert row == ("Cool Title", "Cool Artist")

        # UserTrack 적재 (liked=is_core, source='liked'; playlist source 'playlist:...')
        with db_conn.cursor() as cur:
            cur.execute(
                '''SELECT tp."platformTrackId", ut."isCore", ut.source, ut.platform
                   FROM "UserTrack" ut
                   JOIN "TrackPlatform" tp ON tp."trackId" = ut."trackId"
                   WHERE ut."userId" = %s AND tp.platform = 'youtube'
                     AND tp."platformTrackId" = ANY(%s)''',
                (user_id, [vid_liked, vid_pl]),
            )
            ut = {r[0]: (r[1], r[2], r[3]) for r in cur.fetchall()}
        assert ut[vid_liked][0] is True
        assert ut[vid_liked][1] == "liked"
        assert ut[vid_liked][2] == "youtube"
        assert ut[vid_pl][1].startswith("playlist:")

        # 커버(썸네일)가 TrackPlatform."previewUrl"에 적재됐는지 — 계약 'Track(+cover)'.
        with db_conn.cursor() as cur:
            cur.execute(
                '''SELECT "platformTrackId", "previewUrl" FROM "TrackPlatform"
                   WHERE platform = 'youtube' AND "platformTrackId" = ANY(%s)''',
                ([vid_liked, vid_pl],),
            )
            covers = {r[0]: r[1] for r in cur.fetchall()}
        assert covers[vid_liked] == "liked_cover"
        assert covers[vid_pl] == "pl_cover"

        # 2차 import — 같은 videoId → catalog 신규 0, 전부 기존 재사용
        stats2 = await import_all(db_conn, _build_http(), user_id, "ACCESS_TEST")
        assert stats2.tracks_created == 0
        assert stats2.tracks_existing == 2

        # Track row가 여전히 2개만 (중복 생성 없음)
        with db_conn.cursor() as cur:
            cur.execute(
                '''SELECT COUNT(DISTINCT "trackId") FROM "TrackPlatform"
                   WHERE platform = 'youtube' AND "platformTrackId" = ANY(%s)''',
                ([vid_liked, vid_pl],),
            )
            assert cur.fetchone()[0] == 2
    finally:
        # FK-safe cleanup — 자식(UserTrack, TrackPlatform) 먼저, 그다음 Track/Artist/User
        from mrms.db.ids import stable_id as _id
        track_ids = [_id(f"track|yt_{vid_liked}"), _id(f"track|yt_{vid_pl}")]
        with db_conn.cursor() as cur:
            cur.execute('DELETE FROM "UserTrack" WHERE "trackId" = ANY(%s)', (track_ids,))
            cur.execute('DELETE FROM "TrackPlatform" WHERE "trackId" = ANY(%s)', (track_ids,))
            cur.execute('DELETE FROM "Track" WHERE id = ANY(%s)', (track_ids,))
            cur.execute(
                'DELETE FROM "Artist" WHERE id IN (%s, %s)',
                (_id("artist|some artist"), _id("artist|cool artist")),
            )
            cur.execute('DELETE FROM "UserTrack" WHERE "userId" = %s', (user_id,))
            cur.execute('DELETE FROM "User" WHERE id = %s', (user_id,))
        db_conn.commit()


@pytest.mark.asyncio
async def test_import_all_include_liked_false_skips_liked(db_conn, monkeypatch):
    """include_liked=False면 fetch_liked 미호출 + liked 미적재 (플레이리스트만).

    선택적 import flow 계약: {playlist_ids:[...], include_liked:False}.
    fetch_liked가 호출되면 안 되고, liked source의 UserTrack도 없어야 한다.
    """
    from mrms.db.ids import stable_id as _id
    from mrms.db.user_track import get_or_create_user
    from mrms.sync import youtube_importer as yt_mod

    user_id = get_or_create_user(db_conn, email="yt_no_liked@example.com")
    vid_pl = "yt_no_liked_PL"

    http = AsyncMock()
    # 호출 순서(include_liked=False): fetch_my_playlists → fetch_playlist_tracks
    # (fetch_liked는 호출되지 않으므로 side_effect에 liked 응답 없음)
    http.get = AsyncMock(side_effect=[
        _resp({
            "items": [
                {
                    "id": "PL_ONLY",
                    "snippet": {"title": "Only PL", "thumbnails": {}},
                    "contentDetails": {"itemCount": 1},
                }
            ],
        }),
        _resp({
            "items": [
                {
                    "snippet": {
                        "title": "PL Artist - PL Song",
                        "videoOwnerChannelTitle": "PL Artist",
                        "resourceId": {"videoId": vid_pl},
                        "thumbnails": {"high": {"url": "plc"}},
                    },
                    "contentDetails": {},
                }
            ],
        }),
    ])

    # fetch_liked가 호출되면 즉시 실패시켜 미호출을 강제 검증.
    liked_calls = {"n": 0}
    orig_fetch_liked = yt_mod.YouTubeImporter.fetch_liked

    async def _spy_liked(self):  # pragma: no cover - 호출되면 안 됨
        liked_calls["n"] += 1
        return await orig_fetch_liked(self)

    monkeypatch.setattr(yt_mod.YouTubeImporter, "fetch_liked", _spy_liked)

    try:
        stats = await import_all(
            db_conn, http, user_id, "ACCESS_TEST",
            playlist_ids=["PL_ONLY"], include_liked=False,
        )
        assert liked_calls["n"] == 0, "include_liked=False인데 fetch_liked가 호출됨"
        # 플레이리스트 트랙 1개만 적재
        assert stats.tracks_fetched == 1
        assert stats.tracks_imported == 1
        assert stats.playlists_fetched == 1

        # liked source UserTrack이 없어야 함
        with db_conn.cursor() as cur:
            cur.execute(
                'SELECT COUNT(*) FROM "UserTrack" WHERE "userId" = %s AND source = %s',
                (user_id, "liked"),
            )
            assert cur.fetchone()[0] == 0
            # 플레이리스트 트랙은 적재됨
            cur.execute(
                'SELECT COUNT(*) FROM "UserTrack" WHERE "userId" = %s AND source LIKE %s',
                (user_id, "playlist:%"),
            )
            assert cur.fetchone()[0] == 1
    finally:
        track_id_pl = _id(f"track|yt_{vid_pl}")
        with db_conn.cursor() as cur:
            cur.execute('DELETE FROM "UserTrack" WHERE "userId" = %s', (user_id,))
            cur.execute('DELETE FROM "TrackPlatform" WHERE "trackId" = %s', (track_id_pl,))
            cur.execute('DELETE FROM "Track" WHERE id = %s', (track_id_pl,))
            cur.execute('DELETE FROM "Artist" WHERE id = %s', (_id("artist|pl artist"),))
            cur.execute('DELETE FROM "User" WHERE id = %s', (user_id,))
        db_conn.commit()


@pytest.mark.asyncio
async def test_import_all_playlist_failure_no_stats_db_divergence(db_conn, monkeypatch):
    """플레이리스트 배치 도중 예외가 나면 그 배치의 catalog Track·UserTrack·stats가
    모두 깨끗이 롤백된다 — 보고 수치와 실제 적재 상태가 어긋나지 않음 (blocker #1).

    플레이리스트 두 번째 트랙에서 upsert_user_track이 폭발 → 첫 번째 트랙이 이미
    삽입한 catalog Track/TrackPlatform이 UserTrack 링크 없이 살아남으면 divergence.
    """
    from mrms.db.ids import stable_id as _id
    from mrms.db.user_track import get_or_create_user

    user_id = get_or_create_user(db_conn, email="yt_partial@example.com")
    vid_liked = "yt_partial_LIKED"
    vid_ghost1 = "yt_partial_GHOST1"
    vid_ghost2 = "yt_partial_GHOST2"

    http = AsyncMock()
    http.get = AsyncMock(side_effect=[
        # fetch_liked → 성공 (별도 배치, 커밋됨)
        _resp({
            "items": [
                {
                    "id": vid_liked,
                    "snippet": {
                        "title": "Liked Only - Song",
                        "videoOwnerChannelTitle": "Liked Only",
                        "thumbnails": {"high": {"url": "lc"}},
                    },
                    "contentDetails": {},
                }
            ],
        }),
        # fetch_my_playlists
        _resp({
            "items": [
                {"id": "PL_FAIL", "snippet": {"title": "Will Fail", "thumbnails": {}}, "contentDetails": {}},
            ],
        }),
        # fetch_playlist_tracks(PL_FAIL) → 트랙 2개 (둘째에서 upsert가 폭발)
        _resp({
            "items": [
                {
                    "snippet": {
                        "title": "Ghost One - T1",
                        "videoOwnerChannelTitle": "Ghost One",
                        "resourceId": {"videoId": vid_ghost1},
                        "thumbnails": {"high": {"url": "g1"}},
                    },
                    "contentDetails": {},
                },
                {
                    "snippet": {
                        "title": "Ghost Two - T2",
                        "videoOwnerChannelTitle": "Ghost Two",
                        "resourceId": {"videoId": vid_ghost2},
                        "thumbnails": {"high": {"url": "g2"}},
                    },
                    "contentDetails": {},
                },
            ],
        }),
    ])

    # upsert_user_track: ghost1은 통과, ghost2 호출에서 폭발 — 배치 도중 실패 재현.
    track_id_liked = _id(f"track|yt_{vid_liked}")
    track_id_ghost1 = _id(f"track|yt_{vid_ghost1}")
    track_id_ghost2 = _id(f"track|yt_{vid_ghost2}")

    from mrms.db import user_track as ut_mod
    orig = ut_mod.upsert_user_track

    def _boom(conn, uid, tid, **kw):
        if tid == track_id_ghost2:
            raise RuntimeError("boom mid-playlist")
        return orig(conn, uid, tid, **kw)

    monkeypatch.setattr(ut_mod, "upsert_user_track", _boom)

    try:
        stats = await import_all(db_conn, http, user_id, "ACCESS_TEST")

        # 좋아요 배치만 커밋됨 → imported는 1, ghost 배치는 통째로 폐기
        assert stats.tracks_imported == 1
        assert stats.tracks_created == 1
        # 실패한 플레이리스트 배치의 fetched 델타는 stats에 반영 안 됨
        assert stats.tracks_fetched == 1

        with db_conn.cursor() as cur:
            # 좋아요 트랙 + 링크는 보존
            cur.execute('SELECT 1 FROM "Track" WHERE id = %s', (track_id_liked,))
            assert cur.fetchone() is not None
            cur.execute(
                'SELECT 1 FROM "UserTrack" WHERE "userId" = %s AND "trackId" = %s',
                (user_id, track_id_liked),
            )
            assert cur.fetchone() is not None

            # ghost1: UserTrack 링크 없이 catalog Track/TrackPlatform이 살아남지 않아야 함
            cur.execute('SELECT 1 FROM "Track" WHERE id = %s', (track_id_ghost1,))
            assert cur.fetchone() is None, "ghost catalog Track이 롤백 안 됨 (divergence)"
            cur.execute(
                '''SELECT 1 FROM "TrackPlatform"
                   WHERE platform = 'youtube' AND "platformTrackId" = %s''',
                (vid_ghost1,),
            )
            assert cur.fetchone() is None
            cur.execute(
                'SELECT 1 FROM "UserTrack" WHERE "userId" = %s AND "trackId" = %s',
                (user_id, track_id_ghost1),
            )
            assert cur.fetchone() is None
    finally:
        with db_conn.cursor() as cur:
            cur.execute('DELETE FROM "UserTrack" WHERE "userId" = %s', (user_id,))
            cur.execute(
                'DELETE FROM "TrackPlatform" WHERE "trackId" = ANY(%s)',
                ([track_id_liked, track_id_ghost1, track_id_ghost2],),
            )
            cur.execute(
                'DELETE FROM "Track" WHERE id = ANY(%s)',
                ([track_id_liked, track_id_ghost1, track_id_ghost2],),
            )
            cur.execute(
                'DELETE FROM "Artist" WHERE id IN (%s, %s, %s)',
                (
                    _id("artist|liked only"),
                    _id("artist|ghost one"),
                    _id("artist|ghost two"),
                ),
            )
            cur.execute('DELETE FROM "User" WHERE id = %s', (user_id,))
        db_conn.commit()


@pytest.mark.asyncio
async def test_import_all_matches_embedding_catalog_then_attaches_youtube(db_conn):
    """매칭곡 → 기존 임베딩 trackId에 UserTrack + youtube TrackPlatform 추가
    (새 Track 미생성). 미스곡 → 새 videoId Track. stats.tracks_matched 검증.

    seed: 임베딩 보유 catalog 트랙 1개(artist='Match Artist', title='Match Song')를
    CATALOG_MODEL_VERSION으로 만든다. YouTube liked가 'Match Artist - Match Song
    (Live)'로 들어오면 정규화 매칭되어 그 임베딩 trackId에 붙어야 한다.
    플레이리스트의 'No Match Artist - No Match Song'은 카탈로그에 없어 새 Track.
    """
    from mrms.db.ids import stable_id as _id
    from mrms.db.user_track import get_or_create_user
    from mrms.sync.youtube_importer import CATALOG_MODEL_VERSION

    user_id = get_or_create_user(db_conn, email="yt_match@example.com")

    # ── seed: 임베딩 보유 catalog 트랙 ───────────────────────────────
    cat_artist_id = _id("artist|match artist seed")
    cat_track_id = _id("track|yt_match_seed_isrc")
    cat_isrc = "YT_MATCH_SEED_ISRC"
    emb = "[" + ",".join(["0.01"] * 256) + "]"
    with db_conn.cursor() as cur:
        cur.execute(
            '''INSERT INTO "Artist" (id, name, "nameNormalized")
               VALUES (%s, %s, %s) ON CONFLICT (id) DO NOTHING''',
            (cat_artist_id, "Match Artist", "match artist"),
        )
        cur.execute(
            '''INSERT INTO "Track"
                 (id, isrc, title, "titleNormalized", "durationMs", "artistId")
               VALUES (%s, %s, %s, %s, %s, %s) ON CONFLICT (id) DO NOTHING''',
            (cat_track_id, cat_isrc, "Match Song", "match song", 1000, cat_artist_id),
        )
        cur.execute(
            '''INSERT INTO "TrackEmbedding"
                 (id, "trackId", "modelVersion", embedding, pooling, "audioSource")
               VALUES (%s, %s, %s, %s::vector, 'mean', 'mp3_30s')
               ON CONFLICT ("trackId", "modelVersion") DO NOTHING''',
            (_id(f"emb|{cat_track_id}"), cat_track_id, CATALOG_MODEL_VERSION, emb),
        )
    db_conn.commit()

    vid_match = "yt_match_VID"
    vid_miss = "yt_miss_VID"
    miss_track_id = _id(f"track|yt_{vid_miss}")

    http = AsyncMock()
    # liked → 매칭곡, my playlists → 1개, playlist tracks → 미스곡
    http.get = AsyncMock(side_effect=[
        _resp({
            "items": [
                {
                    "id": vid_match,
                    "snippet": {
                        # 괄호/대소문자 차이가 있어도 정규화 후 'match artist|match song'
                        "title": "MATCH ARTIST - Match Song (Live)",
                        "videoOwnerChannelTitle": "Match Artist",
                        "thumbnails": {"high": {"url": "match_cover"}},
                    },
                    "contentDetails": {},
                }
            ],
        }),
        _resp({
            "items": [
                {"id": "PL_M", "snippet": {"title": "My PL", "thumbnails": {}},
                 "contentDetails": {"itemCount": 1}},
            ],
        }),
        _resp({
            "items": [
                {
                    "snippet": {
                        "title": "No Match Artist - No Match Song",
                        "videoOwnerChannelTitle": "No Match Artist",
                        "resourceId": {"videoId": vid_miss},
                        "thumbnails": {"high": {"url": "miss_cover"}},
                    },
                    "contentDetails": {},
                }
            ],
        }),
    ])

    try:
        stats = await import_all(db_conn, http, user_id, "ACCESS_TEST")

        # stats: 매칭 1, 미스(신규 Track) 1
        assert stats.tracks_matched == 1
        assert stats.tracks_created == 1
        assert stats.tracks_imported == 2

        # 매칭곡: 새 Track이 생기지 않았어야 함 — videoId 기반 합성 trackId 부재
        synthetic_match_id = _id(f"track|yt_{vid_match}")
        with db_conn.cursor() as cur:
            cur.execute('SELECT 1 FROM "Track" WHERE id = %s', (synthetic_match_id,))
            assert cur.fetchone() is None, "매칭곡이 새 Track을 생성함"

            # UserTrack이 임베딩 catalog trackId에 연결됐는지
            cur.execute(
                '''SELECT "isCore", source, platform FROM "UserTrack"
                   WHERE "userId" = %s AND "trackId" = %s''',
                (user_id, cat_track_id),
            )
            row = cur.fetchone()
        assert row is not None, "매칭곡 UserTrack이 임베딩 trackId에 연결 안 됨"
        assert row[0] is True  # liked → is_core
        assert row[1] == "liked"
        assert row[2] == "youtube"

        # 임베딩 trackId에 youtube TrackPlatform(videoId) 매핑이 추가됐는지
        with db_conn.cursor() as cur:
            cur.execute(
                '''SELECT "platformTrackId" FROM "TrackPlatform"
                   WHERE "trackId" = %s AND platform = 'youtube' ''',
                (cat_track_id,),
            )
            tp = cur.fetchone()
        assert tp is not None and tp[0] == vid_match

        # 매칭으로 임베딩 보유 UserTrack이 잡히는지 (onboarding step2 게이트와 동일 조건)
        with db_conn.cursor() as cur:
            cur.execute(
                '''SELECT COUNT(*) FROM "UserTrack" ut
                   JOIN "TrackEmbedding" e ON e."trackId" = ut."trackId"
                   WHERE ut."userId" = %s AND e."modelVersion" = %s''',
                (user_id, CATALOG_MODEL_VERSION),
            )
            assert cur.fetchone()[0] == 1

        # 미스곡: 새 videoId Track 생성 + youtube TrackPlatform
        with db_conn.cursor() as cur:
            cur.execute('SELECT 1 FROM "Track" WHERE id = %s', (miss_track_id,))
            assert cur.fetchone() is not None, "미스곡이 새 Track을 만들지 않음"
            cur.execute(
                '''SELECT 1 FROM "TrackPlatform"
                   WHERE platform = 'youtube' AND "platformTrackId" = %s''',
                (vid_miss,),
            )
            assert cur.fetchone() is not None
    finally:
        with db_conn.cursor() as cur:
            cur.execute('DELETE FROM "UserTrack" WHERE "userId" = %s', (user_id,))
            # 매칭 트랙에 붙은 youtube TP + 미스 트랙 자식들 정리
            cur.execute(
                'DELETE FROM "TrackPlatform" WHERE "trackId" = ANY(%s)',
                ([cat_track_id, miss_track_id],),
            )
            cur.execute('DELETE FROM "TrackEmbedding" WHERE "trackId" = %s', (cat_track_id,))
            cur.execute(
                'DELETE FROM "Track" WHERE id = ANY(%s)',
                ([cat_track_id, miss_track_id],),
            )
            cur.execute(
                'DELETE FROM "Artist" WHERE id IN (%s, %s)',
                (cat_artist_id, _id("artist|no match artist")),
            )
            cur.execute('DELETE FROM "User" WHERE id = %s', (user_id,))
        db_conn.commit()
