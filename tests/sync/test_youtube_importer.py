"""YouTube Importer 테스트 — Data API mock 기반."""
from unittest.mock import AsyncMock

import pytest

from mrms.sync.youtube_importer import (
    ImportStats,
    YouTubeImporter,
    import_all,
    parse_track_metadata,
)


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
