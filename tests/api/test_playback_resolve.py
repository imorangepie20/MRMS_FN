"""재생 시점 트랙 해결 endpoint 테스트 — 외부 API는 respx로 모킹.

youtube는 httpx가 아닌 ytmusicapi(sync)라 _get_ytmusic을 mock으로 대체."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest
import respx
from fastapi.testclient import TestClient
from httpx import Response

from mrms.api.main import app
from mrms.db.ids import stable_id
from mrms.db.user_track import upsert_oauth

client = TestClient(app)

SPOTIFY_SEARCH = "https://api.spotify.com/v1/search"
TIDAL_V2_TRACKS = "https://openapi.tidal.com/v2/tracks"
TIDAL_V1_SEARCH = "https://api.tidal.com/v1/search/tracks"


def _fake_isrc() -> str:
    """12자 영숫자 — 진짜 ISRC 형식 (per-test 고유)."""
    return f"TEST{uuid.uuid4().hex[:8].upper()}"


@pytest.fixture
def auth_user(login, db_conn, cleanup):
    """user + session cookie + 양 플랫폼 UserOAuth (유효 토큰, refresh 불필요)."""
    user_id, session_id = login()
    client.cookies.set("mrms_session", session_id)
    expires = datetime.now(timezone.utc) + timedelta(hours=1)
    for platform in ("spotify", "tidal"):
        upsert_oauth(
            db_conn, user_id, platform,
            access_token=f"{platform.upper()}_TOKEN",
            refresh_token="REFRESH",
            expires_at=expires,
            scopes=[],
        )
    db_conn.commit()
    cleanup('DELETE FROM "UserOAuth" WHERE "userId" = %s', (user_id,))
    yield user_id
    client.cookies.clear()


@pytest.fixture
def make_track(db_conn, cleanup):
    """Artist + Track 생성 factory. track_id 반환.

    isrc 생략 시 EMP 합성 키 형식 → ISRC 검색 생략 경로 검증용.
    """
    def _make(
        *,
        isrc: str | None = None,
        title: str = "the cure",
        artist: str = "Olivia Rodrigo",
        duration_ms: int = 200000,
    ) -> str:
        isrc = isrc or f"emp_test_{uuid.uuid4().hex[:8]}"
        artist_id = stable_id(f"artist|{artist.lower().strip()}")
        track_id = stable_id(f"track|{isrc}")
        # 역순 실행: TrackPlatform → Track → Artist (FK 순서)
        cleanup('DELETE FROM "Artist" WHERE id = %s', (artist_id,))
        cleanup('DELETE FROM "Track" WHERE id = %s', (track_id,))
        cleanup('DELETE FROM "TrackPlatform" WHERE "trackId" = %s', (track_id,))
        with db_conn.cursor() as cur:
            cur.execute(
                '''INSERT INTO "Artist" (id, name, "nameNormalized")
                   VALUES (%s, %s, %s) ON CONFLICT (id) DO NOTHING''',
                (artist_id, artist, artist.lower().strip()),
            )
            cur.execute(
                '''INSERT INTO "Track"
                     (id, isrc, title, "titleNormalized", "durationMs", "artistId")
                   VALUES (%s, %s, %s, %s, %s, %s) ON CONFLICT (id) DO NOTHING''',
                (track_id, isrc, title, title.lower().strip(), duration_ms, artist_id),
            )
        db_conn.commit()
        return track_id

    return _make


def _resolve(track_id: str, platform: str):
    return client.get(
        f"/api/playback/resolve/{track_id}", params={"platform": platform}
    )


# ───────────────────────── Spotify ─────────────────────────

@respx.mock
def test_spotify_isrc_match_then_upsert_persists(db_conn, auth_user, make_track):
    """ISRC 검색 매칭 + TrackPlatform 영속 — 두 번째 요청은 외부 호출 없음."""
    isrc = _fake_isrc()
    track_id = make_track(isrc=isrc)
    route = respx.get(SPOTIFY_SEARCH).mock(return_value=Response(200, json={
        "tracks": {"items": [{
            "id": "sp_111",
            "name": "the cure",
            "artists": [{"name": "Olivia Rodrigo"}],
            "external_ids": {"isrc": isrc},
            "duration_ms": 200000,
        }]}
    }))

    r = _resolve(track_id, "spotify")
    assert r.status_code == 200
    assert r.json() == {"platform_track_id": "sp_111"}
    assert route.call_count == 1
    assert "isrc:" in route.calls[0].request.url.params["q"]

    # DB 영속 확인
    with db_conn.cursor() as cur:
        cur.execute(
            'SELECT "platformTrackId" FROM "TrackPlatform" '
            'WHERE "trackId" = %s AND platform = %s',
            (track_id, "spotify"),
        )
        assert cur.fetchone() == ("sp_111",)

    # 같은 요청 재시도 — 외부 호출 없이 응답
    r2 = _resolve(track_id, "spotify")
    assert r2.status_code == 200
    assert r2.json() == {"platform_track_id": "sp_111"}
    assert route.call_count == 1


@respx.mock
def test_spotify_text_fallback_match(auth_user, make_track):
    """합성 ISRC → ISRC 검색 생략, 텍스트 검색에서 title+artist 매칭."""
    track_id = make_track(duration_ms=180000)  # isrc 생략 → emp_test_* 합성 키

    def responder(request):
        q = request.url.params["q"]
        assert not q.startswith("isrc:")  # ISRC 검색 경로 안 탐
        return Response(200, json={"tracks": {"items": [
            {  # 제목은 맞지만 아티스트 불일치 → 탈락
                "id": "sp_wrong",
                "name": "the cure",
                "artists": [{"name": "Someone Else"}],
                "duration_ms": 180000,
            },
            {  # title/artist 일치 + duration ±5초 → 선택
                "id": "sp_right",
                "name": "The Cure",
                "artists": [{"name": "Olivia Rodrigo"}],
                "duration_ms": 181000,
            },
        ]}})

    respx.get(SPOTIFY_SEARCH).mock(side_effect=responder)

    r = _resolve(track_id, "spotify")
    assert r.status_code == 200
    assert r.json() == {"platform_track_id": "sp_right"}


@respx.mock
def test_spotify_no_match_404(db_conn, auth_user, make_track):
    """그럴듯한 후보 없으면 404 — TrackPlatform도 안 생김 (엉뚱한 곡 방지)."""
    track_id = make_track(title="Obscure Song", artist="Nobody Band")
    respx.get(SPOTIFY_SEARCH).mock(return_value=Response(200, json={
        "tracks": {"items": [{
            "id": "sp_x",
            "name": "Totally Different",
            "artists": [{"name": "Other Artist"}],
            "duration_ms": 100000,
        }]}
    }))

    r = _resolve(track_id, "spotify")
    assert r.status_code == 404
    assert r.json()["detail"] == "no match"

    with db_conn.cursor() as cur:
        cur.execute(
            'SELECT 1 FROM "TrackPlatform" WHERE "trackId" = %s AND platform = %s',
            (track_id, "spotify"),
        )
        assert cur.fetchone() is None


@respx.mock
def test_existing_trackplatform_returns_without_external_call(
    db_conn, auth_user, make_track
):
    """이미 매핑 있으면 외부 호출 없이 그대로 반환 (respx route 미등록 — 호출 시 에러)."""
    track_id = make_track()
    with db_conn.cursor() as cur:
        cur.execute(
            '''INSERT INTO "TrackPlatform" (id, "trackId", platform, "platformTrackId")
               VALUES (%s, %s, %s, %s)''',
            (stable_id("tp|spotify|pre_1"), track_id, "spotify", "pre_1"),
        )
    db_conn.commit()

    r = _resolve(track_id, "spotify")
    assert r.status_code == 200
    assert r.json() == {"platform_track_id": "pre_1"}


# ───────────────────────── Tidal ─────────────────────────

@respx.mock
def test_tidal_isrc_match(db_conn, auth_user, make_track):
    """openapi v2 ISRC 필터 매칭 → TrackPlatform upsert."""
    isrc = _fake_isrc()
    track_id = make_track(isrc=isrc)
    route = respx.get(TIDAL_V2_TRACKS).mock(return_value=Response(200, json={
        "data": [{
            "id": "42424242",
            "type": "tracks",
            "attributes": {"title": "the cure", "isrc": isrc},
        }]
    }))

    r = _resolve(track_id, "tidal")
    assert r.status_code == 200
    assert r.json() == {"platform_track_id": "42424242"}
    assert route.call_count == 1
    assert route.calls[0].request.url.params["filter[isrc]"] == isrc

    with db_conn.cursor() as cur:
        cur.execute(
            'SELECT "platformTrackId" FROM "TrackPlatform" '
            'WHERE "trackId" = %s AND platform = %s',
            (track_id, "tidal"),
        )
        assert cur.fetchone() == ("42424242",)


@respx.mock
def test_tidal_text_fallback_match(auth_user, make_track):
    """합성 ISRC → v1 텍스트 검색만. duration 가산점으로 정답 선택."""
    track_id = make_track(duration_ms=200000)
    respx.get(TIDAL_V1_SEARCH).mock(return_value=Response(200, json={
        "items": [
            {  # 제목 포함 매칭이지만 아티스트 불일치 → 탈락
                "id": 91,
                "title": "The Cure (Live)",
                "artists": [{"name": "Cure Tribute"}],
                "duration": 200,
            },
            {
                "id": 90,
                "title": "the cure",
                "artists": [{"name": "Olivia Rodrigo"}],
                "duration": 200,
            },
        ]
    }))

    r = _resolve(track_id, "tidal")
    assert r.status_code == 200
    assert r.json() == {"platform_track_id": "90"}


@respx.mock
def test_tidal_isrc_miss_falls_back_to_text(auth_user, make_track):
    """진짜 ISRC인데 v2 필터 결과 없음 → v1 텍스트 검색으로 폴백."""
    isrc = _fake_isrc()
    track_id = make_track(isrc=isrc)
    respx.get(TIDAL_V2_TRACKS).mock(return_value=Response(200, json={"data": []}))
    respx.get(TIDAL_V1_SEARCH).mock(return_value=Response(200, json={
        "items": [{
            "id": 77,
            "title": "the cure",
            "artists": [{"name": "Olivia Rodrigo"}],
            "duration": 200,
        }]
    }))

    r = _resolve(track_id, "tidal")
    assert r.status_code == 200
    assert r.json() == {"platform_track_id": "77"}


# ───────────────────────── YouTube ─────────────────────────
# 유저 OAuth 불필요 — login + 세션 쿠키만. 검색은 _get_ytmusic mock으로 대체.
# 주의: cleanup은 역순 실행 — 자식(TrackPlatform) 삭제가 부모(Track)보다
# 먼저 돌도록 부모를 먼저 등록 (make_track이 그 순서로 등록함).
# artist는 테스트 전용 이름 사용 — make_track 기본값(Olivia Rodrigo)은 dev DB의
# 실존 Artist라 teardown의 Artist DELETE가 항상 FK 실패함 (사전 존재 이슈).


@pytest.fixture
def yt_user(login):
    """user + 세션 쿠키만 (플랫폼 OAuth 없음 — youtube는 불필요)."""
    user_id, session_id = login()
    client.cookies.set("mrms_session", session_id)
    yield user_id
    client.cookies.clear()


def _yt_si(vid, title, channel="", desc=""):
    """Data API search.items 형태."""
    return {
        "id": {"videoId": vid},
        "snippet": {"title": title, "channelTitle": channel, "description": desc},
    }


def _yt_vi(vid, *, embeddable=True, duration="PT3M21S"):
    """Data API videos.items 형태 (status.embeddable + contentDetails.duration)."""
    return {
        "id": vid,
        "status": {"embeddable": embeddable},
        "contentDetails": {"duration": duration},
    }


def _patch_yt_dataapi(search_items, video_items):
    """_get_json(search→videos)을 Data API 응답으로 고정 대체."""
    from mrms.api import playback_resolve as pr

    async def fake(http, url, *, params, headers, what):
        return {"items": search_items if url == pr.YOUTUBE_SEARCH_URL else video_items}

    return patch("mrms.api.playback_resolve._get_json", new=fake)


def test_youtube_text_match_then_upsert(db_conn, yt_user, make_track, monkeypatch):
    """제목+아티스트+길이 스코어링 → best embeddable videoId 반환 + TrackPlatform 영속."""
    monkeypatch.setenv("YOUTUBE_DATA_API_KEY", "test-key")
    track_id = make_track(
        title="yt resolve song a", artist="YT Resolve Artist A", duration_ms=200000
    )
    search = [
        # 제목만 맞고 아티스트/길이 불일치 → 35점 < 45 탈락
        _yt_si("ytWRONG0001", "yt resolve song a", channel="Someone Else"),
        # 제목+아티스트(채널)+길이+공식 → 선택
        _yt_si("ytRIGHT0001", "YT Resolve Song A", channel="YT Resolve Artist A"),
    ]
    videos = [
        _yt_vi("ytWRONG0001", duration="PT5M00S"),  # 300s — 길이 가산점 없음
        _yt_vi("ytRIGHT0001", duration="PT3M21S"),  # 201s ≈ 200s → +20
    ]
    with _patch_yt_dataapi(search, videos):
        r = _resolve(track_id, "youtube")

    assert r.status_code == 200
    assert r.json() == {"platform_track_id": "ytRIGHT0001"}

    with db_conn.cursor() as cur:
        cur.execute(
            'SELECT "platformTrackId" FROM "TrackPlatform" '
            'WHERE "trackId" = %s AND platform = %s',
            (track_id, "youtube"),
        )
        assert cur.fetchone() == ("ytRIGHT0001",)


def test_youtube_no_match_404(db_conn, yt_user, make_track, monkeypatch):
    """매칭 후보 없거나 embed 불가뿐이면 404 — TrackPlatform도 안 생김."""
    monkeypatch.setenv("YOUTUBE_DATA_API_KEY", "test-key")
    track_id = make_track(title="YT Obscure Song", artist="YT Nobody Band")
    search = [
        # 제목/아티스트는 맞지만 embed 불가 → 후보에서 탈락
        _yt_si("ytNOEMB0001", "YT Obscure Song", channel="YT Nobody Band"),
        # embed 가능하나 전혀 다른 곡 → 스코어 미달
        _yt_si("ytX00000001", "Totally Different", channel="Other Artist"),
    ]
    videos = [
        _yt_vi("ytNOEMB0001", embeddable=False),
        _yt_vi("ytX00000001", embeddable=True),
    ]
    with _patch_yt_dataapi(search, videos):
        r = _resolve(track_id, "youtube")

    assert r.status_code == 404
    assert r.json()["detail"] == "no match"

    with db_conn.cursor() as cur:
        cur.execute(
            'SELECT 1 FROM "TrackPlatform" WHERE "trackId" = %s AND platform = %s',
            (track_id, "youtube"),
        )
        assert cur.fetchone() is None


def test_youtube_synthetic_mapping_ignored_and_replaced(
    db_conn, yt_user, make_track, monkeypatch
):
    """합성('yt_…') 매핑은 없는 것으로 취급 — 재검색해서 real로 교체,
    합성 ID는 절대 반환되지 않음."""
    monkeypatch.setenv("YOUTUBE_DATA_API_KEY", "test-key")
    track_id = make_track(
        title="yt resolve song b", artist="YT Resolve Artist B", duration_ms=200000
    )
    synthetic = f"yt_{'a' * 16}"
    with db_conn.cursor() as cur:
        cur.execute(
            '''INSERT INTO "TrackPlatform" (id, "trackId", platform, "platformTrackId")
               VALUES (%s, %s, %s, %s)''',
            (stable_id(f"tp|youtube|{synthetic}|{track_id}"), track_id, "youtube", synthetic),
        )
    db_conn.commit()

    with _patch_yt_dataapi(
        [_yt_si("ytREAL00001", "yt resolve song b", channel="YT Resolve Artist B")],
        [_yt_vi("ytREAL00001", duration="PT3M20S")],
    ):
        r = _resolve(track_id, "youtube")

    assert r.status_code == 200
    assert r.json() == {"platform_track_id": "ytREAL00001"}

    # 합성 매핑이 real로 교체됨 (행 1개 유지 — (trackId, platform) unique)
    with db_conn.cursor() as cur:
        cur.execute(
            'SELECT "platformTrackId" FROM "TrackPlatform" '
            'WHERE "trackId" = %s AND platform = %s',
            (track_id, "youtube"),
        )
        assert cur.fetchall() == [("ytREAL00001",)]


def test_youtube_existing_real_mapping_skips_search(db_conn, yt_user, make_track):
    """real 매핑이 이미 있으면 검색 없이 바로 반환 (_get_ytmusic 미호출)."""
    track_id = make_track(title="yt resolve song c", artist="YT Resolve Artist C")
    with db_conn.cursor() as cur:
        cur.execute(
            '''INSERT INTO "TrackPlatform" (id, "trackId", platform, "platformTrackId")
               VALUES (%s, %s, %s, %s)''',
            (stable_id("tp|youtube|ytPRE000001"), track_id, "youtube", "ytPRE000001"),
        )
    db_conn.commit()

    with patch("mrms.api.playback_resolve._resolve_youtube") as resolve_yt:
        r = _resolve(track_id, "youtube")

    assert r.status_code == 200
    assert r.json() == {"platform_track_id": "ytPRE000001"}
    resolve_yt.assert_not_called()


# ───────────────────────── 에러 경로 ─────────────────────────

@respx.mock
def test_external_api_error_502(auth_user, make_track):
    """외부 API 5xx → 502 + 명확한 메시지."""
    track_id = make_track()
    respx.get(SPOTIFY_SEARCH).mock(return_value=Response(500, text="boom"))

    r = _resolve(track_id, "spotify")
    assert r.status_code == 502
    assert "spotify" in r.json()["detail"].lower()


def test_unknown_track_404(auth_user):
    r = _resolve("no_such_track", "spotify")
    assert r.status_code == 404
    assert r.json()["detail"] == "track not found"


def test_unauthenticated_401():
    client.cookies.clear()
    r = _resolve("whatever", "spotify")
    assert r.status_code == 401


def test_invalid_platform_422(auth_user, make_track):
    track_id = make_track()
    r = _resolve(track_id, "apple")
    assert r.status_code == 422
